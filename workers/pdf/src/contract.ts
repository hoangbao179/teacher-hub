import { PDF_MAX_PAGES, PDF_OUTPUT_MAX_BYTES, PDF_SOURCE_MAX_BYTES, PDF_LONG_MAX_PAGES } from '@teacher/shared';

export class JobError extends Error {
  code: string;
  retryable: boolean;
  reason?: string;
  pageIndex?: number;
  ancestorLevel?: number;
  usedBytes?: number;
  limitBytes?: number;
  constructor(code: string, retryable = false, reason?: string,
    capture?: { pageIndex?: number; ancestorLevel?: number; usedBytes?: number; limitBytes?: number }) {
    super(code); this.code = code; this.retryable = retryable; this.reason = reason;
    if (Number.isInteger(capture?.pageIndex) && capture!.pageIndex! >= 1 && capture!.pageIndex! <= PDF_LONG_MAX_PAGES)
      this.pageIndex = capture!.pageIndex;
    if (Number.isInteger(capture?.ancestorLevel) && capture!.ancestorLevel! >= 0 && capture!.ancestorLevel! < 8)
      this.ancestorLevel = capture!.ancestorLevel;
    const maxByteField = 64 * 1048576;
    if (Number.isInteger(capture?.usedBytes) && capture!.usedBytes! >= 1 && capture!.usedBytes! <= maxByteField)
      this.usedBytes = capture!.usedBytes;
    if (Number.isInteger(capture?.limitBytes) && capture!.limitBytes! >= 1 && capture!.limitBytes! <= maxByteField)
      this.limitBytes = capture!.limitBytes;
  }
}
export interface Job { version: 1; jobId: string; source: { provider: 'google_drive'; fileId: string } }
export interface Result {
  version: 1; jobId: string; status: 'COMPLETED' | 'FAILED'; completedAt: string;
  expiresAt: string; objectName?: string; bytes?: number; sha256?: string;
  pages?: number; errorCode?: string;
}
export const BUCKET = 'teacher-hub-pdf-results-2026';
export function parseJob(value: unknown): Job {
  const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
  if (!exact(value, ['version', 'jobId', 'source']) || value.version !== 1 ||
    typeof value.jobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.jobId) ||
    !exact(value.source, ['provider', 'fileId']) || value.source.provider !== 'google_drive' ||
    typeof value.source.fileId !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(value.source.fileId)) {
    throw new JobError('INVALID_REQUEST');
  }
  return { version: 1, jobId: value.jobId,
    source: { provider: 'google_drive', fileId: value.source.fileId } };
}
export interface Limits { maxBytes: number; maxSourceBytes?: number; maxPages: number; deadlineMs: number; redirects: number }
/** Anonymous browser fallback after direct download fails; opt out with `false`. */
export function printFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PDF_PRINT_FALLBACK_ENABLED !== 'false';
}
/** Bitmap tile assembly when Print is missing/disabled; opt out with `false`. */
export function viewerScreenCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PDF_VIEWER_SCREEN_CAPTURE_ENABLED !== 'false';
}
export function limits(env: NodeJS.ProcessEnv = process.env): Limits {
  const number = (key: string, fallback: number, max: number) => {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new JobError('SERVICE_UNAVAILABLE', true);
    return Number(raw);
  };
  // Direct download stays first; when fallback is on, allow the longer browser budget.
  // Screen capture alone cannot enter that fallback and must not extend the job deadline.
  const browserJob = printFallbackEnabled(env);
  return { maxBytes: number('PDF_MAX_BYTES', PDF_OUTPUT_MAX_BYTES, PDF_OUTPUT_MAX_BYTES),
    maxSourceBytes: number('PDF_SOURCE_MAX_BYTES', PDF_SOURCE_MAX_BYTES, PDF_SOURCE_MAX_BYTES),
    maxPages: number('PDF_MAX_PAGES', PDF_MAX_PAGES, PDF_MAX_PAGES),
    deadlineMs: number('PDF_DEADLINE_MS', browserJob ? 120000 : 22000, browserJob ? 120000 : 22000),
    redirects: 3 };
}
