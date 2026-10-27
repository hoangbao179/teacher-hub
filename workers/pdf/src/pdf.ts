import { execFile } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { JobError, type Limits } from './contract.ts';

export async function validatePDF(path: string, cap: Limits, signal: AbortSignal) {
  const size = (await stat(path)).size;
  if (size > cap.maxBytes) {
    throw new JobError('FILE_TOO_LARGE', false, 'validated-pdf-bytes',
      { usedBytes: size, limitBytes: cap.maxBytes });
  }
  const file = await open(path, 'r');
  try {
    const prefix = Buffer.alloc(512);
    await file.read(prefix, 0, 512, 0);
    if (/^\s*(?:<!doctype\s+html|<html)/i.test(prefix.toString('utf8'))) throw new JobError('UNSUPPORTED_SOURCE', false, 'html-response');
    if (!/^%PDF-[12]\.\d/.test(prefix.toString('ascii'))) throw new JobError('INVALID_PDF');
  } finally { await file.close(); }
  const run = (args: string[], allowedCodes: number[] = []) => new Promise<string>((resolve, reject) => {
    // Linux production: bound parser address space, CPU, wall time and diagnostic output.
    execFile('prlimit', ['--as=536870912', '--cpu=5', '--', 'qpdf', ...args, path],
      { signal, timeout: 6000, killSignal: 'SIGKILL', maxBuffer: 16384, encoding: 'utf8' }, (error, stdout) => {
        // qpdf uses 0/2/3. Launcher failure (including qpdf missing behind prlimit)
        // is infrastructure failure, never evidence that the document is invalid.
        const unavailable = error && (error.code === 'ENOENT' || error.code === 'EACCES' ||
          (typeof error.code === 'number' && [1, 126, 127].includes(error.code)));
        if (error && typeof error.code === 'number' && allowedCodes.includes(error.code)) resolve(String(error.code));
        else if (error) reject(new JobError(signal.aborted || error.killed ? 'TIMEOUT' :
          unavailable ? 'SERVICE_UNAVAILABLE' : 'INVALID_PDF',
          signal.aborted || error.killed || !!unavailable));
        else resolve(stdout.trim());
      });
  });
  // qpdf exit 3 (recovered/warnings) is rejected too; never silently repair input.
  // --is-encrypted returns 0 when encrypted, 2 when not; it needs no PDF password.
  if (await run(['--is-encrypted'], [2]) !== '2') throw new JobError('UNSUPPORTED_SOURCE', false, 'encrypted-pdf');
  await run(['--check']);
  const pages = Number(await run(['--show-npages']));
  if (!Number.isInteger(pages) || pages < 1) throw new JobError('INVALID_PDF');
  if (pages > cap.maxPages) throw new JobError('PAGE_LIMIT_EXCEEDED');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path, { signal })) hash.update(chunk);
  return { bytes: size, pages, sha256: hash.digest('hex') };
}
