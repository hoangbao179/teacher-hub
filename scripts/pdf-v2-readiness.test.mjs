import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateService, RELEASE, main} from './pdf-v2-readiness.mjs';
import {CLOUD} from './pdf-cloud-stage.mjs';

function fixture(kind) {
  const worker=kind==='worker', name=CLOUD[kind], {revision,digest}=RELEASE[kind];
  const image=CLOUD.registry+'/'+name+'@'+digest;
  const gates=worker?{PDF_CHUNKED_JOBS_ENABLED:'true',PDF_PROCESSING_ENABLED:'true',PDF_WORKER_IAM_READY:'true',PDF_PRINT_FALLBACK_ENABLED:'true',PDF_TEMP_ROOT:'/tmp/pdf-worker'}:
    {PDF_CHUNKED_JOBS_ENABLED:'true',PDF_GATEWAY_ENABLED:'true',PDF_LONG_PRINT_TASKS_ENABLED:'true',PDF_GATEWAY_WORKER_URL:CLOUD.workerURL};
  return {kind,service:{metadata:{name,generation:2,annotations:worker?{}:{'run.googleapis.com/invoker-iam-disabled':'true'}},
    spec:{template:{metadata:{annotations:{'autoscaling.knative.dev/maxScale':'1'}}}},
    status:{observedGeneration:2,conditions:[{type:'Ready',status:'True'}],traffic:[{revisionName:'old',tag:'canary'},{revisionName:revision,percent:100}]}},
    revision:{metadata:{name:revision},status:{imageDigest:image,conditions:[{type:'Ready',status:'True'}]},
      spec:{serviceAccountName:worker?CLOUD.workerSA:CLOUD.gatewaySA,timeoutSeconds:190,containerConcurrency:worker?1:10,
        containers:[{image,resources:{limits:{cpu:'1',memory:worker?'2Gi':'256Mi'}},env:[...Object.entries(gates).map(([name,value])=>({name,value})),
          ...(!worker?[{name:'PDF_GATEWAY_HMAC_KEY',valueFrom:{secretKeyRef:{name:'existing',key:'1'}}}]:[])],
          volumeMounts:[{name:'scratch',mountPath:'/tmp/pdf-worker'}]}],volumes:[{name:'scratch',emptyDir:{medium:'Memory',sizeLimit:'384Mi'}}]}},policy:{bindings:worker?[{role:'roles/run.invoker',members:['serviceAccount:teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com']}]:[]}};
}
const evaluate=f=>evaluateService(f.kind,f.service,f.revision,f.policy);
test('Worker pin matches reviewed live revision and linux/amd64 manifest, Gateway stays unchanged',()=>{
  assert.deepEqual(RELEASE,{
    worker:{revision:'teacher-pdf-worker-00020-fiv',digest:'sha256:7b0e5d6bcd5ce4aa449939ddf3e31d8f93fd4b6e88c20922850810c06009f5cb'},
    gateway:{revision:'teacher-pdf-gateway-00013-gej',digest:'sha256:5adfd3d41adf82dde6158e9b0c97acbaebb173837cdf7cee99f9680009e1744f'},
  });
});
test('Worker rejects superseded traffic and registry index instead of the reviewed platform manifest',()=>{
  const old=fixture('worker');old.service.status.traffic[1].revisionName='teacher-pdf-worker-00017-guf';
  assert.throws(()=>evaluate(old),/TRAFFIC_MISMATCH/);
  const index=fixture('worker');
  const image=CLOUD.registry+'/'+CLOUD.worker+'@sha256:75357d6f5062ccb3a120e21271a0a9367616dbd2365d4d2df256ce6e7e520b9b';
  index.revision.spec.containers[0].image=image;index.revision.status.imageDigest=image;
  assert.throws(()=>evaluate(index),/REVISION_DIGEST_MISMATCH/);
});
for(const kind of ['worker','gateway']) {
  test(kind+': accepts pinned live image and ignores zero-traffic tags',()=>assert.deepEqual(evaluate(fixture(kind)),RELEASE[kind]));
  for(const [label,mutate] of [
    ['split traffic',f=>{f.service.status.traffic[0].percent=1;f.service.status.traffic[1].percent=99;}],
    ['wrong live revision',f=>f.service.status.traffic[1].revisionName='old'],
    ['unready',f=>f.revision.status.conditions[0].status='False'],
    ['digest drift',f=>f.revision.status.imageDigest='sha256:'+'f'.repeat(64)],
    ['timeout',f=>f.revision.spec.timeoutSeconds=30],
    ['chunk gate',f=>f.revision.spec.containers[0].env[0].value='false'],
    ['public IAM',f=>f.policy.bindings=[{members:['allUsers']}]],
    ['generation',f=>f.service.status.observedGeneration=1],
    ['identity',f=>f.revision.spec.serviceAccountName='other'],
  ]) test(kind+': fails closed on '+label,()=>{const f=fixture(kind);mutate(f);assert.throws(()=>evaluate(f));});
}
test('worker fails old scratch volume',()=>{const f=fixture('worker');f.revision.spec.volumes[0].emptyDir.sizeLimit='32Mi';assert.throws(()=>evaluate(f),/SCRATCH_DRIFT/);});
test('gateway fails wrong Cloud Tasks target',()=>{const f=fixture('gateway');f.revision.spec.containers[0].env.find(e=>e.name==='PDF_GATEWAY_WORKER_URL').value='https://other';assert.throws(()=>evaluate(f),/GATEWAY_DRIFT/);});

