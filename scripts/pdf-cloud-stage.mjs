#!/usr/bin/env node
/**
 * Operator-only PDF Cloud release staging. Pure, read-only by default.
 * --stage explicitly builds and stages both immutable images with NO TRAFFIC.
 * Never grants IAM, exposes anonymous ingress, provisions secrets, or flips API.
 * Compatible with Windows PowerShell (gcloud.cmd, docker.exe through cmd.exe).
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { revisionReadCommand } from './pdf-cloud-readiness.mjs';

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
    '--max=3','--max-instances=3','--timeout=30',
    '--set-env-vars=PDF_PROCESSING_ENABLED=true,PDF_WORKER_IAM_READY=true,PDF_TEMP_ROOT=/tmp/pdf-worker',
    '--add-volume=name=pdf-temp,type=in-memory,size-limit=32Mi,mount-path=/tmp/pdf-worker'];
  if(!RE_SECRET.test(secretVersion??''))throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
  return ['run','deploy',CLOUD.gateway,...common,
    '--service-account='+CLOUD.gatewaySA,'--memory=256Mi','--concurrency=10',
    '--max=1','--max-instances=1','--timeout=30',
    '--set-env-vars=PDF_GATEWAY_ENABLED=true,PDF_GATEWAY_WORKER_URL='+CLOUD.workerURL,
    '--set-secrets=PDF_GATEWAY_HMAC_KEY='+secretVersion];
}

function assertPrivate(service, policy) {
  if (!service || !policy) throw Error('PDF_CLOUD_INVENTORY_REQUIRED');
  if (service.metadata?.annotations?.['run.googleapis.com/invoker-iam-disabled']==='true' ||
    service.invokerIamDisabled===true ||
    (policy.bindings??[]).some(b=>(b.members??[]).some(m=>['allUsers','allAuthenticatedUsers'].includes(m))))
    throw Error('PDF_CLOUD_UNSAFE_INVOCATION_POLICY');
}
export function plan(env=process.env) {
  const sha=env.SOURCE_SHA??'';
  if(!RE_SHA.test(sha)) throw Error('PDF_CLOUD_SOURCE_SHA_REQUIRED');
  const secret=env.PDF_GATEWAY_SECRET_VERSION??'';
  if(!RE_SECRET.test(secret))throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
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
  if(env.PDF_CLOUD_STAGE_APPROVED!=='private-no-traffic'||
     env.PDF_CLOUD_IAM_REVIEWED!=='true')throw Error('PDF_CLOUD_OPERATOR_APPROVAL_REQUIRED');
  if(run('git',['rev-parse','HEAD']).trim()!==p.sourceSha ||
     run('git',['status','--porcelain']).trim()!=='')
    throw Error('PDF_CLOUD_CHECKOUT_UNVERIFIED');
  const services=[CLOUD.worker,CLOUD.gateway];
  // Inspect both services before any image push or deployment. A new public
  // gateway cannot be accidentally created; bootstrap private IAM separately.
  for(const name of services){
    const flags=['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];
    const svc=JSON.parse(run('gcloud',['run','services','describe',name,...flags]));
    const iam=JSON.parse(run('gcloud',['run','services','get-iam-policy',name,...flags]));
    assertPrivate(svc,iam);
  }
  for(let i=0;i<services.length;i++){
    const name=services[i],tag=p.imageTags[i];
    const folder=name===CLOUD.worker?'workers/pdf':'workers/pdf-gateway';
    run('docker',['build','--pull','--platform','linux/amd64','-t',tag,folder]);
    run('docker',['push',tag]);
    const digest=run('gcloud',['artifacts','docker','images','describe',tag,
      '--project='+CLOUD.project,'--format=value(image_summary.digest)']).trim();
    if(!RE_DIGEST.test(digest))throw Error('PDF_CLOUD_INVALID_DIGEST');
    const args=stagedDeployArgs(i===0?'worker':'gateway',
      CLOUD.registry+'/'+name+'@'+digest,env.PDF_GATEWAY_SECRET_VERSION);
    run('gcloud',args);
    // After deployment verify no production traffic moved automatically.
    const srv=JSON.parse(run('gcloud',['run','services','describe',name,
      '--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json']));
    if(!srv.status?.traffic?.length || srv.status.traffic.some(t=>t.tag==='pdf-staging'))
      throw Error('PDF_CLOUD_TRAFFIC_CHECK_FAILED');
  }
  return { staged:true, traffic:'unchanged', images:2, activationAllowed:false };
}
export function main(argv=process.argv.slice(2),env=process.env,run=cliCall) {
  if(argv.length!==1||!['--plan','--stage'].includes(argv[0])){
    console.error('Usage: node scripts/pdf-cloud-stage.mjs --plan | --stage');return 2;
  }
  try {
    if(argv[0]==='--plan')console.log(JSON.stringify(plan(env),null,2));
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
