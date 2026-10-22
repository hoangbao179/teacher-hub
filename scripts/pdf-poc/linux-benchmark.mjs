// Run only against the operator's local Docker engine. Never reads deployment settings.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertLocalEndpoint,directoryBytes} from './linux-metrics.mjs';

const [inputArg,outputArg,faultsOnly]=process.argv.slice(2);
if(!inputArg||!outputArg)throw Error('Usage: node linux-benchmark.mjs OWNED.pdf NEW_ARTIFACT_DIR');
if(faultsOnly && faultsOnly!=='--faults-only')throw Error('Unknown option');
const input=fs.realpathSync(inputArg),output=path.resolve(outputArg),source=path.dirname(fileURLToPath(import.meta.url));
if(fs.existsSync(output))throw Error('Output directory must be new');
let dockerContext;
const call=(args,options={})=>{
  const r=spawnSync('docker',dockerContext?['--context',dockerContext,...args]:args,{encoding:'utf8',timeout:options.timeout??300000,maxBuffer:16*1024*1024,windowsHide:true});
  if(r.error)throw r.error;
  if(r.status!==0&&!options.allowFailure)throw Error(`docker ${args[0]} failed: ${r.stderr}`);
  return r;
};
// Explicitly refuse an SSH/TCP remote context (including a production engine).
const context=JSON.parse(call(['context','inspect']).stdout)[0];
const endpoint=context.Endpoints.docker.Host;
assertLocalEndpoint(endpoint);
dockerContext=context.Name; // Explicit context overrides DOCKER_HOST on subsequent commands.
const engine=JSON.parse(call(['info','--format','{{json .}}']).stdout);
if(engine.OSType!=='linux')throw Error('Linux Docker engine required');
const image='teacher-pdf-poc:linux-benchmark';
call(['build','-f',path.join(source,'Dockerfile.benchmark'),'-t',image,source],{timeout:600000});
fs.mkdirSync(output,{recursive:true});
const imageInfo=JSON.parse(call(['image','inspect',image]).stdout)[0];
fs.writeFileSync(path.join(output,'environment.json'),JSON.stringify({endpoint,engine:{os:engine.OperatingSystem,kernel:engine.KernelVersion,architecture:engine.Architecture,memory:engine.MemTotal,cpus:engine.NCPU},image:{id:imageInfo.Id,sizeBytes:imageInfo.Size},source:input},null,2));
const cases=[...(!faultsOnly?['1g','1536m','2g'].flatMap(memory=>['rgb','indexed256'].map(variant=>({memory,variant,deadline:120000,expected:'COMPLETE'}))):[]),{memory:'64m',variant:'rgb',deadline:120000,expected:'OOM'},{memory:'1g',variant:'rgb',deadline:2000,expected:'TIMEOUT'}];
const results=[];
for(let i=0;i<cases.length;i++) {
  const c=cases[i],dir=path.join(output,`${i+1}-${c.memory}-${c.variant}-${c.expected.toLowerCase()}`),name=`pdf-poc-${process.pid}-${i}`;
  fs.mkdirSync(dir);const start=performance.now();let inspected;
  try {
    call(['create','--name',name,'--cpus','1','--memory',c.memory,'--memory-swap',c.memory,'--pids-limit','128','--network','none','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m',
      '--mount',`type=bind,source=${input},target=/fixture/original.pdf,readonly`,
      '--mount',`type=bind,source=${dir},target=/output`,image,c.variant,String(c.deadline)]);
    const run=call(['start','--attach',name],{timeout:150000,allowFailure:true});
    fs.writeFileSync(path.join(dir,'stdout.log'),run.stdout);fs.writeFileSync(path.join(dir,'stderr.log'),run.stderr);
    inspected=JSON.parse(call(['inspect',name]).stdout)[0];
  }finally { call(['rm','--force',name],{allowFailure:true}); }
  const metricsFile=path.join(dir,'linux-metrics.json'),metrics=fs.existsSync(metricsFile)?JSON.parse(fs.readFileSync(metricsFile,'utf8')):null;
  const oom=Boolean(inspected.State.OOMKilled)||Boolean(metrics?.cgroup.memoryEvents.oom_kill);
  const state={...c,exitCode:inspected.State.ExitCode,oom,hostWallSeconds:(performance.now()-start)/1000,limits:{nanoCpus:inspected.HostConfig.NanoCpus,memoryBytes:inspected.HostConfig.Memory,swapTotalBytes:inspected.HostConfig.MemorySwap},metrics};
  if(state.exitCode!==0){fs.rmSync(path.join(dir,'job'),{recursive:true,force:true});state.cleanupComplete=!fs.existsSync(path.join(dir,'job'));}
  state.retainedBytes=directoryBytes(dir);
  state.accepted=c.expected==='COMPLETE'?state.exitCode===0&&metrics?.status==='COMPLETE'&&!oom:c.expected==='OOM'?oom&&state.exitCode!==0&&state.cleanupComplete:metrics?.status==='TIMEOUT'&&state.cleanupComplete&&metrics.peakTemporaryBytes>0;
  results.push(state);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({case:i+1,memory:c.memory,variant:c.variant,status:metrics?.status,exit:state.exitCode,oom,accepted:state.accepted}));
}
if(results.some(r=>!r.accepted))process.exitCode=1;
