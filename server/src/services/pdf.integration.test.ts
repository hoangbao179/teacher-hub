import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { PdfGuestRepository } from '../repositories/pdf-guest.repository';
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
import { runPdfRecovery } from '../scripts/reconcile-pdf';
import { pdfProgress, type PdfManifest, type PdfChunkJob } from '@teacher/shared';
import { recoverInterruptedMigrations } from '../db/migration-recovery';
import { verifySchema } from '../scripts/verify-pdf-v2';
import { pdfSettings } from '../config/pdf-settings';

const integration=process.env.RUN_MYSQL_INTEGRATION==='1'?test:test.skip;

integration('nullable filename migration preserves old jobs and durable Unicode metadata with lease ownership',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?,'synthetic-fixture','Filename fixture')",[`filename-${randomUUID()}`]);
  const owner=insert.insertId,repo=new PdfRepository();
  t.after(async()=>{
    await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM users WHERE id=?',[owner]);
  });
  const id=await repo.create(owner,randomUUID(),'fixture',['fixture_name_12345'],{enabled:true,maxLinks:1,maxActive:3,maxHourly:20,maxRetries:2,chunked:true});
  const old=(await repo.batch(owner,id)).jobs[0];assert.equal(old.filename,null);
  const work=await repo.lease(owner,id);assert.ok(work);
  const filename='Bài tập Tiếng Anh lớp 6.pdf';
  await repo.save(work,'COMPLETED',null,{status:'COMPLETED',completedAt:new Date().toISOString(),expiresAt:old.expiresAt,filename,objectName:`jobs/${old.id}/output.pdf`,bytes:123,pages:1,sha256:'a'.repeat(64)});
  assert.equal((await new PdfRepository().get(owner,old.id)).filename,filename);
  await repo.save(work,'COMPLETED',null,{status:'COMPLETED',completedAt:new Date().toISOString(),expiresAt:old.expiresAt,filename:'stale.pdf'});
  assert.equal((await repo.get(owner,old.id)).filename,filename,'stale lease cannot overwrite metadata');
  await pool.execute("DELETE FROM schema_migrations WHERE version='0030_pdf_filename.sql'");
  const c=await pool.getConnection();try{await recoverInterruptedMigrations(c);}finally{c.release();}
  const [ledger]=await pool.query<RowDataPacket[]>("SELECT version FROM schema_migrations WHERE version='0030_pdf_filename.sql'");assert.equal(ledger.length,1);
});
after(()=>pool.end());
integration('atomic PDF ALTER is recovered if process dies before migration ledger insert',async()=>{
 const connection=await pool.getConnection();
 try{
  await connection.execute("DELETE FROM schema_migrations WHERE version='0029_pdf_chunk_progress.sql'");
  await recoverInterruptedMigrations(connection);
  const [rows]=await connection.query<RowDataPacket[]>("SELECT version FROM schema_migrations WHERE version='0029_pdf_chunk_progress.sql'");assert.equal(rows.length,1);
  const [columns]=await connection.query<RowDataPacket[]>("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pdf_jobs' AND column_name IN ('worker_version','progress_json')");assert.equal(columns.length,2);
  await verifySchema();
 }finally{connection.release();}
});
const settings={enabled:true,maxLinks:5,maxActive:10,maxHourly:10,maxRetries:2};
integration('v2 admits three mixed active jobs and twenty creations including retry without clearing history', async t => {
  const [insert] = await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?,'synthetic-fixture','PDF limits fixture')", [`limits-${randomUUID()}`]);
  const owner = insert.insertId, repo = new PdfRepository();
  const cfg = pdfSettings({ PDF_API_ENABLED:'true', PDF_CHUNKED_JOBS_ENABLED:'true' });
  t.after(async () => {
    await pool.execute('UPDATE pdf_jobs SET retry_of=NULL WHERE owner_id=?', [owner]);
    await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?', [owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?', [owner]);
    await pool.execute('DELETE FROM users WHERE id=?', [owner]);
  });
  const create = (key = randomUUID()) => repo.create(owner, key, 'fixture-hash', ['owned_fixture_12345'], cfg);
  const ids: string[] = [];
  const key = randomUUID();
  const first = await create(key); ids.push((await repo.batch(owner, first)).jobs[0].id);
  for (let i = 0; i < 2; i++) ids.push((await repo.batch(owner, await create())).jobs[0].id);
  // Existing v1 jobs and unconfirmed results also consume v2 admission capacity.
  await pool.execute("UPDATE pdf_jobs SET status='QUEUED',worker_version=1 WHERE id=?", [ids[1]]);
  await pool.execute("UPDATE pdf_jobs SET status='RESULT_UNCONFIRMED' WHERE id=?", [ids[2]]);
  await assert.rejects(create(), { code:'PDF_RATE_LIMITED' });
  assert.equal(await create(key), first, 'idempotent create bypasses full active quota');
  await pool.execute("UPDATE pdf_jobs SET status='FAILED' WHERE id=?", [ids[0]]);
  const retryKey = randomUUID();
  const child = await repo.retry(owner, ids[0], retryKey, cfg);
  assert.equal(await repo.retry(owner, ids[0], retryKey, cfg), child);
  await pool.execute("UPDATE pdf_jobs SET status='FAILED' WHERE id=?", [ids[1]]);
  const fifth = await create(); // third active slot is free again
  await assert.rejects(repo.retry(owner, ids[1], randomUUID(), cfg), { code:'PDF_RATE_LIMITED' });
  await pool.execute("UPDATE pdf_jobs SET status='FAILED' WHERE owner_id=?", [owner]);
  for (let n = 5; n < 20; n++) {
    const batch = await create();
    await pool.execute("UPDATE pdf_jobs SET status='FAILED' WHERE batch_id=?", [batch]);
  }
  await assert.rejects(create(), { code:'PDF_RATE_LIMITED' });
  const retrySource = (await repo.batch(owner, fifth)).jobs[0].id;
  await assert.rejects(repo.retry(owner, retrySource, randomUUID(), cfg), { code:'PDF_RATE_LIMITED' });
  assert.equal(await create(key), first, 'idempotency survives exhausted hourly quota');
  assert.equal(await repo.retry(owner, ids[0], retryKey, cfg), child);
  await assert.rejects(repo.create(owner, key, 'different-hash', ['owned_fixture_12345'], cfg), { code:'PDF_IDEMPOTENCY_CONFLICT' });
  const [counts] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_jobs WHERE owner_id=?', [owner]);
  assert.equal(Number(counts[0].n), 20, 'old jobs and retry history are retained');
  // Synthetic fixture timestamps only: an aged-out row releases rolling-hour quota without deletion.
  await pool.execute('UPDATE pdf_jobs SET created_at=UTC_TIMESTAMP(3)-INTERVAL 61 MINUTE WHERE id=?', [ids[0]]);
  await pool.execute('UPDATE pdf_batches SET created_at=UTC_TIMESTAMP(3)-INTERVAL 61 MINUTE WHERE id=?', [first]);
  await create();
  const [retained] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_jobs WHERE owner_id=?', [owner]);
  assert.equal(Number(retained[0].n), 21);
});
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

