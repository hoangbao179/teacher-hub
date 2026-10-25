import type { IncomingMessage, ServerResponse } from 'node:http';
import { JobError, limits, parseJob } from './contract.ts';
import { processJob, type Dependencies } from './processor.ts';
import { GCSStore } from './storage.ts';
import { access, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';

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
      const cap = limits(env);
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
      const job = parseJob(raw);
      if (!deps) {
        try {
          const fs = await statfs('/tmp/pdf-worker');
          await access('/tmp/pdf-worker', constants.W_OK);
          if (fs.type !== 0x01021994 || fs.blocks * fs.bsize > 32 * 1024 * 1024 || fs.bavail * fs.bsize < cap.maxBytes) {
            throw new Error('volume');
          }
        } catch { throw new JobError('SERVICE_UNAVAILABLE', true); }
      }
      const runtime = deps ?? { store: new GCSStore(), tempRoot: '/tmp/pdf-worker' };
      const result = await processJob(job, cap, controller.signal, {
        ...runtime, enablePrintFallback: env.PDF_PRINT_FALLBACK_ENABLED === 'true',
      });
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
