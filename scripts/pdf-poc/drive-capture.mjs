import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {ownedHash,driveId,allowedDriveRequest,assertCaptureDimensions} from './drive-policy.mjs';
const [mode,output]=process.argv.slice(2),id=driveId(process.env.PDF_POC_DRIVE_ID);
if(mode!=='sequential')throw Error('Drive experiment requires sequential mode');
if(createHash('sha256').update(fs.readFileSync('/fixture/original.pdf')).digest('hex')!==ownedHash)throw Error('Wrong owned original');
const reference=JSON.parse(fs.readFileSync(path.join(output,'reference-manifest.json'),'utf8'));
const server=await chromium.launchServer({headless:true,chromiumSandbox:false,args:['--disable-gpu','--disable-background-networking']});
fs.writeFileSync(path.join(output,'browser-pids.json'),JSON.stringify({pid:server.process().pid}));
const browser=await chromium.connect(server.wsEndpoint());
try {
 const ctx=await browser.newContext({locale:'vi-VN',viewport:{width:1280,height:900},deviceScaleFactor:1,acceptDownloads:false,serviceWorkers:'block'});
 let requests=0,wireBytes=0,networkLimit=false;
 await ctx.route('**/*',route=>{
  if(++requests>500){networkLimit=true;return route.abort();}
  return allowedDriveRequest(route.request().url(),id,route.request().isNavigationRequest())?route.continue():route.abort();
 });
 ctx.on('requestfinished',async request=>{try{wireBytes+=(await request.sizes()).responseBodySize;if(wireBytes>64*1024*1024){networkLimit=true;await ctx.close();}}catch{/* context closed */}});
 const page=await ctx.newPage();page.setDefaultTimeout(25000);
 await page.goto(`https://drive.google.com/file/d/${id}/view`,{waitUntil:'domcontentloaded',timeout:30000});
 if(await page.title()!=='owned-synthetic-original.pdf - Google Drive')throw Error('INCOMPLETE: wrong fixture title');
 await page.locator('h2').filter({hasText:/1\s*\/\s*5$/}).waitFor();
 // No extraction when the viewer disables printing. This experiment is deliberately narrower than ownership alone.
 const print=page.getByRole('button',{name:'In',exact:true});
 if(await print.count()!==1||!await print.isEnabled())throw Error('INCOMPLETE: viewer does not permit printing');
 const zoom=page.getByRole('combobox');await zoom.fill('300%');await zoom.press('Enter');
 const manifest=[];let pngBytes=0;
 for(const p of reference){
  const heading=page.locator('h2').filter({hasText:new RegExp(` ${p.index} / 5$`)});
  await heading.scrollIntoViewIfNeeded();
  // Wait for the zoom's new bitmap, not the previous lower-resolution image.
  await page.waitForFunction(n=>{const h=[...document.querySelectorAll('h2')].find(h=>h.textContent.trim().endsWith(` ${n} / 5`));const i=h?.parentElement?.parentElement?.querySelector('img');return i?.complete&&i.src.startsWith('blob:')&&i.naturalWidth===2400;},p.index);
  const data=await heading.evaluate(h=>{
   const i=h.parentElement.parentElement.querySelector('img'),c=document.createElement('canvas');
   if(i.naturalWidth*i.naturalHeight>12_000_000)throw Error('INCOMPLETE: canvas allocation limit');
   c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);
   const url=c.toDataURL('image/png');c.width=c.height=1;
   if(url.length>12*1024*1024)throw Error('INCOMPLETE: image byte limit');
   return {w:i.naturalWidth,h:i.naturalHeight,url};
  });
  const dpi=assertCaptureDimensions(p,data.w,data.h),bytes=Buffer.from(data.url.split(',')[1],'base64');
  pngBytes+=bytes.length;if(pngBytes>32*1024*1024||networkLimit)throw Error('INCOMPLETE: capture/network limit');
  fs.writeFileSync(path.join(output,`source-${p.index}.png`),bytes);
  manifest.push({...p,pixelWidth:data.w,pixelHeight:data.h,...dpi,zoomPercent:300,sourceHash:createHash('sha256').update(bytes).digest('hex')});
  global.gc?.();
 }
 if((await page.locator('h2').allTextContents()).some(t=>/\/\s*\d+$/.test(t)&&!t.trim().endsWith('/ 5')))throw Error('INCOMPLETE: viewer count changed');
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(output,'browser-capture.json'),JSON.stringify({mode,pages:manifest.length,viewerPages:5,zoomPercent:300,manifest,pngBytes,requests,wireBytes,version:browser.version(),storageStateSaved:false,externalViewer:true,printEnabled:true},null,2));
 await ctx.close();
}finally{await browser.close();await server.close();}
