#!/usr/bin/env node
/** Operator-only staging, offline image PDF smoke, and read-only GCP audit.
 * Never changes IAM, production traffic, VPS flags or print restriction policy. */
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {stagePublicHmac} from './pdf-cloud-stage-public-hmac.mjs';
import {auditStaged} from './pdf-release-audit.mjs';
import {dockerSmokeArgs} from './pdf-local-runtime-audit.mjs';
export function releaseOnce(env=process.env,ops={}){
  const stage=ops.stage??stagePublicHmac;
  const audit=ops.audit??auditStaged;
  const docker=ops.docker??execFileSync;
  const progress=ops.progress??(label=>console.error('[pdf-release] '+label));
  if(!/^[a-f0-9]{40}$/.test(env.SOURCE_SHA??'')||
     env.PDF_CLOUD_PUBLIC_HMAC_STAGE_APPROVED!=='public-hmac-no-traffic'||
     env.PDF_CLOUD_IAM_REVIEWED!=='true'||env.PDF_CLOUD_HMAC_REVIEWED!=='true')
    throw Error('PDF_CLOUD_RELEASE_APPROVAL_REQUIRED');
  const staged=stage(env,undefined,progress);
  if(staged?.staged!==true||staged?.traffic!=='unchanged'||staged?.activationAllowed!==false)
    throw Error('PDF_CLOUD_STAGING_NOT_VERIFIED');
  progress('LOCAL_IMAGE_PDF_SMOKE');
  const root=resolve(fileURLToPath(new URL('../workers/pdf/test/',import.meta.url)));
  docker('docker',dockerSmokeArgs(env.SOURCE_SHA,root),{stdio:'inherit',timeout:180000});
  progress('CLOUD_IMMUTABLE_REVISION_AUDIT');
  const result=audit({...env,PDF_STAGED_SHA:env.SOURCE_SHA},undefined,progress);
  if(result?.audit!=='PASS'||result?.activationAllowed!==false||result?.services?.length!==2)
    throw Error('PDF_CLOUD_RELEASE_AUDIT_NOT_VERIFIED');
  return {stage:'PASS',smoke:'PASS',cloudAudit:'PASS',traffic:'UNCHANGED',activationAllowed:false,
    printRestrictedViewer:'NOT_SUPPORTED'};
}
export function main(argv=process.argv.slice(2),env=process.env,ops={}){
  if(argv.length!==1||argv[0]!=='--stage-and-verify'){
    console.error('Usage: node scripts/pdf-release-one-shot.mjs --stage-and-verify');
    return 2;
  }
  try{console.log(JSON.stringify(releaseOnce(env,ops)));return 0;}
  catch(e){console.error(e instanceof Error&&/^PDF_CLOUD_[A-Z0-9_]+$/.test(e.message)?
    e.message:'PDF_CLOUD_RELEASE_ONE_SHOT_FAILED');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main();
