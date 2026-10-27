import test from 'node:test';
import assert from 'node:assert/strict';
import { PDF_OUTPUT_MAX_BYTES } from '../../shared/dist/esm/pdf-limits.js';
import { createGatewayServer, route, signature } from './src/server.mjs';

const WORKER = 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app';
const QUEUE = 'projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue';
const ID='55b797f0-e128-4525-8df5-c3cb92163167';
const KEY = 'ab'.repeat(32);
const body=Buffer.from(JSON.stringify({task:{name:QUEUE+'/tasks/pdf-'+ID,dispatchDeadline:'30s',httpRequest:{
  httpMethod:'POST',url:WORKER+'/jobs',headers:{'Content-Type':'application/json'},
  body:Buffer.from(JSON.stringify({version:1,jobId:ID,source:{provider:'google_drive',fileId:'abcdefghijklmno'}})).toString('base64'),
  oidcToken:{serviceAccountEmail:'teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com',audience:WORKER}
}}}));
test('restrict upstream routes and exact task contract',()=>{
  assert.equal(route('POST','/v1/tasks',body,WORKER)?.method,'POST');
  assert.equal(route('GET','/v1/queue',Buffer.alloc(0),WORKER)?.method,'GET');
  assert.equal(route('GET','/v1/objects/'+ID+'/output.pdf',Buffer.alloc(0),WORKER)?.binary,true);
  assert.equal(route('POST','/v1/objects/'+ID+'/output.pdf',Buffer.alloc(0),WORKER),null);
  assert.equal(route('GET','/v1/objects/'+ID+'/../../secrets',Buffer.alloc(0),WORKER),null);
  const forged=JSON.parse(body);forged.task.httpRequest.url='https://attacker.invalid/jobs';
  assert.equal(route('POST','/v1/tasks',Buffer.from(JSON.stringify(forged)),WORKER),null);
  forged.task.httpRequest.url=WORKER+'/jobs';forged.task.httpRequest.oidcToken.serviceAccountEmail='admin@example.com';
  assert.equal(route('POST','/v1/tasks',Buffer.from(JSON.stringify(forged)),WORKER),null);
});
test('long print-task dispatch deadline requires explicit server-side gate',()=>{
 const long = JSON.parse(body.toString('utf8'));
 long.task.dispatchDeadline = '180s';
 const bytes = Buffer.from(JSON.stringify(long));
 assert.equal(route('POST','/v1/tasks',bytes,WORKER),null);
 assert.equal(route('POST','/v1/tasks',bytes,WORKER,true)?.method,'POST');
 long.task.dispatchDeadline = '181s';
 assert.equal(route('POST','/v1/tasks',Buffer.from(JSON.stringify(long)),WORKER,true),null);
});

