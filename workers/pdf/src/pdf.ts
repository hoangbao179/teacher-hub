import { execFile } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { JobError, type Limits } from './contract.ts';
import { PDF_OUTPUT_MAX_BYTES, PDF_MAX_PAGES, PDF_LONG_PARSER_CPU_SECONDS, PDF_LONG_PARSER_WALL_MS,
  PDF_FINAL_PARSER_CPU_SECONDS, PDF_FINAL_PARSER_WALL_MS, PDF_FINAL_PARSER_AS_BYTES } from '@teacher/shared';

/** The expanded budget only applies to strict qpdf --check on the finalized
 * chunk assembly, which has already been checked against immutable part hashes.
 * Keep all other parser runs bounded by their previous limits. */
export function pdfParserBudget(cap: Limits, operation: string, finalAssembly = false) {
  const large = cap.maxBytes > PDF_OUTPUT_MAX_BYTES || cap.maxPages > PDF_MAX_PAGES;
  const finalIntegrity = large && finalAssembly && operation === '--check';
  return {
    cpuSeconds: finalIntegrity ? PDF_FINAL_PARSER_CPU_SECONDS : large ? PDF_LONG_PARSER_CPU_SECONDS : 5,
    wallMs: finalIntegrity ? PDF_FINAL_PARSER_WALL_MS : large ? PDF_LONG_PARSER_WALL_MS : 6000,
    addressSpace: finalIntegrity ? PDF_FINAL_PARSER_AS_BYTES : 536870912,
  };
}

/** Fixed diagnostic reasons; do not include provider data or qpdf stderr. */
export function pdfParserFailureReason(operation: string, aborted: boolean, killed: boolean,
  signalName?: string | null) {
  const step = operation === '--is-encrypted' ? 'encryption' :
    operation === '--check' ? 'integrity' : 'page-count';
  if (aborted) return `parser-${step}-deadline`;
  if (killed) return `parser-${step}-wall-timeout`;
  if (signalName === 'SIGXCPU') return `parser-${step}-cpu-limit`;
  if (signalName === 'SIGKILL') return `parser-${step}-sigkill`;
  if (signalName === 'SIGSEGV') return `parser-${step}-sigsegv`;
  if (signalName) return `parser-${step}-signalled`;
  return undefined;
}

export async function validatePDF(path: string, cap: Limits, signal: AbortSignal,
  options: { finalAssembly?: boolean } = {}) {
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
    const budget=pdfParserBudget(cap,args[0],options.finalAssembly === true);
    execFile('prlimit', [`--as=${budget.addressSpace}`, `--cpu=${budget.cpuSeconds}`, '--', 'qpdf', ...args, path],
      { signal, timeout: budget.wallMs, killSignal: 'SIGKILL', maxBuffer: 16384, encoding: 'utf8' }, (error, stdout) => {
        // qpdf uses 0/2/3. Launcher failure (including qpdf missing behind prlimit)
        // is infrastructure failure, never evidence that the document is invalid.
        const unavailable = error && (error.code === 'ENOENT' || error.code === 'EACCES' ||
          (typeof error.code === 'number' && [1, 126, 127].includes(error.code)));
        if (error && typeof error.code === 'number' && allowedCodes.includes(error.code)) resolve(String(error.code));
        else if (error) {
          const timedOut=signal.aborted || error.killed || error.signal==='SIGXCPU';
          const interrupted=timedOut || !!error.signal;
          const reason=pdfParserFailureReason(args[0],signal.aborted,!!error.killed,error.signal);
          // SIGKILL may be a CPU hard-limit or OS memory kill; SIGSEGV may
          // indicate exhausted address space. Neither proves invalid PDF.
          reject(new JobError(timedOut ? 'TIMEOUT' :
            (unavailable || interrupted) ? 'SERVICE_UNAVAILABLE' : 'INVALID_PDF',
            !!interrupted || !!unavailable, reason));
        }
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
