import type { IncomingMessage, ServerResponse } from 'node:http';
import { JobError, limits, parseJob, printFallbackEnabled } from './contract.ts';
import { processJob, type Dependencies } from './processor.ts';
import { GCSStore } from './storage.ts';
import { access, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isPdfChunkJob, pdfChunkingEnabled, PDF_LONG_MAX_PAGES, PDF_LONG_OUTPUT_MAX_BYTES, PDF_LONG_TEMP_BYTES, PDF_CHUNK_DEADLINE_MS, type PdfChunkJob } from '@teacher/shared';
import { processChunkJob } from './chunk-processor.ts';

export function jobHandler(deps?: Dependencies, env: NodeJS.ProcessEnv = process.env) {
  let busy = false;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, value: unknown) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    // Disabled source remains compatible with the health-only deploy smoke (404).
    if (env.PDF_PROCESSING_ENABLED !== 'true') { reply(404, { error: 'not_found' }); return; }
    if ((!deps && (!env.K_SERVICE || env.PDF_WORKER_IAM_READY !== 'true' || env.PDF_TEMP_ROOT !== '/tmp/pdf-worker')) || busy) {
      reply(503, { error: 'SERVICE_UNAVAILABLE', retryable: true }); return;
    }
    busy = true;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    req.once('aborted', disconnected);
    res.once('close', disconnected);
    let timer: NodeJS.Timeout | undefined;
    try {
      let cap = limits(env);
      timer = setTimeout(() => controller.abort(), cap.deadlineMs);
      const chunks: Buffer[] = [];
      let size = 0;
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new JobError('INVALID_REQUEST');
      if (Number(req.headers['content-length'] ?? 0) > 4096) throw new JobError('BODY_TOO_LARGE');
      // IncomingMessage async iterator does not observe AbortSignal while waiting for a body.
      const onAbort = () => req.destroy();
      controller.signal.addEventListener('abort', onAbort, { once: true });
      try {
        await new Promise<void>((resolve, reject) => {
          const data = (chunk: Buffer) => {
            size += chunk.length;
            if (size > 4096) { cleanup(); req.pause(); reject(new JobError('BODY_TOO_LARGE')); }
            else chunks.push(chunk);
          };
          const end = () => { cleanup(); resolve(); };
          const error = () => { cleanup(); reject(new JobError('INVALID_REQUEST')); };
          const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('close', error); };
          req.on('data', data); req.once('end', end); req.once('error', error); req.once('close', error);
        });
      } finally { controller.signal.removeEventListener('abort', onAbort); }
      let raw: unknown;
      try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new JobError('INVALID_REQUEST'); }
      const chunked = isPdfChunkJob(raw);
      if (chunked && !pdfChunkingEnabled(env)) throw new JobError('SERVICE_UNAVAILABLE',true);
      const job = chunked ? raw : parseJob(raw);
      if (chunked) {
        cap = { ...cap, maxBytes:PDF_LONG_OUTPUT_MAX_BYTES,maxPages:PDF_LONG_MAX_PAGES,deadlineMs:PDF_CHUNK_DEADLINE_MS };
        clearTimeout(timer);timer=setTimeout(()=>controller.abort(),cap.deadlineMs);
      }
      if (!deps) {
        try {
          const fs = await statfs('/tmp/pdf-worker');
          await access('/tmp/pdf-worker', constants.W_OK);
          const scratch = chunked ? PDF_LONG_TEMP_BYTES : 32*1024*1024;
          const required = chunked ? 2*PDF_LONG_OUTPUT_MAX_BYTES+(cap.maxSourceBytes ?? cap.maxBytes) : Math.max(cap.maxBytes, cap.maxSourceBytes ?? cap.maxBytes);
          if (fs.type !== 0x01021994 || fs.blocks * fs.bsize > scratch || fs.bavail * fs.bsize < required) {
            throw new Error('volume');
          }
        } catch { throw new JobError('SERVICE_UNAVAILABLE', true); }
      }
      const runtime = deps ?? { store: new GCSStore(), tempRoot: '/tmp/pdf-worker' };
      const result = await (chunked ? processChunkJob(job as PdfChunkJob, cap, controller.signal, {
        ...runtime, enablePrintFallback: printFallbackEnabled(env),
      }) : processJob(job as ReturnType<typeof parseJob>, cap, controller.signal, {
        ...runtime, enablePrintFallback: printFallbackEnabled(env),
      }));
      reply(200, result);
    } catch (error) {
      const safe = controller.signal.aborted ? new JobError('TIMEOUT', true) :
        error instanceof JobError ? error : new JobError('INTERNAL_ERROR', true);
      reply(safe.retryable ? 503 : safe.code === 'JOB_CONFLICT' ? 409 : safe.code === 'BODY_TOO_LARGE' ? 413 : 400,
        { error: safe.code, retryable: safe.retryable });
    } finally {
      clearTimeout(timer); busy = false;
      // Do not keep unread invalid/oversized request bodies alive on a reusable connection.
      if (!req.complete) res.once('finish', () => req.destroy());
      req.removeListener('aborted', disconnected); res.removeListener('close', disconnected);
    }
  };
}
