#!/usr/bin/env node
// Cloud Run Worker release gates. Read-only; mutation happens only in the protected Actions job.
import { pathToFileURL } from 'node:url';
import { CLOUD, cliCall } from './pdf-cloud-stage.mjs';
import { audit, evaluateService, publicReadinessDiagnostic } from './pdf-v2-readiness.mjs';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const REVISION = /^teacher-pdf-worker-[a-z0-9-]+$/;
const TAG = 'pdf-ci';
const common = ['--project='+CLOUD.project, '--region='+CLOUD.region, '--format=json'];
const required = (valid, reason) => { if (!valid) throw Error('PDF_AUTO_'+reason); };

function query(command, args, run) {
  try { return JSON.parse(run(command,args)); }
  catch { throw Error('PDF_AUTO_CLOUD_READ_FAILED'); }
}
function serviceInfo(run) {
  const service=query('gcloud',['run','services','describe',CLOUD.worker,...common],run);
  const policy=query('gcloud',['run','services','get-iam-policy',CLOUD.worker,...common],run);
  return {service,policy};
}
function liveRevision(service) {
  const active=(service.status?.traffic??[]).filter(r=>(r.percent??0)>0);
  required(active.length===1 && active[0].percent===100 && REVISION.test(active[0].revisionName??''),'TRAFFIC_NOT_EXCLUSIVE');
  return active[0].revisionName;
}
function revisionInfo(revision,run) {
  required(REVISION.test(revision),'INVALID_REVISION');
  return query('gcloud',['run','revisions','describe',revision,...common],run);
}
function checkSource(sha) { required(SHA.test(sha??''),'INVALID_SHA'); }
function checkImage(revision) {
  const image=revision?.spec?.containers?.[0]?.image??'';
  const prefix=CLOUD.registry+'/'+CLOUD.worker+'@';
  required(image.startsWith(prefix) && DIGEST.test(image.slice(prefix.length)),'UNTRUSTED_IMAGE');
  return image.slice(prefix.length);
}
function verifyWorker(service,policy,revision,digest) {
  const fake={...service,status:{...service.status,traffic:[{revisionName:revision.metadata.name,percent:100}]}};
  return evaluateService('worker',fake,revision,policy,{revision:revision.metadata.name,digest});
}
export function preflight(sourceSha,run=cliCall) {
  checkSource(sourceSha);
  // Read-only readiness always verifies the live immutable Worker revision.
  const evidence=audit(sourceSha,run);
  const previous=evidence.services.worker;
  required(REVISION.test(previous.revision) && DIGEST.test(previous.digest),'INVALID_PREVIOUS');
  return {sourceSha,previousRevision:previous.revision,previousDigest:previous.digest};
}
export function checkStaged(sourceSha,digest,previousRevision,run=cliCall) {
  checkSource(sourceSha);
  required(DIGEST.test(digest??'') && REVISION.test(previousRevision??''),'INVALID_ARGUMENT');
  const {service,policy}=serviceInfo(run);
  required(liveRevision(service)===previousRevision,'TRAFFIC_CHANGED');
  const candidates=(service.status?.traffic??[]).filter(t=>t.tag===TAG);
  required(candidates.length===1 && (candidates[0].percent??0)===0 &&
    REVISION.test(candidates[0].revisionName??'') && /^https:\/\/[a-z0-9.-]+\.run\.app$/.test(candidates[0].url??''),
    'CANARY_NOT_FOUND');
  const name=candidates[0].revisionName;
  required(name!==previousRevision,'CANARY_EQUALS_LIVE');
  const revision=revisionInfo(name,run);
  required(checkImage(revision)===digest,'IMAGE_DIGEST_MISMATCH');
  verifyWorker(service,policy,revision,digest);
  return {sourceSha,revision:name,digest,canaryURL:candidates[0].url,previousRevision};
}
export function verifyPromoted(sourceSha,digest,revision,run=cliCall) {
  checkSource(sourceSha);
  required(DIGEST.test(digest??'') && REVISION.test(revision??''),'INVALID_ARGUMENT');
  const evidence=audit(sourceSha,run);
  required(evidence.services.worker.revision===revision && evidence.services.worker.digest===digest,
    'PROMOTION_MISMATCH');
  return {sourceSha,revision,digest,verified:true};
}
export function main(argv=process.argv.slice(2),run=cliCall,out=console) {
  try {
    const [action,...args]=argv;
    const data=action==='preflight' && args.length===1 ? preflight(args[0],run)
      : action==='staged' && args.length===3 ? checkStaged(...args,run)
      : action==='promoted' && args.length===3 ? verifyPromoted(...args,run)
      : null;
    required(data!==null,'USAGE');
    out.log(JSON.stringify(data));
    return 0;
  } catch (error) {
    const message=error instanceof Error && /^PDF_AUTO_[A-Z0-9_]+$/.test(error.message)
      ? error.message : publicReadinessDiagnostic(error) ?? 'PDF_AUTO_VALIDATION_FAILED';
    out.error(message);
    return 1;
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) process.exitCode=main();
