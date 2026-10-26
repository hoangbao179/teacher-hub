#!/usr/bin/env node
/**
 * Stage the PDF Worker (private IAM) and the existing intentionally public-HMAC
 * Gateway with NO TRAFFIC. This is distinct from the strictly-private
 * pdf-cloud-stage.mjs script and never mutates IAM or production traffic.
 */
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CLOUD, cliCall, stagedDeployArgs, trafficSnapshot } from './pdf-cloud-stage.mjs';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SECRET = /^[a-z][a-z0-9_-]{2,127}:[1-9][0-9]*$/;
const common = ['--project='+CLOUD.project,'--region='+CLOUD.region,'--format=json'];

export function checkPolicy(name, service, iam) {
  if (!service || !iam || typeof iam !== 'object' || Array.isArray(iam) ||
      (iam.bindings !== undefined && !Array.isArray(iam.bindings)))
    throw Error('PDF_CLOUD_POLICY_UNVERIFIED');
  const hasPublicRole = (iam.bindings ?? []).some(b => (b.members ?? []).some(m =>
    m === 'allUsers' || m === 'allAuthenticatedUsers'));
  if (hasPublicRole) throw Error('PDF_CLOUD_PUBLIC_IAM_BINDING_FORBIDDEN');
  const disabled = service.metadata?.annotations?.['run.googleapis.com/invoker-iam-disabled'] === 'true' ||
    service.invokerIamDisabled === true;
  if (name === CLOUD.gateway) {
    // Option B is public-HMAC by the explicit invoker-IAM-check setting only;
    // never accept allUsers bindings or an unverified/missing public mode.
    if (!disabled) throw Error('PDF_CLOUD_EXPECTED_PUBLIC_HMAC_GATEWAY');
  } else if (name === CLOUD.worker) {
    if (disabled) throw Error('PDF_CLOUD_WORKER_MUST_REMAIN_IAM_PRIVATE');
  } else throw Error('PDF_CLOUD_UNKNOWN_SERVICE');
}

export function safeStep(label, action, progress = () => {}) {
  progress(label);
  try { return action(); }
  catch(error) {
    // Never disclose raw gcloud, Docker, local paths or authentication stderr.
    const message = error instanceof Error && /^PDF_CLOUD_[A-Z0-9_]+$/.test(error.message)
      ? error.message : 'PDF_CLOUD_COMMAND_FAILED';
    throw Error('PDF_CLOUD_STEP_' + label + '_' + message.replace(/^PDF_CLOUD_/, ''));
  }
}

export function localOperatorCall(command,args) {
  // Chromium images are large. The shared generic 180s/1MiB buffered process
  // budget is appropriate for gcloud inventory, but not for Docker image build.
  // Show Docker progress live without storing logs/credentials in the script.
  if (command === 'docker' && (args[0] === 'build' || args[0] === 'push')) {
    execFileSync('docker',args,{stdio:['ignore','inherit','inherit'],timeout:900000});
    return '';
  }
  return cliCall(command,args);
}

function inventory(name, run) {
  const service=JSON.parse(run('gcloud',['run','services','describe',name,...common]));
  const iam=JSON.parse(run('gcloud',['run','services','get-iam-policy',name,...common]));
  checkPolicy(name,service,iam);
  return service;
}

export function preflightPublicHmac(env=process.env,run=localOperatorCall,progress=()=>{}) {
  if (!SHA.test(env.SOURCE_SHA ?? '')) throw Error('PDF_CLOUD_SOURCE_SHA_REQUIRED');
  if (!SECRET.test(env.PDF_GATEWAY_SECRET_VERSION ?? '')) throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
  safeStep('GIT', () => {
    if (run('git',['rev-parse','HEAD']).trim() !== env.SOURCE_SHA ||
        run('git',['status','--porcelain']).trim() !== '')
      throw Error('PDF_CLOUD_CHECKOUT_UNVERIFIED');
  },progress);
  safeStep('WORKER_IAM',()=>inventory(CLOUD.worker,run),progress);
  safeStep('GATEWAY_HMAC',()=>inventory(CLOUD.gateway,run),progress);
  safeStep('DOCKER_DAEMON',()=>{
    if (!run('docker',['version','--format','{{.Server.Version}}']).trim())
      throw Error('PDF_CLOUD_DOCKER_NOT_READY');
  },progress);
  const [secret,version]=env.PDF_GATEWAY_SECRET_VERSION.split(':');
  safeStep('SECRET_METADATA',()=>{
    const value=JSON.parse(run('gcloud',['secrets','versions','describe',version,
      '--secret='+secret,'--project='+CLOUD.project,'--format=json']));
    if(value.state !== 'ENABLED') throw Error('PDF_CLOUD_SECRET_NOT_ENABLED');
  },progress);
  return {preflight:true,worker:'IAM_PRIVATE',gateway:'PUBLIC_HMAC',
    docker:'READY',secret:'ENABLED',traffic:'not_modified'};
}

