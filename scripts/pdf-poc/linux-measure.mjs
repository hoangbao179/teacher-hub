// Container-only supervisor. The host controls CPU/RAM, network, mount paths and cleanup.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseCounters,treeRss,directoryBytes} from './linux-metrics.mjs';

const [variant='rgb', deadlineArg='120000'] = process.argv.slice(2);
const deadlineMs = Number(deadlineArg);
if (!['rgb','indexed256'].includes(variant) || !Number.isFinite(deadlineMs) || deadlineMs < 1) throw Error('Invalid variant/deadline');
if (process.platform !== 'linux' || !fs.existsSync('/sys/fs/cgroup/memory.peak')) throw Error('Linux cgroup v2 required');
const output='/output',job=path.join(output,'job');
if(fs.existsSync(job))throw Error('New job directory required');
fs.mkdirSync(job,{recursive:true});
const read = file => fs.readFileSync('/sys/fs/cgroup/'+file,'utf8').trim();
const write = (name,data) => fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2));
const started=performance.now(), cpuStart=parseCounters(read('cpu.stat')).usage_usec;
let active, phase='prepare', timeout=false, peakRssBytes=0, peakDiskBytes=0, maxProcesses=0, samples=0;
const sample = () => {
  const processes=[];
  for(const id of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))) {
    try {
      const status=fs.readFileSync(`/proc/${id}/status`,'utf8');
      processes.push({pid:Number(id),ppid:Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),rssBytes:Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]??0)*1024});
    } catch { /* process exited during sample */ }
  }
  const rss=treeRss(processes,process.pid);peakRssBytes=Math.max(peakRssBytes,rss.bytes);maxProcesses=Math.max(maxProcesses,rss.count);
  peakDiskBytes=Math.max(peakDiskBytes,directoryBytes(job));samples++;
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
    active=spawn(process.execPath,['--expose-gc','/poc/benchmark.mjs',current,'/fixture/original.pdf',job,...(current==='prepare'?[]:[variant])],{stdio:'inherit',detached:true});
    active.once('error',reject);active.once('exit',(code,signal)=>{
      active=undefined;
      if(timeout)reject(Error('INCOMPLETE: global deadline'));
      else if(code!==0)reject(Error(`INCOMPLETE: ${current} exited ${code}, signal ${signal}`));
      else resolve();
    });
  });
  sample();phaseMetrics.push({phase:current,wallSeconds:(performance.now()-begin)/1000,cpuSeconds:(parseCounters(read('cpu.stat')).usage_usec-cpu)/1e6});
};
let status='COMPLETE',message;
try {
  for(const current of ['prepare','encode','verify']) { if(timeout)throw Error('INCOMPLETE: global deadline');await run(current); }
} catch(error) { status=timeout?'TIMEOUT':'INCOMPLETE';message=error.message;killChild();process.exitCode=1; }
finally {
  clearTimeout(timer);clearInterval(interval);sample();
  const cgroup={memoryMax:read('memory.max'),swapMax:read('memory.swap.max'),memoryPeakBytes:Number(read('memory.peak')),memoryCurrentBytes:Number(read('memory.current')),memoryEvents:parseCounters(read('memory.events')),cpuMax:read('cpu.max'),cpu:parseCounters(read('cpu.stat'))};
  const report={status,message,variant,platform:process.platform,node:process.version,sourceHash:createHash('sha256').update(fs.readFileSync('/fixture/original.pdf')).digest('hex'),concurrency:1,deadlineMs,wallSeconds:(performance.now()-started)/1000,cpuSeconds:(cgroup.cpu.usage_usec-cpuStart)/1e6,treeRssSampledPeakBytes:peakRssBytes,maxProcesses,samples,peakTemporaryBytes:peakDiskBytes,cgroup,phaseMetrics};
  if(status==='COMPLETE') {
    report.encoding=JSON.parse(fs.readFileSync(path.join(job,variant+'.metrics.json'),'utf8'));
    report.verification=JSON.parse(fs.readFileSync(path.join(job,variant+'.verify.json'),'utf8'));
  } else {
    // Only the fixed, freshly-created job folder is disposable; never touch the mounted original.
    fs.rmSync(job,{recursive:true,force:true});report.cleanupComplete=!fs.existsSync(job);
  }
  write('linux-metrics.json',report);console.log(JSON.stringify({...report,encoding:undefined,verification:undefined}));
}