integration('v2 progress survives service restart, outbox advances distinct steps and accepts 200-page result',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?,'synthetic-fixture','Chunk fixture')",[`chunk-${randomUUID()}`]);
  const owner=insert.insertId,repo=new PdfRepository();
  t.after(async()=>{await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]);await pool.execute('DELETE FROM users WHERE id=?',[owner]);});
  let progress=pdfProgress(null);let pair:any=null;const tasks:PdfChunkJob[]=[];
  const cloud:PdfProvider={configured:true,chunked:true,ready:async()=>true,progress:async()=>progress,
    enqueue:async p=>{tasks.push(p as PdfChunkJob);},result:async()=>pair,task:async()=>tasks.some(p=>p.step===progress.nextStep)?'WAITING':'MISSING',
    open:async()=>{throw Error('not used');}};
  const cfg={...settings,chunked:true};const service=new PdfService(repo,cloud,cfg);
  const batch=await service.create(owner,randomUUID(),{links:[link]});const j=batch.jobs[0];
  assert.equal(j.workerVersion,2);assert.equal(tasks[0].step,0);assert.equal(j.progress?.stage,'DISCOVERING');
  const now=new Date().toISOString(),expiresAt=new Date(Date.parse(now)+86400000).toISOString();
  const manifest:PdfManifest={version:2,jobId:j.id,sourceHash:digest(JSON.stringify({provider:'google_drive',fileId:j.fileId})),expiresAt,totalPages:200,mode:'viewer',fingerprint:'a'.repeat(64)};
  progress=pdfProgress(manifest,1);await due(j.id);
  await new PdfService(new PdfRepository(),cloud,cfg).tick(owner,batch.id);
  const restored=(await new PdfRepository().batch(owner,batch.id)).jobs[0];
  assert.equal(restored.progress?.processedPages,10);assert.equal(restored.progress?.nextStep,2);assert.equal(restored.enqueueAttempts,1);assert.equal(tasks.at(-1)?.step,2);
  await due(j.id);await service.tick(owner,batch.id);assert.equal(tasks.length,2,'waiting step is not enqueued repeatedly');
  pair={claim:{version:1,sourceHash:manifest.sourceHash,createdAt:now,expiresAt},result:{version:1,jobId:j.id,status:'COMPLETED',completedAt:now,expiresAt,objectName:`jobs/${j.id}/output.pdf`,bytes:100000000,pages:200,sha256:'b'.repeat(64)}};
  await due(j.id);await service.tick(owner,batch.id);assert.equal((await repo.get(owner,j.id)).pages,200);
});
integration('PDF MySQL outbox, recovery, result validation, retry, ownership and bounded authenticated download',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?, 'synthetic-fixture', 'PDF fixture')",[`pdf-${randomUUID()}`]);
  const owner=insert.insertId; const repo=new PdfRepository(); const cloud=new FakeCloud(); const service=new PdfService(repo,cloud,settings);
  t.after(async()=>{await pool.execute('DELETE FROM pdf_download_tickets WHERE owner_id=?',[owner]);
    await pool.execute('UPDATE pdf_jobs SET retry_of=NULL WHERE owner_id=?',[owner]); await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]); await pool.execute('DELETE FROM users WHERE id=?',[owner]);});
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
  assert.equal((await call('/batches',{links:[link],other:true})).status,400);
  assert.equal((await call('/batches',{links:Array(6).fill(link),rightsConfirmed:true})).status,400);
  assert.equal((await call('/batches',{links:[link+'?resourcekey=private'],rightsConfirmed:true})).status,400);
  const key=randomUUID();const batch=await service.create(owner,key,{links:[link]});let job=batch.jobs[0];
  assert.equal(job.status,'QUEUED');assert.equal(cloud.tasks.size,1);
  const repeats=await Promise.all([service.create(owner,key,{links:[link]}),service.create(owner,key,{links:[link]})]);
  assert.equal(repeats[0].id,batch.id);assert.equal(repeats[1].jobs.length,1);
  await assert.rejects(service.create(owner,key,{links:['https://drive.google.com/open?id=another_fixture_123']}),{code:'PDF_IDEMPOTENCY_CONFLICT'});
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

