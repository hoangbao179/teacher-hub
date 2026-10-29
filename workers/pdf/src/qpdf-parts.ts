import { execFile } from 'node:child_process';
import { JobError } from './contract.ts';
/** qpdf copies compressed streams from files; no image decoding or Node PDF buffering. */
export async function qpdfParts(inputs: { path: string; range?: string }[], output: string, signal: AbortSignal) {
  signal.throwIfAborted();
  // Final assembly handles up to 20 verified chunks; single-part extraction stays tightly bounded.
  const finalAssembly = inputs.length > 1;
  const wallMs = finalAssembly ? 90_000 : 30_000;
  const cpuSeconds = finalAssembly ? 80 : 25;
  const args = ['--as=536870912', `--cpu=${cpuSeconds}`, '--', 'qpdf', '--empty', '--stream-data=preserve', '--pages',
    ...inputs.flatMap(i=>[i.path, i.range ?? '1-z']), '--', output];
  await new Promise<void>((resolve, reject) => execFile('prlimit', args,
    {signal,timeout:wallMs,killSignal:'SIGKILL',maxBuffer:16384}, error => {
      if (!error) resolve();
      else reject(new JobError(signal.aborted || error.killed ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE', true));
    }));
}
