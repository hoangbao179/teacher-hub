#!/usr/bin/env node
// Bounded Artifact Registry cleanup. Fail closed if inventory, Cloud Run routing,
// digest lineage or validation is uncertain. Deletes only top-level manifests.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const ROOT='asia-southeast1-docker.pkg.dev/teacher-hub-pdf/teacher-pdf';
export const PROJECT='teacher-hub-pdf';
export const REGION='asia-southeast1';
export const SERVICES=['teacher-pdf-worker','teacher-pdf-gateway'];
const DIGEST=/^sha256:[0-9a-f]{64}$/;
const SAFE_AGE_DAYS=3;
const KEEP_RECENT=3;
const MAX_DELETE=12;
const valid=(v,message)=>{if(!v)throw Error('PDF_REGISTRY_'+message);};

function invoke(command,args){return execFileSync(command,args,{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});}
function jsonCall(run,command,args){let value;try{value=JSON.parse(run(command,args));}catch{throw Error('PDF_REGISTRY_CLOUD_READ_FAILED');}return value;}

export function normalizeInventory(data){
  valid(Array.isArray(data),'INVALID_INVENTORY');
  const dedup=new Set();
  return data.map(x=>{
    valid(typeof x?.uri==='string','INVALID_IMAGE_URI');
    const match=x.uri.match(/^(.*)@(sha256:[a-f0-9]{64})$/);
    valid(match && SERVICES.some(s=>match[1]===ROOT+'/'+s),'UNTRUSTED_IMAGE');
    valid(!dedup.has(x.uri),'DUPLICATE_IMAGE');dedup.add(x.uri);
    const stamp=x.uploadTime??x.createTime;
    const ms=Date.parse(stamp);
    valid(typeof stamp==='string'&&Number.isFinite(ms),'INVALID_TIMESTAMP');
    return {uri:x.uri,service:match[1].slice(ROOT.length+1),digest:match[2],created:ms};
  });
}

// Includes 100%-traffic revision and every tagged canary, even at 0%.
export function routesForService(service,name){
  valid(service?.metadata?.name===name && Array.isArray(service.status?.traffic),'INVALID_ROUTING');
  const routes=service.status.traffic;
  const live=routes.filter(r=>(r.percent??0)>0);
  valid(live.length===1&&live[0].percent===100&&
    routes.reduce((sum,r)=>sum+(r.percent??0),0)===100,'TRAFFIC_NOT_EXCLUSIVE');
  const relevant=routes.filter(r=>(r.percent??0)>0||r.tag);
  valid(relevant.length>=1&&relevant.every(r=>/^teacher-pdf-(worker|gateway)-[0-9a-z-]+$/.test(r.revisionName??'')),
    'INVALID_REVISION');
  return [...new Set(relevant.map(r=>r.revisionName))];
}
export function digestForRevision(revision,service){
  const image=revision?.spec?.containers?.[0]?.image;
  const prefix=ROOT+'/'+service+'@';
  valid(typeof image==='string'&&image.startsWith(prefix)&&DIGEST.test(image.slice(prefix.length)),
    'UNTRUSTED_REVISION_IMAGE');
  const d=image.slice(prefix.length), observed=revision?.status?.imageDigest;
  valid(observed===image||observed===d,'REVISION_DIGEST_DRIFT');
  return d;
}
export function childrenOfManifest(manifest){
  valid(manifest?.schemaVersion===2,'INVALID_MANIFEST');
  if(manifest.manifests===undefined)return [];
  valid(Array.isArray(manifest.manifests)&&manifest.manifests.length>0,'INVALID_MANIFEST');
  return manifest.manifests.map(x=>{valid(DIGEST.test(x?.digest??''),'INVALID_CHILD_DIGEST');return x.digest;});
}

