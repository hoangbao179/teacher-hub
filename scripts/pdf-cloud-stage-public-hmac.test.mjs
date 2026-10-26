import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD } from './pdf-cloud-stage.mjs';
import { checkPolicy, stagePublicHmac, preflightPublicHmac, safeStep, main } from './pdf-cloud-stage-public-hmac.mjs';

const SHA='a'.repeat(40), DIGEST='sha256:'+'b'.repeat(64);
const env={SOURCE_SHA:SHA,PDF_GATEWAY_SECRET_VERSION:'teacher-pdf-gateway-hmac:1',
  PDF_CLOUD_PUBLIC_HMAC_STAGE_APPROVED:'public-hmac-no-traffic',
  PDF_CLOUD_IAM_REVIEWED:'true',PDF_CLOUD_HMAC_REVIEWED:'true'};
const privateService={metadata:{annotations:{'run.googleapis.com/invoker-iam-disabled':'false'}},
  status:{traffic:[{revisionName:'worker-current',percent:100}]}};
const publicService={metadata:{annotations:{'run.googleapis.com/invoker-iam-disabled':'true'}},
  status:{traffic:[{revisionName:'gateway-current',percent:100}]}};
const bindings={bindings:[{role:'roles/run.invoker',members:['serviceAccount:only@example.invalid']}]};
test('public-HMAC option is explicit, with private worker and no allUsers role',()=>{
  assert.doesNotThrow(()=>checkPolicy(CLOUD.worker,privateService,bindings));
  assert.doesNotThrow(()=>checkPolicy(CLOUD.gateway,publicService,bindings));
  for(const bad of [
    [CLOUD.worker,publicService,bindings],
    [CLOUD.gateway,privateService,bindings],
    [CLOUD.gateway,publicService,{bindings:[{members:['allUsers']}]}],
    [CLOUD.worker,privateService,{bindings:[{members:['allAuthenticatedUsers']}]}],
    [CLOUD.gateway,publicService,null]
  ]) assert.throws(()=>checkPolicy(...bad),/PDF_CLOUD_/);
});
function runner({badPolicy=false,drift=false,badDigest=false,failedBuild=false}={}){
  const commands=[];
  const run=(cmd,args)=>{
    commands.push([cmd,...args]);
    if(cmd==='git')return args[0]==='rev-parse'?SHA+'\n':'';
    if(cmd==='docker') {
      if(failedBuild && args[0]==='build')throw Error('Docker failed');
      return args[0]==='version' ? '26.1.0' : '';
    }
    if(cmd!=='gcloud')throw Error('unexpected shell command');
    if(args[0]==='artifacts')return JSON.stringify({image_summary:{digest:badDigest?'bad-digest':DIGEST}});
    if(args[0]==='secrets')return JSON.stringify({state:'ENABLED'});
    if(args[0]==='run'&&args[1]==='deploy')return '';
    if(args[0]==='run'&&args[1]==='services'&&args[2]==='describe'){
      const isGateway=args[3]===CLOUD.gateway;
      const data=structuredClone(isGateway?publicService:privateService);
      if(badPolicy && isGateway)data.metadata.annotations['run.googleapis.com/invoker-iam-disabled']='false';
      if(drift && commands.some(x=>x[1]==='run'&&x[2]==='deploy'&&x[3]===args[3]))
        data.status.traffic=[{revisionName:'new-traffic',percent:100}];
      return JSON.stringify(data);
    }
    if(args[0]==='run'&&args[1]==='services'&&args[2]==='get-iam-policy')return JSON.stringify(bindings);
    throw Error('Unexpected gcloud: '+args.join(' '));
  };
  return {run,commands};
}
test('staging needs separate approval, clean checkout and verified secret version',()=>{
  for(const value of [
    {...env,PDF_CLOUD_PUBLIC_HMAC_STAGE_APPROVED:''},
    {...env,PDF_CLOUD_IAM_REVIEWED:'false'},
    {...env,PDF_CLOUD_HMAC_REVIEWED:''},
    {...env,PDF_GATEWAY_SECRET_VERSION:'secret:latest'},
    {...env,SOURCE_SHA:'badsha'}
  ]){
    const r=runner();
    assert.throws(()=>stagePublicHmac(value,r.run),/PDF_CLOUD_/);
    assert.equal(r.commands.length,0);
  }
});
test('incompatible policy aborts before any build or deployment',()=>{
  const r=runner({badPolicy:true});
  assert.throws(()=>stagePublicHmac(env,r.run),/EXPECTED_PUBLIC_HMAC_GATEWAY/);
  assert.equal(r.commands.some(c=>c[0]==='docker'),false);
});
test('only build and no-traffic immutable deployments; preserve both security boundaries',()=>{
  const r=runner();
  assert.deepEqual(stagePublicHmac(env,r.run),{staged:true,mode:'public-hmac-gateway',traffic:'unchanged',
    services:2,activationAllowed:false});
  const deploys=r.commands.filter(c=>c[1]==='run'&&c[2]==='deploy');
  assert.equal(deploys.length,2);
  assert.equal(deploys[0][3],CLOUD.worker);
  assert.equal(deploys[1][3],CLOUD.gateway);
  for(const d of deploys) {
    assert.ok(d.includes('--no-traffic'));
    assert.ok(d.some(x=>x.includes('@sha256:')));
    assert.equal(d.some(x=>/allow-unauthenticated|invoker-iam-check/.test(x)),false);
  }
  assert(r.commands.some(c=>c[0]==='docker'&&c[1]==='build'));
  assert.equal(r.commands.some(c=>c.includes('add-iam-policy-binding')),false);
});
test('staging fails closed on invalid image digest or traffic change',()=>{
  const digest=runner({badDigest:true});
  assert.throws(()=>stagePublicHmac(env,digest.run),/INVALID_DIGEST/);
  assert.equal(digest.commands.some(c=>c[1]==='run'&&c[2]==='deploy'),false);
  const traffic=runner({drift:true});
  assert.throws(()=>stagePublicHmac(env,traffic.run),/TRAFFIC_CHANGED/);
});
test('script rejects unintended operations and does not reveal secrets',()=>{
  const r=runner();
  assert.equal(main(['--delete'],env,r.run),2);
  assert.equal(r.commands.length,0);
});

