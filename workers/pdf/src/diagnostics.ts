import { JobError } from './contract.ts';
import { PDF_LONG_MAX_PAGES, PDF_MAX_STEPS } from '@teacher/shared';

export type Stage = 'direct-download' | 'direct-validation' | 'viewer-render' | 'viewer-validation' | 'chunk-merge' | 'chunk-validation' | 'storage';
const codes = new Set(['ACCESS_DENIED', 'PRINT_UNAVAILABLE', 'UNSUPPORTED_SOURCE', 'INVALID_PDF',
  'FILE_TOO_LARGE', 'PAGE_LIMIT_EXCEEDED', 'SOURCE_UNAVAILABLE', 'TIMEOUT', 'SERVICE_UNAVAILABLE', 'STORAGE_UNAVAILABLE']);
const reasons = new Set(['redirect-policy', 'redirect-limit', 'login-redirect', 'http-access', 'http-status',
  'html-response', 'encrypted-pdf', 'print-missing', 'print-ambiguous', 'print-disabled', 'viewer-readiness',
  'invalid-file-id', 'page-count-unreadable', 'page-total-mismatch', 'anchor-fingerprint-mismatch', 'assembled-page-mismatch',
  'duplicate-page-heading', 'ambiguous-page-layout', 'ambiguous-layout-multiple-headings',
  'ambiguous-layout-multiple-images', 'ambiguous-layout-toolbar-visible', 'bitmap-oversized',
  'bitmap-dimensions-invalid', 'bitmap-dpi-low', 'intermediate-png-page', 'intermediate-png-total',
  'embedded-jpeg-total', 'output-pdf-bytes', 'direct-download-bytes', 'validated-pdf-bytes']);
const maxDiagnosticBytes = 64 * 1048576;

/** Only fixed classifications and validated correlation fields; never provider text. */
export function diagnostic(jobId: string, sourceHash: string, stage: Stage, fallbackEnabled: boolean,
  error: unknown, write: (value: string) => void = console.info, step?: number): void {
  if (!/^[0-9a-f-]{36}$/.test(jobId) || !/^[a-f0-9]{64}$/.test(sourceHash)) return;
  const code = error instanceof JobError && codes.has(error.code) ? error.code : 'INTERNAL_ERROR';
  const reason = error instanceof JobError && reasons.has(error.reason ?? '') ? error.reason : 'unclassified';
  const pageIndex = error instanceof JobError && Number.isInteger(error.pageIndex) &&
    error.pageIndex! >= 1 && error.pageIndex! <= PDF_LONG_MAX_PAGES ? error.pageIndex : undefined;
  const ancestorLevel = error instanceof JobError && Number.isInteger(error.ancestorLevel) &&
    error.ancestorLevel! >= 0 && error.ancestorLevel! < 8 ? error.ancestorLevel : undefined;
  const usedBytes = error instanceof JobError && Number.isInteger(error.usedBytes) &&
    error.usedBytes! >= 1 && error.usedBytes! <= maxDiagnosticBytes ? error.usedBytes : undefined;
  const limitBytes = error instanceof JobError && Number.isInteger(error.limitBytes) &&
    error.limitBytes! >= 1 && error.limitBytes! <= maxDiagnosticBytes ? error.limitBytes : undefined;
  // Observability must not alter persistence/retry behavior if the sink fails.
  try { write(JSON.stringify({ event: 'pdf-stage-failed', jobId, sourceHash, stage, fallbackEnabled,
    code, reason, retryable: error instanceof JobError ? error.retryable : true,
    ...(Number.isInteger(step) && step! >= 0 && step! <= PDF_MAX_STEPS ? { step } : {}),
    ...(pageIndex !== undefined ? { pageIndex } : {}),
    ...(ancestorLevel !== undefined ? { ancestorLevel } : {}),
    ...(usedBytes !== undefined ? { usedBytes } : {}),
    ...(limitBytes !== undefined ? { limitBytes } : {}) })); } catch { /* best effort */ }
}
