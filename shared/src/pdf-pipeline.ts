import { normalizePdfFilename } from './pdf-filename.js';
import { PDF_LONG_MAX_PAGES, PDF_CHUNK_PAGES, PDF_CHUNK_MAX_BYTES, PDF_MAX_STEPS } from './pdf-limits.js';
export interface PdfChunkJob { version: 2; jobId: string; source: { provider: 'google_drive'; fileId: string }; step: number }
export interface PdfManifest {
  version: 2; jobId: string; sourceHash: string; expiresAt: string; totalPages: number;
  filename?: string;
  mode: 'direct' | 'viewer'; fingerprint: string;
}
export interface PdfPart {
  version: 2; jobId: string; sourceHash: string; expiresAt: string; fingerprint: string;
  index: number; firstPage: number; lastPage: number; bytes: number; sha256: string;
}
export interface PdfProgress {
  stage: 'DISCOVERING' | 'RENDERING' | 'MERGING'; processedPages: number; totalPages: number | null;
  percent: number; nextStep: number;
}
export const pdfChunkingEnabled = (env: Record<string, string | undefined>) => env.PDF_CHUNKED_JOBS_ENABLED === 'true';
export const pdfPartCount = (pages: number) => Math.ceil(pages / PDF_CHUNK_PAGES);
export const pdfPartRange = (pages: number, index: number) => ({ firstPage: (index - 1) * PDF_CHUNK_PAGES + 1, lastPage: Math.min(index * PDF_CHUNK_PAGES, pages) });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const exact = (v: unknown, keys: string): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.split(',').sort().join(',');
export function isPdfChunkJob(v: unknown): v is PdfChunkJob {
  return exact(v, 'version,jobId,source,step') && v.version === 2 && typeof v.jobId === 'string' && uuid.test(v.jobId) &&
    Number.isInteger(v.step) && v.step >= 0 && v.step <= PDF_MAX_STEPS && exact(v.source, 'provider,fileId') &&
    v.source.provider === 'google_drive' && typeof v.source.fileId === 'string' && /^[A-Za-z0-9_-]{10,128}$/.test(v.source.fileId);
}
export function isPdfManifest(v: unknown, jobId: string, sourceHash: string, expiresAt: string): v is PdfManifest {
  return (exact(v, 'version,jobId,sourceHash,expiresAt,totalPages,mode,fingerprint') ||
    (exact(v, 'version,jobId,sourceHash,expiresAt,totalPages,mode,fingerprint,filename') && typeof v.filename === 'string' && normalizePdfFilename(v.filename) === v.filename)) && v.version === 2 && v.jobId === jobId &&
    v.sourceHash === sourceHash && v.expiresAt === expiresAt && Number.isInteger(v.totalPages) && v.totalPages >= 1 &&
    v.totalPages <= PDF_LONG_MAX_PAGES && ['direct', 'viewer'].includes(v.mode) && hash(v.fingerprint);
}
export function isPdfPart(v: unknown, m: PdfManifest, index: number): v is PdfPart {
  const range = pdfPartRange(m.totalPages, index);
  return exact(v, 'version,jobId,sourceHash,expiresAt,fingerprint,index,firstPage,lastPage,bytes,sha256') && v.version === 2 &&
    v.jobId === m.jobId && v.sourceHash === m.sourceHash && v.expiresAt === m.expiresAt && v.fingerprint === m.fingerprint &&
    v.index === index && index >= 1 && index <= pdfPartCount(m.totalPages) && v.firstPage === range.firstPage && v.lastPage === range.lastPage &&
    Number.isInteger(v.bytes) && v.bytes >= 1 && v.bytes <= PDF_CHUNK_MAX_BYTES && hash(v.sha256);
}
export function pdfProgress(m: PdfManifest | null, completed = 0): PdfProgress {
  const pages = m ? Math.min(m.totalPages, completed * PDF_CHUNK_PAGES) : 0;
  return { stage: !m ? 'DISCOVERING' : completed === pdfPartCount(m.totalPages) ? 'MERGING' : 'RENDERING',
    processedPages: pages, totalPages: m?.totalPages ?? null, percent: m ? Math.min(99, Math.floor(pages * 99 / m.totalPages)) : 0,
    nextStep: m ? completed + 1 : 0 };
}
