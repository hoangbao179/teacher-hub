import assert from "node:assert/strict";
import test from "node:test";
import { pdfBatchNeedsPolling } from "../src/api/pdfPolling.ts";

test("poll only recoverable unexpired PDF batches, including late-result states", () => {
  const now = Date.parse("2026-10-24T10:00:00Z");
  const batch = (status, expiresAt = new Date(now + 60_000).toISOString()) => ({ jobs: [{ status, expiresAt }] });
  for (const status of ["ENQUEUE_PENDING", "ENQUEUE_RETRY", "QUEUED", "RESULT_UNCONFIRMED", "RETRY_EXHAUSTED"]) {
    assert.equal(pdfBatchNeedsPolling(batch(status), now), true, status);
    assert.equal(pdfBatchNeedsPolling(batch(status, new Date(now).toISOString()), now), false, status);
  }
  for (const status of ["COMPLETED", "FAILED", "EXPIRED"]) assert.equal(pdfBatchNeedsPolling(batch(status), now), false, status);
  assert.equal(pdfBatchNeedsPolling({jobs: []}, now), false);
  assert.equal(pdfBatchNeedsPolling({jobs: [...batch("COMPLETED").jobs, ...batch("RESULT_UNCONFIRMED").jobs]}, now), true);
});
