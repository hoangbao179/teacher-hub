import type { Request,Response,NextFunction } from 'express';
import { Readable,Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PdfService } from '../services/pdf.service';
import { PDF_OUTPUT_MAX_BYTES } from '@teacher/shared';
import { pdfError } from '../services/pdf-validation';

export class PdfController {
  constructor(private service: PdfService) {}
  guard = async (req: Request,_res: Response,next: NextFunction) => {
    if (!req.auth || req.auth.role !== 'TEACHER' || !Number.isSafeInteger(req.auth.id) || req.auth.id<1) throw pdfError(403,'PDF_FORBIDDEN');
    await this.service.authorize(req.auth.id); next();
  };
  capabilities = async (_req: Request,res: Response) => res.json({ data:await this.service.capabilities() });
  create = async (req: Request,res: Response) => res.status(201).json({ data:await this.service.create(req.auth!.id,req.header('Idempotency-Key'),req.body) });
  list = async (req: Request,res: Response) => res.json({ data:await this.service.list(req.auth!.id,req.query.page) });
  detail = async (req: Request,res: Response) => res.json({ data:await this.service.detail(req.auth!.id,String(req.params.id)) });
  retry = async (req: Request,res: Response) => res.status(201).json({ data:await this.service.retry(req.auth!.id,String(req.params.id),req.header('Idempotency-Key')) });
  ticket = async (req: Request,res: Response) => res.json({ data:await this.service.ticket(req.auth!.id,String(req.params.id)) });
  download = async (req: Request,res: Response) => {
    await this.streamDownload(req.auth!.id,req,res);
  };
  async streamDownload(owner: number,req: Request,res: Response) {
    const abort = new AbortController(); let timer = setTimeout(() => abort.abort(),30000);
    const close = () => { if (!res.writableEnded) abort.abort(); }; res.once('close',close);
    let release: (() => void) | undefined;
    try {
      const file = await this.service.download(owner,String(req.params.id),req.body?.ticket,abort.signal); release=file.release;
      clearTimeout(timer); timer=setTimeout(()=>abort.abort(),Math.max(1,Math.min(30000,Date.parse(file.expiresAt)-Date.now())));
      res.set({ 'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="pdf-${req.params.id}.pdf"`,
        'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Length':String(file.bytes) });
      let bytes=0;
      const bound = new Transform({ transform(chunk: Buffer,_enc,cb) {
        bytes+=chunk.length; cb(bytes>file.bytes || bytes>PDF_OUTPUT_MAX_BYTES ? new Error('PDF_STREAM_LIMIT') : null,chunk);
      },flush(cb) { cb(bytes!==file.bytes ? new Error('PDF_STREAM_TRUNCATED') : null); } });
      await pipeline(Readable.from(file.stream),bound,res,{ signal:abort.signal });
    } catch (e) { if (res.headersSent || res.destroyed) res.destroy(); else throw e; }
    finally { clearTimeout(timer); res.off('close',close); release?.(); }
  }
}
