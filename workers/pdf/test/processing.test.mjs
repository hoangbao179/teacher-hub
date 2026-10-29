import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, get } from 'node:http';
import { mkdtemp, readdir, rm, writeFile, readFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Resolver } from 'node:dns/promises';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { JobError, limits, parseJob, printFallbackEnabled, viewerScreenCaptureEnabled } from '../src/contract.ts';
import { selectViewerMode } from '../src/viewer-ready.ts';
import { download, openSource, sourceURL, publicAddress } from '../src/download.ts';
import { processJob } from '../src/processor.ts';
import { validatePDF, pdfParserBudget, pdfParserFailureReason } from '../src/pdf.ts';
import { createWorkerServer } from '../src/server.mjs';
import { scratchVolumeLimitBytes } from '../src/http.ts';
import { job, MemoryStore, syntheticPDF } from './fixtures.mjs';

const signal = () => AbortSignal.timeout(10000);
const cap = limits({});
const output = `jobs/${job.jobId}/output.pdf`;
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'pdf-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function response(body, status = 200, headers = {}) {
  return Object.assign(Readable.from([Buffer.from(body)]), { statusCode: status, headers });
}
const fixtureDownload = async (_id, path, _cap, abort) => { abort.throwIfAborted(); await writeFile(path, syntheticPDF()); };
const fakeValidation = async () => ({ bytes: syntheticPDF().length, pages: 2, sha256: 'a'.repeat(64) });

test('v1 remains compatible with a v2 Worker scratch mount during rollout', () => {
  const v1 = 32 * 1024 * 1024;
  const v2 = 384 * 1024 * 1024;
  assert.equal(scratchVolumeLimitBytes({}, false), v1);
  assert.equal(scratchVolumeLimitBytes({ PDF_CHUNKED_JOBS_ENABLED: 'false' }, false), v1);
  assert.equal(scratchVolumeLimitBytes({ PDF_CHUNKED_JOBS_ENABLED: 'true' }, false), v2);
  assert.equal(scratchVolumeLimitBytes({ PDF_CHUNKED_JOBS_ENABLED: 'true' }, true), v2);
  assert.equal(scratchVolumeLimitBytes({}, true), v2);
});

test('final PDF parser gets a bounded integrity-only budget; chunk and v1 limits do not change', () => {
  const longCap={...cap,maxBytes:150*1048576,maxPages:200};
  assert.deepEqual(pdfParserBudget(longCap,'--check',false),
    {cpuSeconds:45,wallMs:50000,addressSpace:536870912});
  assert.deepEqual(pdfParserBudget(longCap,'--check',true),
    {cpuSeconds:110,wallMs:125000,addressSpace:1073741824});
  assert.deepEqual(pdfParserBudget(longCap,'--is-encrypted',true),
    {cpuSeconds:45,wallMs:50000,addressSpace:536870912});
  assert.deepEqual(pdfParserBudget(longCap,'--show-npages',true),
    {cpuSeconds:45,wallMs:50000,addressSpace:536870912});
  assert.deepEqual(pdfParserBudget(cap,'--check',true),
    {cpuSeconds:5,wallMs:6000,addressSpace:536870912});
  assert.ok(pdfParserBudget(longCap,'--check',true).wallMs<165000);
});

test('qpdf signals report CPU, OOM/kill and segfault distinctly without provider content', () => {
  assert.equal(pdfParserFailureReason('--check',false,false,'SIGXCPU'),'parser-integrity-cpu-limit');
  assert.equal(pdfParserFailureReason('--check',false,false,'SIGKILL'),'parser-integrity-sigkill');
  assert.equal(pdfParserFailureReason('--check',false,false,'SIGSEGV'),'parser-integrity-sigsegv');
  assert.equal(pdfParserFailureReason('--check',false,true,'SIGKILL'),'parser-integrity-wall-timeout');
  assert.equal(pdfParserFailureReason('--check',true,false,'SIGXCPU'),'parser-integrity-deadline');
  assert.equal(pdfParserFailureReason('--show-npages',false,false,'SIGTERM'),'parser-page-count-signalled');
});

