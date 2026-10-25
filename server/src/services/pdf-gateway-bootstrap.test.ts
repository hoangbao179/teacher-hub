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
  federation: { audience:'//iam.googleapis.com/projects/851777150171/locations/global/workloadIdentityPools/vps/providers/oidc',
    serviceAccount:'teacher-pdf-producer@teacher-hub-pdf.iam.gserviceaccount.com',subjectTokenFile:join(tmpdir(),'subject.jwt') },
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
    {federation:undefined},{federation:{type:'service_account',private_key:'rejected'}},
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

test('public-HMAC approval needs an exact explicit mode and never a federation fallback', t => {
 const dir = mkdtempSync(join(tmpdir(), 'teacher-pdf-hmac-'));
 t.after(() => rmSync(dir, {recursive: true, force: true}));
 const file = join(dir, 'approval.json');
 const env = {PDF_GATEWAY_APPROVAL_FILE: file};
 const publicConfig = {
  kind: 'pdf_gateway_v1',
  gatewayURL: 'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app',
  workerBaseURL: 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app',
  hmacKeyHex: 'ab'.repeat(32),
  authMode: 'hmac_public_v1',
  activationApproved: true,
  recoveryVerified: true,
 };
 const read = (value: unknown) => {
  writeFileSync(file, JSON.stringify(value), {mode: 0o600});
  chmodSync(file, 0o600);
  return loadApprovedPdfGateway(env);
 };
 assert.deepEqual(read(publicConfig), Object.fromEntries(
  Object.entries(publicConfig).filter(([key]) => key !== 'kind')));
 for (const patch of [
  {authMode: undefined}, {authMode: 'iam_hmac_v1'},
  {federation: valid().federation}, {activationApproved: false},
  {recoveryVerified: false}, {hmacKeyHex: 'invalid'}, {extra: true},
  {gatewayURL: 'https://attacker.invalid'},
 ]) {
  assert.equal(read({...publicConfig, ...patch}), undefined, JSON.stringify(patch));
 }
});
