import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD } from './pdf-cloud-stage.mjs';
import { RELEASE, audit } from './pdf-v2-readiness.mjs';
import { preflight, checkStaged, verifyPromoted, main } from './pdf-worker-auto-release.mjs';

const SHA='a'.repeat(40), OLD='teacher-pdf-worker-00020-fiv', NEW='teacher-pdf-worker-00021-abc';
const OLD_DIGEST='sha256:'+'a'.repeat(64), NEW_DIGEST='sha256:'+'b'.repeat(64);
const queue={name:'projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue',
  state:'RUNNING',rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1},
  retryConfig:{maxAttempts:5,maxRetryDuration:'3600s',minBackoff:'10s',maxBackoff:'300s'}};

function fixture(name,rev,digest,withCanary=false) {
  const worker=name===CLOUD.worker;
  const service={metadata:{name,generation:1,annotations:worker?{}:{'run.googleapis.com/invoker-iam-disabled':'true'}},
    spec:{template:{metadata:{annotations:{'autoscaling.knative.dev/maxScale':'1'}}}},
    status:{observedGeneration:1,conditions:[{type:'Ready',status:'True'}],traffic:[
      {revisionName:rev,percent:100},...(withCanary?[{revisionName:NEW,tag:'pdf-ci',percent:0,url:'https://pdf-ci---teacher-pdf-worker-abc-uc.a.run.app'}]:[])]}};
  const env=worker?{PDF_CHUNKED_JOBS_ENABLED:'true',PDF_PROCESSING_ENABLED:'true',
    PDF_WORKER_IAM_READY:'true',PDF_PRINT_FALLBACK_ENABLED:'true',PDF_TEMP_ROOT:'/tmp/pdf-worker'}:
    {PDF_CHUNKED_JOBS_ENABLED:'true',PDF_GATEWAY_ENABLED:'true',PDF_LONG_PRINT_TASKS_ENABLED:'true',
      PDF_GATEWAY_WORKER_URL:CLOUD.workerURL};
  const revision={metadata:{name:rev},status:{conditions:[{type:'Ready',status:'True'}],
    imageDigest:CLOUD.registry+'/'+name+'@'+digest},
    spec:{serviceAccountName:worker?CLOUD.workerSA:CLOUD.gatewaySA,timeoutSeconds:180,
      containerConcurrency:worker?1:10,
      containers:[{image:CLOUD.registry+'/'+name+'@'+digest,
        resources:{limits:{cpu:'1',memory:worker?'2Gi':'256Mi'}},
        env:[...Object.entries(env).map(([name,value])=>({name,value})),...(!worker?
          [{name:'PDF_GATEWAY_HMAC_KEY',valueFrom:{secretKeyRef:{name:'existing',key:'1'}}}]:[])],
        volumeMounts:worker?[{name:'scratch',mountPath:'/tmp/pdf-worker'}]:[]}],
      volumes:worker?[{name:'scratch',emptyDir:{medium:'Memory',sizeLimit:'384Mi'}}]:[]}};
  const policy={bindings:worker?
    [{role:'roles/run.invoker',members:['serviceAccount:teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com']}]:[]};
  return {service,revision,policy};
}
function cloud({active=OLD,tag=true,mutate}={}) {
  const work=fixture(CLOUD.worker,active,active===OLD?OLD_DIGEST:NEW_DIGEST,tag);
  const candidate=fixture(CLOUD.worker,NEW,NEW_DIGEST,false).revision;
  const gw=fixture(CLOUD.gateway,RELEASE.gateway.revision,RELEASE.gateway.digest);
  mutate?.(work,candidate,gw);
  let count=0;
  const run=(command,args)=>{
    assert.equal(command,'gcloud');count++;
    if(args[0]==='tasks')return JSON.stringify(queue);
    if(args[0]!=='run')throw Error('Unexpected command');
    const isWorker=args.includes(CLOUD.worker) || args.some(x=>String(x).startsWith('teacher-pdf-worker-'));
    const source=isWorker?work:gw;
    if(args[1]==='services' && args[2]==='describe')return JSON.stringify(source.service);
    if(args[1]==='services' && args[2]==='get-iam-policy')return JSON.stringify(source.policy);
    if(args[1]==='revisions' && args[2]==='describe')
      return JSON.stringify(args[3]===NEW?candidate:source.revision);
    throw Error('Unexpected call');
  };
  return {run,calls:()=>count};
}