test('configured Gateway accepts 30s always and 180s only with explicit true',async t=>{
 for(const flag of [undefined,'false','true','invalid']){
  let tasks=0;
  const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
  if(flag!==undefined)env.PDF_LONG_PRINT_TASKS_ENABLED=flag;
  const s=createGatewayServer({env,fetcher:async url=>{
    if(url.startsWith('http://metadata.google.internal'))
      return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
    if(url.includes('cloudtasks.googleapis.com'))tasks++;
    return new Response('{}');
  }});
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
  t.after(()=>{s.closeAllConnections();s.close();});
  for(const [index,deadline] of ['30s','180s','181s'].entries()){
    const task=JSON.parse(body);task.task.dispatchDeadline=deadline;
    const bytes=Buffer.from(JSON.stringify(task)),stamp=String(Math.floor(Date.now()/1000)),nonce=String(index+1).repeat(32);
    const response=await fetch('http://127.0.0.1:'+s.address().port+'/v1/tasks',{
      method:'POST',body:bytes,headers:{'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
        'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'POST','/v1/tasks',stamp,nonce,bytes)}
    });
    assert.equal(response.status,deadline==='30s'||(deadline==='180s'&&flag==='true')?200:400,`${flag}/${deadline}`);
    await response.body?.cancel();
  }
  assert.equal(tasks,flag==='true'?2:1);
 }
});

test('HMAC binds body method path timestamp and nonce',()=>{
 const k=Buffer.from(KEY,'hex');const stamp='1792850000',nonce='a'.repeat(32);
 const a=signature(k,'POST','/v1/tasks',stamp,nonce,body);
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,signature(k,'GET','/v1/tasks',stamp,nonce,body));
 assert.notEqual(a,signature(k,'POST','/v1/queue',stamp,nonce,body));
 assert.notEqual(a,signature(k,'POST','/v1/tasks',stamp,nonce,Buffer.alloc(0)));
});
test('fail-closed, valid request, invalid signature, replay and timestamp',async(t)=>{
 const now=Date.now();
 let upstream=0;
 const reserved=new Set();
 const fetcher=async(url)=>{
   upstream++;
   if(url.startsWith('http://metadata.google.internal'))
     return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{status:200,headers:{'Metadata-Flavor':'Google'}});
   if(url.includes('upload/storage/v1/')) {
     const name=new URL(url).searchParams.get('name');
     if(reserved.has(name)) return new Response('',{status:412});
     reserved.add(name);return new Response('{}',{status:200});
   }
   return new Response(JSON.stringify({name:QUEUE,state:'RUNNING'}),{status:200});
 };
 const s=createGatewayServer({env:{PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER},fetcher,now:()=>now});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));t.after(()=>s.close());
 const url='http://127.0.0.1:'+s.address().port;
 const stamp=String(Math.floor(now/1000));const nonce='1'.repeat(32);
 const signed=(n,ts,secret=Buffer.from(KEY,'hex'))=>({
   'X-PDF-Timestamp':ts,'X-PDF-Nonce':n,
   'X-PDF-Signature':signature(secret,'GET','/v1/queue',ts,n,Buffer.alloc(0))
 });
 let r=await fetch(url+'/v1/queue'); assert.equal(r.status,401); assert.equal(upstream,0);
 r=await fetch(url+'/v1/queue',{headers:signed(nonce,stamp,Buffer.from('cc'.repeat(32),'hex'))});
 assert.equal(r.status,401);assert.equal(upstream,0);
 r=await fetch(url+'/v1/queue',{headers:signed(nonce,stamp)});assert.equal(r.status,200);assert.equal(upstream,3);
 r=await fetch(url+'/v1/queue',{headers:signed(nonce,stamp)});assert.equal(r.status,401);assert.equal(upstream,5);
 r=await fetch(url+'/v1/queue',{headers:signed('2'.repeat(32),String(Number(stamp)-120))});
 assert.equal(r.status,401);assert.equal(upstream,5);
});
test('service stays disabled without explicit gate',async(t)=>{
 const s=createGatewayServer({env:{PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER}});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));t.after(()=>s.close());
 const url='http://127.0.0.1:'+s.address().port;
 assert.equal((await fetch(url+'/health')).status,200);
 assert.equal((await fetch(url+'/v1/queue')).status,503);
});

