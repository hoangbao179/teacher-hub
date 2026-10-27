import { PDF_OUTPUT_MAX_BYTES } from '../../../shared/dist/esm/pdf-limits.js';
import { PDF_LONG_OUTPUT_MAX_BYTES, PDF_LONG_DOWNLOAD_MS, PDF_MAX_STEPS, PDF_CHUNK_DISPATCH_SECONDS, PDF_LONG_MAX_PAGES, PDF_CHUNK_PAGES } from '../../../shared/dist/esm/pdf-limits.js';
import { isPdfChunkJob, pdfChunkingEnabled } from '../../../shared/dist/esm/pdf-pipeline.js';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const QUEUE = 'projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue';
const BUCKET = 'teacher-hub-pdf-results-2026';
const INVOKER = 'teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const TASK = new RegExp('^/v1/tasks/(' + UUID + ')$');
const OBJECT = new RegExp('^/v1/objects/(' + UUID + ')/(request\\.json|result\\.json|output\\.pdf)$');
const WORKER_URL = /^https:\/\/teacher-pdf-worker-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/;
const digest = b => createHash('sha256').update(b).digest('hex');
const ERROR = JSON.stringify({ error: 'PDF_GATEWAY_UNAVAILABLE' });
const FORBIDDEN = JSON.stringify({ error: 'UNAUTHORIZED' });

function longPrintTasksEnabled(env) {
  return env.PDF_LONG_PRINT_TASKS_ENABLED === 'true';
}

export function signature(key, method, path, timestamp, nonce, body) {
  const data = ['v1', method, path, timestamp, nonce, digest(body)].join('\n');
  return createHmac('sha256', key).update(data).digest('hex');
}