test('source validation and output validation use independent byte ceilings', async t => {
  const root = await directory(t);
  const run = async (maxSourceBytes, maxBytes) => {
    const observed = [];
    const result = await processJob(job, { ...cap, maxSourceBytes, maxBytes }, signal(), {
      store: new MemoryStore(), tempRoot: root,
      download: async (_id, path, downloadCap) => {
        observed.push(downloadCap.maxBytes); await writeFile(path, syntheticPDF());
      },
      validate: async (_path, validationCap) => { observed.push(validationCap.maxBytes); return fakeValidation(); },
    });
    assert.equal(result.status, 'COMPLETED');
    assert.deepEqual(observed, [maxSourceBytes, Math.min(maxSourceBytes, maxBytes)]);
  };
  await run(1000000, 2000000);
  await run(2000000, 1000000);
  assert.equal(limits({ PDF_SOURCE_MAX_BYTES: '1024' }).maxSourceBytes, 1024);
  assert.throws(() => limits({ PDF_SOURCE_MAX_BYTES: '20971521' }), { code: 'SERVICE_UNAVAILABLE' });
});

test('strict versioned contract, UUID-v4, Drive ID and configurable conservative ceilings', () => {
  assert.deepEqual(parseJob(job), job);
  assert.equal(JSON.stringify(parseJob({ source: { fileId: job.source.fileId, provider: 'google_drive' }, jobId: job.jobId, version: 1 })), JSON.stringify(job));
  for (const value of [null, [], {}, { ...job, url: 'https://example.com' }, { ...job, version: 2 },
    { ...job, jobId: '../output' }, { ...job, jobId: job.jobId.toUpperCase() },
    ...['../123456789', 'a'.repeat(129), 'a b', 'file?id=123', 'a'].map(fileId => ({ ...job, source: { ...job.source, fileId } })),
    { ...job, source: { ...job.source, bucket: 'other' } }, { ...job, source: { ...job.source, provider: 'docs' } }]) {
    assert.throws(() => parseJob(value), { code: 'INVALID_REQUEST' });
  }
  assert.equal(limits({ PDF_MAX_PAGES: '3' }).maxPages, 3);
  for (const env of [{ PDF_MAX_BYTES: '20971521' }, { PDF_MAX_PAGES: '100' },
    { PDF_DEADLINE_MS: '120001' }, { PDF_MAX_BYTES: 'NaN' }]) {
    assert.throws(() => limits(env), { code: 'SERVICE_UNAVAILABLE' });
  }
});

test('SSRF policy rejects private, metadata, IPv6 and non-download URLs', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '198.18.0.1', '192.0.2.1', '::1', '::ffff:8.8.8.8']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  for (const url of ['http://drive.google.com/uc', 'https://user:pass@drive.google.com/uc',
    'https://drive.google.com:444/uc', 'https://drive.google.com.evil.test/uc', 'https://127.0.0.1/uc',
    'https://metadata.google.internal/uc', 'file:///etc/passwd', 'https://docs.google.com/document/d/abc',
    'https://drive.google.com/file/d/abc/view']) assert.throws(() => sourceURL(url), { code: 'UNSUPPORTED_SOURCE' });
});

test('bounded direct download, redirects, forbidden/login, HTML and byte limits', async t => {
  const root = await directory(t);
  let n = 0;
  const run = (open, override = cap) => download(job.source.fileId, join(root, `file-${n++}.pdf`), override, signal(), open);
  await run(async url => { assert.equal(url.searchParams.get('id'), job.source.fileId); return response(syntheticPDF()); });
  for (const status of [401, 403, 404]) await assert.rejects(run(async () => response('', status)), { code: 'ACCESS_DENIED' });
  for (const location of ['http://drive.google.com/uc', 'https://169.254.169.254/', 'https://evil.test/', 'https://user:pw@drive.google.com/uc']) {
    await assert.rejects(run(async () => response('', 302, { location })), { code: 'UNSUPPORTED_SOURCE' });
  }
  await assert.rejects(run(async () => response('', 302, { location: 'https://accounts.google.com/login' })), { code: 'ACCESS_DENIED' });
  await assert.rejects(run(async () => response('', 302, { location: 'https://drive.google.com/uc?id=abc' })), { code: 'UNSUPPORTED_SOURCE' });
  let redirects = 0;
  await run(async () => ++redirects === 1 ? response('', 302, { location: 'https://drive.usercontent.google.com/download?id=abc' }) : response(syntheticPDF()));
  await assert.rejects(run(async () => response('x'.repeat(100)), { ...cap, maxBytes: 50 }), { code: 'FILE_TOO_LARGE' });
  await assert.rejects(run(async () => response('', 200, { 'content-length': '99999999' })), { code: 'FILE_TOO_LARGE' });
  await assert.rejects(run(async () => response('', 503)), { code: 'SOURCE_UNAVAILABLE', retryable: true });
  // HTML is not accepted as a PDF by the real validator, regardless of MIME type.
  const html = join(root, 'html.pdf');
  await download(job.source.fileId, html, cap, signal(), async () => response('<html>Login or confirm download</html>', 200, { 'content-type': 'application/pdf' }));
  await assert.rejects(validatePDF(html, cap, signal()), { code: 'UNSUPPORTED_SOURCE', reason: 'html-response' });
});

