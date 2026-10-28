import { dispositionFilename } from './filename.ts';
import { request } from 'node:https';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { IncomingMessage } from 'node:http';
import { JobError, type Limits } from './contract.ts';

// Deliberately narrow: no arbitrary Google subdomains, login, viewer or native-doc export.
export function sourceURL(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new JobError('UNSUPPORTED_SOURCE', false, 'redirect-policy'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
    !['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname) ||
    (url.hostname === 'drive.google.com' ? url.pathname !== '/uc' : url.pathname !== '/download')) {
    throw new JobError('UNSUPPORTED_SOURCE', false, 'redirect-policy');
  }
  return url;
}
export function publicAddress(address: string): boolean {
  // IPv4 only: refusing IPv6 avoids mapped/NAT64/zone and transition-address ambiguities.
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export type OpenSource = (url: URL, signal: AbortSignal) => Promise<IncomingMessage>;
export const openSource: OpenSource = async (url, signal) => {
  sourceURL(url.href);
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const cancel = () => resolver.cancel();
  signal.throwIfAborted();
  signal.addEventListener('abort', cancel, { once: true });
  let addresses: string[];
  try { addresses = await resolver.resolve4(url.hostname); }
  finally { signal.removeEventListener('abort', cancel); }
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(a => !publicAddress(a))) throw new JobError('UNSUPPORTED_SOURCE', false, 'redirect-policy');
  // Pin the validated address in the actual TLS connection; SNI/cert validation retain hostname.
  return new Promise((resolve, reject) => {
    const req = request(url, { signal, agent: false, family: 4,
      lookup: (_hostname, _options, callback) => callback(null, addresses[0], 4),
      headers: { Accept: 'application/pdf', 'Accept-Encoding': 'identity' } }, resolve);
    req.on('error', reject);
    req.end();
  });
};
export async function download(fileId: string, path: string, cap: Limits, signal: AbortSignal, open = openSource): Promise<string | null | void> {
  let url = sourceURL(`https://drive.google.com/uc?export=download&id=${fileId}`);
  for (let redirects = 0; ; redirects++) {
    signal.throwIfAborted();
    const response = await open(url, signal);
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.destroy();
      if (!location || redirects >= cap.redirects) throw new JobError('UNSUPPORTED_SOURCE', false, 'redirect-limit');
      let next: URL;
      try { next = new URL(location, url); } catch { throw new JobError('UNSUPPORTED_SOURCE', false, 'redirect-policy'); }
      if (next.hostname === 'accounts.google.com') throw new JobError('ACCESS_DENIED', false, 'login-redirect');
      url = sourceURL(next.href);
      continue;
    }
    if (status !== 200) {
      response.destroy();
      if ([401, 403, 404].includes(status)) throw new JobError('ACCESS_DENIED', false, 'http-access');
      throw new JobError(status === 429 || status >= 500 ? 'SOURCE_UNAVAILABLE' : 'UNSUPPORTED_SOURCE', status === 429 || status >= 500, 'http-status');
    }
    const length = response.headers['content-length'];
    if ((length && (!/^\d+$/.test(length) || Number(length) > cap.maxBytes)) ||
      (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
      response.destroy();
      throw new JobError('FILE_TOO_LARGE', false, 'direct-download-bytes', { limitBytes: cap.maxBytes });
    }
    let bytes = 0;
    const bound = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > cap.maxBytes
        ? new JobError('FILE_TOO_LARGE', false, 'direct-download-bytes',
          { usedBytes: bytes, limitBytes: cap.maxBytes }) : null, chunk);
    } });
    await pipeline(response, bound, createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal });
    return dispositionFilename(response.headers['content-disposition']);
  }
}