export function route(method, path, body, workerURL, longPrintTasks = false, chunked = false) {
  if (method==='GET' && path==='/v2/capabilities' && chunked && longPrintTasks)
    return {local:{version:2,maxPages:PDF_LONG_MAX_PAGES,maxBytes:PDF_LONG_OUTPUT_MAX_BYTES,chunkPages:PDF_CHUNK_PAGES},method};
  if (chunked && method === 'GET') {
    const task = path.match(new RegExp('^/v2/tasks/('+UUID+')/(\\d{1,2})$'));
    if (task && Number(task[2]) <= PDF_MAX_STEPS) return {url:'https://cloudtasks.googleapis.com/v2/'+QUEUE+'/tasks/pdf-'+task[1]+'-s'+Number(task[2]),method};
    const object = path.match(new RegExp('^/v2/objects/('+UUID+')/(manifest\\.json|parts/([1-9][0-9]?)\\.json)$'));
    if (object && (!object[3] || Number(object[3])<=Math.ceil(PDF_LONG_MAX_PAGES/PDF_CHUNK_PAGES))) return {url:'https://storage.googleapis.com/storage/v1/b/'+BUCKET+'/o/'+encodeURIComponent('jobs/'+object[1]+'/'+object[2])+'?alt=media',method};
  }
  if (method === 'GET' && path === '/v1/queue')
    return { url: 'https://cloudtasks.googleapis.com/v2/' + QUEUE, method };
  if (method === 'POST' && path === '/v1/tasks') {
    // Exact Cloud Tasks schema. No caller-selected target, queue or invoker.
    let data;
    try { data = JSON.parse(body.toString('utf8')); } catch { return null; }
    const task = data?.task;
    const request = task?.httpRequest;
    if (!data || Object.keys(data).join(',') !== 'task' || !task ||
      Object.keys(task).sort().join(',') !== 'dispatchDeadline,httpRequest,name' ||
      !request || Object.keys(request).sort().join(',') !== 'body,headers,httpMethod,oidcToken,url' ||
      typeof task.name !== 'string' ||
      !new RegExp('^' + QUEUE + '/tasks/pdf-' + UUID + (chunked ? '(?:-s[0-9]{1,2})?' : '') + '$').test(task.name) ||
      !(task.dispatchDeadline === '30s' ||
        (longPrintTasks === true && task.dispatchDeadline === '180s')) ||
      request.httpMethod !== 'POST' ||
      request.url !== workerURL + '/jobs' ||
      JSON.stringify(request.headers) !== '{"Content-Type":"application/json"}' ||
      JSON.stringify(request.oidcToken) !== JSON.stringify({ serviceAccountEmail: INVOKER, audience: workerURL }) ||
      typeof request.body !== 'string' || request.body.length > 5500 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(request.body)) return null;
    const bytes = Buffer.from(request.body, 'base64');
    if (bytes.length > 4096 || bytes.toString('base64') !== request.body) return null;
    let payload;
    try { payload = JSON.parse(bytes.toString('utf8')); } catch { return null; }
    if (chunked && longPrintTasks && isPdfChunkJob(payload) && task.dispatchDeadline === PDF_CHUNK_DISPATCH_SECONDS+'s' &&
      task.name === QUEUE+'/tasks/pdf-'+payload.jobId+'-s'+payload.step)
      return {url:'https://cloudtasks.googleapis.com/v2/'+QUEUE+'/tasks',method,body,contentType:'application/json'};
    if (!payload || Object.keys(payload).sort().join(',') !== 'jobId,source,version' ||
      payload.version !== 1 || typeof payload.jobId !== 'string' ||
      !new RegExp('^'+UUID+'$').test(payload.jobId) ||
      !payload.source || Object.keys(payload.source).sort().join(',') !== 'fileId,provider' ||
      payload.source.provider !== 'google_drive' ||
      typeof payload.source.fileId !== 'string' ||
      !/^[A-Za-z0-9_-]{10,128}$/.test(payload.source.fileId) ||
      task.name !== QUEUE + '/tasks/pdf-' + payload.jobId) return null;
    return { url: 'https://cloudtasks.googleapis.com/v2/' + QUEUE + '/tasks',
      method, body, contentType: 'application/json' };
  }
  const task = method === 'GET' && path.match(TASK);
  if (task) return { url: 'https://cloudtasks.googleapis.com/v2/' + QUEUE + '/tasks/pdf-' + task[1], method };
  const object = method === 'GET' && path.match(OBJECT);
  if (object) return { url: 'https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o/' +
      encodeURIComponent('jobs/' + object[1] + '/' + object[2]) + '?alt=media',
    method, binary: object[2] === 'output.pdf' };
  return null;
}

function onceBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    const chunks = []; let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > limit) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); }
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readLimited(response, limit) {
  const chunks = []; let size=0;
  if (!response.body) throw new Error('EMPTY_UPSTREAM');
  for await(const value of response.body) {
    size += value.length;
    if (size > limit) throw new Error('UPSTREAM_TOO_LARGE');
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function createGatewayServer({
  env = process.env, fetcher = fetch, now = () => Date.now(),
  // Injectable only through trusted server construction (tests), never HTTP/env.
  deadlines = { ordinary: 8000, download: pdfChunkingEnabled(env) ? PDF_LONG_DOWNLOAD_MS : 25000 },
} = {}) {
  const enabled = env.PDF_GATEWAY_ENABLED === 'true';
  const keyHex = env.PDF_GATEWAY_HMAC_KEY ?? '';
  const workerURL = env.PDF_GATEWAY_WORKER_URL ?? '';
  const configured = enabled && /^[a-f0-9]{64}$/.test(keyHex) && WORKER_URL.test(workerURL);
  const key = configured ? Buffer.from(keyHex, 'hex') : null;
  // Per-instance budget is defense in depth. Operator must also cap Cloud Run
  // instances and monitor billable upstream requests.
  const budgets = new Map();
  let activeStreams = 0;
  function admit(kind, at) {
    const limits = { enqueue: [5, 20], download: [2, 10], read: [10, 120] };
    const [burst, perMinute] = limits[kind];
    const old = budgets.get(kind) ?? { tokens: burst, at };
    const tokens = Math.min(burst, old.tokens + Math.max(0, at-old.at)*perMinute/60000);
    if (tokens < 1) { budgets.set(kind, { tokens, at }); return false; }
    budgets.set(kind, { tokens: tokens-1, at }); return true;
  }

  return createServer({ requestTimeout: 8000, headersTimeout: 8000, maxHeaderSize: 8192 }, async(req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const reply = (code, payload) => {
      if (res.destroyed) return;
      res.writeHead(code,{ 'Content-Type':'application/json; charset=utf-8' });
      res.end(payload);
    };
    if (req.url==='/health' && (req.method==='GET'||req.method==='HEAD')) {
      res.writeHead(200,{ 'Content-Type':'application/json' });
      res.end(req.method==='HEAD'?undefined:JSON.stringify({ status: 'ok' }));
      return;
    }
    if (!configured) { reply(503,ERROR); return; }
    if (!req.url || req.url.includes('?') || !req.method) { reply(404,ERROR); return; }
    if (!(req.method === 'POST' && req.url === '/v1/tasks') &&
      !(req.method === 'GET' && (req.url==='/v1/queue' || TASK.test(req.url) || OBJECT.test(req.url) ||
        (pdfChunkingEnabled(env) && route('GET',req.url,Buffer.alloc(0),workerURL,true,true))))) {
      reply(404,ERROR); return;
    }
    let body;
    try { body = await onceBody(req); } catch { if (!res.destroyed) reply(413,ERROR); return; }
    if (req.method === 'GET' && body.length !== 0) { reply(400,ERROR); return; }
    const timestamp = req.headers['x-pdf-timestamp'];
    const nonce = req.headers['x-pdf-nonce'];
    const received = req.headers['x-pdf-signature'];
    if (typeof timestamp !== 'string' || !/^[1-9][0-9]{9}$/.test(timestamp) ||
      Math.abs(Math.floor(now()/1000) - Number(timestamp)) > 60 ||
      typeof nonce !== 'string' || !/^[a-f0-9]{32}$/.test(nonce) ||
      typeof received !== 'string' || !/^[a-f0-9]{64}$/.test(received)) {
      reply(401,FORBIDDEN); return;
    }
    const expected = signature(key,req.method,req.url,timestamp,nonce,body);
    if (!timingSafeEqual(Buffer.from(received,'hex'),Buffer.from(expected,'hex'))) {
      reply(401,FORBIDDEN); return;
    }
    const target = route(req.method,req.url,body,workerURL,
      longPrintTasksEnabled(env),pdfChunkingEnabled(env));
    if (!target) { reply(400,ERROR); return; }
    const kind = req.method==='POST' ? 'enqueue' : target.binary ? 'download' : 'read';
    if (target.binary && activeStreams >= 1) { reply(429,ERROR); return; }
    if (!admit(kind,now())) { reply(429,ERROR); return; }
    if (target.binary) activeStreams++;
    const deadline = AbortSignal.timeout(target.binary ? deadlines.download : deadlines.ordinary);
    const disconnected = new AbortController();
    const onClose = () => { if (!res.writableFinished) disconnected.abort(); };
    res.once('close',onClose);
    const signal = AbortSignal.any([deadline,disconnected.signal]);
    try {
      // Only workload metadata may mint the token. User input cannot choose
      // a service account or API destination.
      const meta = await fetcher('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
        headers:{ 'Metadata-Flavor':'Google' }, signal, redirect:'error' });
      if (!meta.ok || meta.headers.get('metadata-flavor') !== 'Google') {
        await meta.body?.cancel(); throw new Error('METADATA_UNAVAILABLE');
      }
      const raw = await readLimited(meta,2048);
      const token = JSON.parse(raw.toString('utf8')).access_token;
      if (typeof token!=='string' || !/^[A-Za-z0-9._~+/-]{20,4096}$/.test(token)) throw new Error('INVALID_TOKEN');
      // Atomic, durable replay reservation. Shared across instances and restarts;
      // existing private bucket's lifecycle removes old reservations eventually.
      // Gateway identity must only have objects.create on gateway-nonces/ prefix.
      const noncePath = 'gateway-nonces/' + digest(nonce);
      const reserve = await fetcher('https://storage.googleapis.com/upload/storage/v1/b/' + BUCKET +
        '/o?uploadType=media&name=' + encodeURIComponent(noncePath) + '&ifGenerationMatch=0', {
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},
        body: '1',signal,redirect:'error'
      });
      if (reserve.status===412) {
        await reserve.body?.cancel();
        reply(401,FORBIDDEN); return;
      }
      if (!reserve.ok) { await reserve.body?.cancel(); throw new Error('NONCE_STORAGE_UNAVAILABLE'); }
      await reserve.body?.cancel();
      if (target.local) { reply(200,JSON.stringify(target.local)); return; }
      const response = await fetcher(target.url, {
        method:target.method, headers:{ Authorization:'Bearer '+token,
          ...(target.contentType?{'Content-Type':target.contentType}:{}) },
        ...(target.body?{body:target.body}:{}), signal, redirect:'error'
      });
      if (!(response.ok || (req.method==='GET' && response.status===404) ||
        (req.method==='POST' && response.status===409))) {
        await response.body?.cancel(); throw new Error('UPSTREAM_UNAVAILABLE');
      }
      if (response.status===404) {
        await response.body?.cancel();
        reply(404,JSON.stringify({error:'NOT_FOUND'})); return;
      }
      if (response.status===409) {
        // Google Cloud Tasks can return a Conflict for reasons other than an
        // existing task. Only the canonical ALREADY_EXISTS status is safe to
        // interpret as successful idempotent creation.
        if (req.method !== 'POST' || !target.url.endsWith('/tasks')) {
          await response.body?.cancel();
          throw new Error('UNEXPECTED_CONFLICT');
        }
        const conflict = JSON.parse((await readLimited(response,4096)).toString('utf8'));
        if (conflict?.error?.code !== 409 || conflict.error.status !== 'ALREADY_EXISTS')
          throw new Error('AMBIGUOUS_CONFLICT');
        reply(409,JSON.stringify({error:'TASK_ALREADY_EXISTS'})); return;
      }
      if (target.binary) {
        if (!response.body) throw new Error('EMPTY_PDF');
        let total=0;
        const limiter = new Transform({
          transform(chunk, _encoding, next) {
            total += chunk.length;
            if (total > (pdfChunkingEnabled(env) ? PDF_LONG_OUTPUT_MAX_BYTES : PDF_OUTPUT_MAX_BYTES)) next(new Error('PDF_TOO_LARGE'));
            else next(null,chunk);
          }
        });
        res.writeHead(200,{ 'Content-Type':'application/pdf' });
        // pipeline cancels pending backpressure/drain and disposes the upstream
        // stream on client disconnect, deadline, truncation and size violation.
        await pipeline(Readable.fromWeb(response.body),limiter,res,{ signal });
      } else {
        const data=await readLimited(response,16384);
        JSON.parse(data.toString('utf8')); // never forward HTML/error pages
        res.writeHead(200,{ 'Content-Type':'application/json; charset=utf-8' });
        res.end(data);
      }
    } catch {
      // Never expose tokens, Google diagnostics, source IDs or raw IAM errors.
      if (!res.headersSent && !res.destroyed) reply(503,ERROR);
      else res.destroy();
    } finally {
      if (target.binary) activeStreams--;
      res.off('close',onClose);
    }
  });
}

export function startGateway(port=process.env.PORT??'8080') {
  if (!/^\d+$/.test(String(port)) || Number(port)<1 || Number(port)>65535) throw Error('INVALID_PORT');
  const server=createGatewayServer();
  server.listen(Number(port),process.env.K_SERVICE?'0.0.0.0':'127.0.0.1');
  const shutdown=()=>server.close(()=>process.exit(0));
  process.once('SIGTERM',shutdown);
  return server;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) startGateway();
