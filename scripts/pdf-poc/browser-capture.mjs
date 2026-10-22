import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {assertPageLimits,limits} from './browser-limits.mjs';

const [mode,output]=process.argv.slice(2);
if(!['retained','sequential'].includes(mode)||!output)throw Error('Invalid browser mode/output');
const fixture=fs.readFileSync('/fixture/original.pdf');if(fixture.length>limits.inputBytes)throw Error('Input limit');
const vendor=path.resolve('/poc/node_modules/pdfjs-dist');
const server=await chromium.launchServer({headless:true,chromiumSandbox:false,args:['--disable-gpu']});
fs.writeFileSync(path.join(output,'browser-pids.json'),JSON.stringify({pid:server.process().pid}));
const browser=await chromium.connect(server.wsEndpoint());
try {
  const ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://owned-fixture.invalid')return route.abort();
    if(url.pathname==='/fixture.pdf')return route.fulfill({contentType:'application/pdf',body:fixture});
    if(url.pathname==='/viewer')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Owned fixture only</title><main></main>'});
    if(url.pathname.startsWith('/vendor/')){
      const file=path.resolve(vendor,'.'+decodeURIComponent(url.pathname.slice(7)));
      if(!file.startsWith(vendor+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
      return route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':'application/octet-stream',body:fs.readFileSync(file)});
    }
    return route.abort();
  });
  const page=await ctx.newPage();page.setDefaultTimeout(30000);
  await page.goto('https://owned-fixture.invalid/viewer');
  const pages=await page.evaluate(async()=>{
    const lib=await import('/vendor/build/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';
    window.doc=await lib.getDocument({url:'/fixture.pdf',wasmUrl:'/vendor/wasm/'}).promise;
    window.canvases=[];const pages=[];
    for(let i=1;i<=window.doc.numPages;i++){const p=await window.doc.getPage(i),v=p.getViewport({scale:1});pages.push({index:i,width:v.width,height:v.height});}
    window.renderOwnedPage=async n=>{
      const p=await window.doc.getPage(n),v=p.getViewport({scale:300/72}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);
      document.querySelector('main').append(c);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;
      window.canvases[n-1]=c;return {width:c.width,height:c.height};
    };
    return pages;
  });
  assertPageLimits(pages);
  if(mode==='retained')for(const p of pages)await page.evaluate(n=>window.renderOwnedPage(n),p.index);
  const manifest=[];let pngBytes=0;
  for(const p of pages){
    if(mode==='sequential')await page.evaluate(n=>window.renderOwnedPage(n),p.index);
    const encoded=await page.evaluate(n=>{const c=window.canvases[n-1];return {w:c.width,h:c.height,png:c.toDataURL('image/png').split(',')[1]};},p.index);
    const bytes=Buffer.from(encoded.png,'base64');pngBytes+=bytes.length;if(pngBytes>limits.pngBytes)throw Error('INCOMPLETE: PNG byte limit');
    const pixelWidth=Math.ceil(p.width*300/72),pixelHeight=Math.ceil(p.height*300/72);
    if(encoded.w!==pixelWidth||encoded.h!==pixelHeight)throw Error('INCOMPLETE: raster dimensions');
    fs.writeFileSync(path.join(output,`source-${p.index}.png`),bytes);
    manifest.push({...p,pixelWidth,pixelHeight,sourceHash:createHash('sha256').update(bytes).digest('hex')});
    if(mode==='sequential'){
      await page.evaluate(async n=>{const c=window.canvases[n-1];c.width=1;c.height=1;c.remove();window.canvases[n-1]=null;(await window.doc.getPage(n)).cleanup();},p.index);
      const cdp=await ctx.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await cdp.detach();
      global.gc?.();
    }
  }
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(output,'browser-capture.json'),JSON.stringify({mode,pages:manifest.length,dpi:300,pngBytes,version:browser.version(),storageStateSaved:false,externalViewer:false},null,2));
  await ctx.close();
}finally{await browser.close();await server.close();}
