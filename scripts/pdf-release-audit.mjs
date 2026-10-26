#!/usr/bin/env node
/**
 * Read-only audit of immutable no-traffic Worker and public-HMAC Gateway
 * revisions, with exact Artifact Registry source-SHA and digest matching.
 * No IAM, traffic, secrets, Cloud Tasks, or application mutations.
 */
import {pathToFileURL} from 'node:url';
import {CLOUD, cliCall, trafficSnapshot} from './pdf-cloud-stage.mjs';
import {checkPolicy, safeStep} from './pdf-cloud-stage-public-hmac.mjs';

const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const cliFlags=['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];
const fail=code=>{throw Error('PDF_CLOUD_'+code);};
const fetchJson=(run,args)=>JSON.parse(run('gcloud',args));
const revisionReady=r=>r?.status?.conditions?.some(c=>c.type==='Ready'&&c.status==='True');
const env=(c,key)=>c?.env?.find(v=>v.name===key)?.value;

export function evaluateStaged(name,sha,service,policy,revision,image){
  if(!SHA.test(sha))fail('STAGED_SHA_REQUIRED');
  if(![CLOUD.worker,CLOUD.gateway].includes(name))fail('UNKNOWN_SERVICE');
  checkPolicy(name,service,policy);
  if(service?.metadata?.name!==name)fail('SERVICE_MISMATCH');
  const staged=service?.status?.latestCreatedRevisionName;
  if(typeof staged!=='string'||!new RegExp('^'+name+'-[0-9]{5}-[a-z0-9]+$').test(staged)||
     revision?.metadata?.name!==staged)fail('LATEST_REVISION_UNVERIFIED');
  if(!revisionReady(revision))fail('STAGED_REVISION_NOT_READY');
  const spec=revision?.spec, c=spec?.containers?.[0];
  const digest=image?.image_summary?.digest??image?.imageSummary?.digest;
  if(typeof digest!=='string'||!DIGEST.test(digest))fail('REGISTRY_DIGEST_UNVERIFIED');
  const immutable=CLOUD.registry+'/'+name+'@'+digest;
  if(c?.image!==immutable||
     !(revision.status?.imageDigest===digest||revision.status?.imageDigest===immutable))
    fail('STAGED_IMAGE_DIGEST_MISMATCH');
  try{trafficSnapshot(service?.status?.traffic);}
  catch{fail('BASELINE_TRAFFIC_UNVERIFIED');}
  if(service.status.traffic.some(t=>t.revisionName===staged&&(t.percent??0)>0))
    fail('STAGED_REVISION_HAS_TRAFFIC');
  const worker=name===CLOUD.worker;
  if(spec?.serviceAccountName!==(worker?CLOUD.workerSA:CLOUD.gatewaySA))
    fail('RUNTIME_IDENTITY_DRIFT');
  if(Number(spec?.containerConcurrency)!==(worker?1:10)||
     Number(spec?.timeoutSeconds)!==(worker?180:30)||
     String(c?.resources?.limits?.cpu)!=='1'||
     c?.resources?.limits?.memory!==(worker?'2Gi':'256Mi'))
    fail('RESOURCE_LIMIT_DRIFT');
  if(worker){
    if(env(c,'PDF_PROCESSING_ENABLED')!=='true'||
       env(c,'PDF_WORKER_IAM_READY')!=='true'||
       env(c,'PDF_TEMP_ROOT')!=='/tmp/pdf-worker'||
       env(c,'PDF_PRINT_FALLBACK_ENABLED')!=='true'||
       env(c,'PDF_VIEWER_SCREEN_CAPTURE_ENABLED')!=='true')fail('WORKER_FEATURE_GATE_DRIFT');
    const mounted=c?.volumeMounts?.some(v=>v.name==='pdf-temp'&&v.mountPath==='/tmp/pdf-worker');
    const vol=spec?.volumes?.some(v=>v.name==='pdf-temp'&&v.emptyDir?.medium==='Memory'&&
      v.emptyDir?.sizeLimit==='32Mi');
    if(!mounted||!vol)fail('WORKER_TEMP_VOLUME_DRIFT');
  } else {
    if(env(c,'PDF_GATEWAY_ENABLED')!=='true'||
       env(c,'PDF_LONG_PRINT_TASKS_ENABLED')!=='true'||
       env(c,'PDF_GATEWAY_WORKER_URL')!==CLOUD.workerURL||
       !c.env?.some(v=>v.name==='PDF_GATEWAY_HMAC_KEY'&&v.value===undefined&&
         v.valueFrom?.secretKeyRef))fail('GATEWAY_FEATURE_GATE_DRIFT');
  }
  return{service:name,revision:staged,imageDigest:digest,
    iam:worker?'PRIVATE':'PUBLIC_HMAC',ready:true,receivingTraffic:false,
    gates:Object.fromEntries((worker
      ? ['PDF_PROCESSING_ENABLED','PDF_WORKER_IAM_READY','PDF_PRINT_FALLBACK_ENABLED','PDF_VIEWER_SCREEN_CAPTURE_ENABLED']
      : ['PDF_GATEWAY_ENABLED','PDF_LONG_PRINT_TASKS_ENABLED']).map(key=>[key,env(c,key)])),
    resourceLimits:'VERIFIED'};
}
export function auditStaged(values=process.env,run=cliCall,progress=()=>{}){
  const sha=values.PDF_STAGED_SHA;
  if(!SHA.test(sha??''))fail('STAGED_SHA_REQUIRED');
  const services=[];
  for(const name of [CLOUD.worker,CLOUD.gateway]){
    const service=safeStep('AUDIT_SERVICE',()=>fetchJson(run,['run','services','describe',name,...cliFlags]),progress);
    const iam=safeStep('AUDIT_IAM',()=>fetchJson(run,['run','services','get-iam-policy',name,...cliFlags]),progress);
    const latest=service?.status?.latestCreatedRevisionName;
    if(typeof latest!=='string'||!new RegExp('^'+name+'-[0-9]{5}-[a-z0-9]+$').test(latest))
      fail('LATEST_REVISION_UNVERIFIED');
    const revision=safeStep('AUDIT_REVISION',()=>fetchJson(run,['run','revisions','describe',latest,...cliFlags]),progress);
    const image=safeStep('AUDIT_REGISTRY',()=>fetchJson(run,['artifacts','docker','images','describe',
      CLOUD.registry+'/'+name+':'+sha,'--project='+CLOUD.project,'--format=json']),progress);
    services.push(safeStep('AUDIT_EVIDENCE',()=>evaluateStaged(name,sha,service,iam,revision,image),progress));
  }
  return{audit:'PASS',stagedSha:sha,services,traffic:'UNCHANGED_BY_AUDIT',
    activationAllowed:false,realViewerE2E:'NOT_VERIFIED'};
}
export function main(args=process.argv.slice(2),values=process.env,run=cliCall){
  if(args.length!==1||args[0]!=='--check'){
    console.error('Usage: set PDF_STAGED_SHA then node scripts/pdf-release-audit.mjs --check');
    return 2;
  }
  try{
    console.log(JSON.stringify(auditStaged(values,run,s=>console.error('[pdf-audit] '+s)),null,2));
    return 0;
  }catch(e){
    console.error(e instanceof Error&&/^PDF_CLOUD_[A-Z0-9_]+$/.test(e.message)?
      e.message:'PDF_CLOUD_RELEASE_AUDIT_FAILED');
    return 2;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main();