export function planCleanup({inventory,referenced,children={},now=Date.now()}){
  valid(Array.isArray(inventory)&&inventory.length>0,'EMPTY_INVENTORY');
  valid(referenced instanceof Map && SERVICES.every(s=>referenced.has(s)&&referenced.get(s).size>0),
    'UNVERIFIED_REFERENCES');
  valid(Number.isFinite(now),'INVALID_CLOCK');
  const plan=[],kept=[];
  for(const service of SERVICES){
    const rows=inventory.filter(x=>x.service===service).sort((a,b)=>b.created-a.created);
    valid(rows.length>0,'MISSING_PACKAGE');
    const protectedDigests=referenced.get(service);
    // Every serving/canary digest must resolve to an index or its child in the registry.
    const parentsFor=d=>rows.filter(x=>x.digest===d || (children[x.uri]??[]).includes(d));
    for(const d of protectedDigests)valid(parentsFor(d).length>0,'LIVE_IMAGE_MISSING');
    const keep=new Set(rows.slice(0,KEEP_RECENT).map(x=>x.uri));
    for(const d of protectedDigests)for(const item of parentsFor(d))keep.add(item.uri);
    for(const item of rows){
      const older=(now-item.created)>=SAFE_AGE_DAYS*86400000;
      // Never delete a newer upload, future timestamp, or 3 most recent versions.
      if(keep.has(item.uri)||!older){kept.push(item.uri);continue;}
      plan.push(item.uri);
    }
  }
  return {candidates:plan.slice(0,MAX_DELETE),remaining:Math.max(0,plan.length-MAX_DELETE),kept};
}

export function inventorySnapshot(run=invoke){
  const references=new Map();
  for(const service of SERVICES){
    const cloud=jsonCall(run,'gcloud',['run','services','describe',service,
      '--project='+PROJECT,'--region='+REGION,'--format=json']);
    const revisions=routesForService(cloud,service);
    const digests=new Set();
    for(const name of revisions){
      const revision=jsonCall(run,'gcloud',['run','revisions','describe',name,
        '--project='+PROJECT,'--region='+REGION,'--format=json']);
      valid(revision?.metadata?.name===name,'REVISION_IDENTITY_MISMATCH');
      digests.add(digestForRevision(revision,service));
    }
    references.set(service,digests);
  }
  // Default list omits children and returns only top-level images.
  const records=jsonCall(run,'gcloud',['artifacts','docker','images','list',ROOT,
    '--project='+PROJECT,'--format=json']);
  const inventory=normalizeInventory(records);
  const children={};
  for(const entry of inventory){
    const manifest=jsonCall(run,'docker',['buildx','imagetools','inspect',entry.uri,'--raw']);
    children[entry.uri]=childrenOfManifest(manifest);
  }
  return {inventory,referenced:references,children};
}
export function inventoryKey(snapshot){
  return JSON.stringify({
    inventory:snapshot.inventory.map(x=>[x.uri,x.created]).sort((a,b)=>a[0].localeCompare(b[0])),
    references:SERVICES.map(s=>[s,[...snapshot.referenced.get(s)].sort()]),
    children:Object.entries(snapshot.children).sort((a,b)=>a[0].localeCompare(b[0]))
  });
}
export function execute({apply=false,now=Date.now(),run=invoke,out=console}={}){
  const snapshot=inventorySnapshot(run);
  const plan=planCleanup({...snapshot,now});
  out.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',candidates:plan.candidates,remaining:plan.remaining,kept:plan.kept.length}));
  if(!apply || plan.candidates.length===0)return plan;
  valid(process.env.PDF_REGISTRY_CLEANUP_ENABLED==='true' &&
    process.env.PDF_REGISTRY_CLEANUP_CONFIRM==='APPLY','APPLY_NOT_AUTHORIZED');
  // Last-minute re-inventory protects against another release/promotion.
  const current=inventorySnapshot(run);
  valid(inventoryKey(snapshot)===inventoryKey(current),'INVENTORY_CHANGED');
  for(const uri of plan.candidates){
    valid(uri.startsWith(ROOT+'/')&&/@sha256:[a-f0-9]{64}$/.test(uri),'INVALID_DELETE_TARGET');
    // gcloud refuses to delete an image in use by another parent manifest.
    try{run('gcloud',['artifacts','docker','images','delete',uri,
      '--project='+PROJECT,'--delete-tags','--quiet']);}
    catch{throw Error('PDF_REGISTRY_DELETE_FAILED');}
  }
  return plan;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    valid(process.argv.length===3 && ['--dry-run','--apply'].includes(process.argv[2]),'USAGE');
    execute({apply:process.argv[2]==='--apply'});
  }catch(e){console.error(/^PDF_REGISTRY_[A-Z_]+$/.test(e?.message??'')?e.message:'PDF_REGISTRY_FAILED');process.exitCode=1;}
}
