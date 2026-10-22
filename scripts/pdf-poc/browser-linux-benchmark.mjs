import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertLocalEndpoint,directoryBytes} from './linux-metrics.mjs';
import {limits} from './browser-limits.mjs';
import {ownedHash,driveId} from './drive-policy.mjs';
const [inputArg,outputArg,option]=process.argv.slice(2);
if(!inputArg||!outputArg||option&&!['--baseline-only','--matrix','--faults-only','--stability','--drive-baseline','--drive-matrix','--drive-faults'].includes(option))throw Error('Usage: node browser-linux-benchmark.mjs OWNED.pdf NEW_ARTIFACT_DIR [--baseline-only|--matrix|--faults-only|--stability|--drive-baseline|--drive-matrix|--drive-faults]');
const input=fs.realpathSync(inputArg),output=path.resolve(outputArg),source=path.dirname(fileURLToPath(import.meta.url));
if(fs.statSync(input).size>limits.inputBytes)throw Error('Input limit');
const drive=option?.startsWith('--drive-');
if(drive){driveId(process.env.PDF_POC_DRIVE_ID);if(createHash('sha256').update(fs.readFileSync(input)).digest('hex')!==ownedHash)throw Error('Wrong owned original');}
if(fs.existsSync(output))throw Error('New output directory required');
let contextName;
const docker=(args,allowFailure=false,timeout=240000)=>{
  const r=spawnSync('docker',contextName?['--context',contextName,...args]:args,{encoding:'utf8',timeout,maxBuffer:32*1024*1024,windowsHide:true});
  if(r.error)throw r.error;if(r.status!==0&&!allowFailure)throw Error(`Docker ${args[0]}: ${r.stderr}`);return r;
};
const context=JSON.parse(docker(['context','inspect']).stdout)[0];assertLocalEndpoint(context.Endpoints.docker.Host);contextName=context.Name;
const info=JSON.parse(docker(['info','--format','{{json .}}']).stdout);if(info.OSType!=='linux')throw Error('Linux engine required');
const image='teacher-pdf-poc:browser-linux';
docker(['build','-f',path.join(source,'Dockerfile.browser-benchmark'),'-t',image,source],false,600000);
fs.mkdirSync(output,{recursive:true});
const imageInfo=JSON.parse(docker(['image','inspect',image]).stdout)[0];
fs.writeFileSync(path.join(output,'environment.json'),JSON.stringify({context:contextName,kernel:info.KernelVersion,os:info.OperatingSystem,architecture:info.Architecture,hostMemory:info.MemTotal,hostCpus:info.NCPU,image:{id:imageInfo.Id,sizeBytes:imageInfo.Size}},null,2));
const baseline={memory:'4g',mode:'retained',deadline:120000,expect:'COMPLETE'};
const cases=drive?(option==='--drive-faults'?[{memory:'4g',mode:'sequential',deadline:5000,expect:'TIMEOUT'}]:(option==='--drive-matrix'?['4g','2g','1g']:['4g']).map(memory=>({memory,mode:'sequential',deadline:120000,expect:'COMPLETE'}))):option==='--stability'?Array.from({length:3},()=>({memory:'512m',mode:'sequential',deadline:120000,expect:'OBSERVE'})):option==='--faults-only'?[
  {memory:'512m',mode:'retained',deadline:120000,expect:'OOM'},
  {memory:'4g',mode:'sequential',deadline:3000,expect:'TIMEOUT'},
]:option==='--matrix'?[
  {...baseline,mode:'sequential'},...['3g','2g','1536m','1g','768m','512m'].map(memory=>({memory,mode:'sequential',deadline:120000,expect:'COMPLETE'})),
]:[baseline];
const results=[];
for(let i=0;i<cases.length;i++){
 const c=cases[i],dir=path.join(output,`${i+1}-${c.memory}-${c.mode}`),name=`browser-pdf-poc-${process.pid}-${i}`;fs.mkdirSync(dir);
 let inspected;
 try{
  docker(['create','--name',name,'--cpus','1','--memory',c.memory,'--memory-swap',c.memory,'--pids-limit','256','--network',drive?'bridge':'none',...(drive?['--env',`PDF_POC_DRIVE_ID=${process.env.PDF_POC_DRIVE_ID}`]:[]),'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=256m','--shm-size','128m',
   '--mount',`type=bind,source=${input},target=/fixture/original.pdf,readonly`,'--mount',`type=bind,source=${dir},target=/output`,image,'indexed256',String(c.deadline),drive?'drive':'browser',c.mode]);
  const run=docker(['start','--attach',name],true,150000);fs.writeFileSync(path.join(dir,'stdout.log'),run.stdout);fs.writeFileSync(path.join(dir,'stderr.log'),run.stderr);
  inspected=JSON.parse(docker(['inspect',name]).stdout)[0];
 }finally{docker(['rm','--force',name],true);}
 const file=path.join(dir,'linux-metrics.json'),m=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const oom=Boolean(inspected.State.OOMKilled)||Boolean(m?.cgroup.memoryEvents.oom_kill);
 const r={...c,exit:inspected.State.ExitCode,oom,limits:{cpu:inspected.HostConfig.NanoCpus,memory:inspected.HostConfig.Memory,swap:inspected.HostConfig.MemorySwap,pids:inspected.HostConfig.PidsLimit},metrics:m};
 if(r.exit!==0){fs.rmSync(path.join(dir,'job'),{recursive:true,force:true});r.cleanupComplete=!fs.existsSync(path.join(dir,'job'));}
 r.retainedBytes=directoryBytes(dir);
 const complete=r.exit===0&&m?.status==='COMPLETE'&&!oom;
 r.accepted=c.expect==='OBSERVE'?complete||(oom&&r.cleanupComplete):c.expect==='COMPLETE'?complete:c.expect==='OOM'?oom&&r.cleanupComplete:m?.status==='TIMEOUT'&&r.cleanupComplete&&m.peakTemporaryBytes>0&&m.browserRssSampledPeakBytes>0;
 // An OOM found while descending after a successful run is a measured boundary,
 // never a successful workload. Other failures still make the research run fail.
 r.boundaryObserved=option==='--matrix'&&i>0&&r.exit!==0&&oom;
 results.push(r);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({memory:c.memory,mode:c.mode,expected:c.expect,exit:r.exit,status:m?.status,oom,accepted:r.accepted,message:m?.message}));
 if(!r.accepted&&c.expect==='COMPLETE'){if(!r.boundaryObserved)process.exitCode=1;break;} // Never continue decreasing RAM after an unsuccessful run.
}
if(results.some(r=>!r.accepted&&!r.boundaryObserved))process.exitCode=1;
