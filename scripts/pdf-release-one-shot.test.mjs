import test from 'node:test';
import assert from 'node:assert/strict';
import {main,releaseOnce} from './pdf-release-one-shot.mjs';
const env={SOURCE_SHA:'a'.repeat(40),
  PDF_CLOUD_PUBLIC_HMAC_STAGE_APPROVED:'public-hmac-no-traffic',
  PDF_CLOUD_IAM_REVIEWED:'true',PDF_CLOUD_HMAC_REVIEWED:'true'};
const stageOk={staged:true,traffic:'unchanged',activationAllowed:false};
const verified={audit:'PASS',activationAllowed:false,services:[{},{}]};
test('stage, offline smoke, immutable GCP audit in order; no traffic promotion',()=>{
  const order=[];
  const result=releaseOnce(env,{
    stage:()=>{order.push('stage');return stageOk;},
    docker:(cmd,args)=>{order.push('smoke');assert.equal(cmd,'docker');assert(args.includes('none'));},
    audit:values=>{order.push('audit');assert.equal(values.PDF_STAGED_SHA,env.SOURCE_SHA);return verified;},
    progress:()=>{}
  });
  assert.deepEqual(order,['stage','smoke','audit']);
  assert.deepEqual(result,{stage:'PASS',smoke:'PASS',cloudAudit:'PASS',traffic:'UNCHANGED',
    activationAllowed:false,printRestrictedViewer:'NOT_SUPPORTED'});
});
test('no downstream work on staging or approval failure; audit must pass',()=>{
  let downstream=false;
  const ops={stage:()=>({staged:false}),docker:()=>{downstream=true;},
    audit:()=>{downstream=true;},progress:()=>{}};
  assert.throws(()=>releaseOnce(env,ops),/STAGING_NOT_VERIFIED/);
  assert.equal(downstream,false);
  assert.throws(()=>releaseOnce({...env,PDF_CLOUD_IAM_REVIEWED:'false'},ops),/RELEASE_APPROVAL_REQUIRED/);
  assert.equal(main(['--deploy'],env,ops),2);
  assert.equal(downstream,false);
  assert.throws(()=>releaseOnce(env,{...ops,stage:()=>stageOk,docker:()=>{},
    audit:()=>({audit:'FAIL'})}),/RELEASE_AUDIT_NOT_VERIFIED/);
});
