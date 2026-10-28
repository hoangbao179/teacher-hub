import assert from 'node:assert/strict';
import test from 'node:test';
import { pdfSettings } from './pdf-settings';

const v2 = { PDF_API_ENABLED: 'true', PDF_CHUNKED_JOBS_ENABLED: 'true' };

test('v2 defaults admit 20 creations/hour and 3 active jobs with one link', () => {
  assert.deepEqual(pdfSettings(v2), {
    enabled: true, chunked: true, maxLinks: 1, maxActive: 3, maxHourly: 20, maxRetries: 2,
  });
  assert.deepEqual(pdfSettings({ PDF_API_ENABLED: 'true' }), {
    enabled: true, chunked: false, maxLinks: 5, maxActive: 10, maxHourly: 10, maxRetries: 2,
  });
});

test('v2 respects lower operator limits and clamps higher valid limits', () => {
  const lower = pdfSettings({ ...v2, PDF_BATCH_LIMIT: '5', PDF_ACTIVE_LIMIT: '2', PDF_HOURLY_LIMIT: '10' });
  assert.equal(lower.maxLinks, 1);
  assert.equal(lower.maxActive, 2);
  assert.equal(lower.maxHourly, 10);
  const higher = pdfSettings({ ...v2, PDF_ACTIVE_LIMIT: '20', PDF_HOURLY_LIMIT: '30' });
  assert.equal(higher.maxActive, 3);
  assert.equal(higher.maxHourly, 20);
});

test('invalid v2 settings still fail closed', () => {
  for (const key of ['PDF_BATCH_LIMIT', 'PDF_ACTIVE_LIMIT', 'PDF_HOURLY_LIMIT']) {
    for (const value of ['0', '-1', 'bad', '1.5', '999', '']) {
      assert.equal(pdfSettings({ ...v2, [key]: value }).enabled, false, `${key}=${value}`);
    }
  }
});
