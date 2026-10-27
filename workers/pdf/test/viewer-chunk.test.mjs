import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { captureViewerChunk, seekViewerPage } from '../src/viewer-chunk.ts';
import { longCap } from './chunk-fixture.mjs';
test('real anonymous browser captures requested noninitial range, preserves native images, rejects changed anchor and still captures when Print is disabled',async t=>{
 const root=await mkdtemp(join(tmpdir(),'viewer-chunk-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent('<button>Print</button><input role="combobox" value="100%"><main></main>');
 await page.evaluate(async()=>{
  for(const [i,color] of [[1,'white'],[11,'red'],[12,'blue']]){
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2547;
   const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,1800,2547);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve));
   const section=document.createElement('section');section.innerHTML=`<div><h2>Page ${i} / 23</h2></div><img style="width:300px">`;
   document.querySelector('main').append(section);const image=section.querySelector('img');image.src=URL.createObjectURL(blob);await image.decode();canvas.width=canvas.height=1;
  }
 });
 const signal=()=>AbortSignal.timeout(30000);
 const probe=await captureViewerChunk(page,null,longCap,signal());assert.equal(probe.totalPages,23);
 const m={...probe,totalPages:23};const path=join(root,'part.pdf');
 await captureViewerChunk(page,path,longCap,signal(),{firstPage:11,lastPage:12},m);
 const pdf=await PDFDocument.load(await readFile(path));assert.equal(pdf.getPageCount(),2);
 for(let i=0;i<2;i++){
  const refs=pdf.getPage(i).node.Resources().lookup(PDFName.of('XObject'),PDFDict).values();assert.equal(refs.length,1);
  const stream=pdf.context.lookup(refs[0],PDFRawStream);const jpeg=Buffer.from(stream.getContents());
  assert.equal((await sharp(jpeg).metadata()).width,1800);
  const pixel=await sharp(jpeg).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();assert.ok(pixel[i===0?0:2]>250);
 }
 await assert.rejects(captureViewerChunk(page,join(root,'wrong.pdf'),longCap,signal(),{firstPage:11,lastPage:12},{...m,fingerprint:'b'.repeat(64)}),{code:'UNSUPPORTED_SOURCE'});
 await page.getByRole('button',{name:'Print'}).evaluate(el=>{el.disabled=true;});
 const restricted=join(root,'restricted.pdf');
 await captureViewerChunk(page,restricted,longCap,signal(),{firstPage:11,lastPage:12},m);
 assert.equal((await PDFDocument.load(await readFile(restricted))).getPageCount(),2);
 assert.deepEqual(await readdir(root),['part.pdf','restricted.pdf']);
});

test('virtualized late headings are reached by bounded scroll, without an off-screen extraction endpoint',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent('<main style="height:600px;overflow-y:auto"><div style="height:40000px;position:relative"><section style="position:absolute"><h2>Page 1 / 200</h2></section></div></main>');
 await page.evaluate(()=>{
  const scroller=document.querySelector('main'),section=document.querySelector('section');
  scroller.addEventListener('scroll',()=>{const n=Math.min(200,Math.floor(scroller.scrollTop/200)+1);section.style.top=`${(n-1)*200}px`;section.innerHTML=`<h2>Page ${n} / 200</h2>`;});
 });
 await seekViewerPage(page,101,200,AbortSignal.timeout(5000));assert.equal(await page.locator('h2').textContent(),'Page 101 / 200');
 await seekViewerPage(page,10,200,AbortSignal.timeout(5000));assert.equal(await page.locator('h2').textContent(),'Page 10 / 200');
});
