// Independent original-content/order check; rendering at 300 DPI here is comparison only.
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {imageError,assertPages} from './checks.mjs';
import {assertOriginalIdentity} from './drive-policy.mjs';
const [dir]=process.argv.slice(2),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const expected=read('reference-manifest.json'),source=read('manifest.json'),encoded=read('indexed256.metrics.json');
assertPages(source,encoded.details);
const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(path.join(dir,'indexed256.pdf')))}).promise;
if(pdf.numPages!==5)throw Error('INCOMPLETE: count');
const rows=[],thumbs=[];
const canvas=(w,h)=>createCanvas(w,h);
for(let n=1;n<=5;n++){
 const c=canvas(120,170);c.getContext('2d').drawImage(await loadImage(path.join(dir,`reference-source-${n}.png`)),0,0,120,170);thumbs.push(c.getContext('2d').getImageData(0,0,120,170).data);
}
const sheet=canvas(1250,1200),sx=sheet.getContext('2d');sx.fillStyle='white';sx.fillRect(0,0,1250,1200);
for(let n=1;n<=5;n++){
 const p=await pdf.getPage(n),v=p.getViewport({scale:300/72}),size=p.getViewport({scale:1}),ref=expected[n-1];
 if(Math.abs(size.width-ref.width)>0.01||Math.abs(size.height-ref.height)>0.01)throw Error('INCOMPLETE: paper size');
 const actual=canvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvasContext:actual.getContext('2d'),viewport:v}).promise;
 const original=canvas(actual.width,actual.height),captured=canvas(actual.width,actual.height);
 original.getContext('2d').drawImage(await loadImage(path.join(dir,`reference-source-${n}.png`)),0,0,actual.width,actual.height);
 captured.getContext('2d').drawImage(await loadImage(path.join(dir,`source-${n}.png`)),0,0,actual.width,actual.height);
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const thumb=canvas(120,170);thumb.getContext('2d').drawImage(actual,0,0,120,170);const a=pixels(thumb);
 const distances=thumbs.map((b,i)=>({index:i+1,rmse:imageError(b,a).rmse})).sort((a,b)=>a.rmse-b.rmse);
 const error=imageError(pixels(original),pixels(actual));
 assertOriginalIdentity(n,distances[0],error.rmse);
 rows.push({page:n,nearestOriginalPage:distances[0].index,thumbnailRmse:distances[0].rmse,...error,captureRoundtrip:imageError(pixels(captured),pixels(actual)),widthPt:size.width,heightPt:size.height,pixelWidth:source[n-1].pixelWidth,pixelHeight:source[n-1].pixelHeight,dpiX:source[n-1].dpiX,dpiY:source[n-1].dpiY});
 if(n===1||n===2){for(const [label,c]of[['original',original],['drive',actual]]){const crop=canvas(1800,500);crop.getContext('2d').drawImage(c,140,n===1?210:150,1800,500,0,0,1800,500);fs.writeFileSync(path.join(dir,`${label}-crop-${n}.png`),crop.toBuffer('image/png'));}}
 const scale=Math.min(400/actual.width,570/actual.height);sx.drawImage(actual,((n-1)%3)*415,Math.floor((n-1)/3)*600,actual.width*scale,actual.height*scale);
 actual.width=original.width=captured.width=1;actual.height=original.height=captured.height=1;p.cleanup();global.gc?.();
}
fs.writeFileSync(path.join(dir,'drive-contact.png'),sheet.toBuffer('image/png'));await pdf.cleanup();
const report={count:5,rows,status:'STRUCTURE_AND_ORIGINAL_IDENTITY_CHECKED',comparisonDpi:300,sourceNotUpscaled:true,printQuality:'VISUAL_REVIEW_REQUIRED; PAPER_NOT_TESTED'};
fs.writeFileSync(path.join(dir,'indexed256.verify.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(dir,'original-comparison.json'),JSON.stringify(report,null,2));
