import test from 'node:test';
import assert from 'node:assert/strict';
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
  const provider=new GatewayPdfProvider(GATEWAY,WORKER,'ab'.repeat(32),true);
  let creations=0;
  globalThis.fetch=async(input,init)=>{
   const url=String(input);
   assert.equal(init?.redirect,'error');
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
