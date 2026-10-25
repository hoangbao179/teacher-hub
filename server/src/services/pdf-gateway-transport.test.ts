import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { loadApprovedPdfGateway } from './pdf-gateway-bootstrap';
import { createPdfRuntime } from './pdf-runtime';
import { GatewayPdfProvider } from './pdf-gateway-provider';
import { pdfQueue, taskName } from './pdf-provider';

test('approved public runtime and provider interoperate with the real Gateway over HTTP', async t => {
 const gatewayURL = 'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app';
 const workerBaseURL = 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app';
 const hmacKeyHex = 'ab'.repeat(32);
 const jobId = '55b797f0-e128-4525-8df5-c3cb92163167';
 const moduleURL = pathToFileURL(resolve(__dirname, '../../../workers/pdf-gateway/src/server.mjs')).href;
 const { createGatewayServer } = await import(moduleURL);
 const reserved = new Set<string>();
 let creates = 0;
 const server: Server = createGatewayServer({
  env: { PDF_GATEWAY_ENABLED: 'true', PDF_GATEWAY_HMAC_KEY: hmacKeyHex, PDF_GATEWAY_WORKER_URL: workerBaseURL },
  fetcher: async (url: string, init: RequestInit) => {
   if (url.startsWith('http://metadata.google.internal/'))
    return Response.json({ access_token: 'a'.repeat(40) }, { headers: { 'Metadata-Flavor': 'Google' } });
   if (url.startsWith('https://storage.googleapis.com/upload/')) {
    const name = new URL(url).searchParams.get('name')!;
    assert.equal(new URL(url).searchParams.get('ifGenerationMatch'), '0');
    assert.equal(reserved.has(name), false);
    reserved.add(name);
    return Response.json({});
   }
   if (url === 'https://cloudtasks.googleapis.com/v2/' + pdfQueue)
    return Response.json({ name: pdfQueue, state: 'RUNNING',
     retryConfig: { maxAttempts: 5, maxRetryDuration: '3600s', minBackoff: '10s', maxBackoff: '300s' },
     rateLimits: { maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1 } });
   if (url === 'https://cloudtasks.googleapis.com/v2/' + pdfQueue + '/tasks') {
    const task = JSON.parse(Buffer.from(init.body as Uint8Array).toString()).task;
    assert.equal(task.name, taskName(jobId));
    assert.equal(task.httpRequest.url, workerBaseURL + '/jobs');
    creates++;
    return Response.json({ name: task.name });
   }
   if (url === 'https://cloudtasks.googleapis.com/v2/' + taskName(jobId))
    return Response.json({ name: taskName(jobId) });
   const object = new URL(url).pathname;
   assert.ok(url.startsWith('https://storage.googleapis.com/storage/v1/'));
   if (object.endsWith('output.pdf')) return new Response('%PDF-synthetic');
   if (object.endsWith('result.json')) return Response.json({ version: 1, jobId });
   assert.ok(object.endsWith('request.json'));
   return Response.json({ version: 1 });
  },
 });
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 t.after(() => { server.closeAllConnections(); server.close(); });
 const address = server.address();
 assert.ok(address && typeof address !== 'string');
 const realFetch = globalThis.fetch;
 let sent = 0;
 t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
  assert.ok(String(input).startsWith(gatewayURL + '/v1/'));
  assert.equal(new Headers(init?.headers).has('Authorization'), false);
  assert.equal(init?.redirect, 'error');
  sent++;
  return realFetch(String(input).replace(gatewayURL, `http://127.0.0.1:${address.port}`), init);
 });
 const dir = mkdtempSync(join(tmpdir(), 'pdf-gateway-transport-'));
 t.after(() => rmSync(dir, { recursive: true, force: true }));
 const file = join(dir, 'approval.json');
 writeFileSync(file, JSON.stringify({ kind: 'pdf_gateway_v1', gatewayURL, workerBaseURL, hmacKeyHex,
  authMode: 'hmac_public_v1', activationApproved: true, recoveryVerified: true }), { mode: 0o600 });
 chmodSync(file, 0o600);
 const approved = loadApprovedPdfGateway({ PDF_GATEWAY_APPROVAL_FILE: file });
 assert.ok(approved);
 const previous = process.env.PDF_API_ENABLED;
 t.after(() => { if (previous === undefined) delete process.env.PDF_API_ENABLED; else process.env.PDF_API_ENABLED = previous; });
 process.env.PDF_API_ENABLED = 'false';
 assert.equal((await createPdfRuntime(approved).capabilities()).submitEnabled, false);
 process.env.PDF_API_ENABLED = 'true';
 assert.equal((await createPdfRuntime().capabilities()).submitEnabled, false);
 assert.equal(sent, 0);
 assert.equal((await createPdfRuntime(approved).capabilities()).submitEnabled, true);
 const provider = new GatewayPdfProvider(gatewayURL, workerBaseURL, hmacKeyHex, true, undefined, 'hmac_public_v1');
 await provider.enqueue({ version: 1, jobId, source: { provider: 'google_drive', fileId: 'owned_fixture_12345' } });
 assert.equal(creates, 1);
 assert.equal(await provider.task(jobId), 'WAITING');
 assert.deepEqual(await provider.result(jobId), { result: { version: 1, jobId }, claim: { version: 1 } });
 const chunks: Uint8Array[] = [];
 for await (const chunk of await provider.open(jobId, AbortSignal.timeout(5000))) chunks.push(chunk);
 assert.equal(Buffer.concat(chunks).toString(), '%PDF-synthetic');
 assert.equal(reserved.size, sent);
 assert.equal(sent, 7);
});