const SHA='a'.repeat(40);
const queue={name:`projects/${CLOUD.project}/locations/${CLOUD.region}/queues/teacher-pdf-queue`,state:'RUNNING',
  rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1},
  retryConfig:{maxAttempts:5,maxRetryDuration:'3600s',minBackoff:'10s',maxBackoff:'300s'}};
const steps=['WORKER_SERVICE','WORKER_REVISION','WORKER_IAM','GATEWAY_SERVICE','GATEWAY_REVISION','GATEWAY_IAM','QUEUE'];
function execute({failStep,fail,mutate,sha=SHA}={}) {
  const logs=[],errors=[],calls=[];
  const run=(command,args)=>{
    assert.equal(command,'gcloud');
    assert(args.includes('--format=json'));
    assert(['describe','get-iam-policy'].includes(args[2]));
    const step=steps[calls.length];
    calls.push(args);
    if(step===failStep)return fail();
    let data;
    if(step==='QUEUE')data=structuredClone(queue);
    else {
      const f=fixture(step.startsWith('WORKER')?'worker':'gateway');
      data=step.endsWith('SERVICE')?f.service:step.endsWith('REVISION')?f.revision:f.policy;
    }
    mutate?.(step,data);
    return JSON.stringify(data);
  };
  const code=main([sha],run,{log:x=>logs.push(x),error:x=>errors.push(x)});
  return {code,logs,errors,calls};
}

test('audit performs only seven reads and emits evidence only after all gates pass',()=>{
  const r=execute();
  assert.equal(r.code,0);assert.equal(r.calls.length,7);assert.deepEqual(r.errors,[]);
  const evidence=JSON.parse(r.logs[0]);
  assert.equal(evidence.sourceSha,SHA);assert.equal(evidence.result,'PASS');
  assert.deepEqual(evidence.services,RELEASE);
});

for(const step of steps) {
  test(step+': reports permission failure without command output or credentials',()=>{
    const r=execute({failStep:step,fail:()=>{throw Object.assign(new Error('command with private arguments'),{
      status:1,stderr:Buffer.from('PERMISSION_DENIED: run.revisions.get denied; Bearer secret-token\n'+
        'https://private.example/?resourcekey=secret-key\n{"private_key":"secret-key"}\n::error::injected'),
      stdout:'private response',output:['private payload']});}});
    assert.equal(r.code,1);assert.deepEqual(r.logs,[]);
    assert.deepEqual(r.errors,[`PDF_V2_${step}_READ_FAILED: reason=PERMISSION_DENIED permission=run.revisions.get exit=1`]);
    assert.equal(r.calls.length,steps.indexOf(step)+1);
  });
  test(step+': invalid JSON is a parse failure, not an IAM failure',()=>{
    const r=execute({failStep:step,fail:()=>'{"private":"secret'});
    assert.equal(r.code,1);assert.deepEqual(r.logs,[]);
    assert.deepEqual(r.errors,[`PDF_V2_${step}_READ_FAILED: reason=INVALID_JSON`]);
  });
}