integration('independent recovery drains five-link HTTP batch and reconciles deleted tasks without inventing failures',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>("INSERT INTO users(username,password_hash,display_name) VALUES(?, 'synthetic-fixture', 'PDF recovery fixture')",[`pdf-${randomUUID()}`]);
  const owner=insert.insertId;const repo=new PdfRepository();const cloud=new FakeCloud();
  const service=new PdfService(repo,cloud,settings);
  t.after(async()=>{
    await pool.execute('DELETE FROM pdf_download_tickets WHERE owner_id=?',[owner]);
    await pool.execute('UPDATE pdf_jobs SET retry_of=NULL WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]);await pool.execute('DELETE FROM users WHERE id=?',[owner]);
  });
  const previous=controllers.pdf;controllers.pdf=new PdfController(service);t.after(()=>{controllers.pdf=previous;});
  const app=express();app.use(express.json());app.use(createRouter());app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>server.listening ? new Promise<void>(resolve=>server.close(()=>resolve())) : undefined);
  const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/pdf/batches`,{method:'POST',
    headers:{Authorization:`Bearer ${jwt.sign({id:owner,role:'TEACHER'},config.jwt.secret)}`,
      'Content-Type':'application/json','Idempotency-Key':randomUUID()},
    body:JSON.stringify({rightsConfirmed:true,links:Array.from({length:5},(_,i)=>`https://drive.google.com/file/d/owned_fixture_batch_${i}/view`)})});
  assert.equal(response.status,201);const batch=(await response.json()).data;
  assert.equal(batch.jobs.filter((j:any)=>j.status==='QUEUED').length,3);
  assert.equal(batch.jobs.filter((j:any)=>j.status==='ENQUEUE_PENDING').length,2);
  await new Promise<void>(resolve=>server.close(()=>resolve())); // No further HTTP requests.
  await pool.execute("UPDATE pdf_jobs SET next_action_at=UTC_TIMESTAMP(3)+INTERVAL 1 HOUR WHERE batch_id=? AND status='QUEUED'",[batch.id]);
  const abandoned=await repo.lease(owner,batch.id);assert.ok(abandoned);
  // A fresh process sees the persisted lease and only handles the other due job.
  const restarted=new PdfService(new PdfRepository(),cloud,settings);
  assert.equal((await runPdfRecovery({maxJobs:1},restarted)).processed,1);
  assert.equal(cloud.tasks.size,4);
  await pool.execute('UPDATE pdf_jobs SET lease_until=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[abandoned.id]);
  const recovery=await runPdfRecovery({},restarted);assert.equal(recovery.processed,1);
  assert.equal(cloud.tasks.size,5);assert.equal((await repo.batch(owner,batch.id)).jobs.every(j=>j.status==='QUEUED'),true);
  await repo.save(abandoned,'FAILED',null);assert.equal((await repo.get(owner,abandoned.id)).status,'QUEUED');
  const [lateSuccess,missingAfterExhaustion,positiveEvidence]=batch.jobs;
  cloud.state='MISSING';cloud.tasks.delete(lateSuccess.id);cloud.tasks.delete(missingAfterExhaustion.id);
  await due(lateSuccess.id);await due(missingAfterExhaustion.id);
  await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,lateSuccess.id)).status,'RESULT_UNCONFIRMED');
  assert.equal((await repo.get(owner,missingAfterExhaustion.id)).status,'RESULT_UNCONFIRMED');
  await assert.rejects(restarted.ticket(owner,missingAfterExhaustion.id),{code:'PDF_NOT_DOWNLOADABLE'});
  await assert.rejects(restarted.retry(owner,missingAfterExhaustion.id,randomUUID()),{code:'PDF_RETRY_NOT_ALLOWED'});
  const taskCount=cloud.tasks.size;
  cloud.failRead=true;await due(lateSuccess.id);await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,lateSuccess.id)).cloudErrorCode,'PDF_CLOUD_UNAVAILABLE');
  assert.equal((await repo.get(owner,lateSuccess.id)).status,'RESULT_UNCONFIRMED');cloud.failRead=false;
  cloud.results.set(lateSuccess.id,completed(lateSuccess,cloud));await due(lateSuccess.id);
  await runPdfRecovery({},restarted);assert.equal((await repo.get(owner,lateSuccess.id)).status,'COMPLETED');
  assert.equal(cloud.tasks.size,taskCount); // No enqueue/new UUID on task disappearance.
  cloud.state='EXHAUSTED';await due(positiveEvidence.id);await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,positiveEvidence.id)).status,'RETRY_EXHAUSTED');
  cloud.state='MISSING';await due(positiveEvidence.id);await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,positiveEvidence.id)).status,'RETRY_EXHAUSTED');
  await due(positiveEvidence.id);const activeLease=await repo.lease(owner,batch.id);assert.ok(activeLease);
  await assert.rejects(restarted.retry(owner,positiveEvidence.id,randomUUID()),{code:'PDF_RETRY_BUSY'});
  await repo.save(activeLease,'RETRY_EXHAUSTED','PDF_QUEUE_RETRY_EXHAUSTED');
  cloud.state='WAITING';await due(positiveEvidence.id);await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,positiveEvidence.id)).status,'RESULT_UNCONFIRMED');
  await assert.rejects(restarted.retry(owner,positiveEvidence.id,randomUUID()),{code:'PDF_RETRY_NOT_ALLOWED'});
  cloud.results.set(positiveEvidence.id,completed(positiveEvidence,cloud));await due(positiveEvidence.id);
  await runPdfRecovery({},restarted);assert.equal((await repo.get(owner,positiveEvidence.id)).status,'COMPLETED');
  await pool.execute('UPDATE pdf_jobs SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',[missingAfterExhaustion.id]);
  await runPdfRecovery({},restarted);assert.equal((await repo.get(owner,missingAfterExhaustion.id)).status,'EXPIRED');
  await assert.rejects(restarted.ticket(owner,missingAfterExhaustion.id),{code:'PDF_NOT_DOWNLOADABLE'});
  // Waiting is bounded by TTL, then an explicit capped/idempotent manual retry is available.
  const key=randomUUID();const child=await restarted.retry(owner,missingAfterExhaustion.id,key);
  assert.notEqual(child.id,missingAfterExhaustion.id);
  assert.equal((await restarted.retry(owner,missingAfterExhaustion.id,key)).id,child.id);
  cloud.failRead=true;
  const outageBatch=await restarted.create(owner,randomUUID(),{links:['https://drive.google.com/open?id=owned_outage_fixture'],rightsConfirmed:true});
  const outageJob=outageBatch.jobs[0];
  for(let attempt=0;attempt<8;attempt++) { await due(outageJob.id);await runPdfRecovery({maxJobs:1},restarted); }
  assert.equal((await repo.get(owner,outageJob.id)).enqueueAttempts,0);
  assert.equal((await repo.get(owner,outageJob.id)).status,'ENQUEUE_RETRY');
  cloud.failRead=false;await due(outageJob.id);await runPdfRecovery({},restarted);
  assert.equal((await repo.get(owner,outageJob.id)).status,'QUEUED');
  assert.equal((await repo.get(owner,outageJob.id)).enqueueAttempts,1);
});