test('DNS-resolved private addresses fail before connecting, including mixed answers', async t => {
  const method = t.mock.method(Resolver.prototype, 'resolve4', async () => ['169.254.169.254']);
  await assert.rejects(openSource(new URL('https://drive.google.com/uc?id=owned'), signal()), { code: 'UNSUPPORTED_SOURCE' });
  method.mock.mockImplementation(async () => ['8.8.8.8', '127.0.0.1']);
  await assert.rejects(openSource(new URL('https://drive.google.com/uc?id=owned'), signal()), { code: 'UNSUPPORTED_SOURCE' });
});

test('print fallback handles eligible direct-download errors when explicitly enabled on deps', async t => {
  const root = await directory(t);
  let rendered = 0;
  const create = (error, enabled, render = async (_id, path) => {
    rendered++;
    await writeFile(path, syntheticPDF());
  }) => processJob(job, cap, signal(), {
    store: new MemoryStore(), tempRoot: root, enablePrintFallback: enabled,
    download: async (_id, path) => { await writeFile(path, '<html>Preview</html>'); throw error; },
    render, validate: fakeValidation,
  });
  const denied = await create(new JobError('ACCESS_DENIED'), false);
  assert.equal(denied.status, 'FAILED');
  assert.equal(rendered, 0, 'fallback disabled when enablePrintFallback is false');

  const result = await create(new JobError('ACCESS_DENIED'), true);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(rendered, 1);
  assert.deepEqual(await readdir(root), []);

  const unsupported = await create(new JobError('UNSUPPORTED_SOURCE'), true);
  assert.equal(unsupported.status, 'COMPLETED');
  assert.equal(rendered, 2);

  await assert.rejects(create(new JobError('SOURCE_UNAVAILABLE',true), true), { code:'SOURCE_UNAVAILABLE' });
  assert.equal(rendered,2, 'transient upstream failures cannot trigger browser fallback');
  const forbidden = await create(new JobError('ACCESS_DENIED'), true, async () => {
    throw new JobError('ACCESS_DENIED');
  });
  assert.equal(forbidden.status, 'FAILED');
  assert.equal(forbidden.errorCode, 'ACCESS_DENIED');
  assert.deepEqual(await readdir(root),[]);
});

test('browser job deadline stays on the long fallback budget', () => {
  assert.equal(limits({}).deadlineMs, 120000);
  assert.equal(limits({ PDF_PRINT_FALLBACK_ENABLED: 'false' }).deadlineMs, 120000);
  for (const fallback of [undefined, 'false', 'true']) for (const capture of [undefined, 'false', 'true', 'invalid']) {
    const env = { PDF_PRINT_FALLBACK_ENABLED: fallback, PDF_VIEWER_SCREEN_CAPTURE_ENABLED: capture };
    assert.equal(printFallbackEnabled(env), true);
    assert.equal(viewerScreenCaptureEnabled(env), true);
    assert.equal(limits(env).deadlineMs, 120000);
    assert.throws(() => limits({ ...env, PDF_DEADLINE_MS: '120001' }), { code: 'SERVICE_UNAVAILABLE' });
  }
  assert.throws(() => limits({ PDF_DEADLINE_MS: '120001' }), { code: 'SERVICE_UNAVAILABLE' });
});

