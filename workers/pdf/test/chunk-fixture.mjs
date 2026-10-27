import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { processChunkJob } from '../src/chunk-processor.ts';
import { ImagePdfWriter } from '../src/image-pdf-writer.ts';
import { JobError, limits } from '../src/contract.ts';
import { PDF_LONG_OUTPUT_MAX_BYTES, PDF_LONG_MAX_PAGES, PDF_SOURCE_MAX_BYTES, pdfPartCount, isPdfChunkJob } from '@teacher/shared';
import { job, syntheticPDF } from './fixtures.mjs';
export class DiskStore {
  constructor(root) { this.root=root; this.metadata=new Map(); this.failName=''; }
  async ready() {}
  path(name) { assert.match(name,/^jobs\/[a-f0-9-]+\/(?:request\.json|manifest\.json|result\.json|source\.pdf|output\.pdf|parts\/\d+\.(?:pdf|json))$/); return join(this.root,name); }
  async head(name) { try { await stat(this.path(name)); return {metadata:this.metadata.get(name)??{},generation:'1'}; } catch(e) { if(e.code==='ENOENT')return null;throw e; } }
  async json(name) { try{return JSON.parse(await readFile(this.path(name),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;} }
  async create(name,body,signal) {
    signal.throwIfAborted(); if(this.failName===name){this.failName='';throw new JobError('STORAGE_UNAVAILABLE',true);}
    await mkdir(dirname(this.path(name)),{recursive:true});
    try {if('json'in body)await writeFile(this.path(name),JSON.stringify(body.json),{flag:'wx'});else await copyFile(body.path,this.path(name),1);}
    catch(e){if(e.code==='EEXIST')return false;throw e;}
    this.metadata.set(name,body.metadata??{});return true;
  }
  async download(name,path,maxBytes,signal) { signal.throwIfAborted(); const {stat}=await import('node:fs/promises');assert.ok((await stat(this.path(name))).size<=maxBytes); await copyFile(this.path(name),path,1); }
}
export const longCap={...limits({}),maxBytes:PDF_LONG_OUTPUT_MAX_BYTES,maxPages:PDF_LONG_MAX_PAGES,maxSourceBytes:PDF_SOURCE_MAX_BYTES};
export async function fixture(root,pages,{texture=false,tempRoot}={}) {
  const store=new DiskStore(join(root,'gcs')), temp=tempRoot??join(root,'scratch');await mkdir(temp,{recursive:true});
  const identities=[], dimensions=[];
  const deps={store,tempRoot:temp,enablePrintFallback:true,download:async()=>{throw new JobError('ACCESS_DENIED');},
    discoverViewer:async()=>({totalPages:pages,fingerprint:'a'.repeat(64)}),
    renderChunk:async(_id,path,cap,signal,range)=>{
      const writer=await ImagePdfWriter.create(path,cap.maxBytes,signal);
      try{
        for(let i=range.firstPage;i<=range.lastPage;i++){
          const [width,height]=i%10===0?[2547,1800]:[1800,2547];
          const svg=Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="40" y="100" font-size="24">Trang ${i}: Tiếng Việt — ă â ê ô ơ ư đ</text><path d="M40 130H1500" stroke="black"/></svg>`);
          let image=sharp(svg);
          if(texture&&i%20!==0){const pixels=Buffer.alloc(700*700*3);let seed=i;for(let n=0;n<pixels.length;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[n]=seed>>>24;}image=image.composite([{input:pixels,raw:{width:700,height:700,channels:3},left:40,top:250}]);}
          const {encodeViewerJpeg}=await import('../src/jpeg.ts');
          const jpeg=await encodeViewerJpeg(await image.png().toBuffer(),signal,cap.maxBytes);
          identities[i-1]=createHash('sha256').update(jpeg).digest('hex');dimensions[i-1]=[width,height];
          await writer.page(jpeg,width,height);
        }
        await writer.finish();
      }catch(e){await writer.abort();throw e;}
    }};
  const run=step=>processChunkJob({...job,version:2,step},longCap,AbortSignal.timeout(120000),deps);
  return {store,temp,deps,run,identities,dimensions};
}
export async function verifyOutput(store,identities,dimensions) {
  const verifyDir=await mkdtemp(join(tmpdir(),'verify-chunk-'));
  const path=join(verifyDir,'output.pdf');
  await copyFile(store.path(`jobs/${job.jobId}/output.pdf`),path);
  try {
  execFileSync('qpdf',['--check',path],{stdio:'pipe',timeout:50000});
  const doc=await PDFDocument.load(await readFile(path));assert.equal(doc.getPageCount(),identities.length);
  for(let i=0;i<identities.length;i++){
    const page=doc.getPage(i);const refs=page.node.Resources().lookup(PDFName.of('XObject'),PDFDict).values();assert.equal(refs.length,1);
    const image=doc.context.lookup(refs[0],PDFRawStream);
    assert.equal(createHash('sha256').update(image.getContents()).digest('hex'),identities[i]);
    assert.equal(image.dict.lookup(PDFName.of('Width')).asNumber(),dimensions[i][0]);
    assert.equal(image.dict.lookup(PDFName.of('Height')).asNumber(),dimensions[i][1]);
  }
  } finally { await rm(verifyDir,{recursive:true,force:true}); }
}
