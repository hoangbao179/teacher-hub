#!/usr/bin/env node
// One-shot read-only/air-gapped smoke of the already staged local Docker image.
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {CLOUD} from './pdf-cloud-stage.mjs';

export function dockerSmokeArgs(sha,root){
  if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('PDF_CLOUD_STAGED_SHA_REQUIRED');
  if(typeof root!=='string'||!root||/[\r\n\0]/.test(root))throw Error('PDF_CLOUD_INVALID_TEST_PATH');
  return ['run','--rm','--platform','linux/amd64','--network','none',
    '--cpus=1','--memory=2g','--memory-swap=2g','--pids-limit=128',
    '--shm-size=256m','--read-only','--cap-drop=ALL',
    '--security-opt=no-new-privileges','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,mode=1777',
    '--mount','type=bind,source='+root+',target=/app/test,readonly',
    CLOUD.registry+'/'+CLOUD.worker+':'+sha,'node','/app/test/image-pdf-runtime-smoke.mjs'];
}
export function main(args=process.argv.slice(2),env=process.env,run=execFileSync){
  if(args.length!==1||args[0]!=='--smoke'){
    console.error('Usage: set PDF_STAGED_SHA then node scripts/pdf-local-runtime-audit.mjs --smoke');
    return 2;
  }
  try{
    const root=resolve(fileURLToPath(new URL('../workers/pdf/test/',import.meta.url)));
    run('docker',dockerSmokeArgs(env.PDF_STAGED_SHA,root),{stdio:'inherit',timeout:180000});
    return 0;
  }catch(e){
    console.error(e instanceof Error&&/^PDF_CLOUD_[A-Z0-9_]+$/.test(e.message)?
      e.message:'PDF_CLOUD_LOCAL_RUNTIME_SMOKE_FAILED');
    return 2;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main();