test('public attack surface rejects tampering, preflight and malformed tasks before Google calls', async t => {
 const now = Date.now(); let upstream = 0;
 const s = createGatewayServer({
  env: {PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER},
  now: () => now,
  fetcher: async () => { upstream++; throw Error('must not reach Google'); },
 });
 await new Promise(resolve => s.listen(0,'127.0.0.1',resolve));
 t.after(() => { s.closeAllConnections(); s.close(); });
 const base = 'http://127.0.0.1:' + s.address().port;
 const stamp = String(Math.floor(now/1000)), nonce = 'd'.repeat(32);
 const headers = (method, path, bytes, ts = stamp) => ({
  'X-PDF-Timestamp':ts, 'X-PDF-Nonce':nonce,
  'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),method,path,ts,nonce,bytes),
 });
 const empty = Buffer.alloc(0);
 const cases = [
  ['/v1/queue', {method:'OPTIONS',headers:{Origin:'https://attacker.invalid'}}, 404],
  ['/v1/queue?extra=1', {headers:headers('GET','/v1/queue',empty)}, 404],
  ['/v1/objects/'+ID+'/secret.json', {}, 404],
  ['/v1/tasks/'+ID, {headers:headers('GET','/v1/queue',empty)}, 401],
  ['/v1/queue', {headers:headers('POST','/v1/queue',empty)}, 401],
  ['/v1/queue', {headers:headers('GET','/v1/queue',empty,String(Number(stamp)+61))}, 401],
  ['/v1/queue', {headers:headers('GET','/v1/queue',empty,String(Number(stamp)-61))}, 401],
  ['/v1/tasks', {method:'POST',body:Buffer.concat([body,Buffer.from(' ')]),headers:headers('POST','/v1/tasks',body)}, 401],
  ['/v1/tasks', {method:'POST',body:'{}',headers:headers('POST','/v1/tasks',Buffer.from('{}'))}, 400],
 ];
 for (const [path, init, status] of cases) {
  const response = await fetch(base + path, init);
  assert.equal(response.status,status,path);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  await response.body?.cancel();
 }
 // Oversize input is disconnected by the byte limit; it must not dispatch.
 await assert.rejects(() => fetch(base+'/v1/tasks', {
  method:'POST',body:Buffer.alloc(8193),headers:headers('POST','/v1/tasks',Buffer.alloc(8193)),
 }));
 assert.equal(upstream,0);
});

test('shared nonce store prevents cross-instance replay',async(t)=>{
 const reserved=new Set(); let up=0;
 const fetcher=async(url)=>{
   up++;
   if(url.startsWith('http://metadata.google.internal'))
     return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
   if(url.includes('/upload/storage/')){
     const name=new URL(url).searchParams.get('name');
     if(reserved.has(name))return new Response('',{status:412});
     reserved.add(name);return new Response('{}');
   }
   return new Response(JSON.stringify({name:QUEUE,state:'RUNNING'}));
 };
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 const a=createGatewayServer({env,fetcher}),b=createGatewayServer({env,fetcher});
 await Promise.all([new Promise(resolve=>a.listen(0,'127.0.0.1',resolve)),new Promise(resolve=>b.listen(0,'127.0.0.1',resolve))]);
 t.after(()=>{a.close();b.close()});
 const stamp=String(Math.floor(Date.now()/1000)),nonce='e'.repeat(32);
 const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
 'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET','/v1/queue',stamp,nonce,Buffer.alloc(0))};
 const r1=await fetch('http://127.0.0.1:'+a.address().port+'/v1/queue',{headers});
 const r2=await fetch('http://127.0.0.1:'+b.address().port+'/v1/queue',{headers});
 assert.equal(r1.status,200);assert.equal(r2.status,401);
 assert.equal(up,5);
});
test('nonce store failure closes access before calling Tasks',async(t)=>{
 let queueCalls=0;
 const fetcher=async(url)=>{
  if(url.startsWith('http://metadata.google.internal'))
    return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
  if(url.includes('/upload/storage/'))return new Response('unavailable',{status:503});
  queueCalls++;return new Response('{}');
 };
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(()=>s.close());
 const stamp=String(Math.floor(Date.now()/1000)),nonce='f'.repeat(32);
 const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
 'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET','/v1/queue',stamp,nonce,Buffer.alloc(0))};
 const r=await fetch('http://127.0.0.1:'+s.address().port+'/v1/queue',{headers});
 assert.equal(r.status,503);assert.equal(queueCalls,0);
});