test('Viewer mode selection always uses view-only tile capture', async () => {
  assert.equal(viewerScreenCaptureEnabled({ PDF_VIEWER_SCREEN_CAPTURE_ENABLED: 'false' }), true);
  for (const count of [0, 1, 2]) {
    const page = {
      evaluateHandle: async () => ({ dispose: async () => {} }), waitForFunction: async () => {},
      getByRole: () => ({ count: async () => count, isVisible: async () => true, isEnabled: async () => true }),
    };
    assert.equal(await selectViewerMode(page, true, signal()), 'view-only');
  }
});

test('render failures clean partial files and cannot reach PDF validation or result upload', async t => {
  const root = await directory(t);
  for (const code of ['SOURCE_UNAVAILABLE', 'TIMEOUT']) {
    const store = new MemoryStore();
    await assert.rejects(processJob(job, cap, signal(), {
      store, tempRoot: root, enablePrintFallback: true,
      download: async () => { throw new JobError('ACCESS_DENIED'); },
      render: async (_id, path) => {
        await writeFile(path, '%PDF-partial');
        throw new JobError(code, true);
      },
      validate: () => assert.fail('failed render must never reach validation'),
    }), { code, retryable: true });
    assert.deepEqual(await readdir(root), []);
    assert.equal(store.objects.has(output), false);
    assert.equal(store.objects.has(`jobs/${job.jobId}/result.json`), false);
  }
});

test('deadline aborts a stalled response and processor removes partial temporary data', async t => {
  const root = await directory(t);
  const store = new MemoryStore();
  const stalled = async (id, path, c, s) => download(id, path, c, s, async () => {
    const stream = new Readable({ read() {} });
    stream.push(Buffer.from('%PDF-1.7\n'));
    return Object.assign(stream, { statusCode: 200, headers: {} });
  });
  await assert.rejects(processJob(job, cap, AbortSignal.timeout(30), { store, tempRoot: root, download: stalled }), { name: 'AbortError' });
  assert.deepEqual(await readdir(root), []);
  assert.equal(store.objects.has(output), false);
});

test('claim TTL is exactly 24h even when Date.now advances between reads', async t => {
  const base = Date.now() - 500;
  let ticks = 0;
  t.mock.method(Date, 'now', () => base + (++ticks));
  const store = new MemoryStore();
  const result = await processJob(job, cap, signal(), { store,
    download: async () => { throw new JobError('ACCESS_DENIED'); } });
  const claim = store.objects.get('jobs/' + job.jobId + '/request.json').json;
  assert.equal(Date.parse(claim.expiresAt) - Date.parse(claim.createdAt), 86400000);
  assert.equal(result.expiresAt, claim.expiresAt);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.errorCode, 'ACCESS_DENIED');
});

test('expired claims fail durably without another download', async () => {
  const store = new MemoryStore();
  const deps = { store, download: async () => { throw new JobError('SOURCE_UNAVAILABLE', true); } };
  await assert.rejects(processJob(job, cap, signal(), deps));
  const claim = store.objects.get(`jobs/${job.jobId}/request.json`).json;
  claim.expiresAt = '2020-01-01T00:00:00.000Z';
  const result = await processJob(job, cap, signal(), { store, download: () => assert.fail('expired claim downloaded') });
  assert.equal(result.errorCode, 'JOB_EXPIRED');
});

