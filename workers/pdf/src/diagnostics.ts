import { JobError } from './contract.ts';

export type Stage = 'direct-download' | 'direct-validation' | 'viewer-render' | 'viewer-validation' | 'storage';
const codes = new Set(['ACCESS_DENIED', 'PRINT_UNAVAILABLE', 'UNSUPPORTED_SOURCE', 'INVALID_PDF',
  'FILE_TOO_LARGE', 'PAGE_LIMIT_EXCEEDED', 'SOURCE_UNAVAILABLE', 'TIMEOUT', 'SERVICE_UNAVAILABLE', 'STORAGE_UNAVAILABLE']);
const reasons = new Set(['redirect-policy', 'redirect-limit', 'login-redirect', 'http-access', 'http-status',
  'html-response', 'encrypted-pdf', 'print-missing', 'print-ambiguous', 'print-disabled', 'viewer-readiness',
  'invalid-file-id', 'page-count-unreadable', 'page-total-mismatch', 'assembled-page-mismatch',
  'duplicate-page-heading', 'ambiguous-page-layout', 'bitmap-oversized', 'bitmap-dimensions-invalid',
  'bitmap-dpi-low']);

/** Only fixed classifications and validated correlation fields; never provider text. */
export function diagnostic(jobId: string, sourceHash: string, stage: Stage, fallbackEnabled: boolean,
  error: unknown, write: (value: string) => void = console.info): void {
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !/^[a-f0-9]{64}$/.test(sourceHash)) return;
  const code = error instanceof JobError && codes.has(error.code) ? error.code : 'INTERNAL_ERROR';
  const reason = error instanceof JobError && reasons.has(error.reason ?? '') ? error.reason : 'unclassified';
  // Observability must not alter persistence/retry behavior if the sink fails.
  try { write(JSON.stringify({ event: 'pdf-stage-failed', jobId, sourceHash, stage, fallbackEnabled,
    code, reason, retryable: error instanceof JobError ? error.retryable : true })); } catch { /* best effort */ }
}
