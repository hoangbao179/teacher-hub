import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { driveFileId,workerPayload } from './pdf-validation';
import { DisabledPdfProvider,RestPdfProvider,pdfQueue,taskName } from './pdf-provider';
import { PdfService } from './pdf.service';
import { PdfRepository } from '../repositories/pdf.repository';
import { pdfSettings } from '../config/pdf-settings';
import { reconcilePdf } from './pdf-reconciler';
import { runPdfRecovery } from '../scripts/reconcile-pdf';
import { createPdfRuntime } from './pdf-runtime';

test('strict Drive normalization rejects credentials, resource keys and unsupported query/hosts', () => {
  assert.equal(driveFileId('https://drive.google.com/file/d/owned_fixture_12345/view'),'owned_fixture_12345');
  assert.equal(driveFileId('https://drive.google.com/open?id=owned_fixture_12345'),'owned_fixture_12345');
  for (const link of ['http://drive.google.com/open?id=owned_fixture_12345',
    'https://evil.test/file/d/owned_fixture_12345/view','https://drive.google.com/open?id=owned_fixture_12345&resourcekey=secret',
    'https://drive.google.com/open?id=owned_fixture_12345&id=another_file','https://user:pw@drive.google.com/open?id=owned_fixture_12345',
    'https://drive.google.com/uc?export=download&id=owned_fixture_12345','https://drive.google.com/file/d/short/view',
    'https://docs.google.com/document/d/owned_fixture_12345/edit']) assert.throws(()=>driveFileId(link),{ code:'PDF_UNSUPPORTED_LINK' });
});

test('producer payload accepted by real worker v1 guards, rejects schema drift', () => {
  const payload=workerPayload(randomUUID(),'owned_fixture_12345');
  const file=pathToFileURL(path.resolve(__dirname,'../../../workers/pdf/src/contract.ts')).href;
  const result=spawnSync(process.execPath,['--input-type=module','-e',`
    const {parseJob}=await import(process.argv[1]);
    const p=JSON.parse(process.argv[2]); parseJob(p);
    for(const bad of [{...p,version:2},{...p,bucket:'arbitrary'}, {...p,source:{...p.source,url:'https://evil.test'}}]) {
      let rejected=false; try{parseJob(bad)}catch{rejected=true} if(!rejected) process.exit(1);
    }`,file,JSON.stringify(payload)],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,0); assert.ok(Buffer.byteLength(JSON.stringify(payload))<=4096);
});

test('production factory remains fail-closed even when environment flag is set', async () => {
  const service=new PdfService(new PdfRepository(),new DisabledPdfProvider(),pdfSettings({PDF_API_ENABLED:'true'}));
  assert.equal((await service.capabilities()).submitEnabled,false);
  await assert.rejects(service.create(1,randomUUID(),{}),{code:'PDF_SERVICE_UNAVAILABLE'});
  assert.equal(pdfSettings({PDF_API_ENABLED:'true',PDF_BATCH_LIMIT:'100'}).enabled,false);
  assert.equal((await new RestPdfProvider(null,'https://teacher-pdf-worker-123.asia-southeast1.run.app',true).ready()),false);
});

test('REST producer verifies queue, deterministic name, OIDC audience, deadline and duplicate creation', async t => {
  const id=randomUUID(); let task:any;
  t.mock.method(globalThis,'fetch',async (url:any,init:any) => {
    assert.equal(init.redirect,'error');
    if(String(url).endsWith('/tasks')) { task=JSON.parse(init.body).task; return new Response('',{status:409}); }
    return Response.json({name:pdfQueue,state:'RUNNING',retryConfig:{maxAttempts:5,maxRetryDuration:'3600s',minBackoff:'10s',maxBackoff:'300s'},
      rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1}});
  });
  const base='https://teacher-pdf-worker-123.asia-southeast1.run.app';
  const provider=new RestPdfProvider({kind:'external_workload',verified:true,accessToken:async()=>'synthetic'},base,true);
  await provider.enqueue(workerPayload(id,'owned_fixture_12345'));
  assert.equal(task.name,taskName(id)); assert.equal(task.dispatchDeadline,'30s');
  assert.equal(task.httpRequest.url,`${base}/jobs`); assert.equal(task.httpRequest.oidcToken.audience,base);
  assert.equal(task.httpRequest.oidcToken.serviceAccountEmail,'teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com');
  assert.deepEqual(JSON.parse(Buffer.from(task.httpRequest.body,'base64').toString()),workerPayload(id,'owned_fixture_12345'));
});

