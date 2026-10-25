export class JobError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, retryable = false) { super(code); this.code = code; this.retryable = retryable; }
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
export interface Limits { maxBytes: number; maxPages: number; deadlineMs: number; redirects: number }
export function limits(env: NodeJS.ProcessEnv = process.env): Limits {
  const number = (key: string, fallback: number, max: number) => {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) throw new JobError('SERVICE_UNAVAILABLE', true);
    return Number(raw);
  };
  // The existing 22s ceiling is unchanged unless the operator explicitly
  // enables the experimental anonymous, print-permitted browser fallback.
  const printFallback = env.PDF_PRINT_FALLBACK_ENABLED === 'true';
  return { maxBytes: number('PDF_MAX_BYTES', 10 * 1024 * 1024, 10 * 1024 * 1024),
    maxPages: number('PDF_MAX_PAGES', 40, 40),
    deadlineMs: number('PDF_DEADLINE_MS', printFallback ? 120000 : 22000, printFallback ? 120000 : 22000),
    redirects: 3 };
}
