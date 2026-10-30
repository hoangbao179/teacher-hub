// Offline writer microbenchmark; never a Drive, qpdf or Cloud Run benchmark.
// node test/image-writer-benchmark.mjs <label> [writer-module-path]
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { encodeViewerJpeg } from '../src/jpeg.ts';
import { PDF_LONG_OUTPUT_MAX_BYTES } from '@teacher/shared';

const label=process.argv[2];assert.match(label??'',/^[a-z0-9-]+$/);
const {ImagePdfWriter}=await import(process.argv[3] ? pathToFileURL(resolve(process.argv[3])).href : '../src/image-pdf-writer.ts');
const scratch=await mkdtemp(join(tmpdir(),'pdf-writer-bench-'));
try {
 const width=1800,height=2547,pixels=Buffer.alloc(700*700*3);let seed=1;
 for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=seed>>>24;}
 const png=await sharp({create:{width,height,channels:3,background:'white'}})
  .composite([{input:pixels,raw:{width:700,height:700,channels:3},left:40,top:250}]).png().toBuffer();
 const base64=png.toString('base64'),at=performance.now();
 for(let i=0;i<30;i++)assert.deepEqual(Buffer.from(base64,'base64'),png);
 const base64DecodeMs=(performance.now()-at)/30;
 const jpegStart=performance.now();
 const jpeg=await encodeViewerJpeg(png,AbortSignal.timeout(10000),PDF_LONG_OUTPUT_MAX_BYTES);
 const jpegMs=performance.now()-jpegStart;
 const imageHash=createHash('sha256').update(jpeg).digest('hex');
 for(const pages of [5,17,50,100,139,200]) {
  const samples=[];let bytes=0;
  for(let run=0;run<3;run++) {
   const path=join(scratch,'output.pdf'),cpu=process.cpuUsage(),start=performance.now();
   const writer=await ImagePdfWriter.create(path,PDF_LONG_OUTPUT_MAX_BYTES,AbortSignal.timeout(30000));
   try{for(let i=0;i<pages;i++)await writer.page(jpeg,width,height);await writer.finish();}
   catch(e){await writer.abort();throw e;}
   const wallMs=performance.now()-start,usage=process.cpuUsage(cpu),file=await readFile(path);bytes=file.length;
   const pdf=await PDFDocument.load(file);assert.equal(pdf.getPageCount(),pages);
   for(const page of pdf.getPages()) {
    const refs=page.node.Resources().lookup(PDFName.of('XObject'),PDFDict).values();assert.equal(refs.length,1);
    const image=pdf.context.lookup(refs[0],PDFRawStream);
    assert.equal(createHash('sha256').update(image.getContents()).digest('hex'),imageHash);
    assert.equal(image.dict.lookup(PDFName.of('Width')).asNumber(),width);
    assert.equal(image.dict.lookup(PDFName.of('Height')).asNumber(),height);
   }
   samples.push({wallMs,cpuMs:(usage.user+usage.system)/1000});await rm(path);
  }
  console.log(JSON.stringify({label,kind:'offline-writer-only',platform:process.platform,node:process.version,pages,bytes,
   medianWallMs:samples.map(s=>s.wallMs).sort((a,b)=>a-b)[1],samples,base64DecodeMs,jpegMs,
   processPeakRssKiB:process.resourceUsage().maxRSS,hardCpuRamLimit:false,
   imageHash,allImagesAndPageCount:'PASS',qpdf:'NOT_VERIFIED',browser:false,cloudRun:false}));
 }
} finally {await rm(scratch,{recursive:true,force:true});}
