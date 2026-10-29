import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { normalizePdfFilename, pdfContentDisposition, isPdfManifest } from '@teacher/shared';
import { dispositionFilename, viewerTitleFilename, viewerFilename } from '../src/filename.ts';
import { download } from '../src/download.ts';
import { processJob } from '../src/processor.ts';
import { fixture } from './chunk-fixture.mjs';
import { job, MemoryStore, syntheticPDF } from './fixtures.mjs';
import { limits } from '../src/contract.ts';

const filename = 'Bài tập Tiếng Anh lớp 6 - Unit 3.pdf';
test('Unicode names are bounded, safe and end in exactly one PDF extension', () => {
  assert.equal(normalizePdfFilename(filename+'.PDF'),filename);
  assert.equal(normalizePdfFilename('../../a\\b\r\n<>:"|?*.pdf'),'a b.pdf');
  for(const name of ['', '..', 'CON', 'nul.pdf']) assert.equal(normalizePdfFilename(name),null);
  assert.ok(Buffer.byteLength(normalizePdfFilename('ế'.repeat(1000)))<=180);
  assert.match(pdfContentDisposition(filename),/filename="Bai tap/);
  assert.ok(pdfContentDisposition(filename).endsWith(encodeURIComponent(filename)));
});
test('direct response names support RFC UTF-8 and ordinary filename without trusting URL paths', async t => {
  assert.equal(dispositionFilename(`attachment; filename="fallback.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`),filename);
  assert.equal(dispositionFilename('attachment; filename*=UTF-8\'\'%ZZ; filename="safe.pdf"'),'safe.pdf');
  assert.equal(dispositionFilename(null),null);
  const dir=await mkdtemp(join(tmpdir(),'pdf-name-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const open=async()=>Object.assign(Readable.from([syntheticPDF(1)]),{statusCode:200,headers:{'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`}});
  assert.equal(await download(job.source.fileId,join(dir,'source.pdf'),limits({}),AbortSignal.timeout(5000),open),filename);
});
test('Viewer title only names a successfully discovered document on its expected public URL', async () => {
  assert.equal(viewerTitleFilename(filename+' - Google Drive'),filename);
  for(const title of ['', 'Google Drive', 'Sign in - Google Drive', 'Access denied - Google Drive', 'Bài tập - Changed suffix']) assert.equal(viewerTitleFilename(title),null);
  assert.equal(await viewerFilename({url:()=>`https://drive.google.com/file/d/${job.source.fileId}/view`,title:async()=>filename+' - Google Drive'},job.source.fileId),filename);
  assert.equal(await viewerFilename({url:()=> 'https://accounts.google.com/',title:async()=>filename+' - Google Drive'},job.source.fileId),null);
});
test('v1 name survives an output upload followed by lost result; old outputs remain readable', async t => {
  const dir=await mkdtemp(join(tmpdir(),'pdf-v1-name-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  for(const name of [filename,undefined]) {
    const store=new MemoryStore();store.failResult=1;
    const deps={store,tempRoot:dir,download:async(_id,path)=>{await writeFile(path,syntheticPDF(1));return name;},validate:async()=>({bytes:123,pages:1,sha256:'a'.repeat(64)})};
    await assert.rejects(processJob(job,limits({}),AbortSignal.timeout(5000),deps));
    deps.download=()=>{throw Error('recovery must not download');};
    assert.equal((await processJob(job,limits({}),AbortSignal.timeout(5000),deps)).filename,name);
  }
});
for(const mode of ['direct-short','direct-long','viewer']) test(`v2 ${mode} keeps optional filename across immutable checkpoint/output recovery`,async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pdf-v2-name-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const f=await fixture(dir,1);
  let pages=mode==='direct-long'?51:1;
  // This fixture reaches final assembly, so checkpoint metadata must describe actual bytes.
  f.deps.validate=async()=>({bytes:syntheticPDF(1).length,pages,sha256:createHash('sha256').update(syntheticPDF(1)).digest('hex')});
  f.deps.merge=async(_files,path)=>writeFile(path,syntheticPDF(1));
  f.deps.renderChunk=async(_id,path)=>writeFile(path,syntheticPDF(1));
  if(mode.startsWith('direct'))f.deps.download=async(_id,path)=>{await writeFile(path,syntheticPDF(1));return filename;};
  else f.deps.discoverViewer=async()=>({totalPages:1,fingerprint:'a'.repeat(64),filename});
  if(mode==='direct-short'){
    f.store.failName=`jobs/${job.jobId}/result.json`;
    await assert.rejects(f.run(0));assert.equal((await f.run(0)).filename,filename);return;
  }
  f.store.failName=`jobs/${job.jobId}/manifest.json`;
  await assert.rejects(f.run(0));await f.run(0);
  const manifest=await f.store.json(`jobs/${job.jobId}/manifest.json`);
  assert.equal(manifest.filename,filename);
  assert.equal(isPdfManifest(manifest,job.jobId,manifest.sourceHash,manifest.expiresAt),true);
  assert.equal(isPdfManifest({...manifest,arbitrary:true},job.jobId,manifest.sourceHash,manifest.expiresAt),false);
  if(mode==='direct-long')return; // Native qpdf integration separately covers long-document merge.
  pages=1;await f.run(1);
  f.store.failName=`jobs/${job.jobId}/result.json`;
  await assert.rejects(f.run(2));
  f.deps.discoverViewer=()=>{throw Error('must recover stored name');};
  assert.equal((await f.run(2)).filename,filename);
});
