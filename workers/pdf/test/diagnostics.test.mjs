import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobError, limits, parseJob } from '../src/contract.ts';
import { diagnostic } from '../src/diagnostics.ts';
import { processJob } from '../src/processor.ts';
import { assertPrintAction } from '../src/print-policy.ts';
import { job, MemoryStore } from './fixtures.mjs';

test('reported file ID is accepted; stage diagnostics distinguish HTML from Viewer errors without source data', async t => {
  const source = { ...job, source: { provider: 'google_drive', fileId: '1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr' } };
  assert.deepEqual(parseJob(source), source);
  const root = await mkdtemp(join(tmpdir(), 'pdf-diagnostic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [count, enabled, code, reason] of [[2, true, 'UNSUPPORTED_SOURCE', 'print-ambiguous'],
    [1, false, 'ACCESS_DENIED', 'print-disabled'], [0, false, 'PRINT_UNAVAILABLE', 'print-missing']]) {
  const events = [];
  const store = new MemoryStore();
  const result = await processJob(source, limits({}), AbortSignal.timeout(5000), {
    store, tempRoot: root, enablePrintFallback: true, log: value => events.push(JSON.parse(value)),
    download: async (_id, path) => writeFile(path, '<html>provider private text</html>'),
    validate: async () => { throw new JobError('UNSUPPORTED_SOURCE', false, 'html-response'); },
    render: async () => assertPrintAction(count, enabled),
  });
  assert.equal(result.errorCode, code);
  assert.deepEqual(events.map(({stage, reason}) => [stage, reason]),
    [['direct-validation', 'html-response'], ['viewer-render', reason]]);
  assert(events.every(e => e.jobId === source.jobId && /^[a-f0-9]{64}$/.test(e.sourceHash) && e.fallbackEnabled));
  assert.equal(store.objects.has(`jobs/${job.jobId}/output.pdf`), false);
  assert.doesNotMatch(JSON.stringify(events), /1_ArvHd|private text|https:|stack/);
  }
});

test('encrypted PDFs do not reach Viewer fallback', async () => {
  let renders = 0;
  const result = await processJob(job, limits({}), AbortSignal.timeout(5000), {
    store: new MemoryStore(), enablePrintFallback: true, log: () => {},
    download: async () => {},
    validate: async () => { throw new JobError('UNSUPPORTED_SOURCE', false, 'encrypted-pdf'); },
    render: async () => { renders++; },
  });
  assert.equal(result.errorCode, 'UNSUPPORTED_SOURCE');
  assert.equal(renders, 0);
});

test('viewer assembly reasons are allowlisted in stage diagnostics', () => {
  const events = [];
  diagnostic(job.jobId, 'a'.repeat(64), 'viewer-render', true,
    new JobError('UNSUPPORTED_SOURCE', false, 'ambiguous-layout-multiple-images', { pageIndex: 2, ancestorLevel: 1 }),
    value => events.push(JSON.parse(value)));
  assert.equal(events[0].reason, 'ambiguous-layout-multiple-images');
  assert.deepEqual([events[0].pageIndex, events[0].ancestorLevel], [2, 1]);
});

test('capture diagnostics omit invalid pageIndex and ancestorLevel', () => {
  const events = [];
  diagnostic(job.jobId, 'a'.repeat(64), 'viewer-render', true,
    new JobError('UNSUPPORTED_SOURCE', false, 'ambiguous-layout-multiple-headings',
      { pageIndex: 0, ancestorLevel: 99 }), value => events.push(JSON.parse(value)));
  assert.equal(events[0].reason, 'ambiguous-layout-multiple-headings');
  assert.equal(events[0].pageIndex, undefined);
  assert.equal(events[0].ancestorLevel, undefined);
});

test('diagnostics discard untrusted error details and tolerate logging failures', () => {
  const events = [];
  const error = new JobError('https://secret.invalid/token', true, 'provider private text');
  diagnostic(job.jobId, 'a'.repeat(64), 'direct-download', false, error, value => events.push(JSON.parse(value)));
  assert.equal(events[0].code, 'INTERNAL_ERROR');
  assert.equal(events[0].reason, 'unclassified');
  assert.doesNotMatch(JSON.stringify(events), /secret|private|token/);
  assert.doesNotThrow(() => diagnostic(job.jobId, 'a'.repeat(64), 'storage', false, error, () => { throw Error('sink'); }));
});
