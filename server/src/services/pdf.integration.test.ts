import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket,ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/pool';
import { config } from '../config/config';
import { PdfRepository } from '../repositories/pdf.repository';
import { PdfService } from './pdf.service';
import { PdfController } from '../controllers/pdf.controller';
import { createRouter } from '../routes';
import { controllers } from '../container';
import { errorHandler } from '../middleware/error-handler';
import type { PdfProvider,PdfPayload } from './pdf-provider';
import { digest } from './pdf-validation';

const integration=process.env.RUN_MYSQL_INTEGRATION==='1'?test:test.skip;
const settings={enabled:true,maxLinks:5,maxActive:10,maxHourly:10,maxRetries:2};
class FakeCloud implements PdfProvider {
  configured=true; available=true; failEnqueue=false; failRead=false; timeoutAfterCreate=false;
  tasks=new Map<string,PdfPayload>(); results=new Map<string,any>(); state:'WAITING'|'MISSING'|'EXHAUSTED'='WAITING';
  bytes=Buffer.from('%PDF-owned-synthetic-output');
  async ready(){return this.available;}
  async enqueue(p:PdfPayload){if(this.failEnqueue)throw Error('fixture');this.tasks.set(p.jobId,p);if(this.timeoutAfterCreate){this.timeoutAfterCreate=false;throw Error('fixture timeout');}}
  async result(id:string){if(this.failRead)throw Error('fixture');return this.results.get(id)??null;}
  async task(){return this.state;}
  async open(){return (async function*(bytes:Buffer){yield bytes;})(this.bytes);}
}
const link='https://drive.google.com/file/d/owned_fixture_12345/view';
async function due(id:string){await pool.execute('UPDATE pdf_jobs SET next_action_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND,lease_until=NULL WHERE id=?',[id]);}
function completed(job:any,cloud:FakeCloud,status='COMPLETED'){
  const now=new Date().toISOString(); const expiresAt=new Date(Date.parse(now)+86400000).toISOString();
  return {claim:{version:1,sourceHash:digest(JSON.stringify({provider:'google_drive',fileId:job.fileId})),createdAt:now,expiresAt},
    result:{version:1,jobId:job.id,status,completedAt:now,expiresAt,...(status==='COMPLETED'?
      {objectName:`jobs/${job.id}/output.pdf`,bytes:cloud.bytes.length,pages:1,sha256:digest(cloud.bytes.toString())}:{errorCode:'ACCESS_DENIED'})}};
}
integration('PDF MySQL outbox, recovery, result validation, retry, ownership and bounded authenticated download',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?, 'synthetic-fixture', 'PDF fixture')",[`pdf-${randomUUID()}`]);
  const owner=insert.insertId; const repo=new PdfRepository(); const cloud=new FakeCloud(); const service=new PdfService(repo,cloud,settings);
  t.after(async()=>{await pool.execute('DELETE FROM pdf_download_tickets WHERE owner_id=?',[owner]);
    await pool.execute('UPDATE pdf_jobs SET retry_of=NULL WHERE owner_id=?',[owner]); await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]); await pool.execute('DELETE FROM users WHERE id=?',[owner]);await pool.end();});
  const previous=controllers.pdf;controllers.pdf=new PdfController(service);t.after(()=>{controllers.pdf=previous;});
  const app=express();app.use(express.json({limit:'1mb'}));app.use(createRouter());app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const token=jwt.sign({id:owner,role:'TEACHER'},config.jwt.secret);
  const call=(url:string,body?:unknown,auth=token,key=randomUUID())=>fetch(`${base}/api/pdf${url}`,{
    method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await call('/capabilities',undefined,'')).status,401);
  assert.equal((await call('/capabilities',undefined,jwt.sign({id:owner,role:'STUDENT'},config.jwt.secret))).status,403);
  assert.equal((await call('/batches',{links:[link],rightsConfirmed:false})).status,400);
  assert.equal((await call('/batches',{links:Array(6).fill(link),rightsConfirmed:true})).status,400);
  assert.equal((await call('/batches',{links:[link+'?resourcekey=private'],rightsConfirmed:true})).status,400);
  const key=randomUUID();const batch=await service.create(owner,key,{links:[link],rightsConfirmed:true});let job=batch.jobs[0];
  assert.equal(job.status,'QUEUED');assert.equal(cloud.tasks.size,1);
  const repeats=await Promise.all([service.create(owner,key,{links:[link],rightsConfirmed:true}),service.create(owner,key,{links:[link],rightsConfirmed:true})]);
  assert.equal(repeats[0].id,batch.id);assert.equal(repeats[1].jobs.length,1);
  await assert.rejects(service.create(owner,key,{links:['https://drive.google.com/open?id=another_fixture_123'],rightsConfirmed:true}),{code:'PDF_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(repo.batch(owner+100000,batch.id),{code:'PDF_NOT_FOUND'});
  // Transaction rolls back an already-inserted first job if the second insert fails.
  const [before]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_batches WHERE owner_id=?',[owner]);
  await assert.rejects(repo.create(owner,randomUUID(),'a'.repeat(64),['valid_fixture_123','x'.repeat(129)],settings));
  const [after]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_batches WHERE owner_id=?',[owner]);assert.equal(after[0].n,before[0].n);
  cloud.failRead=true;await due(job.id);await service.tick(owner,batch.id);
  assert.equal((await repo.get(owner,job.id)).cloudErrorCode,'PDF_CLOUD_UNAVAILABLE');cloud.failRead=false;
  const result=completed(job,cloud);cloud.results.set(job.id,{...result,result:{...result.result,jobId:randomUUID()}});
  await due(job.id);await service.tick(owner,batch.id);assert.equal((await repo.get(owner,job.id)).cloudErrorCode,'PDF_RESULT_SCHEMA_MISMATCH');
  cloud.results.set(job.id,result);await due(job.id);await service.tick(owner,batch.id);assert.equal((await repo.get(owner,job.id)).status,'COMPLETED');
  const ticket=await service.ticket(owner,job.id);assert.ok(Date.parse(ticket.expiresAt)-Date.now()<=120000);
  const download=await call(`/jobs/${job.id}/download`,{ticket:ticket.ticket});assert.equal(download.status,200);
  assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.match(download.headers.get('content-disposition')!,/^attachment/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),cloud.bytes);
  assert.equal((await call(`/jobs/${job.id}/download`,{ticket:ticket.ticket})).status,403);
  const expiredTicket=await service.ticket(owner,job.id);
  await pool.execute('UPDATE pdf_download_tickets SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE token_hash=?',[digest(expiredTicket.ticket)]);
  assert.equal((await call(`/jobs/${job.id}/download`,{ticket:expiredTicket.ticket})).status,403);
  const boundedTicket=await service.ticket(owner,job.id);const originalBytes=cloud.bytes;
  cloud.bytes=Buffer.alloc(10485761);
  await assert.rejects(async()=>{const response=await call(`/jobs/${job.id}/download`,{ticket:boundedTicket.ticket});await response.arrayBuffer();});
  cloud.bytes=originalBytes;
  await pool.execute('UPDATE pdf_jobs SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[job.id]);
  await assert.rejects(service.ticket(owner,job.id),{code:'PDF_NOT_DOWNLOADABLE'});
  assert.equal((await repo.get(owner,job.id)).status,'EXPIRED');
  // Ambiguous creation timeout retries same UUID/task name after restart with new service instance.
  cloud.timeoutAfterCreate=true;
  const pending=await service.create(owner,randomUUID(),{links:[link],rightsConfirmed:true});const pendingId=pending.jobs[0].id;
  assert.equal(pending.jobs[0].status,'ENQUEUE_RETRY');const size=cloud.tasks.size;
  await due(pendingId);await new PdfService(repo,cloud,settings).tick(owner,pending.id);
  assert.equal(cloud.tasks.size,size);assert.equal((await repo.get(owner,pendingId)).status,'QUEUED');
  await due(pendingId);
  const leases=await Promise.all([repo.lease(owner,pending.id),repo.lease(owner,pending.id)]);
  assert.equal(leases.filter(Boolean).length,1);
  const abandoned=leases.find(Boolean)!;
  await pool.execute('UPDATE pdf_jobs SET lease_until=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[pendingId]);
  const recovered=await repo.lease(owner,pending.id);assert.ok(recovered);assert.notEqual(recovered.lease,abandoned.lease);
  await repo.save(abandoned,'FAILED',null);assert.equal((await repo.get(owner,pendingId)).status,'QUEUED');
  await repo.save(recovered,'QUEUED',null);
  cloud.state='MISSING';await pool.execute('UPDATE pdf_jobs SET created_at=UTC_TIMESTAMP(3)-INTERVAL 3 HOUR WHERE id=?',[pendingId]);
  await due(pendingId);await service.tick(owner,pending.id);assert.equal((await repo.get(owner,pendingId)).status,'RESULT_UNCONFIRMED');
  cloud.state='EXHAUSTED';await due(pendingId);await service.tick(owner,pending.id);assert.equal((await repo.get(owner,pendingId)).status,'RETRY_EXHAUSTED');
  const retryKey=randomUUID();const retry=await service.retry(owner,pendingId,retryKey);assert.notEqual(retry.id,pendingId);
  assert.equal((await service.retry(owner,pendingId,retryKey)).id,retry.id);
  cloud.results.set(retry.id,completed(retry,cloud,'FAILED'));await due(retry.id);await service.tick(owner,pending.id);
  assert.equal((await repo.get(owner,retry.id)).errorCode,'ACCESS_DENIED');
  await assert.rejects(service.ticket(owner,retry.id),{code:'PDF_NOT_DOWNLOADABLE'});
  cloud.failEnqueue=true;
  const failedEnqueue=await service.create(owner,randomUUID(),{links:[link],rightsConfirmed:true});
  assert.equal(failedEnqueue.jobs[0].status,'ENQUEUE_RETRY');assert.equal(cloud.tasks.has(failedEnqueue.jobs[0].id),false);
  cloud.failEnqueue=false;await due(failedEnqueue.jobs[0].id);await service.tick(owner,failedEnqueue.id);
  assert.equal((await repo.get(owner,failedEnqueue.jobs[0].id)).status,'QUEUED');
  await assert.rejects(service.ticket(owner+100000,failedEnqueue.jobs[0].id),{code:'PDF_NOT_FOUND'});
  const limited=new PdfService(repo,cloud,{...settings,maxActive:1,maxHourly:1});
  await assert.rejects(limited.create(owner,randomUUID(),{links:[link],rightsConfirmed:true}),{code:'PDF_RATE_LIMITED'});
  cloud.available=false;assert.equal((await service.capabilities()).submitEnabled,false);
  assert.equal((await call('/batches',{links:[link],rightsConfirmed:true})).status,503);
  assert.ok((await service.list(owner,1)).items.length>=2);
});
