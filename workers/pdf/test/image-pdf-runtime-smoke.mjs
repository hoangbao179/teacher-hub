/**
 * Offline image-only PDF roundtrip in production Worker image.
 * No Google Drive requests or export restrictions bypassed.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';

const directory=await mkdtemp(join(tmpdir(),'pdf-smoke-'));
let browser;
try {
  browser=await chromium.launch({headless:true,chromiumSandbox:false,
    args:['--disable-background-networking']});
  const page=await browser.newPage();
  await page.goto('about:blank');
  await page.close();
  const pdf=await PDFDocument.create();
  for(const [w,h] of [[1200,1696],[1696,1200]]){
    const pixels=Buffer.alloc(w*h*3);
    for(let p=0;p<pixels.length;p+=3){
      pixels[p]=(p/3)%255;pixels[p+1]=80;pixels[p+2]=150;
    }
    const jpg=await sharp(pixels,{raw:{width:w,height:h,channels:3}})
      .jpeg({quality:93,chromaSubsampling:'4:4:4'}).toBuffer();
    const img=await pdf.embedJpg(jpg);
    const pw=w>h?841.89:595.28,ph=w>h?595.28:841.89;
    const k=Math.min((pw-16)/w,(ph-16)/h);
    pdf.addPage([pw,ph]).drawImage(img,{x:(pw-w*k)/2,y:(ph-h*k)/2,width:w*k,height:h*k});
  }
  const path=join(directory,'image-only.pdf');
  const bytes=await pdf.save();
  assert(bytes.length>500&&bytes.length<10485760);
  await writeFile(path,bytes,{flag:'wx',mode:0o600});
  execFileSync('qpdf',['--check',path],{stdio:'pipe',timeout:12000});
  assert.equal(execFileSync('qpdf',['--show-npages',path],{encoding:'utf8',timeout:12000}).trim(),'2');
  const decoded=await PDFDocument.load(await readFile(path));
  assert.equal(decoded.getPageCount(),2);
  assert(decoded.getPage(0).getHeight()>decoded.getPage(0).getWidth());
  assert(decoded.getPage(1).getWidth()>decoded.getPage(1).getHeight());
  console.log(JSON.stringify({status:'PDF_IMAGE_RUNTIME_OK',pages:2,
    qpdf:'PASS',chromium:'PASS',sharp:'PASS',pdfLib:'PASS',network:'DISABLED'}));
}finally{
  await browser?.close().catch(()=>{});
  await rm(directory,{recursive:true,force:true});
}
