// Container-only supervisor. The host controls CPU/RAM, network, mount paths and cleanup.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isNodeProcess,parseCounters,treeRss,directoryBytes} from './linux-metrics.mjs';

const [variant='rgb', deadlineArg='120000', pipeline='node', browserMode='sequential'] = process.argv.slice(2);
const deadlineMs = Number(deadlineArg);
if (!['rgb','indexed256'].includes(variant) || !Number.isFinite(deadlineMs) || deadlineMs < 1) throw Error('Invalid variant/deadline');
if(!['node','browser'].includes(pipeline)||!['retained','sequential'].includes(browserMode))throw Error('Invalid pipeline/mode');
if (process.platform !== 'linux' || !fs.existsSync('/sys/fs/cgroup/memory.peak')) throw Error('Linux cgroup v2 required');
const output='/output',job=path.join(output,'job');
if(fs.existsSync(job))throw Error('New job directory required');
fs.mkdirSync(job,{recursive:true});
const read = file => fs.readFileSync('/sys/fs/cgroup/'+file,'utf8').trim();
const write = (name,data) => fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2));
const started=performance.now(), cpuStart=parseCounters(read('cpu.stat')).usage_usec;
let active, phase='prepare', timeout=false, oomDetected=false, limitExceeded=false, peakRssBytes=0, peakDiskBytes=0, maxProcesses=0, samples=0;
let browserRssPeakBytes=0,nodeRssPeakBytes=0,browserPid=0;
let peakBrowserTmpBytes=0;
const phasePeaks={};
const sample = () => {
  const processes=[];
  for(const id of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))) {
    try {
      const status=fs.readFileSync(`/proc/${id}/status`,'utf8');
      let executable;
      try{executable=fs.readlinkSync(`/proc/${id}/exe`);}catch{/* Chromium may restrict exe access; still include its RSS. */}
      processes.push({pid:Number(id),ppid:Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),rssBytes:Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]??0)*1024,executable});
    } catch { /* process exited during sample */ }
  }
  const rss=treeRss(processes,process.pid);peakRssBytes=Math.max(peakRssBytes,rss.bytes);maxProcesses=Math.max(maxProcesses,rss.count);
  if(pipeline==='browser'){
    try{browserPid=JSON.parse(fs.readFileSync(path.join(job,'browser-pids.json'),'utf8')).pid;}catch{/* not launched yet */}
    browserRssPeakBytes=Math.max(browserRssPeakBytes,browserPid?treeRss(processes,browserPid).bytes:0);
    nodeRssPeakBytes=Math.max(nodeRssPeakBytes,treeRss(processes.filter(isNodeProcess),process.pid).bytes);
    phasePeaks[phase]=Math.max(phasePeaks[phase]??0,Number(read('memory.current')));
  }
  peakDiskBytes=Math.max(peakDiskBytes,directoryBytes(job));samples++;
  if(pipeline==='browser')peakBrowserTmpBytes=Math.max(peakBrowserTmpBytes,directoryBytes('/tmp',{transient:true}));
  if(pipeline==='browser'&&peakDiskBytes>64*1024*1024){limitExceeded=true;killChild();}
  if(pipeline==='browser'&&parseCounters(read('memory.events')).oom_kill>0){oomDetected=true;killChild();}
};
const killChild = () => {
  if(active?.pid) { try { process.kill(-active.pid,'SIGKILL'); } catch { /* already exited */ } }
};
const timer=setTimeout(()=>{timeout=true;killChild();},deadlineMs);
const interval=setInterval(sample,100);
const phaseMetrics=[];
const run = async current => {
  phase=current;const begin=performance.now(),cpu=parseCounters(read('cpu.stat')).usage_usec;
  await new Promise((resolve,reject)=>{
    const command=current==='browser'?['/poc/browser-capture.mjs',browserMode,job]:current==='compare'?['/poc/browser-quality.mjs',job]:['/poc/benchmark.mjs',current,'/fixture/original.pdf',job,...(current==='prepare'?[]:[variant])];
    active=spawn(process.execPath,['--expose-gc',...command],{stdio:'inherit',detached:true});
    active.once('error',reject);active.once('exit',(code,signal)=>{
      active=undefined;
      if(oomDetected)reject(Error('INCOMPLETE: cgroup OOM kill'));
      else if(limitExceeded)reject(Error('INCOMPLETE: temporary byte limit'));
      else if(timeout)reject(Error('INCOMPLETE: global deadline'));
      else if(code!==0)reject(Error(`INCOMPLETE: ${current} exited ${code}, signal ${signal}`));
      else resolve();
    });
  });
  sample();phaseMetrics.push({phase:current,wallSeconds:(performance.now()-begin)/1000,cpuSeconds:(parseCounters(read('cpu.stat')).usage_usec-cpu)/1e6});
};
let status='COMPLETE',message;
try {
  if(pipeline==='browser'){
    if(fs.statSync('/fixture/original.pdf').size>10*1024*1024)throw Error('Input byte limit');
    const {PDFDocument}=await import('pdf-lib');const {assertPageLimits}=await import('./browser-limits.mjs');
    const doc=await PDFDocument.load(fs.readFileSync('/fixture/original.pdf'));assertPageLimits(doc.getPages().map(p=>p.getSize()));
  }
  for(const current of (pipeline==='browser'?['prepare','browser','encode','verify','compare']:['prepare','encode','verify'])) {
    if(timeout)throw Error('INCOMPLETE: global deadline');await run(current);
    if(pipeline==='browser'&&current==='prepare'){
      fs.renameSync(path.join(job,'manifest.json'),path.join(job,'reference-manifest.json'));
      for(let n=1;n<=5;n++)fs.renameSync(path.join(job,`source-${n}.png`),path.join(job,`reference-source-${n}.png`));
    }
  }
} catch(error) { status=timeout?'TIMEOUT':'INCOMPLETE';message=error.message;killChild();process.exitCode=1; }
finally {
  clearTimeout(timer);clearInterval(interval);sample();
  const cgroup={memoryMax:read('memory.max'),swapMax:read('memory.swap.max'),memoryPeakBytes:Number(read('memory.peak')),memoryCurrentBytes:Number(read('memory.current')),memoryEvents:parseCounters(read('memory.events')),cpuMax:read('cpu.max'),cpu:parseCounters(read('cpu.stat'))};
  const report={status,message,pipeline,browserMode:pipeline==='browser'?browserMode:undefined,variant,platform:process.platform,node:process.version,sourceHash:createHash('sha256').update(fs.readFileSync('/fixture/original.pdf')).digest('hex'),concurrency:1,deadlineMs,wallSeconds:(performance.now()-started)/1000,cpuSeconds:(cgroup.cpu.usage_usec-cpuStart)/1e6,treeRssSampledPeakBytes:peakRssBytes,browserRssSampledPeakBytes:browserRssPeakBytes,nodeRssSampledPeakBytes:nodeRssPeakBytes,phaseSampledCgroupPeakBytes:phasePeaks,maxProcesses,samples,peakTemporaryBytes:peakDiskBytes,peakBrowserTmpBytes,cgroup,phaseMetrics};
  if(status==='COMPLETE') {
    report.encoding=JSON.parse(fs.readFileSync(path.join(job,variant+'.metrics.json'),'utf8'));
    report.verification=JSON.parse(fs.readFileSync(path.join(job,variant+'.verify.json'),'utf8'));
    if(pipeline==='browser'){
      report.browserCapture=JSON.parse(fs.readFileSync(path.join(job,'browser-capture.json'),'utf8'));
      report.originalComparison=JSON.parse(fs.readFileSync(path.join(job,'original-comparison.json'),'utf8'));
    }
  } else {
    // Only the fixed, freshly-created job folder is disposable; never touch the mounted original.
    fs.rmSync(job,{recursive:true,force:true});report.cleanupComplete=!fs.existsSync(job);
  }
  report.terminalPhase=phase;
  write('linux-metrics.json',report);console.log(JSON.stringify({...report,encoding:undefined,verification:undefined}));
}
