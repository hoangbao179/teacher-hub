import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD, plan, stagedDeployArgs, cliCall, stage, main } from './pdf-cloud-stage.mjs';
const SHA='a'.repeat(40);
const DIGEST='sha256:'+'b'.repeat(64);
const secret='teacher-pdf-gateway-hmac:1';
const env={SOURCE_SHA:SHA,PDF_GATEWAY_SECRET_VERSION:secret,
  PDF_CLOUD_STAGE_APPROVED:'private-no-traffic',PDF_CLOUD_IAM_REVIEWED:'true'};
const traffic=[{revisionName:'teacher-pdf-worker-00002-lml',percent:100}];
function fakeRunner({publicGateway=false,failedDigest=false,trafficDrift=false,missingGateway=false}={}){
 const calls=[];
 const run=(command,args)=>{
  calls.push([command,...args]);
  if(command==='git')return args[0]==='rev-parse'?SHA+'\n':'';
  if(command==='docker')return '';
  if(command!=='gcloud')throw Error('Unexpected command');
  if(args[0]==='artifacts')return JSON.stringify({image_summary:{digest:failedDigest?'not-a-digest':DIGEST}});
  if(args[0]==='run'&&args[1]==='deploy')return '';
  if(args[0]==='run'&&args[1]==='services'&&args[2]==='describe'){
   const name=args[3];
   if(missingGateway&&name===CLOUD.gateway)throw Error('missing gateway');
   const changed=trafficDrift&&calls.some(c=>c[1]==='run'&&c[2]==='deploy'&&c[3]===name);
   return JSON.stringify({metadata:{annotations:{'run.googleapis.com/invoker-iam-disabled':'false'}},
     status:{traffic:changed?[{revisionName:'unexpected-revision',percent:100}]:traffic}});
  }
  if(args[0]==='run'&&args[1]==='services'&&args[2]==='get-iam-policy')
   return JSON.stringify({bindings:publicGateway&&args[3]===CLOUD.gateway?
    [{role:'roles/run.invoker',members:['allUsers']}]:[]});
  throw Error('Unexpected gcloud command: '+args.join(' '));
 };
 return {run,calls};
}
test('operator preview is read only and needs no production secret',()=>{
 const p=plan({SOURCE_SHA:SHA});
 assert.equal(p.traffic,'NO_TRAFFIC');
 assert.equal(p.iamMutations,false);
 assert.equal(p.apiEnabled,false);
 assert.equal(p.imageTags.length,2);
 assert.equal(main(['--plan'],{SOURCE_SHA:SHA},()=>assert.fail('ran command')),0);
 assert.throws(()=>plan({}),/PDF_CLOUD_SOURCE_SHA_REQUIRED/);
});
test('deploy args are fixed, immutable, no-traffic, no IAM mutation, bounded',()=>{
 const w=stagedDeployArgs('worker',CLOUD.registry+'/'+CLOUD.worker+'@'+DIGEST);
 const g=stagedDeployArgs('gateway',CLOUD.registry+'/'+CLOUD.gateway+'@'+DIGEST,secret);
 assert(w.includes('--no-traffic') && g.includes('--no-traffic'));
 assert(w.includes('--add-volume=name=pdf-temp,type=in-memory,size-limit=32Mi,mount-path=/tmp/pdf-worker'));
 assert(w.includes('--memory=2Gi')&&w.includes('--concurrency=1')&&w.includes('--max=3'));
 assert(g.includes('--memory=256Mi')&&g.includes('--max=1'));
 assert(g.includes('--set-secrets=PDF_GATEWAY_HMAC_KEY='+secret));
 assert(!w.concat(g).some(x=>/allow-unauthenticated|set-iam-policy|add-iam-policy|pdf_api_enabled/i.test(x)));
 assert.throws(()=>stagedDeployArgs('gateway',CLOUD.registry+'/'+CLOUD.gateway+'@'+DIGEST,'key:latest'),/SECRET_REFERENCE/);
});
test('Windows gcloud shim allows fixed CLI tokens and rejects shell injection',()=>{
 let seen;
 const result=cliCall('gcloud',['run','services','describe','teacher-pdf-worker','--format=json'],
  'win32',(cmd,args)=>{seen={cmd,args};return 'ok'});
 assert.equal(result,'ok');assert.equal(seen.cmd,'cmd.exe');
 assert.deepEqual(seen.args.slice(0,3),['/d','/s','/c']);
 assert.match(seen.args[3],/^gcloud run services describe/);
 assert.throws(()=>cliCall('gcloud',['run','x&whoami'],'win32',()=>{}),/UNSAFE_WINDOWS_ARGUMENT/);
});
test('staging requires explicit operator approval, clean git and both private services',()=>{
 const a=fakeRunner(); assert.throws(()=>stage({...env,PDF_CLOUD_STAGE_APPROVED:''},a.run),/APPROVAL_REQUIRED/);
 assert.equal(a.calls.length,0);
 const b=fakeRunner({publicGateway:true});
 assert.throws(()=>stage(env,b.run),/UNSAFE_INVOCATION_POLICY/);
 assert(!b.calls.some(x=>x[0]==='docker'));
 const c=fakeRunner({missingGateway:true});
 assert.throws(()=>stage(env,c.run),/missing gateway/);
 assert(!c.calls.some(x=>x[0]==='docker'));
 const d=fakeRunner({failedDigest:true});
 assert.throws(()=>stage(env,d.run),/INVALID_DIGEST/);
 assert(!d.calls.some(x=>x[1]==='run'&&x[2]==='deploy'));
});
test('stage uses private no-traffic images and confirms original traffic remains',()=>{
 const a=fakeRunner();
 const result=stage(env,a.run);
 assert.deepEqual(result,{staged:true,traffic:'unchanged',images:2,activationAllowed:false});
 const deploys=a.calls.filter(x=>x[0]==='gcloud'&&x[1]==='run'&&x[2]==='deploy');
 assert.equal(deploys.length,2);
 assert.equal(deploys[0][3],CLOUD.worker);
 assert.equal(deploys[1][3],CLOUD.gateway);
 assert(deploys.every(x=>x.includes('--no-traffic')));
 assert(a.calls.filter(x=>x[0]==='docker'&&x[1]==='build').length===2);
 const b=fakeRunner({trafficDrift:true});
 assert.throws(()=>stage(env,b.run),/TRAFFIC_CHECK_FAILED/);
});
