// Read-only deployment gate. Deliberately separate from the older v1 staging tools.
import {pathToFileURL} from 'node:url';
import {CLOUD, cliCall} from './pdf-cloud-stage.mjs';
import {checkPolicy} from './pdf-cloud-stage-public-hmac.mjs';

export const RELEASE = Object.freeze({
  worker: {revision:'teacher-pdf-worker-00020-fiv', digest:'sha256:7b0e5d6bcd5ce4aa449939ddf3e31d8f93fd4b6e88c20922850810c06009f5cb'},
  gateway: {revision:'teacher-pdf-gateway-00013-gej', digest:'sha256:5adfd3d41adf82dde6158e9b0c97acbaebb173837cdf7cee99f9680009e1744f'},
});
const requireCheck = (ok, code) => { if (!ok) throw Error('PDF_V2_'+code); };
const env = (c,n) => c?.env?.find(e=>e.name===n)?.value;
const ready = s => s?.conditions?.some(c=>c.type==='Ready'&&c.status==='True');

// Only locally constructed diagnostics reach stderr. Never forward command args,
// stdout, stderr or Error.message: gcloud can include credentials and payloads.
class ReadinessDiagnostic extends Error {}
function commandFailure(step, error) {
  const detail = [error?.stderr, error?.message].map(v=>
    typeof v==='string' || Buffer.isBuffer(v) ? String(v) : '').join('\n');
  const reason = error?.code==='ENOENT' ? 'GCLOUD_NOT_FOUND' :
    error?.code==='ETIMEDOUT' ? 'COMMAND_TIMEOUT' :
    error?.code==='ENOBUFS' ? 'OUTPUT_LIMIT_EXCEEDED' :
    /SERVICE_DISABLED|API has not been used|API.*disabled/i.test(detail) ? 'API_DISABLED' :
    /UNAUTHENTICATED|invalid_grant|invalid credentials|reauthentication|no active account|do not currently have an active account/i.test(detail) ? 'UNAUTHENTICATED' :
    /PERMISSION_DENIED|permission[^\n]*denied|does not have permission/i.test(detail) ? 'PERMISSION_DENIED' :
    /NOT_FOUND|was not found|does not exist/i.test(detail) ? 'NOT_FOUND' :
    /DEADLINE_EXCEEDED|timed out/i.test(detail) ? 'DEADLINE_EXCEEDED' :
    /UNAVAILABLE|connection|name resolution/i.test(detail) ? 'UNAVAILABLE' : 'COMMAND_FAILED';
  const permission = ['run.services.getIamPolicy','run.services.get','run.revisions.get','cloudtasks.queues.get',
    'iam.serviceAccounts.getAccessToken','iam.serviceAccounts.getOpenIdToken','serviceusage.services.use']
    .find(p=>detail.includes(p));
  const status = Number.isInteger(error?.status) && error.status>=0 && error.status<=255
    ? ' exit='+error.status : '';
  const signal = ['SIGTERM','SIGKILL','SIGINT'].includes(error?.signal) ? ' signal='+error.signal : '';
  return new ReadinessDiagnostic('PDF_V2_'+step+'_READ_FAILED: reason='+reason+
    (permission ? ' permission='+permission : '')+status+signal);
}
function readCloud(step, args, run) {
  let raw;
  try { raw=run('gcloud',args); }
  catch(error) { throw commandFailure(step,error); }
  try { return JSON.parse(raw); }
  catch { throw new ReadinessDiagnostic('PDF_V2_'+step+'_READ_FAILED: reason=INVALID_JSON'); }
}

export function evaluateService(kind, service, revision, policy, expected=RELEASE[kind]) {
  const worker=kind==='worker', name=worker?CLOUD.worker:CLOUD.gateway;
  requireCheck(!!expected,'UNKNOWN_SERVICE');
  checkPolicy(name,service,policy);
  if(worker) requireCheck(policy.bindings?.some(b=>b.role==='roles/run.invoker' && !b.condition &&
    b.members?.includes('serviceAccount:teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com')),'TASK_INVOKER_UNVERIFIED');
  requireCheck(service.metadata?.name===name && ready(service.status) &&
    service.status?.observedGeneration===service.metadata?.generation,'SERVICE_NOT_READY');
  const routes=service.status?.traffic;
  requireCheck(Array.isArray(routes) && routes.reduce((n,r)=>n+(r.percent??0),0)===100 &&
    routes.every(r=>(r.percent??0)===0 || r.revisionName===expected.revision),'TRAFFIC_MISMATCH');
  const spec=revision?.spec, c=spec?.containers?.[0];
  const scale=service.spec?.template?.metadata?.annotations;
  requireCheck(scale?.['autoscaling.knative.dev/maxScale']==='1' &&
    (scale?.['autoscaling.knative.dev/minScale']??'0')==='0','SCALING_DRIFT');
  const image=CLOUD.registry+'/'+name+'@'+expected.digest;
  requireCheck(revision?.metadata?.name===expected.revision && ready(revision.status) &&
    c?.image===image && [image,expected.digest].includes(revision.status?.imageDigest),'REVISION_DIGEST_MISMATCH');
  requireCheck(spec?.serviceAccountName===(worker?CLOUD.workerSA:CLOUD.gatewaySA) &&
    Number(spec.timeoutSeconds)>=180 && Number(spec.containerConcurrency)===(worker?1:10) &&
    c.resources?.limits?.cpu==='1' && c.resources?.limits?.memory===(worker?'2Gi':'256Mi'),'RESOURCE_DRIFT');
  requireCheck(env(c,'PDF_CHUNKED_JOBS_ENABLED')==='true','CHUNKS_DISABLED');
  if(worker) {
    requireCheck(['PDF_PROCESSING_ENABLED','PDF_WORKER_IAM_READY','PDF_PRINT_FALLBACK_ENABLED'].every(n=>env(c,n)==='true'),'WORKER_DISABLED');
    const mount=c.volumeMounts?.find(v=>v.mountPath==='/tmp/pdf-worker');
    const volume=spec.volumes?.find(v=>v.name===mount?.name);
    requireCheck(mount && volume?.emptyDir?.medium==='Memory' && volume.emptyDir.sizeLimit==='384Mi' &&
      env(c,'PDF_TEMP_ROOT')==='/tmp/pdf-worker','SCRATCH_DRIFT');
  } else {
    requireCheck(env(c,'PDF_GATEWAY_ENABLED')==='true' &&
      env(c,'PDF_GATEWAY_WORKER_URL')===CLOUD.workerURL &&
      c.env?.some(e=>e.name==='PDF_GATEWAY_HMAC_KEY' && e.value===undefined && e.valueFrom?.secretKeyRef),'GATEWAY_DRIFT');
  }
  return {revision:expected.revision,digest:expected.digest};
}

