import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gatewayIdToken, validGatewayFederation } from './pdf-gateway-identity';

const url = 'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app';
const sa = 'teacher-pdf-producer@teacher-hub-pdf.iam.gserviceaccount.com';
const audience = '//iam.googleapis.com/projects/851777150171/locations/global/workloadIdentityPools/vps/providers/oidc';
const jwt = (claims: object) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
test('keyless federation sends exact audiences, caches and renews token from rotated subject', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-identity-'));
  const subjectTokenFile = join(dir, 'subject.jwt');
  const original = globalThis.fetch; const clock = Date.now; let now = clock();
  t.after(() => { globalThis.fetch = original; Date.now = clock; rmSync(dir, { recursive: true, force: true }); });
  Date.now = () => now;
  writeFileSync(subjectTokenFile, 'issuer.first.signature', { mode: 0o600 });
  let calls = 0; let expectedSubject = 'issuer.first.signature';
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(init?.redirect, 'error'); assert(init?.signal);
    const body = JSON.parse(String(init?.body));
    if (String(input) === 'https://sts.googleapis.com/v1/token') {
      assert.equal(body.audience, audience); assert.equal(body.subjectToken, expectedSubject);
      assert.equal(body.subjectTokenType, 'urn:ietf:params:oauth:token-type:jwt');
      return Response.json({ access_token: 'x'.repeat(12288) });
    }
    assert.equal(String(input), `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${sa}:generateIdToken`);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer ' + 'x'.repeat(12288));
    assert.deepEqual(body, { audience: url, includeEmail: true });
    return Response.json({ token: jwt({ aud: url, iss: 'https://accounts.google.com', email: sa, exp: Math.floor(now / 1000) + 3600 }) });
  };
  const token = gatewayIdToken({ audience, serviceAccount: sa, subjectTokenFile }, url);
  const signal = AbortSignal.timeout(5000);
  assert.equal(await token(signal), await token(signal)); assert.equal(calls, 2);
  now += 3550000; expectedSubject = 'issuer.rotated.signature';
  writeFileSync(subjectTokenFile, expectedSubject);
  await token(signal); assert.equal(calls, 4);
});

test('identity rejects missing/private-key config, malformed files, failures and wrong token audience without diagnostics', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-identity-'));
  const subjectTokenFile = join(dir, 'subject.jwt');
  const config = { audience, serviceAccount: sa, subjectTokenFile };
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; rmSync(dir, { recursive: true, force: true }); });
  assert.equal(validGatewayFederation({ ...config, audience: 'https://attacker' }), false);
  assert.equal(validGatewayFederation({ ...config, subjectTokenFile: 'relative' }), false);
  assert.equal(validGatewayFederation({ ...config, private_key: 'no' } as typeof config), false);
  const rejects = () => assert.rejects(() => gatewayIdToken(config, url)(AbortSignal.timeout(5000)), /^Error: PDF_CLOUD_UNAVAILABLE$/);
  globalThis.fetch = async () => { throw Error('credential diagnostic must never escape'); };
  await rejects();
  writeFileSync(subjectTokenFile, '{"type":"service_account"}', { mode: 0o600 }); await rejects();
  writeFileSync(subjectTokenFile, 'issuer.token.signature'); await rejects();
  for (const response of [() => new Response('private diagnostic', { status: 403 }), () => Response.json({ access_token: '\r\nunsafe' })]) {
    globalThis.fetch = async () => response(); await rejects();
  }
  for (const patch of [{ aud: 'https://attacker' }, { exp: 1 }, { email: 'other' }, { iss: 'untrusted' }]) {
    globalThis.fetch = async input => String(input).includes('sts.googleapis.com') ? Response.json({ access_token: 'access' }) :
      Response.json({ token: jwt({ aud: url, exp: Math.floor(Date.now() / 1000) + 3600, email: sa, iss: 'https://accounts.google.com', ...patch }) });
    await rejects();
  }
  if (process.platform !== 'win32') { chmodSync(subjectTokenFile, 0o644); await rejects(); }
});
