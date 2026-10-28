#!/usr/bin/env node
/**
 * Operator-only PDF Cloud release staging. Pure, read-only by default.
 * --stage explicitly builds and stages both immutable images with NO TRAFFIC.
 * Never grants IAM, exposes anonymous ingress, provisions secrets, or flips API.
 * Compatible with Windows PowerShell (gcloud.cmd, docker.exe through cmd.exe).
 * Legacy v1 resource/env contract, NOT the v2 deployment target. See
 * docs/operations/cloud-run-pdf-worker.md before using this operator-only tool.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CLOUD = Object.freeze({
  project: 'teacher-hub-pdf', region: 'asia-southeast1',
  worker: 'teacher-pdf-worker', gateway: 'teacher-pdf-gateway',
  workerSA: 'teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com',
  gatewaySA: 'teacher-pdf-gateway@teacher-hub-pdf.iam.gserviceaccount.com',
  workerURL: 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app',
  registry: 'asia-southeast1-docker.pkg.dev/teacher-hub-pdf/teacher-pdf',
});
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_DIGEST = /^sha256:[0-9a-f]{64}$/;
const RE_SECRET = /^[a-z][a-z0-9_-]{2,127}:[1-9][0-9]*$/;
export function cliCall(command, args, platform=process.platform, invoke=execFileSync) {
  if (!['git','docker','gcloud','node'].includes(command)) throw Error('PDF_CLOUD_UNKNOWN_COMMAND');
  if (args.some(arg=>typeof arg!=='string'||arg.includes('\0')||arg.includes('\r')||arg.includes('\n')))
    throw Error('PDF_CLOUD_UNSAFE_ARGUMENT');
  if (platform === 'win32' && command === 'gcloud') {
    // cmd shell used only for fixed command templates and allowlisted operator values.
    if (!args.every(v=>/^[A-Za-z0-9_./:@=,-]+$/.test(v))) throw Error('PDF_CLOUD_UNSAFE_WINDOWS_ARGUMENT');
    return invoke('cmd.exe',['/d','/s','/c','gcloud '+args.join(' ')],{
      encoding:'utf8',timeout:180000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  }
  return invoke(command,args,{encoding:'utf8',timeout:180000,maxBuffer:1024*1024,
    stdio:['ignore','pipe','pipe']});
}
export function stagedDeployArgs(service, image, secretVersion) {
  if (!['worker','gateway'].includes(service)|| !/^[a-z0-9-]+-docker\.pkg\.dev\/[^\s]+@sha256:[0-9a-f]{64}$/.test(image))
    throw Error('PDF_CLOUD_INVALID_IMAGE');
  const common=['--project='+CLOUD.project,'--region='+CLOUD.region,'--image='+image,
    '--no-traffic','--cpu=1','--min=0','--min-instances=0','--no-cpu-boost',
    '--cpu-throttling','--ingress=all','--port=8080',
    '--startup-probe=httpGet.path=/health,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3',
    '--quiet'];
  if (service==='worker') return ['run','deploy',CLOUD.worker,...common,
    '--service-account='+CLOUD.workerSA,'--memory=2Gi','--concurrency=1',
    '--max=3','--max-instances=3','--timeout=180',
    '--set-env-vars=PDF_PROCESSING_ENABLED=true,PDF_WORKER_IAM_READY=true,PDF_TEMP_ROOT=/tmp/pdf-worker,PDF_PRINT_FALLBACK_ENABLED=true,PDF_VIEWER_SCREEN_CAPTURE_ENABLED=true',
    '--add-volume=name=pdf-temp,type=in-memory,size-limit=32Mi,mount-path=/tmp/pdf-worker'];
  if(!RE_SECRET.test(secretVersion??''))throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
  return ['run','deploy',CLOUD.gateway,...common,
    '--service-account='+CLOUD.gatewaySA,'--memory=256Mi','--concurrency=10',
    '--max=1','--max-instances=1','--timeout=30',
    '--set-env-vars=PDF_GATEWAY_ENABLED=true,PDF_LONG_PRINT_TASKS_ENABLED=true,PDF_GATEWAY_WORKER_URL='+CLOUD.workerURL,
    '--set-secrets=PDF_GATEWAY_HMAC_KEY='+secretVersion];
}

function assertPrivate(service, policy) {
  if (!service || !policy) throw Error('PDF_CLOUD_INVENTORY_REQUIRED');
  if (service.metadata?.annotations?.['run.googleapis.com/invoker-iam-disabled']==='true' ||
    service.invokerIamDisabled===true ||
    (policy.bindings??[]).some(b=>(b.members??[]).some(m=>['allUsers','allAuthenticatedUsers'].includes(m))))
    throw Error('PDF_CLOUD_UNSAFE_INVOCATION_POLICY');
}
// --no-traffic may turn latestRevision into an explicit revision and reorder
// response fields. Compare resolved routing, including tagged URLs, not JSON bytes.
export function trafficSnapshot(traffic) {
  if (!Array.isArray(traffic) || traffic.length === 0) throw Error('PDF_CLOUD_BASELINE_TRAFFIC_REQUIRED');
  let total = 0;
  const routes = traffic.map(item => {
    const percent = item.percent ?? 0;
    if (typeof item.revisionName !== 'string' || !item.revisionName ||
        !Number.isInteger(percent) || percent < 0 || percent > 100 ||
        (item.tag !== undefined && typeof item.tag !== 'string') ||
        (item.url !== undefined && typeof item.url !== 'string')) throw Error('PDF_CLOUD_INVALID_TRAFFIC');
    total += percent;
    return JSON.stringify([item.revisionName, percent, item.tag ?? '', item.url ?? '']);
  });
  if (total !== 100) throw Error('PDF_CLOUD_INVALID_TRAFFIC');
  return JSON.stringify(routes.sort());
}
export function plan(env=process.env) {
  const sha=env.SOURCE_SHA??'';
  if(!RE_SHA.test(sha)) throw Error('PDF_CLOUD_SOURCE_SHA_REQUIRED');
  const secret=env.PDF_GATEWAY_SECRET_VERSION??'';
  return {
    sourceSha:sha, services:[CLOUD.worker,CLOUD.gateway],
    imageTags:[CLOUD.registry+'/'+CLOUD.worker+':'+sha,CLOUD.registry+'/'+CLOUD.gateway+':'+sha],
    traffic:'NO_TRAFFIC', apiEnabled:false, iamMutations:false,
    prerequisites:['gcloud operator authentication and Artifact Registry access',
      'existing private Worker and Gateway services and dedicated gateway SA',
      'service account IAM scope, secret accessor and nonce bucket policy independently reviewed',
      'Secret Manager version reference; never plaintext HMAC key',
      'Docker Linux/amd64 and clean checkout at SOURCE_SHA'],
  };
}
export function stage(env=process.env, run=cliCall) {
  const p=plan(env);
  if(!RE_SECRET.test(env.PDF_GATEWAY_SECRET_VERSION??''))
    throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
  if(env.PDF_CLOUD_STAGE_APPROVED!=='private-no-traffic'||
     env.PDF_CLOUD_IAM_REVIEWED!=='true')throw Error('PDF_CLOUD_OPERATOR_APPROVAL_REQUIRED');
  if(run('git',['rev-parse','HEAD']).trim()!==p.sourceSha ||
     run('git',['status','--porcelain']).trim()!=='')
    throw Error('PDF_CLOUD_CHECKOUT_UNVERIFIED');
  const services=[CLOUD.worker,CLOUD.gateway];
  const initialTraffic=new Map();
  // Inspect both services before any image push or deployment. A new public
  // gateway cannot be accidentally created; bootstrap private IAM separately.
  for(const name of services){
    const flags=['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];
    const svc=JSON.parse(run('gcloud',['run','services','describe',name,...flags]));
    const iam=JSON.parse(run('gcloud',['run','services','get-iam-policy',name,...flags]));
    assertPrivate(svc,iam);
    if(!Array.isArray(svc.status?.traffic)||svc.status.traffic.length<1)
      throw Error('PDF_CLOUD_BASELINE_TRAFFIC_REQUIRED');
    initialTraffic.set(name,trafficSnapshot(svc.status.traffic));
  }
  for(let i=0;i<services.length;i++){
    const name=services[i],tag=p.imageTags[i];
    const folder=name===CLOUD.worker?'workers/pdf':'workers/pdf-gateway';
    run('docker',['build','--pull','--platform','linux/amd64','-t',tag,folder]);
    run('docker',['push',tag]);
    const info=JSON.parse(run('gcloud',['artifacts','docker','images','describe',tag,
      '--project='+CLOUD.project,'--format=json']));
    const digest=info.image_summary?.digest ?? info.imageSummary?.digest;
    if(typeof digest!=='string'||!RE_DIGEST.test(digest))throw Error('PDF_CLOUD_INVALID_DIGEST');
    const args=stagedDeployArgs(i===0?'worker':'gateway',
      CLOUD.registry+'/'+name+'@'+digest,env.PDF_GATEWAY_SECRET_VERSION);
    run('gcloud',args);
    // After deployment verify no production traffic moved automatically.
    const srv=JSON.parse(run('gcloud',['run','services','describe',name,
      '--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json']));
    if(trafficSnapshot(srv.status?.traffic)!==initialTraffic.get(name))
      throw Error('PDF_CLOUD_TRAFFIC_CHECK_FAILED');
  }
  return { staged:true, traffic:'unchanged', images:2, activationAllowed:false };
}
/** Compact read-only blocker inventory; no secret payload, IAM grants or
 * operator credentials appear in the output.
 */
