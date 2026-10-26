import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { GatewayPdfProvider } from './pdf-gateway-provider';
import { pdfQueue } from './pdf-provider';
const GATEWAY='https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app';
const WORKER='https://teacher-pdf-worker-851777150171.asia-southeast1.run.app';
const payload={version:1 as const,jobId:'55b797f0-e128-4525-8df5-c3cb92163167',
 source:{provider:'google_drive' as const,fileId:'abcdefghijklmno'}};
function readyQueue(){
 return {name:pdfQueue,state:'RUNNING',
 rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1},
 retryConfig:{maxAttempts:5,maxRetryDuration:'3600s',minBackoff:'10s',maxBackoff:'300s'}};
}
test('HTTP 409 only means duplicate when explicit TASK_ALREADY_EXISTS; authorization failure rejects',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 for(const error of ['UNAUTHORIZED','NOT_FOUND','TASK_ALREADY_EXISTS']){
  const provider=new GatewayPdfProvider(GATEWAY,WORKER,'ab'.repeat(32),true,async()=> 'google-id-token');
  let creations=0;
  globalThis.fetch=async(input,init)=>{
   const url=String(input);
   assert.equal(init?.redirect,'error');
   assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer google-id-token');
   assert.match(String((init?.headers as Record<string,string>)['X-PDF-Signature']),/^[a-f0-9]{64}$/);
   if(url.endsWith('/v1/queue'))
     return new Response(JSON.stringify(readyQueue()),{status:200});
   if(url.endsWith('/v1/tasks')){
     creations++;
     return new Response(JSON.stringify({error}),{status:409});
   }
   throw Error('unexpected gateway route');
  };
  if(error==='TASK_ALREADY_EXISTS') await provider.enqueue(payload);
  else await assert.rejects(()=>provider.enqueue(payload),/PDF_CLOUD_UNAVAILABLE/);
  assert.equal(creations,1);
 }
});
test('provider fails closed on invalid gateway URL, key and approval',async()=>{
 const a=new GatewayPdfProvider(GATEWAY,WORKER,'ab'.repeat(32),false);
 const b=new GatewayPdfProvider('https://attacker.example.com',WORKER,'ab'.repeat(32),true);
 const c=new GatewayPdfProvider(GATEWAY,WORKER,'invalid',true);
 for(const provider of [a,b,c]){
  assert.equal(provider.configured,false);
  assert.equal(await provider.ready(),false);
  await assert.rejects(()=>provider.enqueue(payload),/PDF_CLOUD_UNAVAILABLE/);
 }
});
test('missing IAM supplier and failed token exchange cannot dispatch HMAC-only requests',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 globalThis.fetch=async()=>assert.fail('must not call Gateway without IAM identity');
 const missing=new GatewayPdfProvider(GATEWAY,WORKER,'ab'.repeat(32),true);
 assert.equal(missing.configured,false);
 const failed=new GatewayPdfProvider(GATEWAY,WORKER,'ab'.repeat(32),true,async()=>{throw Error('secret');});
 assert.equal(await failed.ready(),false);
 await assert.rejects(()=>failed.enqueue(payload),/PDF_CLOUD_UNAVAILABLE/);
});

test('explicit public-HMAC mode signs both reads and writes without Authorization header', async t => {
 const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
 const provider = new GatewayPdfProvider(GATEWAY, WORKER, 'ab'.repeat(32), true, undefined, 'hmac_public_v1');
 assert.equal(provider.configured, true);
 let seen = 0;
 globalThis.fetch = async (input, init) => {
  const route = new URL(String(input)).pathname;
  const headers = init?.headers as Record<string, string>;
  assert.equal(Object.hasOwn(headers, 'Authorization'), false);
  assert.equal(Object.hasOwn(headers, 'authorization'), false);
  const timestamp = headers['X-PDF-Timestamp'], nonce = headers['X-PDF-Nonce'];
  assert.match(timestamp, /^[1-9][0-9]{9}$/);
  assert.match(nonce, /^[a-f0-9]{32}$/);
  const bytes = init?.body ? Buffer.from(init.body as Uint8Array) : Buffer.alloc(0);
  const canonical = ['v1', String(init?.method), route, timestamp, nonce,
    createHash('sha256').update(bytes).digest('hex')].join('\n');
  assert.equal(headers['X-PDF-Signature'],
    createHmac('sha256', Buffer.from('ab'.repeat(32), 'hex')).update(canonical).digest('hex'));
  seen++;
  if (route === '/v1/queue') return Response.json(readyQueue());
  assert.equal(route, '/v1/tasks');
  assert.equal(init?.method, 'POST');
  return new Response('{}', {status: 200});
 };
 assert.equal(await provider.ready(), true);
 await provider.enqueue(payload);
 assert.equal(seen, 2);
 const unapproved = new GatewayPdfProvider(GATEWAY, WORKER, 'ab'.repeat(32), false, undefined, 'hmac_public_v1');
 assert.equal(unapproved.configured, false);
 assert.equal(await unapproved.ready(), false);
});

test('IAM mode rejects an empty token before sending a signed request', async t => {
 const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
 let calls = 0;
 globalThis.fetch = async () => { calls++; return Response.json(readyQueue()); };
 const provider = new GatewayPdfProvider(GATEWAY, WORKER, 'ab'.repeat(32), true, async () => '');
 assert.equal(await provider.ready(), false);
 await assert.rejects(() => provider.task(payload.jobId), /PDF_CLOUD_UNAVAILABLE/);
 assert.equal(calls, 0);
});

test('long print tasks require explicit true; missing and false keep 30s',async t=>{
 const original=globalThis.fetch;
 const previous=process.env.PDF_LONG_PRINT_TASKS_ENABLED;
 t.after(()=>{
  globalThis.fetch=original;
  if(previous===undefined) delete process.env.PDF_LONG_PRINT_TASKS_ENABLED;
  else process.env.PDF_LONG_PRINT_TASKS_ENABLED=previous;
 });
 const deadlines:string[]=[];
 globalThis.fetch=async (input,init)=>{
  const url=String(input);
  if(url.endsWith('/v1/queue'))return Response.json(readyQueue());
  if(url.endsWith('/v1/tasks')) {
   const request=JSON.parse(Buffer.from(init?.body as Uint8Array).toString('utf8'));
   deadlines.push(request.task.dispatchDeadline);
   return Response.json({name:'accepted'});
  }
  throw Error('unrecognized URL');
 };
 const args=[GATEWAY,WORKER,'ab'.repeat(32),true,undefined,'hmac_public_v1'] as const;
 delete process.env.PDF_LONG_PRINT_TASKS_ENABLED;
 await new GatewayPdfProvider(...args).enqueue(payload);
 process.env.PDF_LONG_PRINT_TASKS_ENABLED='true';
 await new GatewayPdfProvider(...args).enqueue(payload);
 process.env.PDF_LONG_PRINT_TASKS_ENABLED='false';
 await new GatewayPdfProvider(...args).enqueue(payload);
 assert.deepEqual(deadlines,['30s','180s','30s']);
});