integration('public history crosses devices while private history stays isolated',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>(
    "INSERT INTO users(username,password_hash,display_name) VALUES(?, 'synthetic-fixture', 'PDF guest fixture')",
    ['pdf-guest-'+randomUUID()]);
  const owner=insert.insertId;
  const guests=new PdfGuestRepository(), repo=new PdfRepository(), service=new PdfService(repo,new FakeCloud(),settings);
  const first={id:randomUUID(),owner},second={id:randomUUID(),owner};
  const secretA=randomBytes(32).toString('base64url'),secretB=randomBytes(32).toString('base64url');
  for(const [guest,secret] of [[first,secretA],[second,secretB]] as const){
    await pool.execute("INSERT INTO pdf_guest_sessions(id,token_hash,owner_id,created_at,expires_at) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 180 DAY)",
      [guest.id,digest(secret),owner]);
  }
  t.after(async()=>{
    await pool.execute("DELETE FROM pdf_download_tickets WHERE owner_id=?",[owner]);
    await pool.execute("DELETE FROM pdf_guest_batches WHERE session_id IN (?,?)",[first.id,second.id]);
    await pool.execute("DELETE FROM pdf_guest_sessions WHERE owner_id=?",[owner]);
    await pool.execute("UPDATE pdf_jobs SET retry_of=NULL WHERE owner_id=?",[owner]);
    await pool.execute("DELETE FROM pdf_jobs WHERE owner_id=?",[owner]);
    await pool.execute("DELETE FROM pdf_batches WHERE owner_id=?",[owner]);
    await pool.execute("DELETE FROM users WHERE id=?",[owner]);
  });
  assert.equal((await guests.find(secretA))?.id,first.id);
  assert.equal(await guests.find('invalid'),null);
  const batch=await service.create(owner,randomUUID(),{links:[link],rightsConfirmed:true},first.id);
  assert.equal((await guests.list(first,1)).total,1);
  assert.equal((await guests.list(second,1)).total,0);
  assert.equal((await guests.publicList(1)).items.some(b=>b.id===batch.id),true);
  assert.equal((await guests.publicBatch(batch.id)).owner,owner);
  assert.equal((await guests.publicJob(batch.jobs[0].id)).owner,owner);
  await guests.ownsBatch(first,batch.id);
  await guests.ownsJob(first,batch.jobs[0].id);
  await assert.rejects(guests.ownsBatch(second,batch.id),{code:'PDF_NOT_FOUND'});
  await assert.rejects(guests.ownsJob(second,batch.jobs[0].id),{code:'PDF_NOT_FOUND'});
  await assert.rejects(guests.ownsJob(second,randomUUID()),{code:'PDF_NOT_FOUND'});
  // Existing teacher-owned batches are not silently exposed to public guests.
  const privateBatch=await service.create(owner,randomUUID(),{links:[link],rightsConfirmed:true});
  const privateList=await service.list(owner,1);
  assert.equal(privateList.total,1);
  assert.deepEqual(privateList.items.map(b=>b.id),[privateBatch.id]);
  assert.equal((await guests.publicList(1)).items.some(b=>b.id===privateBatch.id),false);
  await assert.rejects(guests.ownsBatch(first,privateBatch.id),{code:'PDF_NOT_FOUND'});
  await assert.rejects(guests.publicBatch(privateBatch.id),{code:'PDF_NOT_FOUND'});
  await assert.rejects(guests.publicJob(privateBatch.jobs[0].id),{code:'PDF_NOT_FOUND'});
  assert.equal((await guests.list(first,1)).total,1);
  await pool.execute("UPDATE pdf_guest_sessions SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[second.id]);
  assert.equal(await guests.find(secretB),null);
  await pool.execute("UPDATE pdf_guest_sessions SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[first.id]);
  assert.equal(await guests.find(secretA),null);
  assert.equal((await guests.publicBatch(batch.id)).owner,owner);
  assert.equal((await guests.publicJob(batch.jobs[0].id)).owner,owner);
});

integration('public batch linkage rolls back with jobs and is durable before enqueue and restart',async t=>{
  const [insert]=await pool.execute<ResultSetHeader>(
    "INSERT INTO users(username,password_hash,display_name) VALUES(?,'synthetic-fixture','Atomic PDF fixture')",['pdf-atomic-'+randomUUID()]);
  const owner=insert.insertId,session=randomUUID(),repo=new PdfRepository(),cloud=new FakeCloud();
  const service=new PdfService(repo,cloud,settings),guests=new PdfGuestRepository();
  await pool.execute("INSERT INTO pdf_guest_sessions(id,token_hash,owner_id,created_at,expires_at) VALUES(?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 1 DAY)",[session,digest(randomUUID()),owner]);
  const trigger='audit_public_link_'+randomUUID().replaceAll('-','');
  t.after(async()=>{
    await pool.query(`DROP TRIGGER IF EXISTS ${trigger}`);
    await pool.execute('DELETE FROM pdf_guest_batches WHERE session_id=?',[session]);
    await pool.execute('DELETE FROM pdf_guest_sessions WHERE id=?',[session]);
    await pool.execute('DELETE FROM pdf_jobs WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM pdf_batches WHERE owner_id=?',[owner]);
    await pool.execute('DELETE FROM users WHERE id=?',[owner]);
  });
  await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON pdf_guest_batches FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic public link failure'`);
  const key=randomUUID();
  await assert.rejects(service.create(owner,key,{links:[link],rightsConfirmed:true},session));
  assert.equal((await repo.list(owner,1)).total,0);
  const [jobs]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_jobs WHERE owner_id=?',[owner]);
  assert.equal(jobs[0].n,0);assert.equal(cloud.tasks.size,0);
  await pool.query(`DROP TRIGGER ${trigger}`);
  const enqueue=cloud.enqueue.bind(cloud);
  cloud.enqueue=async payload=>{
    const durable=await repo.get(owner,payload.jobId);
    assert.equal((await guests.publicBatch(durable.batchId)).id,session);
    await enqueue(payload);
  };
  const repeated=await Promise.all([service.create(owner,key,{links:[link],rightsConfirmed:true},session),service.create(owner,key,{links:[link],rightsConfirmed:true},session)]);
  assert.equal(repeated[0].id,repeated[1].id);assert.equal(cloud.tasks.size,1);
  const batch=repeated[0];
  const [counts]=await pool.query<RowDataPacket[]>('SELECT COUNT(*) n FROM pdf_batches WHERE owner_id=?',[owner]);assert.equal(counts[0].n,1);
  await assert.rejects(service.create(owner,key,{links:[link],rightsConfirmed:true}),{code:'PDF_IDEMPOTENCY_CONFLICT'});
  const restarted=new PdfService(new PdfRepository(),cloud,settings);
  cloud.results.set(batch.jobs[0].id,completed(batch.jobs[0],cloud));await due(batch.jobs[0].id);
  await runPdfRecovery({},restarted);
  assert.equal((await new PdfGuestRepository().publicBatch(batch.id)).owner,owner);
  assert.equal((await restarted.detail(owner,batch.id)).jobs[0].status,'COMPLETED');
});
