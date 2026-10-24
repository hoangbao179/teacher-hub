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
  t.mock.method(globalThis,'fetch',async()=>mode==='missing'?new Response('',{status:404}):
    mode==='error'?new Response('',{status:503}):Response.json({name:taskName(id),responseCount:5,dispatchCount:mode==='inflight'?6:5,
      firstAttempt:{dispatchTime:new Date(Date.now()-7200000).toISOString()},
      lastAttempt:{responseTime:new Date().toISOString(),responseStatus:{code:14}}}));
  assert.equal(await provider.task(id),'MISSING');
  mode='inflight';assert.equal(await provider.task(id),'WAITING');
  mode='exhausted';assert.equal(await provider.task(id),'EXHAUSTED');
  mode='error';await assert.rejects(provider.task(id),/PDF_CLOUD_UNAVAILABLE/);
});

test('VPS PDF modules do not import a parser, renderer or child-process runtime',()=>{
  for(const file of ['pdf.service.ts','pdf-provider.ts','pdf-validation.ts']) {
    const source=readFileSync(path.join(__dirname,file),'utf8');
    assert.doesNotMatch(source,/(?:from\s*|import\s*\()['"](?:node:child_process|pdf-lib|playwright|puppeteer|pdfjs-dist)/);
  }
});
