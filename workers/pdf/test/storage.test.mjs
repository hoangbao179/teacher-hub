import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GCSStore, boundedJSON } from '../src/storage.ts';
import { BUCKET } from '../src/contract.ts';

test('GCS REST fixed bucket, metadata auth, preconditions, streaming upload and read recovery', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gcs-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'source.pdf'); await writeFile(path, 'owned-pdf-bytes');
  let upload = 0;
  t.mock.method(globalThis, 'fetch', async (raw, init) => {
    const url = new URL(raw);
    if (url.hostname === 'metadata.google.internal') {
      assert.equal(init.headers['Metadata-Flavor'], 'Google');
      return Response.json({ access_token: 'synthetic-token' }, { headers: { 'Metadata-Flavor': 'Google' } });
    }
    assert.equal(url.hostname, 'storage.googleapis.com');
    assert.ok(url.pathname.includes(`/b/${BUCKET}/`));
    assert.equal(init.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(init.redirect, 'error');
    if (url.pathname.endsWith('/iam/testPermissions')) {
      assert.deepEqual(url.searchParams.getAll('permissions'), ['storage.objects.get', 'storage.objects.create']);
      return Response.json({ permissions: ['storage.objects.get', 'storage.objects.create'] });
    }
    if (init.method === 'POST') {
      assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
      assert.equal(url.searchParams.get('uploadType'), 'multipart');
      let body = '';
      for await (const part of init.body) body += part.toString();
      assert.ok(body.includes('private, no-store'));
      assert.ok(body.includes(upload === 0 ? 'owned-pdf-bytes' : 'COMPLETED'));
      return new Response('', { status: ++upload === 1 ? 200 : 412 });
    }
    if (url.searchParams.get('alt') === 'media') return Response.json({ status: 'COMPLETED' });
    return Response.json({ generation: '12', metadata: { sourceHash: 'test' } });
  });
  const store = new GCSStore(); const signal = AbortSignal.timeout(10000);
  await store.ready(signal);
  assert.equal(await store.create('jobs/owned/output.pdf', { path, metadata: { sha256: 'abc' } }, signal), true);
  assert.equal(await store.create('jobs/owned/result.json', { json: { status: 'COMPLETED' } }, signal), false);
  assert.equal((await store.json('jobs/owned/result.json', signal)).status, 'COMPLETED');
  assert.equal((await store.head('jobs/owned/output.pdf', signal)).generation, '12');
});

test('permission denial, missing get/create, and bounded storage responses', async t => {
  t.mock.method(globalThis, 'fetch', async raw => String(raw).startsWith('http://metadata.') ?
    Response.json({ access_token: 'synthetic' }, { headers: { 'Metadata-Flavor': 'Google' } }) : new Response('', { status: 403 }));
  await assert.rejects(new GCSStore().ready(AbortSignal.timeout(1000)), { code: 'SERVICE_UNAVAILABLE', retryable: true });
  globalThis.fetch = async raw => String(raw).startsWith('http://metadata.') ?
    Response.json({ access_token: 'synthetic' }, { headers: { 'Metadata-Flavor': 'Google' } }) : Response.json({ permissions: ['storage.objects.create'] });
  await assert.rejects(new GCSStore().ready(AbortSignal.timeout(1000)), { code: 'SERVICE_UNAVAILABLE' });
  await assert.rejects(boundedJSON(new Response('x'.repeat(20000))), { code: 'STORAGE_UNAVAILABLE' });
});
