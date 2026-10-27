import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, verifyOutput } from './chunk-fixture.mjs';
import { pdfPartCount } from '@teacher/shared';
const pages=Number(process.argv[2]); assert.ok([17,50,100,200].includes(pages));
const root=await mkdtemp('/evidence/chunk-'), scratch=await mkdtemp('/tmp/chunk-');
const start=performance.now(), cpu=process.cpuUsage();
try {
  const f=await fixture(root,pages,{texture:true,tempRoot:scratch});let maxStepMs=0;
  for(let step=0;step<=pdfPartCount(pages)+1;step++){
    const at=performance.now();const result=await f.run(step);maxStepMs=Math.max(maxStepMs,performance.now()-at);
    assert.notEqual(result.status,'FAILED',JSON.stringify({step,...result}));
    assert.deepEqual(await readdir(scratch),[]);
    if(step===pdfPartCount(pages)+1){
      assert.equal(result.status,'COMPLETED',JSON.stringify(result));assert.equal(result.pages,pages);
      const pipelineSeconds=(performance.now()-start)/1000;
      const peakBeforeVerify=Number(await readFile('/sys/fs/cgroup/memory.peak','utf8'));
      const usage=process.cpuUsage(cpu);
      await verifyOutput(f.store,f.identities,f.dimensions);
      console.log(JSON.stringify({kind:'chunked-offline-end-to-end',pages,bytes:result.bytes,parts:pdfPartCount(pages),
        pipelineSeconds,maxStepSeconds:maxStepMs/1000,nodeCpuSeconds:(usage.user+usage.system)/1e6,
        pipelineCgroupPeakBytes:peakBeforeVerify,totalCgroupPeakBytes:Number(await readFile('/sys/fs/cgroup/memory.peak','utf8')),
        qpdf:'PASS',allPageHashesAndOrder:'PASS',nativeDpi:'>=200',scratchCleanup:'PASS',browser:false,cloudRun:false,paperPrintQuality:'NOT_VERIFIED'}));
    }
  }
}finally{await rm(root,{recursive:true,force:true});await rm(scratch,{recursive:true,force:true});}
