import assert from 'node:assert/strict';
import test from 'node:test';
import { pdfFromJpegPages, sortImagePages, validateImageFiles } from '../src/api/imagePdf.ts';

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
