import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadApprovedPdfGateway } from './pdf-gateway-bootstrap';

const valid = () => ({
  kind:'pdf_gateway_v1',
  gatewayURL:'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app',
  workerBaseURL:'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app',
  hmacKeyHex:'ab'.repeat(32),
  activationApproved:true,
  recoveryVerified:true,
});
test('gateway config file fail-closed and shared bootstrap', t => {
  assert.equal(loadApprovedPdfGateway({}),undefined);
  assert.equal(loadApprovedPdfGateway({PDF_GATEWAY_APPROVAL_FILE:'relative.json'}),undefined);
  const dir=mkdtempSync(join(tmpdir(),'teacher-pdf-gateway-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'approval.json');
  const env={PDF_GATEWAY_APPROVAL_FILE:file};
  writeFileSync(file,JSON.stringify(valid()),{mode:0o600});chmodSync(file,0o600);
  assert.deepEqual(loadApprovedPdfGateway(env),Object.fromEntries(
    Object.entries(valid()).filter(([k])=>k!=='kind')));
  for(const patch of [
    {activationApproved:false},{recoveryVerified:false},{hmacKeyHex:'invalid'},
    {gatewayURL:'https://attacker.example.com'},{workerBaseURL:'http://localhost:8080'},
    {extra:'unsafe'},
  ]) {
    writeFileSync(file,JSON.stringify({...valid(),...patch}));
    assert.equal(loadApprovedPdfGateway(env),undefined,JSON.stringify(patch));
  }
  writeFileSync(file,'not json');
  assert.equal(loadApprovedPdfGateway(env),undefined);
  writeFileSync(file,JSON.stringify(valid()));
  if(process.platform!=='win32') {
    chmodSync(file,0o644);
    assert.equal(loadApprovedPdfGateway(env),undefined);
  }
});
