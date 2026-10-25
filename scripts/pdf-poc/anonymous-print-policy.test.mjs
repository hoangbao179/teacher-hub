import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicDriveLink, allowedAnonymousRequest, printPageSize } from './anonymous-print-policy.mjs';

const id = '1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr';
test('only canonical public Drive file/view URL; never a credential or resource key', () => {
  assert.equal(parsePublicDriveLink('https://drive.google.com/file/d/' + id + '/view'), id);
  for (const u of ['http://drive.google.com/file/d/' + id + '/view',
    'https://drive.google.com/file/d/' + id + '/view?resourcekey=secret',
    'https://drive.google.com/file/d/' + id + '/view#fragment',
    'https://drive.google.com.evil.test/file/d/' + id + '/view',
    'https://drive.google.com/file/d/short/view',
    'https://docs.google.com/document/d/' + id + '/edit']) {
    assert.throws(() => parsePublicDriveLink(u), /UNSUPPORTED_LINK/);
  }
});
test('allowed external resources are narrow; no login navigation', () => {
  assert.equal(allowedAnonymousRequest('https://drive.google.com/file/d/' + id + '/view',id,true),true);
  assert.equal(allowedAnonymousRequest('https://lh3.googleusercontent.com/x',id,false),true);
  for (const u of ['https://accounts.google.com/', 'http://drive.google.com/',
    'https://drive.google.com.evil.test/', 'https://127.0.0.1/',
    'https://drive.google.com:444/', 'https://somewhere.example/view']) {
    assert.equal(allowedAnonymousRequest(u,id,true),false);
    assert.equal(allowedAnonymousRequest(u,id,false),false);
  }
  assert.equal(allowedAnonymousRequest('https://drive.google.com/file/d/another/view',id,true),false);
});
test('A4 print preserves portrait and landscape proportions with ink margin', () => {
  const p = printPageSize(2400,3396), l = printPageSize(2400,1696);
  assert.ok(p.height > p.width && p.dpi > 190 && p.x > 0 && p.y > 0);
  assert.ok(l.width > l.height && l.dpi > 190 && l.x > 0 && l.y > 0);
  assert.ok(Math.abs(p.outputWidth/p.outputHeight - 2400/3396)<1e-8);
  for(const wh of [[0,300],[100000,100000],[2.2,100]])assert.throws(()=>printPageSize(...wh),/CAPTURE_TOO_LARGE/);
});