test('REST reconciliation requires positive exhaustion evidence and treats a missing task as ambiguous',async t=>{
  const provider=new RestPdfProvider({kind:'external_workload',verified:true,accessToken:async()=>'synthetic'},
    'https://teacher-pdf-worker-123.asia-southeast1.run.app',true);
  let mode='missing';const id=randomUUID();
  t.mock.method(globalThis,'fetch',async(url:any)=>String(url).endsWith(pdfQueue)?Response.json({name:pdfQueue,state:'RUNNING',
    retryConfig:{maxAttempts:mode==='changed-queue'?100:5,maxRetryDuration:'3600s'}}):mode==='missing'?new Response('',{status:404}):
    mode==='error'?new Response('',{status:503}):Response.json({name:taskName(id),responseCount:5,dispatchCount:mode==='inflight'?6:5,
      firstAttempt:{dispatchTime:new Date(Date.now()-7200000).toISOString()},
      lastAttempt:{dispatchTime:new Date(Date.now()-120000).toISOString(),
        responseTime:new Date(Date.now()-(mode==='recent'?0:61000)).toISOString(),responseStatus:{code:14}},
      ...(mode==='different-retry'?{retryConfig:{maxAttempts:100,maxRetryDuration:'7200s'}}:{})}));
  assert.equal(await provider.task(id),'MISSING');
  mode='inflight';assert.equal(await provider.task(id),'WAITING');
  mode='recent';assert.equal(await provider.task(id),'WAITING');
  mode='different-retry';assert.equal(await provider.task(id),'WAITING');
  mode='changed-queue';assert.equal(await provider.task(id),'WAITING');
  mode='exhausted';assert.equal(await provider.task(id),'EXHAUSTED');
  mode='error';await assert.rejects(provider.task(id),/PDF_CLOUD_UNAVAILABLE/);
});

test('independent one-shot sweep honors count/time bounds and default runtime remains disabled',async()=>{
  let calls=0;
  const service={tick:async(_owner?:number,_batch?:string,limit?:number,signal?:AbortSignal)=>{
    assert.equal(limit,1); assert.ok(signal); calls++; return 1;
  }};
  assert.deepEqual(await reconcilePdf(service,{maxJobs:5}),{processed:5,stopped:'job_limit'});
  assert.equal(calls,5);
  let time=0;calls=0;
  assert.deepEqual(await reconcilePdf(service,{maxJobs:50,budgetMs:10},()=>time+=6),{processed:1,stopped:'deadline'});
  assert.equal(calls,1);
  assert.deepEqual(await runPdfRecovery(),{processed:0,stopped:'idle_or_unavailable'});
  assert.equal((await createPdfRuntime().capabilities()).submitEnabled,false);
  await assert.rejects(reconcilePdf(service,{maxJobs:51}),/INVALID_LIMITS/);
});

test('reconciler deadline interrupts an identity supplier that does not finish',async()=>{
  const provider=new RestPdfProvider({kind:'external_workload',verified:true,
    accessToken:()=>new Promise(()=>{})},'https://teacher-pdf-worker-123.asia-southeast1.run.app',true);
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20);
  try { await assert.rejects(provider.task(randomUUID(),abort.signal),/PDF_CLOUD_UNAVAILABLE/); }
  finally { clearTimeout(timer); }
});

test('HTTP/CLI runtime needs approved identity and verified independent recovery together',async t=>{
  const previous=process.env.PDF_API_ENABLED;process.env.PDF_API_ENABLED='true';
  t.mock.method(globalThis,'fetch',async()=>Response.json({name:pdfQueue,state:'RUNNING',
    retryConfig:{maxAttempts:5,maxRetryDuration:'3600s',minBackoff:'10s',maxBackoff:'300s'},
    rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1}}));
  const approved={identity:{kind:'external_workload' as const,verified:true as const,accessToken:async()=>'synthetic'},
    workerBaseURL:'https://teacher-pdf-worker-123.asia-southeast1.run.app',activationApproved:true as const};
  try {
    assert.equal((await createPdfRuntime().capabilities()).submitEnabled,false);
    assert.equal((await createPdfRuntime(approved as any).capabilities()).submitEnabled,false);
    assert.equal((await createPdfRuntime({...approved,recoveryVerified:true}).capabilities()).submitEnabled,true);
  } finally { if(previous===undefined) delete process.env.PDF_API_ENABLED;else process.env.PDF_API_ENABLED=previous; }
});

test('VPS PDF modules do not import a parser, renderer or child-process runtime',()=>{
  for(const file of ['pdf.service.ts','pdf-provider.ts','pdf-validation.ts']) {
    const source=readFileSync(path.join(__dirname,file),'utf8');
    assert.doesNotMatch(source,/(?:from\s*|import\s*\()['"](?:node:child_process|pdf-lib|playwright|puppeteer|pdfjs-dist)/);
  }
});