export function audit(sourceSha, run=cliCall, options={}) {
  requireCheck(/^[a-f0-9]{40}$/.test(sourceSha??''),'SOURCE_SHA_REQUIRED');
  const common=['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];
  const services={};
  for(const kind of ['worker','gateway']) {
    const name=CLOUD[kind];
    const step=kind.toUpperCase();
    const service=readCloud(step+'_SERVICE',['run','services','describe',name,...common],run);
    // Managed Worker releases verify the live immutable platform digest, not a stale
    // source pin. Gateway is still pinned to its reviewed revision and digest.
    let expected=RELEASE[kind];
    if(kind==='worker' && options.managedWorker===true) {
      const live=(service.status?.traffic??[]).filter(t=>(t.percent??0)>0);
      requireCheck(live.length===1 && live[0].percent===100 &&
        /^teacher-pdf-worker-[a-z0-9-]+$/.test(live[0].revisionName??''),'WORKER_LIVE_REVISION_INVALID');
      const current=readCloud(step+'_REVISION',['run','revisions','describe',live[0].revisionName,...common],run);
      const image=current?.spec?.containers?.[0]?.image??'';
      const prefix=CLOUD.registry+'/'+CLOUD.worker+'@';
      requireCheck(image.startsWith(prefix) && /^sha256:[a-f0-9]{64}$/.test(image.slice(prefix.length)),
        'WORKER_LIVE_IMAGE_INVALID');
      expected={revision:live[0].revisionName,digest:image.slice(prefix.length)};
      const policy=readCloud(step+'_IAM',['run','services','get-iam-policy',name,...common],run);
      try { services[kind]=evaluateService(kind,service,current,policy,expected); }
      catch(error) {
        const code=/^PDF_(V2|CLOUD)_[A-Z0-9_]+$/.test(error?.message) ? error.message : 'INVALID_RESPONSE';
        throw new ReadinessDiagnostic('PDF_V2_'+step+'_VALIDATION_FAILED: '+code);
      }
      continue;
    }
    const revision=readCloud(step+'_REVISION',['run','revisions','describe',expected.revision,...common],run);
    const policy=readCloud(step+'_IAM',['run','services','get-iam-policy',name,...common],run);
    try { services[kind]=evaluateService(kind,service,revision,policy,expected); }
    catch(error) {
      const code=/^PDF_(V2|CLOUD)_[A-Z0-9_]+$/.test(error?.message) ? error.message : 'INVALID_RESPONSE';
      throw new ReadinessDiagnostic('PDF_V2_'+step+'_VALIDATION_FAILED: '+code);
    }
  }
  const q=readCloud('QUEUE',['tasks','queues','describe','teacher-pdf-queue','--project='+CLOUD.project,'--location='+CLOUD.region,'--format=json'],run);
  requireCheck(q?.name===`projects/${CLOUD.project}/locations/${CLOUD.region}/queues/teacher-pdf-queue` &&
    q.state==='RUNNING' && !q.httpTarget && q.rateLimits?.maxConcurrentDispatches===1 &&
    q.rateLimits.maxDispatchesPerSecond>0 && q.rateLimits.maxDispatchesPerSecond<=1 &&
    q.retryConfig?.maxAttempts===5 && q.retryConfig.maxRetryDuration==='3600s' &&
    q.retryConfig.minBackoff==='10s' && q.retryConfig.maxBackoff==='300s','QUEUE_DRIFT');
  return {version:1,sourceSha,checkedAt:new Date().toISOString(),workerURL:CLOUD.workerURL,
    gatewayURL:'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app',services,result:'PASS'};
}

export function main(argv=process.argv.slice(2),run=cliCall,output=console) {
  try { output.log(JSON.stringify(audit(argv[0],run,{managedWorker:process.env.PDF_WORKER_AUTO_DEPLOY_ENABLED==='true'}))); return 0; }
  catch(e) {
    output.error(e instanceof ReadinessDiagnostic || ['PDF_V2_SOURCE_SHA_REQUIRED','PDF_V2_QUEUE_DRIFT'].includes(e?.message)
      ? e.message : 'PDF_V2_READINESS_FAILED: reason=UNEXPECTED_ERROR');
    return 1;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main();