export function inspect(env=process.env,run=cliCall) {
  const flags=['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];
  const results={project:CLOUD.project,region:CLOUD.region,services:{},gatewayServiceAccount:'UNKNOWN',
    gatewaySecretVersion:'NOT_CONFIGURED',activationAllowed:false};
  for(const name of [CLOUD.worker,CLOUD.gateway]) {
    try {
      const svc=JSON.parse(run('gcloud',['run','services','describe',name,...flags]));
      const policy=JSON.parse(run('gcloud',['run','services','get-iam-policy',name,...flags]));
      try {
        assertPrivate(svc,policy);
        results.services[name]='EXISTS_PRIVATE_DIRECT_IAM';
      } catch { results.services[name]='POLICY_REQUIRES_REVIEW'; }
    } catch { results.services[name]='NOT_FOUND_OR_NOT_READABLE'; }
  }
  try {
    const sa=JSON.parse(run('gcloud',['iam','service-accounts','describe',CLOUD.gatewaySA,
      '--project='+CLOUD.project,'--format=json']));
    results.gatewayServiceAccount=sa.email===CLOUD.gatewaySA?'EXISTS':'UNEXPECTED_IDENTITY';
  } catch { results.gatewayServiceAccount='NOT_FOUND_OR_NOT_READABLE'; }
  const reference=env.PDF_GATEWAY_SECRET_VERSION;
  if(reference) {
    if(!RE_SECRET.test(reference))results.gatewaySecretVersion='INVALID_REFERENCE';
    else {
      const [name,version]=reference.split(':');
      try {
        const item=JSON.parse(run('gcloud',['secrets','versions','describe',version,
          '--secret='+name,'--project='+CLOUD.project,'--format=json']));
        results.gatewaySecretVersion=item.state==='ENABLED'?'ENABLED_VERSION_EXISTS':'NOT_ENABLED';
      } catch { results.gatewaySecretVersion='NOT_FOUND_OR_NOT_READABLE'; }
    }
  }
  return results;
}
export function main(argv=process.argv.slice(2),env=process.env,run=cliCall) {
  if(argv.length!==1||!['--plan','--inspect','--stage'].includes(argv[0])){
    console.error('Usage: node scripts/pdf-cloud-stage.mjs --plan | --inspect | --stage');return 2;
  }
  try {
    if(argv[0]==='--plan')console.log(JSON.stringify(plan(env),null,2));
    else if(argv[0]==='--inspect')console.log(JSON.stringify(inspect(env,run),null,2));
    else console.log(JSON.stringify(stage(env,run)));
    return 0;
  }catch(e){
    // Never print credentials, gcloud stderr, secret names or upstream diagnostics.
    console.error(e instanceof Error && e.message.startsWith('PDF_CLOUD_') ?
      e.message : 'PDF_CLOUD_STAGE_FAILED');
    return 2;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main();