test('small PDF streams exactly with proper content type',async(t)=>{
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 const fetcher=async(url)=>{
   if(url.startsWith('http://metadata.google.internal'))
     return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
   if(url.includes('/upload/storage/')) return new Response('{}');
   if(url.includes('output.pdf')) return new Response(Buffer.from('%PDF-1.4\\nSAMPLE\\n'));
   return new Response('{}');
 };
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));t.after(()=>s.close());
 const stamp=String(Math.floor(Date.now()/1000)),nonce='a'.repeat(32);
 const path='/v1/objects/'+ID+'/output.pdf';
 const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
 'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET',path,stamp,nonce,Buffer.alloc(0))};
 const r=await fetch('http://127.0.0.1:'+s.address().port+path,{headers});
 assert.equal(r.status,200);
 assert.equal(await r.text(),'%PDF-1.4\\nSAMPLE\\n');
 assert.equal(r.headers.get('content-type'),'application/pdf');
});
test('local admission denies excessive valid reads without reaching Google',async(t)=>{
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 let google=0;
 const fetcher=async(url)=>{
  if(url.startsWith('http://metadata.google.internal'))return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
  if(url.includes('/upload/storage/'))return new Response('{}');
  google++;return new Response(JSON.stringify({name:QUEUE,state:'RUNNING'}));
 };
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));t.after(()=>s.close());
 const base='http://127.0.0.1:'+s.address().port;
 let limited=false;
 for(let i=0;i<15;i++){
  const stamp=String(Math.floor(Date.now()/1000)),nonce=i.toString(16).padStart(32,'0');
  const path='/v1/queue';
  const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
   'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET',path,stamp,nonce,Buffer.alloc(0))};
  const r=await fetch(base+path,{headers});
  if(r.status===429){limited=true;break;}
  assert.equal(r.status,200);
 }
 assert.equal(limited,true);
 assert(google<=10);
});

test('downstream disconnect cancels upstream PDF reader without waiting for drain',async(t)=>{
 const {get}=await import('node:http');
 let cancelled=false;
 const fetcher=async(url)=>{
  if(url.startsWith('http://metadata.google.internal'))
    return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
  if(url.includes('/upload/storage/'))return new Response('{}');
  if(url.includes('output.pdf'))return new Response(new ReadableStream({
    pull(controller){controller.enqueue(new Uint8Array(65536));},
    cancel(){cancelled=true;}
  }),{headers:{'Content-Type':'application/pdf'}});
  throw Error('unexpected request');
 };
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(()=>{s.closeAllConnections();s.close();});
 const path='/v1/objects/'+ID+'/output.pdf',stamp=String(Math.floor(Date.now()/1000)),nonce='c'.repeat(32);
 const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
 'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET',path,stamp,nonce,Buffer.alloc(0))};
 await new Promise((resolve,reject)=>{
   const req=get({hostname:'127.0.0.1',port:s.address().port,path,headers},res=>{
    res.once('data',()=>{res.destroy();resolve();});
    res.once('error',reject);
   });
   req.once('error',reject);
 });
 const deadline=Date.now()+1500;
 while(!cancelled && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(cancelled,true);
});