test('preflight verifies managed Worker and pinned Gateway using read-only calls',()=>{
  const c=cloud();
  assert.deepEqual(preflight(SHA,c.run),{sourceSha:SHA,previousRevision:OLD,previousDigest:OLD_DIGEST});
  assert.equal(c.calls(),7);
});
test('staged canary must be immutable, private, ready and not receiving traffic',()=>{
  const c=cloud();
  const result=checkStaged(SHA,NEW_DIGEST,OLD,c.run);
  assert.equal(result.revision,NEW);
  assert.equal(result.previousRevision,OLD);
  assert.match(result.canaryURL,/^https:/);
  assert.equal(c.calls(),3);
});
test('refuse any traffic drift, digest mismatch, or public IAM',()=>{
  assert.throws(()=>checkStaged(SHA,NEW_DIGEST,OLD,cloud({active:NEW}).run),/TRAFFIC_CHANGED/);
  assert.throws(()=>checkStaged(SHA,OLD_DIGEST,OLD,cloud().run),/IMAGE_DIGEST_MISMATCH/);
  assert.throws(()=>checkStaged(SHA,NEW_DIGEST,OLD,cloud({mutate:(w)=>{w.policy.bindings=[{members:['allUsers']}];}}).run));
  assert.throws(()=>checkStaged(SHA,NEW_DIGEST,OLD,cloud({tag:false}).run),/CANARY_NOT_FOUND/);
  assert.throws(()=>checkStaged(SHA,'nope',OLD,()=>{throw Error('called')}),/INVALID_ARGUMENT/);
});
test('promotion checks the exact candidate digest, revision and all Cloud security guards',()=>{
  const cloudPromoted=cloud({active:NEW,tag:false});
  const result=verifyPromoted(SHA,NEW_DIGEST,NEW,cloudPromoted.run);
  assert.equal(result.verified,true);
  assert.throws(()=>verifyPromoted(SHA,OLD_DIGEST,NEW,cloudPromoted.run),/PROMOTION_MISMATCH/);
});
test('invalid source fails before cloud access and errors never reveal command details',()=>{
  let calls=0;
  const run=()=>{calls++;throw Error('private_token_123');};
  assert.throws(()=>preflight('wrong',run),/INVALID_SHA/);
  assert.equal(calls,0);
  const errors=[];
  assert.equal(main(['preflight',SHA],run,{log:()=>{},error:x=>errors.push(x)}),1);
  assert.deepEqual(errors,['PDF_AUTO_VALIDATION_FAILED']);
});

for (const [name,mutate] of [
  ['not Ready',(w,c)=>{c.status.conditions[0].status='False';}],
  ['wrong CPU',(w,c)=>{c.spec.containers[0].resources.limits.cpu='2';}],
  ['wrong RAM',(w,c)=>{c.spec.containers[0].resources.limits.memory='4Gi';}],
  ['wrong concurrency',(w,c)=>{c.spec.containerConcurrency=2;}],
  ['short timeout',(w,c)=>{c.spec.timeoutSeconds=30;}],
  ['wrong scratch',(w,c)=>{c.spec.volumes[0].emptyDir.sizeLimit='32Mi';}],
  ['IAM disabled',(w)=>{w.service.metadata.annotations['run.googleapis.com/invoker-iam-disabled']='true';}],
  ['tag receiving traffic',(w)=>{w.service.status.traffic[1].percent=1;}],
]) test('staged gate rejects '+name,()=>{
  assert.throws(()=>checkStaged(SHA,NEW_DIGEST,OLD,cloud({mutate}).run));
});
