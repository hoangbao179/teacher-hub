import assert from 'node:assert/strict';
import test from 'node:test';
import type { PdfJob } from '@teacher/shared';
import { digest, validatePdfResult } from './pdf-validation';

test('Viewer Print-UI uncertainty is a valid terminal result distinct from access denial', () => {
  const now = Date.parse('2026-10-26T03:00:00.000Z');
  const createdAt = new Date(now - 10000).toISOString();
  const expiresAt = new Date(now - 10000 + 86400000).toISOString();
  const id = 'c51f4dfa-4b13-42dc-ab81-243b09201d17';
  const fileId = '1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr';
  const job = { id, fileId, createdAt } as PdfJob;
  const claim = { version:1, sourceHash:digest(JSON.stringify({provider:'google_drive',fileId})),
    createdAt, expiresAt };
  const base = { version:1, jobId:id, status:'FAILED', completedAt:new Date(now-5000).toISOString(), expiresAt };
  for (const errorCode of ['PRINT_UNAVAILABLE','ACCESS_DENIED']) {
    const result = validatePdfResult(job, {claim,result:{...base,errorCode}}, now);
    assert.equal(result.errorCode,errorCode);
  }
  assert.throws(() => validatePdfResult(job,
    {claim,result:{...base,errorCode:'SUCCESS_WHEN_PRINT_DISABLED'}}, now),
    {code:'PDF_RESULT_SCHEMA_MISMATCH'});
});
