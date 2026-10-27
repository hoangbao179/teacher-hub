import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { PdfJob, PdfJobStatus, PdfBatch, PdfBatchList, PdfProgress } from '@teacher/shared';
import { pool } from '../db/pool';
import { pdfError } from '../services/pdf-validation';
import type { PdfSettings } from '../config/pdf-settings';
import type { ValidPdfResult } from '../services/pdf-validation';

const date = (v: string | Date) => v instanceof Date ? v.toISOString() : new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`).toISOString();
const nullableDate = (v: string | null) => v ? date(v) : null;
export interface PdfWork extends PdfJob { lease: string }
function job(r: RowDataPacket): PdfJob {
  return { id: r.id, batchId: r.batch_id, fileId: r.file_id, status: r.status,
    workerVersion: r.worker_version === 2 ? 2 : 1,
    progress: typeof r.progress_json === 'string' ? JSON.parse(r.progress_json) : r.progress_json ?? null,
    createdAt: date(r.created_at), updatedAt: date(r.updated_at), enqueuedAt: nullableDate(r.enqueued_at),
    completedAt: nullableDate(r.completed_at), expiresAt: date(r.expires_at), errorCode: r.error_code,
    cloudErrorCode: r.cloud_error_code, bytes: r.bytes, pages: r.pages, retryOf: r.retry_of,
    retryAttempts: r.retry_attempts, enqueueAttempts: r.enqueue_attempts };
}
async function transaction<T>(run: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const value = await run(c); await c.commit(); return value; }
  catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
export class PdfRepository {
  async authorize(owner: number) {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id=? AND role=\'TEACHER\' AND status=\'ACTIVE\'', [owner]);
    if (!rows.length) throw pdfError(403, 'PDF_FORBIDDEN');
  }
  private async lock(c: PoolConnection, owner: number) {
    const [rows] = await c.execute<RowDataPacket[]>('SELECT id FROM users WHERE id=? AND role=\'TEACHER\' AND status=\'ACTIVE\' FOR UPDATE', [owner]);
    if (!rows.length) throw pdfError(403, 'PDF_FORBIDDEN');
  }
  async expire(owner?: number) {
    await pool.execute(`UPDATE pdf_jobs SET status='EXPIRED',updated_at=UTC_TIMESTAMP(3),lease_token=NULL,lease_until=NULL
      WHERE expires_at<=UTC_TIMESTAMP(3) AND status<>'EXPIRED' ${owner ? 'AND owner_id=?' : ''}`, owner ? [owner] : []);
  }
  private async capacity(c: PoolConnection, owner: number, count: number, cfg: PdfSettings) {
    const [active] = await c.execute<RowDataPacket[]>(`SELECT COUNT(*) n FROM pdf_jobs WHERE owner_id=?
      AND status IN ('ENQUEUE_PENDING','ENQUEUE_RETRY','QUEUED','RESULT_UNCONFIRMED') AND expires_at>UTC_TIMESTAMP(3)`, [owner]);
    const [recent] = await c.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_jobs WHERE owner_id=? AND created_at>UTC_TIMESTAMP(3)-INTERVAL 1 HOUR', [owner]);
    if (Number(active[0].n) + count > cfg.maxActive || Number(recent[0].n) + count > cfg.maxHourly * cfg.maxLinks) throw pdfError(429, 'PDF_RATE_LIMITED');
  }
  private async insert(c: PoolConnection, owner: number, batch: string, file: string, retry?: PdfJob, key?: string, chunked = false) {
    const id = randomUUID();
    await c.execute(`INSERT INTO pdf_jobs(id,batch_id,owner_id,file_id,created_at,updated_at,expires_at,next_action_at,retry_of,retry_attempts,retry_key,worker_version)
      VALUES(?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 24 HOUR,UTC_TIMESTAMP(3),?,?,?,?)`,
    [id,batch,owner,file,retry?.id ?? null,retry ? retry.retryAttempts+1 : 0,key ?? null,chunked ? 2 : 1]);
    return id;
  }
  async create(owner: number, key: string, hash: string, files: string[], cfg: PdfSettings, publicSessionId?: string) {
    return transaction(async c => {
      await this.lock(c, owner);
      if (publicSessionId) {
        const [sessions] = await c.execute<RowDataPacket[]>(
          'SELECT id FROM pdf_guest_sessions WHERE id=? AND owner_id=? AND expires_at>UTC_TIMESTAMP(3) FOR SHARE',
          [publicSessionId,owner]);
        if (!sessions.length) throw pdfError(401,'PDF_GUEST_SESSION_REQUIRED');
      }
      const [existing] = await c.execute<RowDataPacket[]>('SELECT id,request_hash FROM pdf_batches WHERE owner_id=? AND idempotency_key=?', [owner,key]);
      if (existing.length) {
        if (existing[0].request_hash !== hash) throw pdfError(409, 'PDF_IDEMPOTENCY_CONFLICT');
        const [visibility] = await c.execute<RowDataPacket[]>('SELECT session_id FROM pdf_guest_batches WHERE batch_id=?', [existing[0].id]);
        if ((visibility[0]?.session_id ?? undefined) !== publicSessionId) throw pdfError(409,'PDF_IDEMPOTENCY_CONFLICT');
        return existing[0].id as string;
      }
      await this.capacity(c, owner, files.length, cfg);
      const [rate] = await c.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_batches WHERE owner_id=? AND created_at>UTC_TIMESTAMP(3)-INTERVAL 1 HOUR', [owner]);
      if (Number(rate[0].n) >= cfg.maxHourly) throw pdfError(429, 'PDF_RATE_LIMITED');
      const id = randomUUID();
      await c.execute('INSERT INTO pdf_batches(id,owner_id,idempotency_key,request_hash,rights_confirmed_at,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))', [id,owner,key,hash]);
      for (const file of files) await this.insert(c,owner,id,file,undefined,undefined,cfg.chunked);
      if (publicSessionId) {
        await c.execute('INSERT INTO pdf_guest_batches(batch_id,session_id) VALUES(?,?)', [id,publicSessionId]);
      }
      return id;
    });
  }
  async retry(owner: number, id: string, key: string, cfg: PdfSettings) {
    return transaction(async c => {
      await this.lock(c,owner);
      const [duplicate] = await c.execute<RowDataPacket[]>('SELECT * FROM pdf_jobs WHERE owner_id=? AND retry_key=?', [owner,key]);
      if (duplicate.length) {
        if (duplicate[0].retry_of !== id) throw pdfError(409,'PDF_IDEMPOTENCY_CONFLICT');
        return duplicate[0].id as string;
      }
      const [rows] = await c.execute<RowDataPacket[]>('SELECT * FROM pdf_jobs WHERE id=? AND owner_id=? FOR UPDATE', [id,owner]);
      if (!rows.length) throw pdfError(404,'PDF_NOT_FOUND');
      const old = job(rows[0]);
      if (rows[0].lease_until && Date.parse(date(rows[0].lease_until))>Date.now()) throw pdfError(409,'PDF_RETRY_BUSY');
      if (!['FAILED','RETRY_EXHAUSTED','EXPIRED'].includes(old.status) || old.retryAttempts >= cfg.maxRetries) throw pdfError(409,'PDF_RETRY_NOT_ALLOWED');
      const [children] = await c.execute<RowDataPacket[]>('SELECT id FROM pdf_jobs WHERE retry_of=?', [id]);
      if (children.length) throw pdfError(409,'PDF_RETRY_ALREADY_CREATED');
      await this.capacity(c,owner,1,cfg);
      return this.insert(c,owner,old.batchId,old.fileId,old,key,cfg.chunked);
    });
  }
  async get(owner: number, id: string): Promise<PdfJob> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM pdf_jobs WHERE id=? AND owner_id=?', [id,owner]);
    if (!rows.length) throw pdfError(404,'PDF_NOT_FOUND'); return job(rows[0]);
  }
  async batch(owner: number, id: string): Promise<PdfBatch> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM pdf_batches WHERE id=? AND owner_id=?', [id,owner]);
    if (!rows.length) throw pdfError(404,'PDF_NOT_FOUND');
    const [jobs] = await pool.execute<RowDataPacket[]>('SELECT * FROM pdf_jobs WHERE batch_id=? AND owner_id=? ORDER BY created_at,id', [id,owner]);
    return { id,createdAt:date(rows[0].created_at),rightsConfirmedAt:date(rows[0].rights_confirmed_at),jobs:jobs.map(job) };
  }
  async list(owner: number, page: number): Promise<PdfBatchList> {
    const privateOnly = 'b.owner_id=? AND NOT EXISTS (SELECT 1 FROM pdf_guest_batches g WHERE g.batch_id=b.id)';
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT b.* FROM pdf_batches b WHERE ${privateOnly} ORDER BY b.created_at DESC,b.id DESC LIMIT 20 OFFSET ?`, [owner,(page-1)*20]);
    const [count] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) n FROM pdf_batches b WHERE ${privateOnly}`, [owner]);
    return { items:rows.map(r => ({ id:r.id,createdAt:date(r.created_at),rightsConfirmedAt:date(r.rights_confirmed_at) })),page,pageSize:20,total:Number(count[0].n) };
  }
  async lease(owner?: number, batch?: string): Promise<PdfWork | null> {
    return transaction(async c => {
      const [rows] = await c.query<RowDataPacket[]>(`SELECT * FROM pdf_jobs WHERE status IN
        ('ENQUEUE_PENDING','ENQUEUE_RETRY','QUEUED','RESULT_UNCONFIRMED','RETRY_EXHAUSTED') AND expires_at>UTC_TIMESTAMP(3)
        AND next_action_at<=UTC_TIMESTAMP(3) AND (lease_until IS NULL OR lease_until<UTC_TIMESTAMP(3))
        ${owner ? 'AND owner_id=?' : ''} ${batch ? 'AND batch_id=?' : ''} ORDER BY next_action_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [...(owner ? [owner] : []),...(batch ? [batch] : [])]);
      if (!rows.length) return null;
      const token = randomUUID();
      await c.execute('UPDATE pdf_jobs SET lease_token=?,lease_until=UTC_TIMESTAMP(3)+INTERVAL 60 SECOND WHERE id=?', [token,rows[0].id]);
      return { ...job(rows[0]),lease:token };
    });
  }
  async save(work: PdfWork, status: PdfJobStatus, cloudError: string | null, result?: ValidPdfResult, enqueueAttempted = false, progress?: PdfProgress) {
    await pool.execute(`UPDATE pdf_jobs SET status=?,cloud_error_code=?,updated_at=UTC_TIMESTAMP(3),
      enqueued_at=CASE WHEN ?='QUEUED' THEN COALESCE(enqueued_at,UTC_TIMESTAMP(3)) ELSE enqueued_at END,
      enqueue_attempts=CASE WHEN ? THEN ? ELSE enqueue_attempts+? END,progress_json=COALESCE(?,progress_json),
      next_action_at=UTC_TIMESTAMP(3)+INTERVAL 15 SECOND,lease_token=NULL,lease_until=NULL,
      completed_at=COALESCE(?,completed_at),expires_at=COALESCE(?,expires_at),error_code=COALESCE(?,error_code),
      object_name=COALESCE(?,object_name),bytes=COALESCE(?,bytes),pages=COALESCE(?,pages),sha256=COALESCE(?,sha256)
      WHERE id=? AND lease_token=?`, [status,cloudError,status,
      !!progress && progress.nextStep !== work.progress?.nextStep,enqueueAttempted ? 1 : 0,enqueueAttempted ? 1 : 0,progress ? JSON.stringify(progress) : null,
      result ? new Date(result.completedAt) : null,result ? new Date(result.expiresAt) : null,result?.errorCode ?? null,
      result?.objectName ?? null,result?.bytes ?? null,result?.pages ?? null,result?.sha256 ?? null,work.id,work.lease]);
  }
  async ticket(owner: number, id: string, hash: string, expiry: Date) {
    // Small expiring authorization records; bounded per job and cleaned without touching job history.
    await transaction(async c => {
      await this.lock(c,owner);
      await c.execute('DELETE FROM pdf_download_tickets WHERE owner_id=? AND expires_at<=UTC_TIMESTAMP(3)', [owner]);
      const [rows] = await c.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_download_tickets WHERE owner_id=?', [owner]);
      if (Number(rows[0].n)>=20) throw pdfError(429,'PDF_RATE_LIMITED');
      await c.execute('INSERT INTO pdf_download_tickets(token_hash,job_id,owner_id,expires_at) VALUES(?,?,?,?)', [hash,id,owner,expiry]);
    });
  }
  async consume(owner: number, id: string, hash: string) {
    const [r] = await pool.execute<ResultSetHeader>('UPDATE pdf_download_tickets SET consumed_at=UTC_TIMESTAMP(3) WHERE token_hash=? AND owner_id=? AND job_id=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP(3)', [hash,owner,id]);
    if (r.affectedRows !== 1) throw pdfError(403,'PDF_INVALID_TICKET');
  }
}
