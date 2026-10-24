import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { BUCKET, JobError } from './contract.ts';

export interface Stored { metadata: Record<string, string>; generation: string }
export interface Store {
  ready(signal: AbortSignal): Promise<void>;
  json<T>(name: string, signal: AbortSignal): Promise<T | null>;
  head(name: string, signal: AbortSignal): Promise<Stored | null>;
  create(name: string, body: { json: unknown } | { path: string; metadata: Record<string, string> }, signal: AbortSignal): Promise<boolean>;
}
export async function boundedJSON<T>(response: Response, max = 16384): Promise<T> {
  let bytes = 0;
  const parts: Uint8Array[] = [];
  if (!response.body) throw new JobError('STORAGE_UNAVAILABLE', true);
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > max) throw new JobError('STORAGE_UNAVAILABLE', true);
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8')) as T;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
// Small GCS REST adapter: built-in fetch provides one shared abort deadline, no hidden retries.
// Runtime credentials come only from Cloud Run's fixed metadata endpoint, never request input.
export class GCSStore implements Store {
  private token = '';
  private base = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;
  async ready(signal: AbortSignal) {
    const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }, signal, redirect: 'error' });
    if (!r.ok || r.headers.get('metadata-flavor') !== 'Google') {
      await r.body?.cancel(); throw new JobError('SERVICE_UNAVAILABLE', true);
    }
    this.token = (await boundedJSON<{ access_token: string }>(r)).access_token;
    if (!this.token) throw new JobError('SERVICE_UNAVAILABLE', true);
    const permissions = ['storage.objects.get', 'storage.objects.create'];
    const query = new URLSearchParams(permissions.map(p => ['permissions', p]));
    const probe = await this.call(`${this.base}/iam/testPermissions?${query}`, { signal });
    const granted = await boundedJSON<{ permissions?: string[] }>(probe);
    if (!permissions.every(p => granted.permissions?.includes(p))) throw new JobError('SERVICE_UNAVAILABLE', true);
  }
  private async call(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, { ...init, redirect: 'error',
      headers: { ...init.headers, Authorization: `Bearer ${this.token}` } });
    if (!response.ok && ![404, 412].includes(response.status)) {
      await response.body?.cancel();
      throw new JobError(response.status === 403 || response.status === 401 ? 'SERVICE_UNAVAILABLE' : 'STORAGE_UNAVAILABLE', true);
    }
    return response;
  }
  async json<T>(name: string, signal: AbortSignal): Promise<T | null> {
    const r = await this.call(`${this.base}/o/${encodeURIComponent(name)}?alt=media`, { signal });
    if (r.status === 404) { await r.body?.cancel(); return null; }
    return boundedJSON<T>(r);
  }
  async head(name: string, signal: AbortSignal): Promise<Stored | null> {
    const r = await this.call(`${this.base}/o/${encodeURIComponent(name)}?fields=metadata,generation`, { signal });
    if (r.status === 404) { await r.body?.cancel(); return null; }
    return boundedJSON<Stored>(r);
  }
  async create(name: string, body: { json: unknown } | { path: string; metadata: Record<string, string> }, signal: AbortSignal) {
    const boundary = `pdf-${randomUUID()}`;
    const metadata = { name, contentType: 'json' in body ? 'application/json' : 'application/pdf',
      cacheControl: 'private, no-store', ...('metadata' in body ? { metadata: body.metadata } : {}) };
    async function* multipart() {
      yield Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.contentType}\r\n\r\n`);
      if ('json' in body) yield Buffer.from(JSON.stringify(body.json));
      else yield* createReadStream(body.path, { signal });
      yield Buffer.from(`\r\n--${boundary}--\r\n`);
    }
    const stream = Readable.from(multipart());
    try {
      const r = await this.call(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart&ifGenerationMatch=0`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: stream as unknown as BodyInit, duplex: 'half', signal } as RequestInit);
      const created = r.ok;
      await r.body?.cancel();
      return created;
    } finally { stream.destroy(); }
  }
}
