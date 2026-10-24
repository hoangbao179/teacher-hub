import type { PdfBatch } from "@teacher/shared";

const recoverable = new Set(["ENQUEUE_PENDING", "ENQUEUE_RETRY", "QUEUED", "RESULT_UNCONFIRMED", "RETRY_EXHAUSTED"]);

/** Exhausted/unconfirmed jobs can still receive a late result before expiry. */
export function pdfBatchNeedsPolling(batch: PdfBatch, now = Date.now()): boolean {
  return batch.jobs.some(job => recoverable.has(job.status) && Date.parse(job.expiresAt) > now);
}
