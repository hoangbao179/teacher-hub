import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, errors as playwrightErrors } from 'playwright';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { captureViewerChunk, seekViewerPage } from '../src/viewer-chunk.ts';
import { longCap } from './chunk-fixture.mjs';
test('first Viewer chunk reuses the verified page-1 bitmap rather than exporting PNG twice', async t => {
 const root=await mkdtemp(join(tmpdir(),'viewer-first-anchor-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 await page.setContent('<input role="combobox" value="100%"><main><section><div><h2>Page 1 / 1</h2></div><img style="width:300px"></section></main>');
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2547;
  const ctx=canvas.getContext('2d');ctx.fillStyle='green';ctx.fillRect(0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve));
  const img=document.querySelector('img');img.src=URL.createObjectURL(blob);await img.decode();
  canvas.width=canvas.height=1;
  const original=HTMLCanvasElement.prototype.toDataURL;
  window.pngExports=0;
  HTMLCanvasElement.prototype.toDataURL=function(...args){window.pngExports++;return original.apply(this,args);};
 });
 const signal=()=>AbortSignal.timeout(30000);
 const discovery=await captureViewerChunk(page,null,longCap,signal());
 assert.equal(await page.evaluate(()=>window.pngExports),1,'discovery exports the anchor once');
 const path=join(root,'first.pdf');
 await captureViewerChunk(page,path,longCap,signal(),{firstPage:1,lastPage:1},discovery);
 assert.equal(await page.evaluate(()=>window.pngExports),2,'first chunk must not recapture its own anchor');
 const pdf=await PDFDocument.load(await readFile(path));assert.equal(pdf.getPageCount(),1);
 const refs=pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict).values();
 const jpeg=Buffer.from(pdf.context.lookup(refs[0],PDFRawStream).getContents());
 assert.equal((await sharp(jpeg).metadata()).width,1800);
 const pixel=await sharp(jpeg).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();
 assert.ok(pixel[1]>100 && pixel[0]<40 && pixel[2]<40,'the saved page contains the native green bitmap');
 await assert.rejects(captureViewerChunk(page,join(root,'wrong.pdf'),longCap,signal(),
   {firstPage:1,lastPage:1},{...discovery,fingerprint:'b'.repeat(64)}),
   {code:'UNSUPPORTED_SOURCE',reason:'anchor-fingerprint-mismatch',pageIndex:1});
 assert.deepEqual(await readdir(root),['first.pdf'],'failed identity must not publish a part');
});

test('real anonymous browser captures requested noninitial range, preserves native images, rejects changed anchor and still captures when Print is disabled',async t=>{
 const root=await mkdtemp(join(tmpdir(),'viewer-chunk-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent(`<style>
  .layers{position:relative;width:300px;height:1350px}
  .slot{position:absolute;left:0;width:300px;height:450px} h2{margin:0;font-size:16px}
  img{position:absolute;left:0;width:300px}
 </style><button>Print</button><input role="combobox" value="100%"><main>
 <section class="layers"><div class="labels"></div><div class="bitmaps"></div></section></main>`);
 await page.evaluate(async()=>{
  for(const [offset,[i,color]] of [[1,'white'],[11,'red'],[12,'blue']].entries()){
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2547;
   const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,1800,2547);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve));
   const slot=document.createElement('div');slot.className='slot';slot.style.top=`${offset*450}px`;
   slot.innerHTML=`<h2>Page ${i} / 23</h2>`;document.querySelector('.labels').append(slot);
   const image=document.createElement('img');image.style.top=`${offset*450+24}px`;
   document.querySelector('.bitmaps').append(image);image.src=URL.createObjectURL(blob);await image.decode();canvas.width=canvas.height=1;
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
 await assert.rejects(captureViewerChunk(page,join(root,'wrong.pdf'),longCap,signal(),{firstPage:11,lastPage:12},{...m,fingerprint:'b'.repeat(64)}),
  {code:'UNSUPPORTED_SOURCE',reason:'anchor-fingerprint-mismatch',pageIndex:1});
 await page.getByRole('button',{name:'Print'}).evaluate(el=>{el.disabled=true;});
 const restricted=join(root,'restricted.pdf');
 await captureViewerChunk(page,restricted,longCap,signal(),{firstPage:11,lastPage:12},m);
 assert.equal((await PDFDocument.load(await readFile(restricted))).getPageCount(),2);
 assert.deepEqual(await readdir(root),['part.pdf','restricted.pdf']);
});

test('independent Viewer sessions keep stable anchors but fail closed for tiny render drift and changed documents', async t => {
 const root=await mkdtemp(join(tmpdir(),'viewer-anchor-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const capture=async(variant,expected)=>{
  const context=await browser.newContext();
  try {
   const page=await context.newPage();await page.route('**/*',r=>r.abort());
   await page.setContent('<input role="combobox" value="100%"><main></main>');
   await page.evaluate(async variant=>{
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2547;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1800,2547);
    ctx.fillStyle='black';ctx.fillRect(80,80,800,20);
    if(variant==='drift'){ctx.fillStyle='#fefefe';ctx.fillRect(0,0,1,1);}
    if(variant==='changed'){ctx.fillStyle='black';ctx.fillRect(80,150,800,20);}
    const blob=await new Promise(resolve=>canvas.toBlob(resolve));
    document.querySelector('main').innerHTML=`<section><div><h2>Page 1 / ${variant==='total'?24:23}</h2></div><img style="width:300px"></section>`;
    const img=document.querySelector('img');img.src=URL.createObjectURL(blob);await img.decode();
    canvas.width=canvas.height=1;
   },variant);
   return await captureViewerChunk(page,null,longCap,AbortSignal.timeout(15000),undefined,expected);
  } finally {await context.close();}
 };
 const baseline=await capture('stable');
 assert.deepEqual(await capture('stable',baseline),baseline);
 for(const variant of ['drift','changed']) {
  await assert.rejects(capture(variant,baseline),
   {code:'UNSUPPORTED_SOURCE',reason:'anchor-fingerprint-mismatch',pageIndex:1});
 }
 await assert.rejects(capture('total',baseline),{code:'UNSUPPORTED_SOURCE',reason:'page-total-mismatch'});
 assert.deepEqual(await readdir(root),[],'discovery retains no page images');
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

test('late-page seek keeps the Viewer scroller when virtualization temporarily removes every heading',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent('<main style="height:500px;overflow-y:auto"><div style="height:13900px;position:relative"><section style="position:absolute"><h2>Page 1 / 139</h2></section></div></main>');
 await page.evaluate(()=>{
   const scroller=document.querySelector('main'),section=document.querySelector('section');
   scroller.addEventListener('scroll',()=>{
     const top=scroller.scrollTop;
     // Remote Viewer pages are not mounted immediately after the large seek.
     section.innerHTML=top>=13300?'<h2>Page 131 / 139</h2>':'';
     section.style.top=top+'px';
   });
 });
 await seekViewerPage(page,131,139,AbortSignal.timeout(6000));
 assert.equal(await page.locator('h2').textContent(),'Page 131 / 139');
});

test('late-page navigation records an allowlisted reason and page index on Playwright timeout',async()=>{
 const fake={waitForFunction:async()=>{throw new playwrightErrors.TimeoutError('synthetic timeout with private URL');}};
 await assert.rejects(seekViewerPage(fake,131,139,new AbortController().signal),e=>
   e.code==='SOURCE_UNAVAILABLE' && e.retryable===true &&
   e.reason==='viewer-seek-timeout' && e.pageIndex===131 &&
   !String(e.message).includes('private URL'));
});
