import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOT,SERVICES,normalizeInventory,routesForService,digestForRevision,childrenOfManifest,
  planCleanup,execute} from './pdf-registry-cleanup.mjs';
const digest=(n)=>'sha256:'+n.repeat(64);
const uri=(s,d)=>ROOT+'/'+s+'@'+d;
const age=(days)=>new Date(Date.UTC(2026,9,29)-days*86400000).toISOString();
const NOW=Date.UTC(2026,9,29);
const worker=SERVICES[0], gateway=SERVICES[1];
function fixture(){
  const inventory=[];
  for(const s of SERVICES)for(let i=1;i<=6;i++){
    const d=digest(String(i));
    inventory.push({uri:uri(s,d),uploadTime:age(i)});
  }
  return normalizeInventory(inventory);
}
function references(){return new Map([[worker,new Set([digest('1')])],[gateway,new Set([digest('2')])]]);}
test('plans bounded deletes and protects live/canary digests plus three most recent',()=>{
  const p=planCleanup({inventory:fixture(),referenced:references(),now:NOW});
  assert.deepEqual(p.candidates,[uri(worker,digest('4')),uri(worker,digest('5')),uri(worker,digest('6')),
    uri(gateway,digest('4')),uri(gateway,digest('5')),uri(gateway,digest('6'))]);
});
test('references to an OCI child retain its parent manifest',()=>{
  const refs=references();refs.get(worker).add(digest('7'));
  const p=planCleanup({inventory:fixture(),referenced:refs,
    children:{[uri(worker,digest('2'))]:[digest('7')]},now:NOW});
  assert.equal(p.candidates.includes(uri(worker,digest('2'))),false);
});
test('rejects wrong image families, invalid time and missing live digest',()=>{
  assert.throws(()=>normalizeInventory([{uri:ROOT+'/unknown@'+digest('a'),uploadTime:age(6)}]),/UNTRUSTED_IMAGE/);
  assert.throws(()=>normalizeInventory([{uri:uri(worker,digest('a')),uploadTime:'bad'}]),/INVALID_TIMESTAMP/);
  const refs=references();refs.get(worker).add(digest('9'));
  assert.throws(()=>planCleanup({inventory:fixture(),referenced:refs,now:NOW}),/LIVE_IMAGE_MISSING/);
});
test('requires exclusive production traffic but retains zero-traffic tagged canary',()=>{
  const svc={metadata:{name:worker},status:{traffic:[
    {revisionName:'teacher-pdf-worker-00024-lir',percent:100},
    {revisionName:'teacher-pdf-worker-00025-new',percent:0,tag:'pdf-ci'}]}};
  assert.deepEqual(routesForService(svc,worker),['teacher-pdf-worker-00024-lir','teacher-pdf-worker-00025-new']);
  svc.status.traffic[1].percent=1;
  assert.throws(()=>routesForService(svc,worker),/TRAFFIC_NOT_EXCLUSIVE/);
});
test('rejects mutable image tag and digest mismatch, validates index children',()=>{
  const rev={spec:{containers:[{image:uri(worker,digest('a'))}]},status:{imageDigest:digest('a')}};
  assert.equal(digestForRevision(rev,worker),digest('a'));
  rev.status.imageDigest=digest('b');assert.throws(()=>digestForRevision(rev,worker),/REVISION_DIGEST_DRIFT/);
  rev.spec.containers[0].image=ROOT+'/teacher-pdf-worker:latest';
  assert.throws(()=>digestForRevision(rev,worker),/UNTRUSTED_REVISION_IMAGE/);
  assert.deepEqual(childrenOfManifest({schemaVersion:2,manifests:[{digest:digest('a')}]}),[digest('a')]);
  assert.throws(()=>childrenOfManifest({schemaVersion:2,manifests:[{digest:'bad'}]}),/INVALID_CHILD_DIGEST/);
});
test('dry-run never deletes and apply is denied without separate explicit opt-in',()=>{
  const svcs={
    [worker]:{metadata:{name:worker},status:{traffic:[{revisionName:'teacher-pdf-worker-00024-lir',percent:100}]}},
    [gateway]:{metadata:{name:gateway},status:{traffic:[{revisionName:'teacher-pdf-gateway-00013-gej',percent:100}]}}
  };
  let deletes=0;
  const run=(bin,args)=>{
    if(bin==='docker')return JSON.stringify({schemaVersion:2});
    if(args[0]==='run'&&args[1]==='services')return JSON.stringify(svcs[args[3]]);
    if(args[0]==='run'&&args[1]==='revisions'){
      const service=args[3].startsWith('teacher-pdf-worker')?worker:gateway;
      return JSON.stringify({metadata:{name:args[3]},spec:{containers:[{image:uri(service,digest('1'))}]},
        status:{imageDigest:digest('1')}});
    }
    if(args[0]==='artifacts'&&args[3]==='list')return JSON.stringify(fixture().map(x=>({uri:x.uri,uploadTime:new Date(x.created).toISOString()})));
    if(args[0]==='artifacts'&&args[3]==='delete'){deletes++;return '';}
    throw Error('unexpected CLI call');
  };
  const prev=process.env.PDF_REGISTRY_CLEANUP_ENABLED, confirm=process.env.PDF_REGISTRY_CLEANUP_CONFIRM;
  try{
    delete process.env.PDF_REGISTRY_CLEANUP_ENABLED;
    delete process.env.PDF_REGISTRY_CLEANUP_CONFIRM;
    const result=execute({now:NOW,run,out:{log:()=>{}}});
    assert(result.candidates.length>0);assert.equal(deletes,0);
    assert.throws(()=>execute({apply:true,now:NOW,run,out:{log:()=>{}}}),/APPLY_NOT_AUTHORIZED/);
    assert.equal(deletes,0);
  }finally{
    if(prev===undefined)delete process.env.PDF_REGISTRY_CLEANUP_ENABLED;
    else process.env.PDF_REGISTRY_CLEANUP_ENABLED=prev;
    if(confirm===undefined)delete process.env.PDF_REGISTRY_CLEANUP_CONFIRM;
    else process.env.PDF_REGISTRY_CLEANUP_CONFIRM=confirm;
  }
});
