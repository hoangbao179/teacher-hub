import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobError, type Job, type Limits, type Result } from './contract.ts';
import { download } from './download.ts';
import { validatePDF } from './pdf.ts';
import type { Store } from './storage.ts';

interface Claim { version: 1; sourceHash: string; createdAt: string; expiresAt: string }
export interface Dependencies {
  store: Store; download?: typeof download; validate?: typeof validatePDF;
  render?: (fileId: string, path: string, cap: Limits, signal: AbortSignal) => Promise<void>;
  enablePrintFallback?: boolean; tempRoot?: string;
}
export async function processJob(job: Job, cap: Limits, signal: AbortSignal, deps: Dependencies): Promise<Result> {
  const { store } = deps;
  const prefix = `jobs/${job.jobId}/`;
  const sourceHash = createHash('sha256').update(JSON.stringify({
    provider: job.source.provider, fileId: job.source.fileId })).digest('hex');
  await store.ready(signal); // Check both get/create before downloading or writing any object.
  // Capture a single instant: API reconciliation requires an exact 24-hour claim.
  const createdMs = Date.now();
  const createdAt = new Date(createdMs).toISOString();
  const candidate: Claim = { version: 1, sourceHash, createdAt, expiresAt: new Date(createdMs + 86400000).toISOString() };
  await store.create(`${prefix}request.json`, { json: candidate }, signal);
  const claim = await store.json<Claim>(`${prefix}request.json`, signal);
  if (!claim || claim.version !== 1 || !/^[a-f0-9]{64}$/.test(claim.sourceHash ?? '') ||
    !Number.isFinite(Date.parse(claim.createdAt)) || !Number.isFinite(Date.parse(claim.expiresAt))) throw new JobError('STORAGE_UNAVAILABLE', true);
  if (claim.sourceHash !== sourceHash) throw new JobError('JOB_CONFLICT');
  const readResult = async () => {
    const value = await store.json<Result>(`${prefix}result.json`, signal);
    if (value && (value.version !== 1 || value.jobId !== job.jobId || value.expiresAt !== claim.expiresAt ||
      !Number.isFinite(Date.parse(value.completedAt)) ||
      (value.status === 'COMPLETED' ? value.objectName !== `${prefix}output.pdf` ||
        !/^[a-f0-9]{64}$/.test(value.sha256 ?? '') || !Number.isInteger(value.bytes) || (value.bytes ?? 0) < 1 ||
        !Number.isInteger(value.pages) || (value.pages ?? 0) < 1 :
        value.status !== 'FAILED' || typeof value.errorCode !== 'string'))) throw new JobError('STORAGE_UNAVAILABLE', true);
    return value;
  };
  const existing = await readResult();
  if (existing) return existing;
  const base = { version: 1 as const, jobId: job.jobId, expiresAt: claim.expiresAt };
  const finish = async (result: Result) => {
    if (await store.create(`${prefix}result.json`, { json: result }, signal)) return result;
    const winner = await readResult();
    if (!winner) throw new JobError('STORAGE_UNAVAILABLE', true);
    return winner;
  };
  const recover = async (): Promise<Result | null> => {
    const output = await store.head(`${prefix}output.pdf`, signal);
    if (!output) return null;
    const m = output.metadata;
    if (m?.sourceHash !== sourceHash || !/^[a-f0-9]{64}$/.test(m.sha256 ?? '') ||
      !Number.isInteger(Number(m.bytes)) || Number(m.bytes) < 1 || Number(m.bytes) > cap.maxBytes ||
      !Number.isInteger(Number(m.pages)) || Number(m.pages) < 1 || Number(m.pages) > cap.maxPages ||
      !Number.isFinite(Date.parse(m.completedAt))) throw new JobError('STORAGE_UNAVAILABLE', true);
    return finish({ ...base, status: 'COMPLETED', objectName: `${prefix}output.pdf`, bytes: Number(m.bytes),
      pages: Number(m.pages), sha256: m.sha256, completedAt: m.completedAt });
  };
  if (Date.now() >= Date.parse(claim.expiresAt)) {
    return finish({ ...base, status: 'FAILED', errorCode: 'JOB_EXPIRED', completedAt: createdAt });
  }
  const recovered = await recover();
  if (recovered) return recovered;
  const dir = await mkdtemp(join(deps.tempRoot ?? tmpdir(), 'teacher-pdf-'));
  try {
    const path = join(dir, 'source.pdf');
    try {
      let info: Awaited<ReturnType<typeof validatePDF>>;
      try {
        await (deps.download ?? download)(job.source.fileId, path, cap, signal);
        info = await (deps.validate ?? validatePDF)(path, cap, signal);
      } catch (sourceError) {
        const fallback = deps.enablePrintFallback === true &&
          sourceError instanceof JobError && !sourceError.retryable &&
          ['ACCESS_DENIED','UNSUPPORTED_SOURCE'].includes(sourceError.code);
        if (!fallback || signal.aborted) throw sourceError;
        // The direct endpoint may have produced HTML or partial bytes; never
        // mistake them for an output or let them survive the second attempt.
        await rm(path, { force:true });
        const render = deps.render ?? (await import('./renderer.ts')).renderPrintablePdf;
        await render(job.source.fileId, path, cap, signal);
        info = await (deps.validate ?? validatePDF)(path, cap, signal);
      }
      await store.create(`${prefix}output.pdf`, { path, metadata: { sourceHash, ...Object.fromEntries(
        Object.entries(info).map(([k, v]) => [k, String(v)])), completedAt: new Date().toISOString() } }, signal);
      const result = await recover();
      if (!result) throw new JobError('STORAGE_UNAVAILABLE', true);
      return result;
    } catch (error) {
      if (!(error instanceof JobError) || error.retryable || signal.aborted) throw error;
      // Await persistence before entering async cleanup, so a rejected write is
      // immediately observed and reaches HTTP as retryable instead of unhandled.
      return await finish({ ...base, status: 'FAILED', completedAt: new Date().toISOString(), errorCode: error.code });
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
}
