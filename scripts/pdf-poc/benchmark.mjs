// Local, owned-fixture experiment. No URL ingestion, server, cookies or production integration.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';
import {assertPages,imageError} from './checks.mjs';
sharp.concurrency(1); sharp.cache(false);
const self=fileURLToPath(import.meta.url);
const [mode,inputArg,outputArg,...args]=process.argv.slice(2);
const input=path.resolve(inputArg||''),output=path.resolve(outputArg||'');
const variants=['rgb','indexed128','indexed256','jpeg85','jpeg92','jpeg97'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const peak=()=>process.resourceUsage().maxRSS/1024;
async function open(file){return getDocument({data:new Uint8Array(fs.readFileSync(file))}).promise;}
async function render(page,dpi){
 const v=page.getViewport({scale:dpi/72}),c=createCanvas(Math.ceil(v.width),Math.ceil(v.height));
 await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;return c;
}
async function child(childMode,extra=[]){
 await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,['--expose-gc',self,childMode,input,output,...extra],{stdio:'inherit',windowsHide:true});
  const timer=setTimeout(()=>{p.kill();reject(Error('INCOMPLETE: child deadline'));},300000);
  p.on('error',e=>{clearTimeout(timer);reject(e);});p.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`INCOMPLETE: ${childMode} exit ${code}`));});
 });
}
try {
 if (!inputArg || !outputArg) throw Error('Usage: node benchmark.mjs run ORIGINAL.pdf NEW_ARTIFACT_DIR');
 if(mode==='run'){
  if(fs.existsSync(output))throw Error('Use a new output directory; existing artifacts are never deleted automatically');
  fs.mkdirSync(output,{recursive:true});
  save(path.join(output,'run.json'),{status:'RUNNING',node:process.version,platform:process.platform,dpi:300,concurrency:1,sourceHash:hash(fs.readFileSync(input))});
  await child('prepare');
  for(const v of variants){await child('encode',[v]);await child('verify',[v]);}
  save(path.join(output,'summary.json'),variants.map(v=>({...read(path.join(output,v+'.metrics.json')),verification:read(path.join(output,v+'.verify.json'))})));
  save(path.join(output,'run.json'),{status:'LOCAL_ROUNDTRIP_COMPLETE',sourceHash:hash(fs.readFileSync(input)),node:process.version,platform:process.platform,dpi:300,concurrency:1,drive:'NOT_TESTED',paperPrint:'NOT_TESTED',linux:process.platform==='linux'?'MEASURED':'NOT_TESTED'});
 }else if(mode==='prepare'){
  const pdf=await open(input),manifest=[];
  for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i),v=p.getViewport({scale:1}),c=await render(p,300),png=c.toBuffer('image/png');
   fs.writeFileSync(path.join(output,`source-${i}.png`),png);
   manifest.push({index:i,width:v.width,height:v.height,pixelWidth:c.width,pixelHeight:c.height,sourceHash:hash(png)});
   c.width=1;c.height=1;p.cleanup();global.gc?.();
  }
  save(path.join(output,'manifest.json'),manifest);await pdf.cleanup();
 }else if(mode==='encode'){
  const variant=args[0];if(!variants.includes(variant))throw Error('Unknown variant');
  const start=performance.now(),cpu=process.cpuUsage(),baseline=process.memoryUsage().rss/1048576;
  const manifest=read(path.join(output,'manifest.json')),pdf=await PDFDocument.create(),details=[];let compressionSeconds=0,maxCompressionRssDeltaMiB=0;
  for(const p of manifest){
   const raw=fs.readFileSync(path.join(output,`source-${p.index}.png`));if(hash(raw)!==p.sourceHash)throw Error('INCOMPLETE: changed source');
   const before=process.memoryUsage().rss,at=performance.now();let bytes;
   if(variant==='rgb')bytes=raw;
   else if(variant.startsWith('indexed'))bytes=await sharp(raw).png({palette:true,colours:Number(variant.slice(7)),dither:0,effort:10}).toBuffer();
   else bytes=await sharp(raw).jpeg({quality:Number(variant.slice(4)),chromaSubsampling:'4:4:4'}).toBuffer();
   compressionSeconds+=(performance.now()-at)/1000;maxCompressionRssDeltaMiB=Math.max(maxCompressionRssDeltaMiB,(process.memoryUsage().rss-before)/1048576);
   const metadata=await sharp(bytes).metadata();if(metadata.width!==p.pixelWidth||metadata.height!==p.pixelHeight)throw Error('INCOMPLETE: resolution changed');
   const image=variant.startsWith('jpeg')?await pdf.embedJpg(bytes):await pdf.embedPng(bytes);
   const page=pdf.addPage([p.width,p.height]);page.drawImage(image,{x:0,y:0,width:p.width,height:p.height});
   await pdf.flush(); // releases embedder work; compressed PDF objects remain until save.
   details.push({...p,encodedBytes:bytes.length,paletteBits:metadata.bitsPerSample??null});
   global.gc?.();
  }
  const bytes=await pdf.save();fs.writeFileSync(path.join(output,variant+'.pdf'),bytes);
  const delta=process.cpuUsage(cpu);
  const metrics={variant,pages:details.length,pdfBytes:bytes.length,wallSeconds:(performance.now()-start)/1000,compressionSeconds,cpuSeconds:(delta.user+delta.system)/1e6,peakRssMiB:peak(),baselineRssMiB:baseline,maxCompressionRssDeltaMiB,peakRssIncreaseMiB:peak()-baseline,details};
  save(path.join(output,variant+'.metrics.json'),metrics);console.log(JSON.stringify({...metrics,details:undefined}));
 }else if(mode==='verify'){
  const variant=args[0],expected=read(path.join(output,'manifest.json')),built=read(path.join(output,variant+'.metrics.json'));
  assertPages(expected,built.details);
  const pdf=await open(path.join(output,variant+'.pdf'));if(pdf.numPages!==expected.length)throw Error('INCOMPLETE: output count');
  const rows=[];const sheet=createCanvas(1250,1800),sx=sheet.getContext('2d');sx.fillStyle='white';sx.fillRect(0,0,sheet.width,sheet.height);
  for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i),v=p.getViewport({scale:1}),ref=expected[i-1];
   assertPages([{...ref,index:1}],[{...ref,index:1,width:v.width,height:v.height}]);
   const actual=await render(p,300),image=await loadImage(path.join(output,`source-${i}.png`)),reference=createCanvas(actual.width,actual.height);
   if(actual.width!==ref.pixelWidth||actual.height!==ref.pixelHeight)throw Error('INCOMPLETE: pixel size');
   reference.getContext('2d').drawImage(image,0,0);
   const error=imageError(reference.getContext('2d').getImageData(0,0,actual.width,actual.height).data,actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data);
   // Identity check against all other source pages at thumbnail scale (not just distinct hashes).
   const thumb=createCanvas(100,140);thumb.getContext('2d').drawImage(actual,0,0,100,140);const a=thumb.getContext('2d').getImageData(0,0,100,140).data;
   const distances=[];
   for(const other of expected){const candidate=await loadImage(path.join(output,`source-${other.index}.png`));const t=createCanvas(100,140);t.getContext('2d').drawImage(candidate,0,0,100,140);distances.push({index:other.index,rmse:imageError(a,t.getContext('2d').getImageData(0,0,100,140).data).rmse});t.width=1;t.height=1;}
   distances.sort((a,b)=>a.rmse-b.rmse);if(distances[0].index!==i)throw Error('INCOMPLETE: closest content belongs to different page');
   rows.push({index:i,...error,nearestOriginalPage:distances[0].index,width:v.width,height:v.height});
   if(i===1||i===2||i===4){const crop=createCanvas(1100,450);crop.getContext('2d').drawImage(actual,140,i===1?210:150,1100,450,0,0,1100,450);fs.writeFileSync(path.join(output,`${variant}-crop-${i}.png`),crop.toBuffer('image/png'));}
   const k=i-1,scale=Math.min(400/actual.width,570/actual.height);sx.drawImage(actual,(k%3)*415,Math.floor(k/3)*600,actual.width*scale,actual.height*scale);
   actual.width=1;actual.height=1;reference.width=1;reference.height=1;p.cleanup();global.gc?.();
  }
  fs.writeFileSync(path.join(output,variant+'-contact.png'),sheet.toBuffer('image/png'));
  save(path.join(output,variant+'.verify.json'),{count:rows.length,rows,peakRssMiB:peak(),status:'STRUCTURE_AND_IDENTITY_CHECKED',printQuality:'REQUIRES_VISUAL_REVIEW'});await pdf.cleanup();
 }else throw Error('Unknown mode');
}catch(error){if(outputArg&&fs.existsSync(output))save(path.join(output,'failure.json'),{status:'INCOMPLETE',mode,message:error.message});console.error(error.message);process.exitCode=1;}