for(const [reason,details] of [
  ['NOT_FOUND',{stderr:'NOT_FOUND: revision does not exist'}],
  ['UNAUTHENTICATED',{stderr:'invalid_grant: sensitive-auth-details'}],
  ['UNAUTHENTICATED',{stderr:'You do not currently have an active account selected.'}],
  ['API_DISABLED',{stderr:'PERMISSION_DENIED: SERVICE_DISABLED'}],
  ['DEADLINE_EXCEEDED',{stderr:'DEADLINE_EXCEEDED'}],
  ['UNAVAILABLE',{stderr:'connection refused'}],
  ['GCLOUD_NOT_FOUND',{code:'ENOENT'}],
  ['COMMAND_TIMEOUT',{code:'ETIMEDOUT'}],
  ['OUTPUT_LIMIT_EXCEEDED',{code:'ENOBUFS'}],
  ['COMMAND_FAILED',{message:'arbitrary private error',status:null}],
]) test('classifies '+reason+' without exposing raw diagnostics',()=>{
  const r=execute({failStep:'WORKER_REVISION',fail:()=>{throw Object.assign(new Error('private'),details);}});
  assert.equal(r.code,1);assert.deepEqual(r.logs,[]);
  assert.deepEqual(r.errors,[`PDF_V2_WORKER_REVISION_READ_FAILED: reason=${reason}`]);
});

for(const [step,mutate,expected] of [
  ['WORKER_SERVICE',d=>d.spec.template.metadata.annotations['autoscaling.knative.dev/maxScale']='3','PDF_V2_WORKER_VALIDATION_FAILED: PDF_V2_SCALING_DRIFT'],
  ['WORKER_REVISION',d=>d.spec.volumes[0].emptyDir.sizeLimit='32Mi','PDF_V2_WORKER_VALIDATION_FAILED: PDF_V2_SCRATCH_DRIFT'],
  ['WORKER_REVISION',d=>d.spec.containers[0].env[0].value='false','PDF_V2_WORKER_VALIDATION_FAILED: PDF_V2_CHUNKS_DISABLED'],
  ['GATEWAY_REVISION',d=>d.spec.timeoutSeconds=30,'PDF_V2_GATEWAY_VALIDATION_FAILED: PDF_V2_RESOURCE_DRIFT'],
  ['GATEWAY_IAM',d=>d.bindings=[{members:['allUsers']}],'PDF_V2_GATEWAY_VALIDATION_FAILED: PDF_CLOUD_PUBLIC_IAM_BINDING_FORBIDDEN'],
  ['QUEUE',d=>d.httpTarget={uriOverride:{host:'private'}},'PDF_V2_QUEUE_DRIFT'],
]) test('keeps validation gate and context: '+expected,()=>{
  const r=execute({mutate:(s,d)=>{if(s===step)mutate(d);}});
  assert.equal(r.code,1);assert.deepEqual(r.logs,[]);assert.deepEqual(r.errors,[expected]);
});

test('source validation fails before any cloud reads',()=>{
  const r=execute({sha:'invalid'});
  assert.equal(r.code,1);assert.deepEqual(r.calls,[]);assert.deepEqual(r.logs,[]);
  assert.deepEqual(r.errors,['PDF_V2_SOURCE_SHA_REQUIRED']);
});

test('reports allowlisted process signal without printing arbitrary process fields',()=>{
  const r=execute({failStep:'QUEUE',fail:()=>{throw {signal:'SIGTERM',status:null,stderr:'private'};}});
  assert.equal(r.code,1);assert.deepEqual(r.logs,[]);
  assert.deepEqual(r.errors,['PDF_V2_QUEUE_READ_FAILED: reason=COMMAND_FAILED signal=SIGTERM']);
});
