import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD} from './pdf-cloud-stage.mjs';
import {auditStaged,evaluateStaged,main} from './pdf-release-audit.mjs';
const sha='a'.repeat(40), digest='sha256:'+'b'.repeat(64);
const rev=n=>n+'-00008-k7m';
function fixture(name){
  const w=name===CLOUD.worker;
  const uri=CLOUD.registry+'/'+name+'@'+digest;
  const env=w?[
    {name:'PDF_PROCESSING_ENABLED',value:'true'},
    {name:'PDF_WORKER_IAM_READY',value:'true'},
    {name:'PDF_TEMP_ROOT',value:'/tmp/pdf-worker'},
    {name:'PDF_PRINT_FALLBACK_ENABLED',value:'false'}
  ]:[
    {name:'PDF_GATEWAY_ENABLED',value:'true'},
    {name:'PDF_LONG_PRINT_TASKS_ENABLED',value:'false'},
    {name:'PDF_GATEWAY_WORKER_URL',value:CLOUD.workerURL},
    {name:'PDF_GATEWAY_HMAC_KEY',valueFrom:{secretKeyRef:{name:'secret',key:'1'}}}
  ];
  const spec={
    serviceAccountName:w?CLOUD.workerSA:CLOUD.gatewaySA,
    containerConcurrency:w?1:10,timeoutSeconds:w?180:30,
    volumes:w?[{name:'pdf-temp',emptyDir:{medium:'Memory',sizeLimit:'32Mi'}}]:[],
    containers:[{image:uri,resources:{limits:{cpu:'1',memory:w?'2Gi':'256Mi'}},
      volumeMounts:w?[{name:'pdf-temp',mountPath:'/tmp/pdf-worker'}]:[],env}]
  };
  return {
    service:{metadata:{name,annotations:{'run.googleapis.com/invoker-iam-disabled':w?'false':'true'}},
      status:{latestCreatedRevisionName:rev(name),traffic:[{revisionName:name+'-00007-old',percent:100}]}},
    policy:{bindings:[]},
    revision:{metadata:{name:rev(name)},spec,
      status:{imageDigest:uri,conditions:[{type:'Ready',status:'True'}]}},
    image:{image_summary:{digest}}
  };
}
test('exact staged evidence passes; no writes to Cloud Run',()=>{
  const calls=[];
  const run=(cmd,args)=>{
    calls.push([cmd,...args]);assert.equal(cmd,'gcloud');
    let name;
    const joined=args.join(' ');
    name=joined.includes(CLOUD.gateway)?CLOUD.gateway:CLOUD.worker;
    const f=fixture(name);
    if(args[0]==='run'&&args[1]==='services'&&args[2]==='describe')return JSON.stringify(f.service);
    if(args[0]==='run'&&args[1]==='services'&&args[2]==='get-iam-policy')return JSON.stringify(f.policy);
    if(args[0]==='run'&&args[1]==='revisions')return JSON.stringify(f.revision);
    if(args[0]==='artifacts')return JSON.stringify(f.image);
    throw Error('UNEXPECTED');
  };
  const out=auditStaged({PDF_STAGED_SHA:sha},run);
  assert.equal(out.audit,'PASS');assert.equal(out.services.length,2);
  assert.equal(out.activationAllowed,false);assert.equal(calls.length,8);
  assert.equal(calls.some(x=>/\bdeploy\b|\bupdate\b|set-iam-policy/.test(x.join(' '))),false);
  assert.equal(main(['--delete'],{PDF_STAGED_SHA:sha},run),2);
  assert.equal(calls.length,8);
});
test('reject public Worker, private Gateway, changes to image, gate, traffic, resource',()=>{
  for(const name of [CLOUD.worker,CLOUD.gateway]){
    const x=fixture(name);
    const check=o=>evaluateStaged(name,sha,o.service,o.policy,o.revision,o.image);
    assert.equal(check(x).ready,true);
    const reject=mutate=>{const y=structuredClone(x);mutate(y);assert.throws(()=>check(y),/PDF_CLOUD_/);};
    reject(y=>{y.service.status.traffic=[{revisionName:rev(name),percent:100}];});
    reject(y=>{y.revision.status.imageDigest='sha256:'+'c'.repeat(64);});
    reject(y=>{y.revision.spec.containers[0].image='image:latest';});
    reject(y=>{y.revision.status.conditions[0].status='False';});
    reject(y=>{y.revision.spec.timeoutSeconds=999;});
    reject(y=>{y.policy.bindings=[{role:'roles/run.invoker',members:['allUsers']}];});
    reject(y=>{y.service.status.latestCreatedRevisionName='unknown';});
    if(name===CLOUD.worker){
      reject(y=>{y.service.metadata.annotations['run.googleapis.com/invoker-iam-disabled']='true';});
      reject(y=>{y.revision.spec.containers[0].env[3].value='true';});
      reject(y=>{y.revision.spec.volumes=[];});
    }else{
      reject(y=>{y.service.metadata.annotations['run.googleapis.com/invoker-iam-disabled']='false';});
      reject(y=>{y.revision.spec.containers[0].env[1].value='true';});
      reject(y=>{y.revision.spec.containers[0].env[3]={name:'PDF_GATEWAY_HMAC_KEY',value:'key'};});
    }
  }
});
test('invalid SHA and missing traffic fail closed',()=>{
  const x=fixture(CLOUD.worker);
  assert.throws(()=>auditStaged({},()=>assert.fail('no call')),/STAGED_SHA_REQUIRED/);
  assert.throws(()=>evaluateStaged(CLOUD.worker,'bad',x.service,x.policy,x.revision,x.image),/STAGED_SHA_REQUIRED/);
  x.service.status.traffic=[];
  assert.throws(()=>evaluateStaged(CLOUD.worker,sha,x.service,x.policy,x.revision,x.image),/BASELINE_TRAFFIC_UNVERIFIED/);
});
