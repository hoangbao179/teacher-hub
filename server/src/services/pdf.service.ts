import { randomBytes } from 'node:crypto';
import type { PdfCapabilities, PdfDownloadTicket } from '@teacher/shared';
import { PDF_MAX_PAGES, PDF_OUTPUT_MAX_BYTES, PDF_SOURCE_MAX_BYTES, PDF_LONG_MAX_PAGES, PDF_LONG_OUTPUT_MAX_BYTES, PDF_LONG_DOWNLOAD_MS, type PdfChunkJob } from '@teacher/shared';
import { PdfRepository } from '../repositories/pdf.repository';
import type { PdfProvider } from './pdf-provider';
import type { PdfSettings } from '../config/pdf-settings';
import { digest, driveFileId, pdfError, uuid, validatePdfResult, workerPayload } from './pdf-validation';
import { AppError } from '../errors/app-error';

export class PdfService {
  private downloading = false;
  constructor(private repo: PdfRepository, private provider: PdfProvider, private cfg: PdfSettings) {}
  async authorize(owner: number) { await this.repo.authorize(owner); }
  async capabilities(signal?: AbortSignal): Promise<PdfCapabilities> {
    const enabled = this.cfg.enabled && this.provider.configured && (!this.cfg.chunked || this.provider.chunked === true) && await this.provider.ready(signal).catch(()=>false);
    return { submitEnabled:enabled,downloadEnabled:enabled,unavailableReason:enabled ? null : 'PDF_SERVICE_UNAVAILABLE',
      maxLinksPerBatch:this.cfg.maxLinks,maxActiveJobs:this.cfg.maxActive,maxBatchesPerHour:this.cfg.maxHourly,maxSourceBytes:PDF_SOURCE_MAX_BYTES,
      maxRetries:this.cfg.maxRetries,maxBytes:this.cfg.chunked ? PDF_LONG_OUTPUT_MAX_BYTES : PDF_OUTPUT_MAX_BYTES,maxPages:this.cfg.chunked ? PDF_LONG_MAX_PAGES : PDF_MAX_PAGES,ticketTtlSeconds:120 };
  }
  private async available() { if (!(await this.capabilities()).submitEnabled) throw pdfError(503,'PDF_SERVICE_UNAVAILABLE'); }
  private id(id: string) { if (!uuid(id)) throw pdfError(400,'PDF_INVALID_REQUEST'); }
  async create(owner: number, key: unknown, body: unknown, publicSessionId?: string) {
    await this.available();
    if (!uuid(key) || !body || typeof body !== 'object' || Array.isArray(body)) throw pdfError(400,'PDF_INVALID_REQUEST');
    const value = body as { links: unknown; rightsConfirmed?: unknown };
    const fields = Object.keys(body).sort().join();
    // Accept in-flight legacy clients; new UI does not claim download rights.
    if (!(fields === 'links' || (fields === 'links,rightsConfirmed' && value.rightsConfirmed === true)) ||
      !Array.isArray(value.links) || !value.links.length || value.links.length>this.cfg.maxLinks)
      throw pdfError(400,'PDF_INVALID_REQUEST');
    const files = value.links.map(driveFileId);
    if (new Set(files).size !== files.length) throw pdfError(400,'PDF_DUPLICATE_SOURCE');
    // Keep historical request hashes/idempotency keys stable across frontend rollout.
    const hash = digest(JSON.stringify({ files,rightsConfirmed:true }));
    const id = await this.repo.create(owner,key,hash,files,this.cfg,publicSessionId);
    await this.tick(owner,id);
    return this.repo.batch(owner,id);
  }
  async list(owner: number, page: unknown) {
    const number = page === undefined ? 1 : Number(page);
    if (!Number.isSafeInteger(number) || number<1 || number>10000) throw pdfError(400,'PDF_INVALID_REQUEST');
    await this.repo.expire(owner); return this.repo.list(owner,number);
  }
  async detail(owner: number, id: string) {
    this.id(id); await this.repo.batch(owner,id);
    await this.tick(owner,id); await this.repo.expire(owner); return this.repo.batch(owner,id);
  }
  async retry(owner: number, id: string, key: unknown) {
    this.id(id); if (!uuid(key)) throw pdfError(400,'PDF_INVALID_REQUEST');
    await this.available(); await this.repo.expire(owner);
    const newId = await this.repo.retry(owner,id,key,this.cfg);
    const created = await this.repo.get(owner,newId); await this.tick(owner,created.batchId);
    return this.repo.get(owner,newId);
  }
  /** HTTP uses at most 3 jobs; the independent reconciler requests one per sweep step. */
  async tick(owner?: number, batch?: string, limit = 3, signal?: AbortSignal): Promise<number> {
    if (!Number.isInteger(limit) || limit<1 || limit>3) throw new Error('PDF_TICK_INVALID_LIMIT');
    if (signal?.aborted || !(await this.capabilities(signal)).submitEnabled) return 0;
    await this.repo.expire(owner); let count = 0;
    for (; count<limit && !signal?.aborted; count++) {
      const work = await this.repo.lease(owner,batch); if (!work) break;
      let enqueueAttempted = false;
      try {
        signal?.throwIfAborted();
        const pair = await this.provider.result(work.id, signal);
        if (pair) {
          const result = validatePdfResult(work,pair,Date.now());
          await this.repo.save(work,Date.parse(result.expiresAt)<=Date.now() ? 'EXPIRED' : result.status,null,result);
        } else if (work.workerVersion === 2) {
          if (!this.provider.chunked || !this.provider.progress) throw new Error('PDF_CHUNKS_DISABLED');
          const progress = await this.provider.progress(work,signal);
          const sameStep = progress.nextStep === (work.progress?.nextStep ?? 0);
          const task = sameStep ? await this.provider.task(work.id,signal,progress.nextStep) : 'MISSING';
          if (task === 'EXHAUSTED' || (sameStep && task==='MISSING' && work.status==='RETRY_EXHAUSTED')) {
            await this.repo.save(work,'RETRY_EXHAUSTED','PDF_QUEUE_RETRY_EXHAUSTED',undefined,false,progress);
          } else if (task === 'WAITING') {
            await this.repo.save(work,'QUEUED',null,undefined,false,progress);
          } else if (sameStep && work.enqueueAttempts>=8) {
            await this.repo.save(work,'RESULT_UNCONFIRMED','PDF_ENQUEUE_UNCONFIRMED',undefined,false,progress);
          } else {
            const payload: PdfChunkJob={...workerPayload(work.id,work.fileId),version:2,step:progress.nextStep};
            enqueueAttempted=true;
            await this.provider.enqueue(payload,signal);
            await this.repo.save(work,'QUEUED',null,undefined,true,progress);
          }
        } else if (['ENQUEUE_PENDING','ENQUEUE_RETRY'].includes(work.status)) {
          if (work.enqueueAttempts>=8) { await this.repo.save(work,'RESULT_UNCONFIRMED','PDF_ENQUEUE_UNCONFIRMED'); continue; }
          enqueueAttempted = true;
          await this.provider.enqueue(workerPayload(work.id,work.fileId), signal);
          await this.repo.save(work,'QUEUED',null,undefined,true);
        } else {
          const state = await this.provider.task(work.id, signal);
          const exhausted = state === 'EXHAUSTED' || (state === 'MISSING' && work.status === 'RETRY_EXHAUSTED');
          await this.repo.save(work,exhausted ? 'RETRY_EXHAUSTED' :
            work.status === 'RESULT_UNCONFIRMED' || work.status === 'RETRY_EXHAUSTED' || state === 'MISSING' || Date.now()-Date.parse(work.createdAt)>7200000
              ? 'RESULT_UNCONFIRMED' : 'QUEUED',
          exhausted ? 'PDF_QUEUE_RETRY_EXHAUSTED' : state === 'MISSING' ? 'PDF_RESULT_PENDING' : null);
        }
      } catch (error) {
        const mismatch = error instanceof Error && 'code' in error && error.code === 'PDF_RESULT_SCHEMA_MISMATCH';
        await this.repo.save(work,['ENQUEUE_PENDING','ENQUEUE_RETRY'].includes(work.status) ? 'ENQUEUE_RETRY' : work.status,
          mismatch ? 'PDF_RESULT_SCHEMA_MISMATCH' : 'PDF_CLOUD_UNAVAILABLE',undefined,enqueueAttempted);
      }
    }
    return count;
  }
  private async downloadable(owner: number, id: string) {
    this.id(id); await this.repo.expire(owner); const job = await this.repo.get(owner,id);
    if (job.status !== 'COMPLETED' || Date.parse(job.expiresAt)<=Date.now()) throw pdfError(409,'PDF_NOT_DOWNLOADABLE');
    await this.available(); return job;
  }
  async ticket(owner: number,id: string): Promise<PdfDownloadTicket> {
    const job = await this.downloadable(owner,id);
    const expiry = new Date(Math.min(Date.now()+120000,Date.parse(job.expiresAt)));
    const token = randomBytes(32).toString('base64url'); await this.repo.ticket(owner,id,digest(token),expiry);
    return { ticket:token,expiresAt:expiry.toISOString(),downloadPath:`/api/pdf/jobs/${id}/download` };
  }
  async download(owner: number,id: string,token: unknown,signal: AbortSignal) {
    const job = await this.downloadable(owner,id);
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw pdfError(403,'PDF_INVALID_TICKET');
    if (this.downloading) throw pdfError(429,'PDF_DOWNLOAD_BUSY');
    this.downloading = true;
    try {
      await this.repo.consume(owner,id,digest(token));
      const stream = await this.provider.open(id,signal);
      return { stream,filename:job.filename,fileId:job.fileId,bytes:job.bytes!,expiresAt:job.expiresAt,
        maxBytes:job.workerVersion===2 ? PDF_LONG_OUTPUT_MAX_BYTES : PDF_OUTPUT_MAX_BYTES,
        timeoutMs:job.workerVersion===2 ? PDF_LONG_DOWNLOAD_MS : 30000,release:() => { this.downloading=false; } };
    } catch (e) { this.downloading=false; if (e instanceof AppError) throw e; throw pdfError(503,'PDF_DOWNLOAD_UNAVAILABLE'); }
  }
}
