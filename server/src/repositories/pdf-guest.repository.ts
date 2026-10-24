import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { PdfBatchList } from "@teacher/shared";
import { pool } from "../db/pool";
import { pdfError, uuid } from "../services/pdf-validation";

export interface PdfGuest { id: string; owner: number }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export class PdfGuestRepository {
  async find(token: string | null): Promise<PdfGuest | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id,owner_id FROM pdf_guest_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(3)", [digest(token)]);
    return rows.length ? { id: rows[0].id, owner: Number(rows[0].owner_id) } : null;
  }
  async issue(): Promise<{ guest: PdfGuest; token: string }> {
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE role='TEACHER' AND status='ACTIVE' ORDER BY id LIMIT 2");
    if (users.length !== 1) throw pdfError(503, "PDF_SERVICE_UNAVAILABLE");
    const id = randomUUID(), token = randomBytes(32).toString("base64url");
    const owner = Number(users[0].id);
    await pool.execute(
      "INSERT INTO pdf_guest_sessions(id,token_hash,owner_id,created_at,expires_at) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 180 DAY)",
      [id, digest(token), owner]);
    return { guest: { id, owner }, token };
  }
  async attach(guest: PdfGuest, batchId: string): Promise<void> {
    await pool.execute("INSERT IGNORE INTO pdf_guest_batches(batch_id,session_id) VALUES(?,?)", [batchId, guest.id]);
    await this.ownsBatch(guest, batchId);
  }
  async ownsBatch(guest: PdfGuest, id: string): Promise<void> {
    if (!uuid(id)) throw pdfError(400, "PDF_INVALID_REQUEST");
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT b.id FROM pdf_guest_batches g JOIN pdf_batches b ON b.id=g.batch_id WHERE g.session_id=? AND g.batch_id=? AND b.owner_id=?",
      [guest.id, id, guest.owner]);
    if (!rows.length) throw pdfError(404, "PDF_NOT_FOUND");
  }
  async ownsJob(guest: PdfGuest, id: string): Promise<void> {
    if (!uuid(id)) throw pdfError(400, "PDF_INVALID_REQUEST");
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT j.id FROM pdf_jobs j JOIN pdf_guest_batches g ON j.batch_id=g.batch_id WHERE g.session_id=? AND j.id=? AND j.owner_id=?",
      [guest.id, id, guest.owner]);
    if (!rows.length) throw pdfError(404, "PDF_NOT_FOUND");
  }
  async list(guest: PdfGuest, page: unknown): Promise<PdfBatchList> {
    const n = page === undefined ? 1 : Number(page);
    if (!Number.isSafeInteger(n) || n < 1 || n > 10000) throw pdfError(400, "PDF_INVALID_REQUEST");
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT b.id,b.created_at,b.rights_confirmed_at FROM pdf_guest_batches g JOIN pdf_batches b ON b.id=g.batch_id WHERE g.session_id=? AND b.owner_id=? ORDER BY b.created_at DESC,b.id LIMIT 20 OFFSET ?",
      [guest.id,guest.owner,(n-1)*20]);
    const [counts] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM pdf_guest_batches g JOIN pdf_batches b ON b.id=g.batch_id WHERE g.session_id=? AND b.owner_id=?",
      [guest.id,guest.owner]);
    const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value.includes("T") ? value : value.replace(" ","T")+"Z").toISOString();
    return {items:rows.map(r=>({id:r.id,createdAt:iso(r.created_at),rightsConfirmedAt:iso(r.rights_confirmed_at)})),
      page:n,pageSize:20,total:Number(counts[0].n)};
  }
  async publicBatch(id:string):Promise<PdfGuest>{
    if(!uuid(id))throw pdfError(400,"PDF_INVALID_REQUEST");
    const [r]=await pool.execute<RowDataPacket[]>("SELECT g.session_id,b.owner_id FROM pdf_guest_batches g JOIN pdf_batches b ON b.id=g.batch_id WHERE b.id=?",[id]);
    if(!r.length)throw pdfError(404,"PDF_NOT_FOUND");
    return {id:r[0].session_id,owner:Number(r[0].owner_id)};
  }
  async publicJob(id:string):Promise<PdfGuest>{
    if(!uuid(id))throw pdfError(400,"PDF_INVALID_REQUEST");
    const [r]=await pool.execute<RowDataPacket[]>("SELECT g.session_id,j.owner_id FROM pdf_guest_batches g JOIN pdf_jobs j ON j.batch_id=g.batch_id WHERE j.id=?",[id]);
    if(!r.length)throw pdfError(404,"PDF_NOT_FOUND");
    return {id:r[0].session_id,owner:Number(r[0].owner_id)};
  }
  async publicList(page:unknown):Promise<PdfBatchList>{
    const n=page===undefined?1:Number(page);
    if(!Number.isSafeInteger(n)||n<1||n>10000)throw pdfError(400,"PDF_INVALID_REQUEST");
    const [rows]=await pool.query<RowDataPacket[]>("SELECT b.id,b.created_at,b.rights_confirmed_at FROM pdf_guest_batches g JOIN pdf_batches b ON b.id=g.batch_id ORDER BY b.created_at DESC,b.id DESC LIMIT 20 OFFSET ?",[(n-1)*20]);
    const [counts]=await pool.query<RowDataPacket[]>("SELECT COUNT(*) n FROM pdf_guest_batches");
    const iso=(v:string|Date)=>v instanceof Date?v.toISOString():new Date(v.includes("T")?v:v.replace(" ","T")+"Z").toISOString();
    return {items:rows.map(r=>({id:r.id,createdAt:iso(r.created_at),rightsConfirmedAt:iso(r.rights_confirmed_at)})),page:n,pageSize:20,total:Number(counts[0].n)};
  }

}
