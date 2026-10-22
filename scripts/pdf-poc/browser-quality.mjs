import fs from 'node:fs';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {imageError} from './checks.mjs';
const [dir]=process.argv.slice(2),ref=JSON.parse(fs.readFileSync(path.join(dir,'reference-manifest.json'),'utf8'));
const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(path.join(dir,'indexed256.pdf')))}).promise;
if(pdf.numPages!==5)throw Error('INCOMPLETE: reconstructed count');
const rows=[];
for(let n=1;n<=5;n++){
  const p=await pdf.getPage(n),v=p.getViewport({scale:300/72}),base=p.getViewport({scale:1}),r=ref[n-1];
  if(Math.abs(base.width-r.width)>0.01||Math.abs(base.height-r.height)>0.01)throw Error('INCOMPLETE: paper dimensions');
  const actual=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvasContext:actual.getContext('2d'),viewport:v}).promise;
  const reference=createCanvas(actual.width,actual.height),x=reference.getContext('2d');x.drawImage(await loadImage(path.join(dir,`reference-source-${n}.png`)),0,0);
  const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,b=x.getImageData(0,0,actual.width,actual.height).data;
  const error=imageError(b,a);rows.push({page:n,...error,widthPt:base.width,heightPt:base.height,pixelWidth:actual.width,pixelHeight:actual.height});
  if(n===1||n===2){const crop=createCanvas(1100,450);crop.getContext('2d').drawImage(reference,140,n===1?210:150,1100,450,0,0,1100,450);fs.writeFileSync(path.join(dir,`original-crop-${n}.png`),crop.toBuffer('image/png'));}
  actual.width=1;actual.height=1;reference.width=1;reference.height=1;p.cleanup();global.gc?.();
}
await pdf.cleanup();fs.writeFileSync(path.join(dir,'original-comparison.json'),JSON.stringify({count:5,rows,rendererDifference:'Browser Canvas versus Node Canvas, plus indexed encoding; visual review required',peakRssMiB:process.resourceUsage().maxRSS/1024},null,2));