test('Cloud Tasks conflict is ACKed only for canonical ALREADY_EXISTS response',async t=>{
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 let conflict={error:{code:409,status:'ALREADY_EXISTS'}};
 const fetcher=async(url)=>{
  if(url.startsWith('http://metadata.google.internal'))
   return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
  if(url.includes('/upload/storage/'))return new Response('{}');
  if(url.endsWith('/tasks'))return new Response(JSON.stringify(conflict),{status:409});
  throw Error('unexpected route');
 };
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(()=>s.close());
 const makeHeaders=nonce=>{
   const stamp=String(Math.floor(Date.now()/1000));
   return {'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
     'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'POST','/v1/tasks',stamp,nonce,body)};
 };
 let r=await fetch('http://127.0.0.1:'+s.address().port+'/v1/tasks',{
  method:'POST',body,headers:makeHeaders('a'.repeat(32))});
 assert.equal(r.status,409);
 assert.equal((await r.json()).error,'TASK_ALREADY_EXISTS');
 conflict={error:{code:409,status:'ABORTED'}};
 r=await fetch('http://127.0.0.1:'+s.address().port+'/v1/tasks',{
  method:'POST',body,headers:makeHeaders('b'.repeat(32))});
 assert.equal(r.status,503);
 conflict={error:{code:409,status:'CONFLICT'}};
 r=await fetch('http://127.0.0.1:'+s.address().port+'/v1/tasks',{
  method:'POST',body,headers:makeHeaders('c'.repeat(32))});
 assert.equal(r.status,503);
});

test('oversized and upstream-truncated PDFs cannot finish as successful downloads',async t=>{
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 let attempt=0;
 const fetcher=async url=>{
   if(url.startsWith('http://metadata.google.internal'))
     return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
   if(url.includes('/upload/storage/')) return new Response('{}');
   if(url.includes('output.pdf')){
     attempt++;
     if(attempt===1){
       const chunk=2*1024*1024;
       const chunks=Math.ceil(PDF_OUTPUT_MAX_BYTES/chunk)+1;
       let sent=0;
       return new Response(new ReadableStream({pull(controller){
         if(sent++<chunks)controller.enqueue(new Uint8Array(chunk));
         else controller.close();
       }}));
     }
     let sent=false;
     return new Response(new ReadableStream({pull(controller){
       if(!sent){sent=true;controller.enqueue(new Uint8Array([37,80,68,70]));}
       else controller.error(new Error('TRUNCATED_UPSTREAM'));
     }}));
   }
   throw Error('Unexpected upstream');
 };
 const s=createGatewayServer({env,fetcher});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(()=>{s.closeAllConnections();s.close()});
 const path='/v1/objects/'+ID+'/output.pdf',base='http://127.0.0.1:'+s.address().port;
 async function read(nonce){
   const stamp=String(Math.floor(Date.now()/1000));
   const headers={'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
     'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET',path,stamp,nonce,Buffer.alloc(0))};
   const response=await fetch(base+path,{headers});
   assert.equal(response.status,200);
   return response.arrayBuffer();
 }
 await assert.rejects(()=>read('3'.repeat(32)));
 await assert.rejects(()=>read('4'.repeat(32)));
 assert.equal(attempt,2);
});
test('stalled download times out, rejects a concurrent stream and releases slot',async t=>{
 const env={PDF_GATEWAY_ENABLED:'true',PDF_GATEWAY_HMAC_KEY:KEY,PDF_GATEWAY_WORKER_URL:WORKER};
 let calls=0,cancelled=false;
 const fetcher=async url=>{
   if(url.startsWith('http://metadata.google.internal'))
     return new Response(JSON.stringify({access_token:'a'.repeat(40)}),{headers:{'Metadata-Flavor':'Google'}});
   if(url.includes('/upload/storage/')) return new Response('{}');
   if(url.includes('output.pdf')){
     calls++;
     if(calls===1)return new Response(new ReadableStream({
       start(controller){controller.enqueue(new Uint8Array([37,80,68,70]));},
       cancel(){cancelled=true;}
     }));
     return new Response(new Uint8Array([37,80,68,70]));
   }
   throw Error('Unexpected upstream');
 };
 const s=createGatewayServer({env,fetcher,deadlines:{ordinary:1000,download:150}});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 t.after(()=>{s.closeAllConnections();s.close()});
 const path='/v1/objects/'+ID+'/output.pdf',base='http://127.0.0.1:'+s.address().port;
 const signed=nonce=>{
   const stamp=String(Math.floor(Date.now()/1000));
   return {'X-PDF-Timestamp':stamp,'X-PDF-Nonce':nonce,
     'X-PDF-Signature':signature(Buffer.from(KEY,'hex'),'GET',path,stamp,nonce,Buffer.alloc(0))};
 };
 const first=await fetch(base+path,{headers:signed('5'.repeat(32))});
 assert.equal(first.status,200);
 const busy=await fetch(base+path,{headers:signed('6'.repeat(32))});
 assert.equal(busy.status,429);
 await assert.rejects(()=>first.arrayBuffer());
 assert.equal(cancelled,true);
 const fresh=await fetch(base+path,{headers:signed('7'.repeat(32))});
 assert.equal(fresh.status,200);
 assert.deepEqual(new Uint8Array(await fresh.arrayBuffer()),new Uint8Array([37,80,68,70]));
 assert.equal(calls,2);
});