test('read-only preflight gives clear checkpoints and never deploys',()=>{
 const r=runner(); const checkpoints=[];
 assert.deepEqual(preflightPublicHmac(env,r.run,step=>checkpoints.push(step)),{
  preflight:true,worker:'IAM_PRIVATE',gateway:'PUBLIC_HMAC',
  docker:'READY',secret:'ENABLED',traffic:'not_modified'});
 assert.deepEqual(checkpoints,['GIT','WORKER_IAM','GATEWAY_HMAC','DOCKER_DAEMON','SECRET_METADATA']);
 assert.equal(r.commands.filter(x=>x[0]==='docker').length,1);
 assert.equal(r.commands.some(x=>x[1]==='run'&&x[2]==='deploy'),false);
});
test('expected operator errors are stage-specific and raw exceptions are never exposed',()=>{
 assert.throws(()=>safeStep('DOCKER_DAEMON',()=>{throw Error('secret-runner-diagnostics');}),
   {message:'PDF_CLOUD_STEP_DOCKER_DAEMON_COMMAND_FAILED'});
 assert.throws(()=>safeStep('WORKER_IAM',()=>{throw Error('PDF_CLOUD_WORKER_MUST_REMAIN_IAM_PRIVATE');}),
   {message:'PDF_CLOUD_STEP_WORKER_IAM_WORKER_MUST_REMAIN_IAM_PRIVATE'});
 const r=runner({failedBuild:true});
 assert.throws(()=>stagePublicHmac(env,r.run), /PDF_CLOUD_STEP_WORKER_DOCKER_BUILD_COMMAND_FAILED/);
});
