import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import test from 'node:test';
import { pdfFromJpegPages, sortImagePages, validateImageFiles } from '../src/api/imagePdf.ts';
import { encodedImageDimensions, inspectImageFile } from '../src/api/imageDimensions.ts';

const fakeJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]);

test('images sort in page number order and reject unbounded/untrusted input', () => {
  assert.deepEqual(sortImagePages([{name:'page-10.png'}, {name:'page-2.png'}, {name:'page-1.png'}]).map(x=>x.name),
    ['page-1.png','page-2.png','page-10.png']);
  assert.throws(() => validateImageFiles([]));
  assert.throws(() => validateImageFiles([{name:'x.svg',type:'image/svg+xml',size:1024}]));
  assert.throws(() => validateImageFiles([{name:'x.png',type:'image/png',size:16*1024*1024}]));
  assert.doesNotThrow(() => validateImageFiles([{name:'x.jpg',type:'image/jpeg',size:1024}]));
});

test('generate ordered PDF object tree, distinct portrait and landscape dimensions', async () => {
  const pdf = pdfFromJpegPages([
    {bytes:fakeJpeg,width:1000,height:1800},
    {bytes:fakeJpeg,width:1800,height:1000},
  ]);
  assert.equal(pdf.type, 'application/pdf');
  const text = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text,/\/Count 2/);
  assert.match(text,/\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(text,/\/MediaBox \[0 0 841\.89 595\.28\]/);
  assert.match(text,/\/Length 8 >>\nstream/);
  assert.match(text,/xref\n0 9\n/);
  const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
  assert.equal(text.slice(startxref,startxref+4),'xref');
  const lines = text.slice(startxref).split('\n');
  for(let id=1;id<=8;id++) {
    const offset=Number(lines[id+2].slice(0,10));
    assert.equal(text.slice(offset,offset+String(id).length+6),`${id} 0 obj`);
  }
  assert.ok(text.endsWith('%%EOF\n'));
});

test('rejects malformed JPEG, invalid dimensions, excessive count, or oversized PDF', () => {
  assert.throws(()=>pdfFromJpegPages([]));
  assert.throws(()=>pdfFromJpegPages([{bytes:new Uint8Array([1,2]),width:100,height:100}]));
  assert.throws(()=>pdfFromJpegPages([{bytes:fakeJpeg,width:0,height:1}]));
  assert.throws(()=>pdfFromJpegPages(Array.from({length:41},()=>({bytes:fakeJpeg,width:2,height:2}))));
  const huge = new Uint8Array(21*1024*1024);huge[0]=huge[1]=0xff;huge[2]=0xd8;
  huge[huge.length-2]=0xff;huge[huge.length-1]=0xd9;
  assert.throws(()=>pdfFromJpegPages([{bytes:huge,width:100,height:100}]));
});

test('inspect PNG/JPEG/WebP headers without decoding compressed pixel data', async () => {
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,5,0,0,0,7,8]);
  assert.deepEqual(encodedImageDimensions(png,'image/png'),{width:1280,height:1800});
  assert.deepEqual(await inspectImageFile(new Blob([png],{type:'image/png'})),{width:1280,height:1800});

  const jpeg=Uint8Array.from([255,216,255,224,0,4,0,0,255,192,0,17,8,4,0,3,0,0,1,0,0,0,0,0,0,0,0,0]);
  assert.deepEqual(encodedImageDimensions(jpeg,'image/jpeg'),{width:768,height:1024});

  const webp=new Uint8Array(30);
  Buffer.from('RIFF').copy(webp,0);Buffer.from('WEBP').copy(webp,8);Buffer.from('VP8X').copy(webp,12);
  webp[24]=31;webp[27]=63;
  assert.deepEqual(encodedImageDimensions(webp,'image/webp'),{width:32,height:64});
});

test('rejects spoofed headers, malformed lengths, oversized decoded images and unsupported types', async () => {
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,5,0,0,0,7,8]);
  assert.throws(()=>encodedImageDimensions(png,'image/jpeg'));
  assert.throws(()=>encodedImageDimensions(new Uint8Array(24),'image/png'));
  assert.throws(()=>encodedImageDimensions(Uint8Array.from([255,216,255,192,0,255]),'image/jpeg'));
  assert.throws(()=>encodedImageDimensions(new Uint8Array(30),'image/webp'));

  const oversized=Uint8Array.from(png);
  oversized.set([0,0,195,80,0,0,195,80],16); // 50000 x 50000 pixel bomb
  assert.throws(()=>encodedImageDimensions(oversized,'image/png'),/24 triệu/);
  await assert.rejects(inspectImageFile(new Blob([png],{type:'image/jpeg'})));
  await assert.rejects(inspectImageFile(new Blob([png],{type:'image/gif'})));
});
