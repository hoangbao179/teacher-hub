
export const pdfQueue = 'projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue';
export const pdfBucket = 'teacher-hub-pdf-results-2026';
export interface PdfPayload { version: 1; jobId: string; source: { provider: 'google_drive'; fileId: string } }
export const taskName = (id: string) => `${pdfQueue}/tasks/pdf-${id}`;
export class PdfCloudError extends Error { constructor() { super('PDF_CLOUD_UNAVAILABLE'); } }
export interface PdfProvider {
  readonly configured: boolean;
  ready(): Promise<boolean>;
  enqueue(payload: PdfPayload): Promise<void>;
  result(id: string): Promise<{ claim: unknown; result: unknown } | null>;
  task(id: string): Promise<'WAITING' | 'MISSING' | 'EXHAUSTED'>;
  open(id: string, signal: AbortSignal): Promise<AsyncIterable<Uint8Array>>;
}
export class DisabledPdfProvider implements PdfProvider {
  readonly configured = false;
  async ready() { return false; }
  async enqueue(): Promise<void> { throw new PdfCloudError(); }
  async result(): Promise<null> { throw new PdfCloudError(); }
  async task(): Promise<'MISSING'> { throw new PdfCloudError(); }
  async open(): Promise<AsyncIterable<Uint8Array>> { throw new PdfCloudError(); }
}
export interface VerifiedPdfIdentity {
  readonly kind: 'external_workload'; readonly verified: true;
  accessToken(signal: AbortSignal): Promise<string>;
}
async function json(response: Response): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new PdfCloudError();
  const parts: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > 16384) throw new PdfCloudError(); parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
/** Not wired to production: independently approved token acquisition is still missing. */
export class RestPdfProvider implements PdfProvider {
  readonly configured: boolean;
  private readyUntil = 0;
  constructor(private identity: VerifiedPdfIdentity | null, private baseURL: string, approved = false) {
    this.configured = approved && identity?.kind === 'external_workload' && identity.verified === true &&
      /^https:\/\/teacher-pdf-worker-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/.test(baseURL);
  }
  private async call(url: string, init: RequestInit = {}, signal = AbortSignal.timeout(4000)) {
    if (!this.configured || !this.identity) throw new PdfCloudError();
    try {
      let cancel: (() => void) | undefined;
      const token = await Promise.race([this.identity.accessToken(signal),new Promise<never>((_resolve,reject) => {
        cancel=() => reject(new PdfCloudError()); signal.addEventListener('abort',cancel,{once:true});
        if(signal.aborted) cancel();
      })]).finally(() => { if(cancel) signal.removeEventListener('abort',cancel); });
      signal.throwIfAborted();
      const response = await fetch(url, { ...init, signal, redirect: 'error',
        headers: { ...init.headers, Authorization: `Bearer ${token}` } });
      if (!response.ok && ![404, 409].includes(response.status)) { await response.body?.cancel(); throw new PdfCloudError(); }
      return response;
    } catch { throw new PdfCloudError(); }
  }
  async ready() {
    if (!this.configured) return false;
    if (Date.now() < this.readyUntil) return true;
    try {
      const r = await this.call(`https://cloudtasks.googleapis.com/v2/${pdfQueue}`);
      const q = await json(r);
      const retry = q.retryConfig; const rate = q.rateLimits;
      if (q.name !== pdfQueue || q.state !== 'RUNNING' || retry?.maxAttempts !== 5 ||
        retry.maxRetryDuration !== '3600s' || retry.minBackoff !== '10s' || retry.maxBackoff !== '300s' ||
        !rate || rate.maxConcurrentDispatches !== 1 || typeof rate.maxDispatchesPerSecond !== 'number' ||
        !Number.isFinite(rate.maxDispatchesPerSecond) || rate.maxDispatchesPerSecond > 1 || rate.maxDispatchesPerSecond <= 0 ||
        q.httpTarget) return false;
      this.readyUntil = Date.now() + 60000; return true;
    } catch { return false; }
  }
  async enqueue(payload: PdfPayload) {
    if (!await this.ready()) throw new PdfCloudError();
    const r = await this.call(`https://cloudtasks.googleapis.com/v2/${pdfQueue}/tasks`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: {
        name: taskName(payload.jobId), dispatchDeadline: '30s', httpRequest: { httpMethod: 'POST',
          url: `${this.baseURL}/jobs`, headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          oidcToken: { serviceAccountEmail: 'teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com', audience: this.baseURL } } } }) });
    const ok = r.ok || r.status === 409; await r.body?.cancel(); if (!ok) throw new PdfCloudError();
  }
  private async object(id: string, name: 'request.json' | 'result.json') {
    const r = await this.call(`https://storage.googleapis.com/storage/v1/b/${pdfBucket}/o/${encodeURIComponent(`jobs/${id}/${name}`)}?alt=media`);
    if (r.status === 404) { await r.body?.cancel(); return null; } return json(r);
  }
  async result(id: string) {
    const result = await this.object(id, 'result.json'); if (!result) return null;
    return { result, claim: await this.object(id, 'request.json') };
  }
  async task(id: string): Promise<'WAITING' | 'MISSING' | 'EXHAUSTED'> {
    const r = await this.call(`https://cloudtasks.googleapis.com/v2/${taskName(id)}`);
    if (r.status === 404) { await r.body?.cancel(); return 'MISSING'; }
    const task = await json(r);
    if (task.name !== taskName(id) || !Number.isInteger(task.responseCount ?? 0) || !Number.isInteger(task.dispatchCount ?? 0)) throw new PdfCloudError();
    const first = Date.parse(task.firstAttempt?.dispatchTime);
    return task.responseCount >= 5 && task.dispatchCount === task.responseCount &&
      Number.isFinite(Date.parse(task.lastAttempt?.responseTime)) && task.lastAttempt?.responseStatus?.code > 0 &&
      Number.isFinite(first) && Date.now() - first >= 3600000 ? 'EXHAUSTED' : 'WAITING';
  }
  async open(id: string, signal: AbortSignal) {
    const r = await this.call(`https://storage.googleapis.com/storage/v1/b/${pdfBucket}/o/${encodeURIComponent(`jobs/${id}/output.pdf`)}?alt=media`, {}, signal);
    if (!r.ok || !r.body) { await r.body?.cancel(); throw new PdfCloudError(); }
    return r.body as unknown as AsyncIterable<Uint8Array>;
  }
}
