import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './chunk-fixture.mjs';
import { job } from './fixtures.mjs';
import { JobError } from '../src/contract.ts';
import { diagnostic } from '../src/diagnostics.ts';

test('v2 preserves distinct source failure reasons before persisting FAILED, without source content', async t => {
  for (const reason of ['anchor-fingerprint-mismatch', 'page-total-mismatch',
    'duplicate-page-heading', 'ambiguous-layout-multiple-headings',
    'ambiguous-layout-multiple-images', 'ambiguous-layout-toolbar-visible', 'bitmap-oversized']) {
    const root = await mkdtemp(join(tmpdir(), 'chunk-diagnostic-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const f = await fixture(root, 139);
    const events = [];
    f.deps.log = value => events.push(JSON.parse(value));
    await f.run(0);
    assert.deepEqual(events.map(e => [e.step, e.stage]), [[0, 'direct-download']]);
    events.length = 0;
    // A valid preceding marker is sufficient to reach step 2; rendering is injected.
    const prefix = `jobs/${job.jobId}/`;
    const manifest = await f.store.json(prefix + 'manifest.json');
    await f.store.create(prefix + 'parts/1.json', { json: {
      version: 2, jobId: job.jobId, sourceHash: manifest.sourceHash, expiresAt: manifest.expiresAt,
      fingerprint: manifest.fingerprint, index: 1, firstPage: 1, lastPage: 10, bytes: 4772813, sha256: 'b'.repeat(64),
    } }, AbortSignal.timeout(5000));
    f.deps.renderChunk = async () => {
      const error = new JobError('UNSUPPORTED_SOURCE', false, reason, { pageIndex: 1 });
      error.message = 'https://private.invalid/document?secret=content';
      throw error;
    };
    assert.equal((await f.run(2)).errorCode, 'UNSUPPORTED_SOURCE');
    assert.equal(events.length, 1);
    assert.deepEqual([events[0].step, events[0].stage, events[0].reason, events[0].pageIndex],
      [2, 'viewer-render', reason, 1]);
    assert.doesNotMatch(JSON.stringify(events), /private|secret|content|https:|fileId|filename|png/);
    assert.deepEqual(Object.keys(events[0]).sort(),
      ['event', 'jobId', 'sourceHash', 'stage', 'fallbackEnabled', 'code', 'reason', 'retryable', 'step', 'pageIndex'].sort());
    assert.equal(await f.store.head(prefix + 'parts/2.json'), null);
    assert.equal(await f.store.head(prefix + 'output.pdf'), null);
    assert.deepEqual(await readdir(f.temp), []);
    events.length = 0;
    await f.run(2);
    assert.deepEqual(events, [], 'terminal replay performs no capture');
  }
});

test('v2 logs retryable capture failure and tolerates sink failure without persisting FAILED', async t => {
  const root = await mkdtemp(join(tmpdir(), 'chunk-retry-diagnostic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const f = await fixture(root, 23);
  f.deps.log = () => {};
  await f.run(0);
  const events = [];
  f.deps.log = value => { events.push(JSON.parse(value)); throw Error('sink'); };
  f.deps.renderChunk = async () => { throw new JobError('SOURCE_UNAVAILABLE', true, 'viewer-readiness'); };
  await assert.rejects(f.run(1), { code: 'SOURCE_UNAVAILABLE', retryable: true });
  assert.deepEqual(events.map(e => [e.step, e.reason]), [[1, 'viewer-readiness']]);
  assert.equal(await f.store.head(`jobs/${job.jobId}/result.json`), null);
  assert.deepEqual(await readdir(f.temp), []);
});

test('diagnostic step accepts only bounded integers', () => {
  for (const step of [0, 2, 21, -1, 22, '2', NaN]) {
    const events = [];
    diagnostic(job.jobId, 'a'.repeat(64), 'viewer-render', true,
      new JobError('UNSUPPORTED_SOURCE', false, 'anchor-fingerprint-mismatch'),
      value => events.push(JSON.parse(value)), step);
    assert.equal(events[0].step, [0, 2, 21].includes(step) ? step : undefined);
  }
});
