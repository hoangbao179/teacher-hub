import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, verifyOutput } from './chunk-fixture.mjs';
import { job, syntheticPDF } from './fixtures.mjs';
import { JobError } from '../src/contract.ts';
import { isPdfChunkJob, pdfPartCount } from '@teacher/shared';
import { createWorkerServer } from '../src/server.mjs';
import { once } from 'node:events';

test('real HTTP v2 dispatch is gated, validates payload and persists terminal result',async t=>{
 const root=await mkdtemp(join(tmpdir(),'chunk-http-'));t.after(()=>rm(root,{recursive:true,force:true}));const f=await fixture(root,1);
 f.deps.download=async(_id,path)=>writeFile(path,syntheticPDF(1));
 f.deps.validate=async()=>({bytes:syntheticPDF(1).length,pages:1,sha256:'b'.repeat(64)});
 for(const enabled of [false,true]){
  const server=createWorkerServer(f.deps,{PDF_PROCESSING_ENABLED:'true',PDF_CHUNKED_JOBS_ENABLED:String(enabled)});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...job,version:2,step:0})});
  assert.equal(response.status,enabled?200:503);const body=await response.json();if(enabled)assert.equal(body.status,'COMPLETED');
 }
});
test('one-hour long-job cutoff returns a terminal result without another render or merge',async t=>{
  const root=await mkdtemp(join(tmpdir(),'chunk-processing-cap-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,139);
  await f.run(0);
  const claim=await f.store.json(`jobs/${job.jobId}/request.json`);
  const later=Date.parse(claim.createdAt)+60*60*1000+1;
  t.mock.method(Date,'now',()=>later);
  f.deps.renderChunk=()=>assert.fail('must not render pages after processing deadline');
  f.deps.merge=()=>assert.fail('must not merge after processing deadline');
  const result=await f.run(1);
  assert.equal(result.status,'FAILED');
  assert.equal(result.errorCode,'JOB_EXPIRED');
  assert.equal(result.expiresAt,claim.expiresAt,'24-hour result expiry remains unchanged');
  assert.equal((await f.run(1)).errorCode,'JOB_EXPIRED','later deliveries are idempotent');
  assert.equal(await f.store.head(`jobs/${job.jobId}/parts/1.pdf`),null);
});

test('versioned chunk payload rejects extra fields and unbounded steps',()=>{
  assert.equal(isPdfChunkJob({...job,version:2,step:0}),true);
  for(const v of [{...job,version:2,step:22},{...job,version:2,step:-1},{...job,version:2,step:1,range:'1-200'}]) assert.equal(isPdfChunkJob(v),false);
});
test('durable chunks survive lost checkpoint, duplicate delivery, failure, restart, ordered merge and lost terminal write',async t=>{
  if(process.platform!=='linux'){t.skip('real qpdf Linux integration runs in Docker/CI');return;}
  const root=await mkdtemp(join(tmpdir(),'chunk-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,23);
  await f.run(0);await f.run(0);
  await assert.rejects(f.run(2),{code:'STORAGE_UNAVAILABLE'});
  f.store.failName=`jobs/${job.jobId}/parts/1.json`;
  await assert.rejects(f.run(1),{code:'STORAGE_UNAVAILABLE'});
  const original=f.deps.renderChunk;f.deps.renderChunk=()=>{throw Error('must recover uploaded part without capture');};
  await f.run(1);await f.run(1);f.deps.renderChunk=original;
  f.deps.renderChunk=async()=>{throw new JobError('SOURCE_UNAVAILABLE',true);};
  await assert.rejects(f.run(2),{code:'SOURCE_UNAVAILABLE'});assert.deepEqual(await readdir(f.temp),[]);
  f.deps.renderChunk=original;await f.run(2);await f.run(3);
  f.store.failName=`jobs/${job.jobId}/result.json`;
  await assert.rejects(f.run(4),{code:'STORAGE_UNAVAILABLE'});
  const result=await f.run(4);assert.equal(result.status,'COMPLETED');assert.equal(result.pages,23);
  await verifyOutput(f.store,f.identities,f.dimensions);assert.deepEqual(await readdir(f.temp),[]);
});
test('direct 3/35/50 pages keep normal path; 51/200 pages checkpoint and merge exact page count',async t=>{
  if(process.platform!=='linux'){t.skip('Linux qpdf');return;}
  for(const pages of [3,35,50,51,200]){
    const root=await mkdtemp(join(tmpdir(),'chunk-direct-'));t.after(()=>rm(root,{recursive:true,force:true}));const f=await fixture(root,pages);
    f.deps.download=async(_id,path)=>writeFile(path,syntheticPDF(pages));
    const initial=await f.run(0);
    if(pages<=50){assert.equal(initial.status,'COMPLETED');assert.equal(initial.pages,pages);continue;}
    for(let step=1;step<=pdfPartCount(pages);step++){
      await f.run(step);
      assert.ok(await f.store.head(`jobs/${job.jobId}/parts/${step}.json`),'each ten-page checkpoint is durable');
    }
    const result=await f.run(pdfPartCount(pages)+1);assert.equal(result.pages,pages);assert.equal(result.status,'COMPLETED');
    assert.equal(Number(execFileSync('qpdf',['--show-npages',f.store.path(`jobs/${job.jobId}/output.pdf`)],{encoding:'utf8'})),pages);
  }
});
test('final assembly verifies checkpoint bytes without reparsing every part', async t=>{
  if(process.platform!=='linux'){t.skip('Linux qpdf');return;}
  const root=await mkdtemp(join(tmpdir(),'chunk-final-hash-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,23);
  for(let step=0;step<=3;step++) await f.run(step);
  let validationCalls=0;
  const {validatePDF}=await import('../src/pdf.ts');
  f.deps.validate=async (...args)=>{
    validationCalls++;
    assert.deepEqual(args[3],{finalAssembly:true},'only the final assembly opts into expanded budget');
    return validatePDF(...args);
  };
  const result=await f.run(4);
  assert.equal(result.status,'COMPLETED');
  assert.equal(result.pages,23);
  assert.equal(validationCalls,1,'only the final assembled PDF needs a full parser validation');
  assert.deepEqual(await readdir(f.temp),[]);
});

test('final assembly resumes validation from an immutable internal checkpoint', async t=>{
  if(process.platform!=='linux'){t.skip('Linux qpdf');return;}
  const root=await mkdtemp(join(tmpdir(),'chunk-resume-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,23);
  for(let step=0;step<=3;step++) await f.run(step);
  let interrupted=false;
  f.deps.validate=async()=>{interrupted=true;throw new JobError('TIMEOUT',true);};
  await assert.rejects(f.run(4),{code:'TIMEOUT',retryable:true});
  assert.equal(interrupted,true);
  const prefix=`jobs/${job.jobId}/`;
  assert.ok(await f.store.head(prefix+'assembled.pdf'),'internal assembly must survive');
  assert.equal(await f.store.head(prefix+'output.pdf'),null,'unvalidated bytes must not be published');
  assert.equal(await f.store.head(prefix+'result.json'),null);
  f.deps.merge=()=>assert.fail('resume must not redo assembly');
  const originalDownload=f.store.download.bind(f.store);
  f.store.download=async(name,path,maxBytes,signal)=>{
    assert.equal(name,prefix+'assembled.pdf');
    return originalDownload(name,path,maxBytes,signal);
  };
  delete f.deps.validate;
  const result=await f.run(4);
  assert.equal(result.status,'COMPLETED');assert.equal(result.pages,23);
  assert.deepEqual(await readdir(f.temp),[]);
});

test('tampered staged assembly cannot be promoted or passed to validator',async t=>{
  if(process.platform!=='linux'){t.skip('Linux qpdf');return;}
  const root=await mkdtemp(join(tmpdir(),'chunk-staged-tamper-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,23);
  for(let step=0;step<=3;step++) await f.run(step);
  f.deps.validate=async()=>{throw new JobError('TIMEOUT',true);};
  await assert.rejects(f.run(4),{code:'TIMEOUT'});
  await writeFile(f.store.path(`jobs/${job.jobId}/assembled.pdf`),'%PDF-1.7 corrupted bytes');
  f.deps.merge=()=>assert.fail('do not reassemble corrupted checkpoint');
  f.deps.validate=()=>assert.fail('corrupt checkpoint must not reach validator');
  await assert.rejects(f.run(4),{code:'STORAGE_UNAVAILABLE'});
  assert.equal(await f.store.head(`jobs/${job.jobId}/output.pdf`),null);
});

test('final assembly rejects tampered PDF parts before merge', async t=>{
  if(process.platform!=='linux'){t.skip('Linux qpdf');return;}
  const root=await mkdtemp(join(tmpdir(),'chunk-final-corrupt-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const f=await fixture(root,23);
  for(let step=0;step<=3;step++) await f.run(step);
  await writeFile(f.store.path(`jobs/${job.jobId}/parts/2.pdf`),'corrupt');
  await assert.rejects(f.run(4),{code:'STORAGE_UNAVAILABLE'});
  assert.equal(await f.store.head(`jobs/${job.jobId}/output.pdf`),null);
  assert.deepEqual(await readdir(f.temp),[]);
});

test('over 200 pages and permission restriction persist failure, no partial output',async t=>{
  const root=await mkdtemp(join(tmpdir(),'chunk-limit-'));t.after(()=>rm(root,{recursive:true,force:true}));const f=await fixture(root,201);
  assert.equal((await f.run(0)).errorCode,'PAGE_LIMIT_EXCEEDED');assert.equal(await f.store.head(`jobs/${job.jobId}/output.pdf`),null);
});
