import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPrintRequest, assertPrintAction, printPageSize } from '../src/print-policy.ts';

const id = '1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr';
test('anonymous print browser navigation cannot reach login or arbitrary URLs', () => {
  assert.equal(allowedPrintRequest('https://drive.google.com/file/d/'+id+'/view',id,true),true);
  assert.equal(allowedPrintRequest('https://lh3.googleusercontent.com/image',id,false),true);
  for(const u of ['https://accounts.google.com/login','https://drive.google.com.evil.test/',
    'https://127.0.0.1/','http://drive.google.com/','https://drive.google.com:444/',
    'https://metadata.google.internal/','file:///etc/passwd']) {
    assert.equal(allowedPrintRequest(u,id,true),false);
    assert.equal(allowedPrintRequest(u,id,false),false);
  }
  assert.equal(allowedPrintRequest('https://drive.google.com/file/d/other/view',id,true),false);
});

test('native images fit A4 portrait/landscape without stretching', () => {
  for(const [w,h] of [[2400,3396],[2400,1696]]) {
    const p = printPageSize(w,h);
    assert.ok(p.x >= 7 && p.y >= 7 && p.dpi >= 150);
    assert.ok(Math.abs(p.width/p.height-w/h)<1e-7);
  }
  assert.ok(printPageSize(2400,1696).pageWidth>printPageSize(2400,1696).pageHeight);
  for(const [w,h] of [[0,300],[300000,300000],[1.5,200],[20,20]]) {
    assert.throws(()=>printPageSize(w,h));
  }
});

test('missing Print UI is not misreported as definitive access denial', () => {
  assert.doesNotThrow(() => assertPrintAction(1, true));
  assert.throws(() => assertPrintAction(0), { code: 'PRINT_UNAVAILABLE', retryable: false });
  assert.throws(() => assertPrintAction(1, false), { code: 'ACCESS_DENIED', retryable: false });
  assert.throws(() => assertPrintAction(2), { code: 'UNSUPPORTED_SOURCE', retryable: false });
});
