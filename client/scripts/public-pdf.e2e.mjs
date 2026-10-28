/* global process, console, document, localStorage, sessionStorage */
// Synthetic MySQL/FakeCloud fixture only. No production identity or PDF source access.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import express from "express";
import mysql from "mysql2/promise";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const origin = "http://127.0.0.1:5197", apiRoot = "/api/public/pdf";
const database = `pdf_browser_${process.pid}_${Date.now()}_test`;
const env = {...process.env,NODE_ENV:"test",DB_HOST:process.env.DB_HOST??"127.0.0.1",DB_PORT:process.env.DB_PORT??"3306",
  DB_USER:process.env.DB_USER??"root",DB_PASSWORD:process.env.DB_PASSWORD??"",DB_NAME:database,
  PUBLIC_APP_ORIGIN:origin,VITE_API_BASE_URL:""};
Object.assign(process.env,env);
const policy=createArtifactPolicy(root,"public-pdf");
const viewports=[[320,720],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]];
async function verifyResponsive(page) {
  for(const [width,height] of viewports) {
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`overflow at ${width}`);
    const form=await page.getByTestId('pdf-submit').boundingBox(),history=await page.getByRole('heading',{name:'Tài liệu đã xử lý'}).boundingBox();
    assert(width>=1024 ? history.x>form.x+form.width : history.y>form.y,`column layout at ${width}`);
    for(const button of await page.getByTestId('pdf-job').getByRole('button').all()) {
      const box=await button.boundingBox();assert(box&&box.height>=44&&box.x>=0&&box.x+box.width<=width,`action target at ${width}`);
    }
  }
}
let browser,vite,server,pool,admin,createdDatabase=false,passed=false;
try {
  admin=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD});
  // This unique database must be newly created; never reset a pre-existing database.
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);createdDatabase=true;
  const migrated=spawnSync(process.execPath,["--import","tsx","src/db/migrate.ts"],{cwd:path.join(root,"server"),env,encoding:"utf8"});
  assert.equal(migrated.status,0,migrated.stderr);
  ({pool}=await import("../../server/src/db/pool.ts"));
  const {PdfRepository}=await import("../../server/src/repositories/pdf.repository.ts");
  const {PdfGuestRepository}=await import("../../server/src/repositories/pdf-guest.repository.ts");
  const {PdfService}=await import("../../server/src/services/pdf.service.ts");
  const {PublicPdfController}=await import("../../server/src/controllers/public-pdf.controller.ts");
  const {createRouter}=await import("../../server/src/routes/index.ts");
  const {errorHandler}=await import("../../server/src/middleware/error-handler.ts");
  const {digest,validatePdfResult}=await import("../../server/src/services/pdf-validation.ts");
  const {runPdfRecovery}=await import("../../server/src/scripts/reconcile-pdf.ts");
  const [user]=await pool.execute("INSERT INTO users(username,password_hash,display_name) VALUES(?,'synthetic-fixture','Public PDF fixture')",["pdf-browser-"+randomUUID()]);
  const owner=user.insertId,repo=new PdfRepository(),guests=new PdfGuestRepository();
  const bytes=Buffer.from("%PDF-synthetic-fixture"),results=new Map(),tasks=new Map();
  let chunkProgress={stage:"DISCOVERING",processedPages:0,totalPages:null,percent:0,nextStep:0};
  const cloud={configured:true,chunked:true,progress:async()=>chunkProgress,ready:async()=>true,enqueue:async p=>{tasks.set(p.jobId,p);},
    result:async id=>results.get(id)??null,task:async()=>"WAITING",open:async()=> (async function*(){yield bytes;})()};
  const settings={enabled:true,maxLinks:5,maxActive:10,maxHourly:10,maxRetries:2,chunked:false};
  const service=new PdfService(repo,cloud,settings);
  const app=express();app.use(express.json());app.use(createRouter(new PublicPdfController(service)));app.use(errorHandler);
  vite=await createServer({root:path.join(root,"client"),define:{"import.meta.env.VITE_API_BASE_URL":JSON.stringify("")},
    server:{middlewareMode:true,hmr:false},appType:"spa"});app.use(vite.middlewares);
  server=app.listen(5197,"127.0.0.1");await once(server,"listening");
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  installPlaywrightArtifactPolicy(browser,policy);
  const A=await browser.newContext(),B=await browser.newContext();
  const page=await A.newPage();await page.goto(origin+"/tools");
  await page.getByText('Chưa có tài liệu nào được gửi lên công cụ.').waitFor();
  await verifyResponsive(page);
  const input=page.getByTestId("pdf-links").locator("textarea").first(),submit=page.getByTestId("pdf-submit");
  const link="https://drive.google.com/file/d/owned_fixture_12345/view";
  for(const value of ["invalid",Array(6).fill(link).join("\n"),[link,link].join("\n")]) {
    await input.fill(value);assert.equal(await submit.isDisabled(),true);
  }
  await input.fill(link);assert.equal(await submit.isDisabled(),false);
  assert.equal(await page.getByRole("checkbox",{name:/có quyền tải xuống/}).count(),0);
  await submit.click();
  await page.getByTestId("pdf-job").waitFor();
  const batch=await repo.batch(owner,(await guests.publicList(1)).items[0].id),job=batch.jobs[0];
  await page.close(); // Recovery proceeds with no live page from the submitter.
  // The Worker contract requires an exact 24-hour claim. Read the clock once:
  // two separate reads can cross a millisecond and make recovery reject the fixture.
  const createdMs=Date.now(),now=new Date(createdMs).toISOString(),expiresAt=new Date(createdMs+86400000).toISOString();
  results.set(job.id,{claim:{version:1,sourceHash:digest(JSON.stringify({provider:"google_drive",fileId:job.fileId})),createdAt:now,expiresAt},
    result:{version:1,jobId:job.id,status:"COMPLETED",completedAt:now,expiresAt,objectName:`jobs/${job.id}/output.pdf`,bytes:bytes.length,pages:1,sha256:digest(bytes.toString())}});
  validatePdfResult(job,results.get(job.id),Date.now());
  await pool.execute("UPDATE pdf_jobs SET next_action_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[job.id]);
  await runPdfRecovery({},new PdfService(new PdfRepository(),cloud,{enabled:true,maxLinks:5,maxActive:10,maxHourly:10,maxRetries:2}));
  const recovered=await repo.get(owner,job.id);
  assert.equal(recovered.status,"COMPLETED",`Fixture recovery failed: ${recovered.cloudErrorCode}`);
  const b=await B.newPage();await b.goto(origin+"/tools");await b.getByTestId("pdf-download").waitFor();
  assert.equal((await B.cookies()).length,0,"Reader must not need the submitting cookie");
  for(const width of [360,390,430,1440]) {
    await b.setViewportSize({width,height:844});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  }
  const downloaded=b.waitForEvent("download");await b.getByTestId("pdf-download").click();
  assert.equal(await (await downloaded).failure(),null);
  const headers={Origin:origin,"Idempotency-Key":randomUUID()};
  const ticket=(await (await B.request.post(origin+apiRoot+`/jobs/${job.id}/download-ticket`,{headers})).json()).data;
  const download=()=>B.request.post(origin+ticket.downloadPath,{headers,data:{ticket:ticket.ticket}});
  const file=await download();assert.equal(file.status(),200);assert.deepEqual(await file.body(),bytes);assert.equal((await download()).status(),403);
  const privateBatch=await service.create(owner,randomUUID(),{links:[link],rightsConfirmed:true});
  assert.deepEqual((await service.list(owner,1)).items.map(x=>x.id),[privateBatch.id]);
  assert.equal((await B.request.get(origin+apiRoot+"/batches/"+privateBatch.id)).status(),404);
  for(const action of ["retry","download-ticket","download"]) {
    assert.equal((await B.request.post(origin+apiRoot+`/jobs/${privateBatch.jobs[0].id}/${action}`,{headers,data:{ticket:ticket.ticket}})).status(),404);
  }
  assert.equal((await B.request.get(origin+"/api/pdf/batches")).status(),401);
  assert.equal((await B.request.post(origin+apiRoot+`/jobs/${job.id}/download-ticket`,{headers:{Origin:"https://invalid.example"}})).status(),403);
  await pool.execute("UPDATE pdf_jobs SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[job.id]);
  assert.equal((await B.request.post(origin+apiRoot+`/jobs/${job.id}/download-ticket`,{headers})).status(),409);
  const retried=await B.request.post(origin+apiRoot+`/jobs/${job.id}/retry`,{headers});assert.equal(retried.status(),201);
  const child=(await retried.json()).data;assert.equal(child.retryOf,job.id);
  assert.equal((await (await B.request.post(origin+apiRoot+`/jobs/${job.id}/retry`,{headers})).json()).data.id,child.id);
  await pool.execute("UPDATE pdf_jobs SET status='FAILED' WHERE id=?",[child.id]);
  const failedRetry=await B.request.post(origin+apiRoot+`/jobs/${child.id}/retry`,{headers:{...headers,"Idempotency-Key":randomUUID()}});
  assert.equal(failedRetry.status(),201);assert.equal((await failedRetry.json()).data.retryOf,child.id);
  await b.reload();await b.getByTestId("pdf-job").first().waitFor();
  const a2=await A.newPage();await a2.goto(origin+"/tools");await a2.getByTestId("pdf-job").first().waitFor();
  assert.equal(await a2.getByTestId("pdf-job").count(),await b.getByTestId("pdf-job").count());
  assert.equal(await b.locator('input[type="file"]').count(),0);
  assert.equal(await b.getByTestId('image-pdf-tool').count(),0);
  // Exercise real binary client helper in Vite, preserving both storage modes on public 401.
  await B.route(url=>url.pathname.endsWith("/download"),r=>r.fulfill({status:401,json:{error:{code:"UNAUTHORIZED"}}}));
  const sessionResults=await b.evaluate(async()=>{
    const client=await import("/src/api/client.ts");let unauthorized=0;client.setUnauthorizedHandler(()=>{unauthorized++;});
    const outcomes=[];
    for(const remembered of [true,false]) {
      localStorage.clear();sessionStorage.clear();const storage=remembered?localStorage:sessionStorage;storage.setItem("teacher-token","opaque-browser-fixture");
      for(const scope of ["public/pdf","pdf"]) {
        try{await client.apiPostPdfBlob(`/api/${scope}/jobs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/download`,{ticket:"A".repeat(43)});}catch{ /* expected 401 */ }
        outcomes.push(storage.getItem("teacher-token")!==null);
      }
    }
    client.setUnauthorizedHandler(null);return {outcomes,unauthorized};
  });
  assert.deepEqual(sessionResults,{outcomes:[true,false,true,false],unauthorized:2});
  // Real MySQL progress + recovery and native POST download for a v2 job.
  settings.chunked=true;
  const C=await browser.newContext();
  assert.equal((await C.request.post(origin+apiRoot+"/session",{headers:{Origin:origin}})).status(),200);
  const guest=await guests.find((await C.cookies()).find(c=>c.name==="teacher_pdf_guest").value);
  // Seed a public v2 batch without spending another submit token after the rate-limit/retry scenarios.
  const longBatch=await service.create(owner,randomUUID(),{links:["https://drive.google.com/file/d/long_fixture_12345/view"]},guest.id),longJob=longBatch.jobs[0];
  const cp=await C.newPage();await cp.goto(origin+"/tools");await cp.getByTestId("pdf-progress").first().waitFor();
  chunkProgress={stage:"RENDERING",processedPages:100,totalPages:200,percent:49,nextStep:11};
  await pool.execute("UPDATE pdf_jobs SET next_action_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[longJob.id]);
  await new PdfService(new PdfRepository(),cloud,settings).tick(owner,longBatch.id);
  await cp.reload();await cp.getByTestId("pdf-progress").filter({hasText:"100/200 trang"}).waitFor();
  const lm=Date.now(),lc=new Date(lm).toISOString(),le=new Date(lm+86400000).toISOString();
  results.set(longJob.id,{claim:{version:1,sourceHash:digest(JSON.stringify({provider:"google_drive",fileId:longJob.fileId})),createdAt:lc,expiresAt:le},
    result:{version:1,jobId:longJob.id,status:"COMPLETED",completedAt:lc,expiresAt:le,objectName:`jobs/${longJob.id}/output.pdf`,bytes:bytes.length,pages:200,sha256:digest(bytes.toString()),filename:'Bài tập Tiếng Anh lớp 6 - Unit 3.pdf'}});
  await pool.execute("UPDATE pdf_jobs SET next_action_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?",[longJob.id]);await service.tick(owner,longBatch.id);
  await cp.reload();await cp.getByTestId("pdf-progress").filter({hasText:"100%"}).waitFor();
  assert.equal((await repo.get(owner,longJob.id)).filename,'Bài tập Tiếng Anh lớp 6 - Unit 3.pdf');
  await cp.clock.install();
  const namedRow=cp.getByTestId("pdf-job").filter({hasText:'Bài tập Tiếng Anh lớp 6 - Unit 3.pdf'});
  const startDownload=async()=>{const event=cp.waitForEvent('download');await namedRow.getByTestId('pdf-download').click();const file=await event;assert.equal(await file.failure(),null);assert.equal(file.suggestedFilename(),'Bài tập Tiếng Anh lớp 6 - Unit 3.pdf');};
  await startDownload();assert.match(cp.url(),/tools/);
  await cp.getByTestId('pdf-download-feedback').waitFor();
  await verifyResponsive(cp);
  await cp.clock.fastForward(4000);await startDownload();
  await cp.clock.fastForward(3000);assert.equal(await cp.getByTestId('pdf-download-feedback').count(),1,'old timer must not clear a newer notice');
  await cp.clock.fastForward(3501);assert.equal(await cp.getByTestId('pdf-download-feedback').count(),0);
  await startDownload();await cp.getByTestId('pdf-download-feedback').getByRole('button').click();
  assert.equal(await cp.getByTestId('pdf-download-feedback').count(),0);
  await C.route(url=>url.pathname.endsWith('/download-ticket'),r=>r.fulfill({status:503,json:{error:{code:'PDF_SERVICE_UNAVAILABLE'}}}));
  await namedRow.getByTestId('pdf-download').click();await cp.getByTestId('pdf-download-feedback').waitFor();
  assert.equal(await cp.getByTestId('pdf-download-feedback').getAttribute('role'),'alert');
  await cp.reload();await namedRow.waitFor();assert.equal(await cp.getByTestId('pdf-download-feedback').count(),0);
  // A full page of terminal batches must not generate 20 detail reads every tick.
  const polling=await browser.newContext(),pollPage=await polling.newPage();
  await pollPage.clock.install();
  const records=Array.from({length:20},(_,index)=>{
    const id=`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`;
    return {id,createdAt:now,rightsConfirmedAt:now,jobs:[{...job,id,batchId:id,filename:index===19?null:'Bài tập Tiếng Anh rất dài '.repeat(5)+'.pdf',status:["QUEUED","RESULT_UNCONFIRMED","RETRY_EXHAUSTED","ENQUEUE_RETRY","FAILED"][index]??"COMPLETED",errorCode:index===4?'ACCESS_DENIED':null,progress:index===0?{stage:'RENDERING',processedPages:10,totalPages:200,percent:4,nextStep:2}:null,expiresAt}]};
  });
  let detailReads=0,listReads=0;
  await polling.route(url=>url.pathname.startsWith(apiRoot),r=>{
    const pathname=new URL(r.request().url()).pathname;
    if(pathname.endsWith("/capabilities"))return r.fulfill({json:{data:{submitEnabled:true,downloadEnabled:true,maxLinksPerBatch:5,maxRetries:2}}});
    if(pathname.endsWith("/batches")){listReads++;return r.fulfill({json:{data:{items:records.map(record=>({id:record.id,createdAt:record.createdAt,rightsConfirmedAt:record.rightsConfirmedAt})),page:1,pageSize:20,total:20}}});}
    detailReads++;return r.fulfill({json:{data:records.find(record=>pathname.endsWith(record.id))}});
  });
  await pollPage.goto(origin+"/tools");await pollPage.waitForFunction(()=>document.querySelectorAll('[data-testid="pdf-job"]').length===20);
  assert.equal(detailReads,20);
  const polled=pollPage.waitForResponse(response=>response.url().endsWith(records[3].id));
  await pollPage.clock.fastForward(15000);await polled;
  assert.equal(listReads,2);assert.equal(detailReads,24,"Only four recoverable batches should be polled");
  const refreshed=pollPage.waitForResponse(response=>response.url().endsWith(records[19].id));
  await pollPage.getByRole("button",{name:"Làm mới"}).click();await refreshed;
  assert.equal(detailReads,44,"Manual refresh must include cached terminal batches");
  await verifyResponsive(pollPage);
  passed=true;
  console.log("Public PDF MySQL/FakeCloud browser E2E passed: close/recovery, v2 persisted progress/refresh/100%/native POST download, public/private history, retry FAILED/EXPIRED, ticket replay, expiry, mobile layout, binary 401, selective polling/manual refresh.");
} finally {
  try {await finalizePlaywrightArtifacts(browser,policy,passed);} finally {
    await browser?.close();await vite?.close();
    if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();
    if(createdDatabase)await admin.query(`DROP DATABASE \`${database}\``);await admin?.end();
  }
}
