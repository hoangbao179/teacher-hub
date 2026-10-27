import { createHash, createHmac, randomBytes } from 'node:crypto';
import { pdfQueue, taskName, PdfCloudError, type PdfPayload, type PdfProvider } from './pdf-provider';
import type { GatewayIdToken } from './pdf-gateway-identity';
import { isPdfChunkJob, isPdfManifest, isPdfPart, pdfPartCount, pdfProgress, pdfChunkingEnabled,
  PDF_LONG_DOWNLOAD_MS, PDF_CHUNK_DISPATCH_SECONDS, PDF_CHUNK_PAGES, PDF_LONG_MAX_PAGES, PDF_LONG_OUTPUT_MAX_BYTES, type PdfChunkJob, type PdfJob, type PdfManifest, type PdfProgress } from '@teacher/shared';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const gateway = /^https:\/\/teacher-pdf-gateway-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/;
const worker = /^https:\/\/teacher-pdf-worker-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/;
const invoker = 'teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com';

/** Enable only after the live Gateway and Worker support long tasks. */
export function longPrintTasksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PDF_LONG_PRINT_TASKS_ENABLED === 'true';
}

export function gatewaySignature(key: Buffer, method: string, path: string, timestamp: string, nonce: string, body: Buffer) {
  return createHmac('sha256',key).update(['v1',method,path,timestamp,nonce,
    createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
}
export class GatewayPdfProvider implements PdfProvider {
  readonly configured: boolean;
  private queueReadyUntil = 0;
  private key: Buffer | null;
  constructor(private url: string, private workerURL: string, keyHex: string, approved = false,
    private idToken?: GatewayIdToken,
    private readonly authMode: 'iam_hmac_v1' | 'hmac_public_v1' = 'iam_hmac_v1',
    private readonly longPrintTasks = longPrintTasksEnabled(),
    readonly chunked = pdfChunkingEnabled(process.env)) {
    // Public HMAC is an explicit, review-approved opt-in. The default stays
    // IAM + HMAC, and a missing IAM token never downgrades authentication.
    this.configured = approved === true &&
      typeof url === 'string' && url.trim() === url && gateway.test(url) &&
      typeof workerURL === 'string' && workerURL.trim() === workerURL && worker.test(workerURL) &&
      typeof keyHex === 'string' && keyHex.length === 64 && /^[a-f0-9]{64}$/.test(keyHex) &&
      (authMode === 'hmac_public_v1' || (authMode === 'iam_hmac_v1' && typeof idToken === 'function'));
    this.key = this.configured ? Buffer.from(keyHex,'hex') : null;
  }
  private async call(method: 'GET'|'POST', path: string, body?: Buffer,
    parent?: AbortSignal, timeoutMs=5000): Promise<Response> {
    if (!this.configured || !this.key) throw new PdfCloudError();
    const signal = parent ? AbortSignal.any([parent,AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    const bytes = body ?? Buffer.alloc(0);
    const stamp = String(Math.floor(Date.now()/1000));
    const nonce = randomBytes(16).toString('hex');
    const sign = gatewaySignature(this.key,method,path,stamp,nonce,bytes);
    try {
      const token = this.authMode === 'iam_hmac_v1' ? await this.idToken!(signal) : undefined;
      if (this.authMode === 'iam_hmac_v1' &&
        (typeof token !== 'string' || !token || token.trim() !== token)) throw new PdfCloudError();
      const response=await fetch(this.url+path, {method,redirect:'error',signal,
        headers:{...(token ? {Authorization:`Bearer ${token}`} : {}),
          'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,'X-PDF-Signature':sign,
          ...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:new Uint8Array(body)}:{})});
      if(!response.ok && !(method==='GET'&&response.status===404) &&
        !(method==='POST'&&response.status===409)) {
        await response.body?.cancel();
        throw new PdfCloudError();
      }
      return response;
    } catch { throw new PdfCloudError(); }
  }
  private async json(r: Response): Promise<any> {
    if (!r.ok) { await r.body?.cancel(); throw new PdfCloudError(); }
    const chunks: Buffer[]=[]; let size=0;
    try {
      if(!r.body) throw new PdfCloudError();
      for await (const chunk of r.body) {
        size+=chunk.length; if(size>16384) throw new PdfCloudError();
        chunks.push(Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw new PdfCloudError(); }
  }
  async ready(signal?: AbortSignal) {
    if(this.chunked&&!this.longPrintTasks)return false;
    if(!this.configured||signal?.aborted)return false;
    if(Date.now()<this.queueReadyUntil)return true;
    try {
      const q=await this.json(await this.call('GET','/v1/queue',undefined,signal));
      const r=q.retryConfig, l=q.rateLimits;
      if(q.name!==pdfQueue||q.state!=='RUNNING'||r?.maxAttempts!==5||
        r.maxRetryDuration!=='3600s'||r.minBackoff!=='10s'||r.maxBackoff!=='300s'||
        l?.maxConcurrentDispatches!==1||!(l.maxDispatchesPerSecond>0&&l.maxDispatchesPerSecond<=1)||
        q.httpTarget)return false;
      if(this.chunked){
        const caps=await this.json(await this.call('GET','/v2/capabilities',undefined,signal));
        if(caps.version!==2||caps.maxPages!==PDF_LONG_MAX_PAGES||caps.maxBytes!==PDF_LONG_OUTPUT_MAX_BYTES||caps.chunkPages!==PDF_CHUNK_PAGES)return false;
      }
      this.queueReadyUntil=Date.now()+60000;
      return true;
    } catch {return false;}
  }
  async enqueue(payload: PdfPayload | PdfChunkJob, signal?: AbortSignal) {
    if(!uuid.test(payload.jobId)||!await this.ready(signal))throw new PdfCloudError();
    const v2 = payload.version === 2;
    if (v2 && (!this.chunked || !this.longPrintTasks || !isPdfChunkJob(payload))) throw new PdfCloudError();
    const body=Buffer.from(JSON.stringify({task:{
      name:taskName(payload.jobId)+(v2 ? '-s'+payload.step : ''),dispatchDeadline:this.longPrintTasks ? PDF_CHUNK_DISPATCH_SECONDS+'s' : '30s',httpRequest:{
        httpMethod:'POST',url:this.workerURL+'/jobs',
        headers:{'Content-Type':'application/json'},
        body:Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken:{serviceAccountEmail:invoker,audience:this.workerURL}
      }}}));
    const r=await this.call('POST','/v1/tasks',body,signal);
    let ok=r.ok;
    if (r.status===409) {
      try {
        const body=await r.json() as {error?:string};
        ok=body?.error==='TASK_ALREADY_EXISTS';
      } catch { ok=false; }
    } else await r.body?.cancel();
    if(!ok)throw new PdfCloudError();
  }
  private async object(id:string,name:'request.json'|'result.json',signal?:AbortSignal) {
    if(!uuid.test(id))throw new PdfCloudError();
    const r=await this.call('GET','/v1/objects/'+id+'/'+name,undefined,signal);
    if(r.status===404){await r.body?.cancel();return null;}
    return this.json(r);
  }
  async result(id:string,signal?:AbortSignal) {
    const result=await this.object(id,'result.json',signal);
    if(!result)return null;
    return {result,claim:await this.object(id,'request.json',signal)};
  }
  async progress(job: PdfJob, signal?: AbortSignal): Promise<PdfProgress> {
    signal=signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
    if (!this.chunked || job.workerVersion !== 2 || !uuid.test(job.id)) throw new PdfCloudError();
    const claim = await this.object(job.id,'request.json',signal);
    const sourceHash=createHash('sha256').update(JSON.stringify({provider:'google_drive',fileId:job.fileId})).digest('hex');
    if (!claim) return pdfProgress(null);
    if (claim.version!==1 || claim.sourceHash!==sourceHash || Date.parse(claim.expiresAt)-Date.parse(claim.createdAt)!==86400000 ||
      Date.parse(claim.createdAt)<Date.parse(job.createdAt)-60000 || Date.parse(claim.createdAt)>Date.now()+60000) throw new PdfCloudError();
    const read = async (name: string) => {
      const r=await this.call('GET','/v2/objects/'+job.id+'/'+name,undefined,signal);
      if(r.status===404){await r.body?.cancel();return null;} return this.json(r);
    };
    const manifest = await read('manifest.json');
    if (!manifest) return pdfProgress(null);
    if (!isPdfManifest(manifest,job.id,sourceHash,claim.expiresAt)) throw new PdfCloudError();
    const m: PdfManifest=manifest;
    let completed=job.progress?.totalPages===m.totalPages ? Math.ceil(job.progress.processedPages/PDF_CHUNK_PAGES) : 0;
    if (!Number.isInteger(completed) || completed<0 || completed>pdfPartCount(m.totalPages)) throw new PdfCloudError();
    const start=completed;
    // Bound each sweep below Gateway's read burst. Persisted prefix was validated on prior sweeps.
    for(let i=start+1;i<=Math.min(pdfPartCount(m.totalPages),start+5);i++) {
      const part=await read('parts/'+i+'.json');
      if(!part)break;
      if(!isPdfPart(part,m,i))throw new PdfCloudError();
      completed=i;
    }
    return pdfProgress(m,completed);
  }
  async task(id:string,signal?:AbortSignal,step?:number):Promise<'WAITING'|'MISSING'|'EXHAUSTED'> {
    if(!uuid.test(id))throw new PdfCloudError();
    const r=await this.call('GET',step === undefined ? '/v1/tasks/'+id : '/v2/tasks/'+id+'/'+step,undefined,signal);
    if(r.status===404){await r.body?.cancel();return 'MISSING';}
    const t=await this.json(r);
    if(t.name!==taskName(id)+(step === undefined ? '' : '-s'+step)||!Number.isInteger(t.responseCount??0)||!Number.isInteger(t.dispatchCount??0))throw new PdfCloudError();
    const first=Date.parse(t.firstAttempt?.dispatchTime);
    const dispatch=Date.parse(t.lastAttempt?.dispatchTime);
    const response=Date.parse(t.lastAttempt?.responseTime);
    const exhausted=(t.responseCount>=5&&t.dispatchCount===t.responseCount&&
      Number.isInteger(t.lastAttempt?.responseStatus?.code)&&t.lastAttempt.responseStatus.code>0&&
      t.lastAttempt.responseStatus.code<=16&&Number.isFinite(first)&&Number.isFinite(dispatch)&&
      Number.isFinite(response)&&first<=dispatch&&dispatch<=response&&
      Date.now()-response>=60000&&Date.now()-first>=3660000);
    if(!exhausted)return 'WAITING';
    const q=await this.json(await this.call('GET','/v1/queue',undefined,signal));
    return q.name===pdfQueue&&q.state==='RUNNING'&&q.retryConfig?.maxAttempts===5&&
      q.retryConfig.maxRetryDuration==='3600s'?'EXHAUSTED':'WAITING';
  }
  async open(id:string,signal:AbortSignal):Promise<AsyncIterable<Uint8Array>> {
    if(!uuid.test(id))throw new PdfCloudError();
    const r=await this.call('GET','/v1/objects/'+id+'/output.pdf',undefined,signal,this.chunked ? PDF_LONG_DOWNLOAD_MS : 30000);
    if(!r.ok||!r.body){await r.body?.cancel();throw new PdfCloudError();}
    return r.body as unknown as AsyncIterable<Uint8Array>;
  }
}