export function stagePublicHmac(env=process.env,run=localOperatorCall,progress=()=>{}) {
  if (!SHA.test(env.SOURCE_SHA ?? '')) throw Error('PDF_CLOUD_SOURCE_SHA_REQUIRED');
  if (!SECRET.test(env.PDF_GATEWAY_SECRET_VERSION ?? '')) throw Error('PDF_CLOUD_SECRET_REFERENCE_REQUIRED');
  if (env.PDF_CLOUD_PUBLIC_HMAC_STAGE_APPROVED !== 'public-hmac-no-traffic' ||
      env.PDF_CLOUD_IAM_REVIEWED !== 'true' ||
      env.PDF_CLOUD_HMAC_REVIEWED !== 'true') throw Error('PDF_CLOUD_OPERATOR_APPROVAL_REQUIRED');
  // Preflight uses only read operations, and isolates the exact failure step.
  preflightPublicHmac(env,run,progress);
  const names=[CLOUD.worker,CLOUD.gateway];
  const before=new Map();
  // Fail closed BEFORE building/pushing anything if either security boundary
  // cannot be positively verified from the live service and IAM policy.
  for(const name of names) {
    const service=safeStep(name===CLOUD.worker?'WORKER_INVENTORY':'GATEWAY_INVENTORY',
      ()=>inventory(name,run),progress);
    before.set(name,trafficSnapshot(service.status?.traffic));
  }
  for(const name of names) {
    const tag=CLOUD.registry+'/'+name+':'+env.SOURCE_SHA;
    const folder=name===CLOUD.worker?'workers/pdf':'workers/pdf-gateway';
    const part=name===CLOUD.worker?'WORKER':'GATEWAY';
    safeStep(part+'_DOCKER_BUILD',()=>run('docker',['build','--pull','--platform','linux/amd64','-t',tag,folder]),progress);
    safeStep(part+'_DOCKER_PUSH',()=>run('docker',['push',tag]),progress);
    const image=safeStep(part+'_IMAGE_DIGEST',()=>JSON.parse(run('gcloud',['artifacts','docker','images','describe',tag,
      '--project='+CLOUD.project,'--format=json'])),progress);
    const digest=image.image_summary?.digest ?? image.imageSummary?.digest;
    if(typeof digest !== 'string' || !DIGEST.test(digest)) throw Error('PDF_CLOUD_INVALID_DIGEST');
    const service=name===CLOUD.worker?'worker':'gateway';
    const immutableImage=CLOUD.registry+'/'+name+'@'+digest;
    const args=stagedDeployArgs(service,immutableImage,env.PDF_GATEWAY_SECRET_VERSION);
    // The only deployment action is a new immutable revision without traffic.
    if(!args.includes('--no-traffic') || args.some(a => /allow-unauthenticated|invoker-iam-check|set-iam-policy/.test(a)))
      throw Error('PDF_CLOUD_UNSAFE_STAGING_ARGUMENTS');
    safeStep(part+'_DEPLOY_NO_TRAFFIC',()=>run('gcloud',args),progress);
    const current=safeStep(part+'_VERIFY_IAM_TRAFFIC',()=>inventory(name,run),progress);
    if(trafficSnapshot(current.status?.traffic)!==before.get(name))
      throw Error('PDF_CLOUD_TRAFFIC_CHANGED');
  }
  return {staged:true,mode:'public-hmac-gateway',traffic:'unchanged',
    services:2,activationAllowed:false};
}

export function main(argv=process.argv.slice(2),env=process.env,run=localOperatorCall) {
  if(argv.length!==1 || !['--preflight','--stage'].includes(argv[0])) {
    console.error('Usage: node scripts/pdf-cloud-stage-public-hmac.mjs --preflight | --stage');
    return 2;
  }
  try {
    const progress=step=>console.error('[pdf-stage] '+step);
    const value=argv[0]==='--preflight'
      ? preflightPublicHmac(env,run,progress)
      : stagePublicHmac(env,run,progress);
    console.log(JSON.stringify(value));
    return 0;
  }
  catch(e) {
    console.error(e instanceof Error && /^PDF_CLOUD_/.test(e.message) ? e.message :
      'PDF_CLOUD_PUBLIC_HMAC_STAGE_FAILED');
    return 2;
  }
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  process.exitCode=main();