test('idempotent upload, source binding, result-write retry recovery and cleanup', async t => {
  const root = await directory(t);
  const store = new MemoryStore();
  let downloads = 0;
  const deps = { store, tempRoot: root, validate: fakeValidation, download: async (...args) => { downloads++; await fixtureDownload(...args); } };
  store.failResult = 1;
  await assert.rejects(processJob(job, cap, signal(), deps), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(store.objects.has(output), true);
  assert.deepEqual(await readdir(root), []);
  const result = await processJob(job, cap, signal(), deps);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(downloads, 1);
  assert.deepEqual(await processJob(job, cap, signal(), deps), result);
  assert.deepEqual(store.objects.get(output).bytes, syntheticPDF());
  assert.equal(store.objects.size, 3);
  await assert.rejects(processJob({ ...job, source: { ...job.source, fileId: 'different_file_id' } }, cap, signal(), deps), { code: 'JOB_CONFLICT' });
});

test('permanent errors persist before ACK; transient/permission failures remain retryable and clean', async t => {
  const root = await directory(t);
  for (const error of [new JobError('ACCESS_DENIED'), new JobError('INVALID_PDF'), new JobError('FILE_TOO_LARGE'),
    new JobError('SOURCE_UNAVAILABLE', true), new JobError('TIMEOUT', true)]) {
    const store = new MemoryStore();
    const deps = { store, tempRoot: root, download: async (_id, path) => { await writeFile(path, 'partial'); throw error; } };
    if (error.retryable) await assert.rejects(processJob(job, cap, signal(), deps), { code: error.code });
    else {
      const result = await processJob(job, cap, signal(), deps);
      assert.equal(result.errorCode, error.code);
      assert.deepEqual(await processJob(job, cap, signal(), deps), result);
    }
    assert.equal(store.objects.has(output), false);
    assert.deepEqual(await readdir(root), []);
  }
  const store = new MemoryStore(); store.denied = true;
  await assert.rejects(processJob(job, cap, signal(), { store, download: () => assert.fail('download before permission check') }), { code: 'SERVICE_UNAVAILABLE' });
  assert.equal(store.objects.size, 0);
});

test('concurrent generation conflicts produce a single terminal result', async t => {
  const store = new MemoryStore();
  const root = await directory(t);
  const deps = { store, tempRoot: root, download: fixtureDownload, validate: fakeValidation };
  const results = await Promise.all(Array.from({ length: 4 }, () => processJob(job, cap, signal(), deps)));
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal(store.objects.size, 3);
  assert.deepEqual(await readdir(root), []);
});

test('HTTP handler always enables Viewer fallback regardless of legacy env flags', async t => {
  const root = await directory(t);
  for (const fallback of [undefined,'true','false']) for (const capture of ['true','false']) {
    let rendered=0;
    const server=createWorkerServer({
      store:new MemoryStore(),tempRoot:root,
      download:async()=>{throw new JobError('ACCESS_DENIED');},
      render:async(...args)=>{rendered++;await fixtureDownload(...args);},
      validate:fakeValidation,
    },{PDF_PROCESSING_ENABLED:'true',PDF_PRINT_FALLBACK_ENABLED:fallback,PDF_VIEWER_SCREEN_CAPTURE_ENABLED:capture});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    try {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/jobs`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(job)
      });
      assert.equal(response.status,200);
      assert.equal((await response.json()).status,'COMPLETED');
      assert.equal(rendered,1);
    } finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
  }
});

test('HTTP gating, validation, permanent ACK and transient non-2xx', async t => {
  const store = new MemoryStore();
  const server = createWorkerServer({ store,
    download: async () => { throw new JobError('ACCESS_DENIED'); },
    render: async () => { throw new JobError('ACCESS_DENIED'); },
  }, { PDF_PROCESSING_ENABLED: 'true', PDF_PRINT_FALLBACK_ENABLED: 'false' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = value => fetch(`http://127.0.0.1:${server.address().port}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await post({ ...job, extra: true })).status, 400);
  assert.equal((await post({ junk: 'x'.repeat(5000) })).status, 413);
  const result = await post(job); assert.equal(result.status, 200); assert.equal((await result.json()).errorCode, 'ACCESS_DENIED');
  store.denied = true;
  assert.equal((await post(job)).status, 503);
});

test('enabled production handler fails closed without runtime/config readiness', async t => {
  const server = createWorkerServer(undefined, { PDF_PROCESSING_ENABLED: 'true' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const r = await fetch(`http://127.0.0.1:${server.address().port}/jobs`, { method: 'POST' });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'SERVICE_UNAVAILABLE');
});

test('HTTP never ACKs a permanent failure until its result is stored, and retries transient source failures', async t => {
  const store = new MemoryStore(); store.failResult = 1;
  let transient = true;
  const server = createWorkerServer({ store,
    download: async () => {
      throw new JobError(transient ? 'SOURCE_UNAVAILABLE' : 'ACCESS_DENIED', transient);
    },
    render: async () => { throw new JobError('ACCESS_DENIED'); },
  }, { PDF_PROCESSING_ENABLED: 'true', PDF_PRINT_FALLBACK_ENABLED: 'false' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = () => fetch(`http://127.0.0.1:${server.address().port}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
  assert.equal((await post()).status, 503);
  transient = false;
  assert.equal((await post()).status, 503);
  const r = await post(); assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'FAILED');
});

test('missing Linux parser runtime is retryable instead of an invalid PDF', { skip: process.platform !== 'linux' }, async t => {
  const root = await directory(t);
  const path = join(root, 'owned.pdf'); await writeFile(path, syntheticPDF());
  const bin = join(root, 'bin'); await mkdir(bin);
  const program = `
    import { validatePDF } from './src/pdf.ts';
    import { limits } from './src/contract.ts';
    try {
      await validatePDF(process.argv[1], limits({}), AbortSignal.timeout(3000));
      process.stdout.write(JSON.stringify({ unexpectedSuccess: true }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ code: error.code, retryable: error.retryable }));
    }
  `;
  const validate = () => {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', program, path], {
      env: { ...process.env, PATH: bin }, encoding: 'utf8', timeout: 5000, maxBuffer: 4096 });
    assert.equal(child.status, 0);
    assert.deepEqual(JSON.parse(child.stdout), { code: 'SERVICE_UNAVAILABLE', retryable: true });
  };
  validate(); // Missing prlimit itself produces Node ENOENT.
  await symlink('/usr/bin/prlimit', join(bin, 'prlimit'));
  const probe = spawnSync(join(bin, 'prlimit'), ['--as=536870912', '--cpu=5', '--', 'qpdf', '--check', path], {
    env: { ...process.env, PATH: bin, LC_ALL: 'C' }, encoding: 'utf8', maxBuffer: 4096 });
  assert.ok([1, 126, 127].includes(probe.status), `Unexpected launcher exit: ${probe.status}`);
  assert.match(probe.stderr, /failed to execute qpdf: No such file or directory/);
  // This diagnostic comes only from an owned missing-executable fixture, never a document.
  t.diagnostic(`Missing-qpdf fixture: exit=${probe.status}; stderr=${probe.stderr.trim()}`);
  validate(); // prlimit starts but cannot exec qpdf: numeric launcher exit, not Node ENOENT.
});

test('local HTTP-to-download-to-qpdf-to-fake-GCS end-to-end, byte identity', { skip: process.platform !== 'linux' }, async t => {
  for (const command of ['qpdf', 'prlimit']) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8', maxBuffer: 4096 });
    assert.equal(probe.status, 0, `Linux E2E requires executable ${command}; install qpdf and util-linux`);
  }
  const root = await directory(t);
  const source = createServer((_req, res) => { res.setHeader('Content-Type', 'application/octet-stream'); res.end(syntheticPDF()); });
  source.listen(0, '127.0.0.1'); await once(source, 'listening');
  t.after(() => new Promise(resolve => source.close(resolve)));
  const open = async url => {
    sourceURL(url.href);
    return new Promise((resolve, reject) => get(`http://127.0.0.1:${source.address().port}/owned.pdf`, resolve).on('error', reject));
  };
  const store = new MemoryStore();
  const worker = createWorkerServer({ store, tempRoot: root, download: (id, path, c, s) => download(id, path, c, s, open) }, { PDF_PROCESSING_ENABLED: 'true' });
  worker.listen(0, '127.0.0.1'); await once(worker, 'listening');
  t.after(() => new Promise(resolve => worker.close(resolve)));
  const r = await fetch(`http://127.0.0.1:${worker.address().port}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
  assert.equal(r.status, 200);
  const result = await r.json(); assert.equal(result.status, 'COMPLETED', `Owned fixture result: ${JSON.stringify(result)}`); assert.equal(result.pages, 2);
  assert.deepEqual(store.objects.get(output).bytes, syntheticPDF());
  assert.deepEqual(await readdir(root), []);
  for (const [name, bytes, error] of [['corrupt', Buffer.from('%PDF-1.7\ncorrupt\n%%EOF'), 'INVALID_PDF'],
    ['too-many', syntheticPDF(41), 'PAGE_LIMIT_EXCEEDED']]) {
    const path = join(root, name); await writeFile(path, bytes);
    await assert.rejects(validatePDF(path, cap, signal()), { code: error });
  }
  const original = join(root, 'owned.pdf'); await writeFile(original, syntheticPDF(40));
  assert.equal((await validatePDF(original, cap, signal())).pages, 40);
  const encrypted = join(root, 'encrypted.pdf');
  execFileSync('qpdf', ['--encrypt', 'test-only-user', 'test-only-owner', '256', '--', original, encrypted]);
  await assert.rejects(validatePDF(encrypted, cap, signal()), { code: 'UNSUPPORTED_SOURCE', reason: 'encrypted-pdf' });
});
