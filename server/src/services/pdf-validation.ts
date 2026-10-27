import { createHash } from 'node:crypto';
import type { PdfJob } from '@teacher/shared';
import { PDF_MAX_PAGES, PDF_OUTPUT_MAX_BYTES, PDF_LONG_MAX_PAGES, PDF_LONG_OUTPUT_MAX_BYTES } from '@teacher/shared';
import { AppError } from '../errors/app-error';
import type { PdfPayload } from './pdf-provider';

export const pdfError = (status: number, code: string) => new AppError(status, code, 'Không thể thực hiện thao tác PDF.');
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export function driveFileId(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 512) throw pdfError(400, 'PDF_UNSUPPORTED_LINK');
  let url: URL; try { url = new URL(raw); } catch { throw pdfError(400, 'PDF_UNSUPPORTED_LINK'); }
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.port || url.username || url.password || url.hash) throw pdfError(400, 'PDF_UNSUPPORTED_LINK');
  let id: string | null = null;
  const match = /^\/file\/d\/([A-Za-z0-9_-]{10,128})\/view$/.exec(url.pathname);
  if (match && !url.search) id = match[1];
  if (url.pathname === '/open' && [...url.searchParams.keys()].length === 1 && url.searchParams.has('id')) id = url.searchParams.get('id');
  if (!id || !/^[A-Za-z0-9_-]{10,128}$/.test(id)) throw pdfError(400, 'PDF_UNSUPPORTED_LINK');
  return id;
}
export function workerPayload(id: string, fileId: string): PdfPayload {
  if (!uuid(id) || !/^[A-Za-z0-9_-]{10,128}$/.test(fileId)) throw pdfError(400, 'PDF_INVALID_REQUEST');
  const payload: PdfPayload = { version: 1, jobId: id, source: { provider: 'google_drive', fileId } };
  if (Buffer.byteLength(JSON.stringify(payload)) > 4096) throw pdfError(400, 'PDF_INVALID_REQUEST');
  return payload;
}
export interface ValidPdfResult { status: 'COMPLETED' | 'FAILED'; completedAt: string; expiresAt: string;
  objectName?: string; bytes?: number; pages?: number; sha256?: string; errorCode?: string }
export function validatePdfResult(job: PdfJob, pair: { claim: any; result: any }, now: number): ValidPdfResult {
  const { claim: c, result: r } = pair;
  const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
  const fail = () => { throw pdfError(503, 'PDF_RESULT_SCHEMA_MISMATCH'); };
  if (!c || c.version !== 1 || c.sourceHash !== digest(JSON.stringify({ provider: 'google_drive', fileId: job.fileId })) ||
    !iso(c.createdAt) || !iso(c.expiresAt) || Date.parse(c.expiresAt) - Date.parse(c.createdAt) !== 86400000 ||
    Date.parse(c.createdAt) < Date.parse(job.createdAt) - 60000 || Date.parse(c.createdAt) > now + 60000) fail();
  if (!r || r.version !== 1 || r.jobId !== job.id || r.expiresAt !== c.expiresAt || !iso(r.completedAt) ||
    Date.parse(r.completedAt) < Date.parse(c.createdAt) || Date.parse(r.completedAt) > now + 60000) fail();
  if (r.status === 'COMPLETED') {
    if (Object.keys(r).sort().join() !== ['version','jobId','status','objectName','bytes','sha256','pages','completedAt','expiresAt'].sort().join() ||
      r.objectName !== `jobs/${job.id}/output.pdf` || !Number.isInteger(r.bytes) || r.bytes < 1 || r.bytes > (job.workerVersion === 2 ? PDF_LONG_OUTPUT_MAX_BYTES : PDF_OUTPUT_MAX_BYTES) ||
      !Number.isInteger(r.pages) || r.pages < 1 || r.pages > (job.workerVersion === 2 ? PDF_LONG_MAX_PAGES : PDF_MAX_PAGES) || !/^[a-f0-9]{64}$/.test(r.sha256 ?? '')) fail();
  } else if (r.status !== 'FAILED' || Object.keys(r).sort().join() !== ['version','jobId','status','errorCode','completedAt','expiresAt'].sort().join() ||
    !['ACCESS_DENIED','PRINT_UNAVAILABLE','UNSUPPORTED_SOURCE','INVALID_PDF','FILE_TOO_LARGE','PAGE_LIMIT_EXCEEDED','JOB_EXPIRED'].includes(r.errorCode)) fail();
  return r;
}
