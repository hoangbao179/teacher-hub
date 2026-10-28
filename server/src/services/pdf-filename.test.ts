import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PdfJob } from '@teacher/shared';
import { validatePdfResult, digest } from './pdf-validation';

test('result accepts old and named completions but rejects unsafe names and unknown fields', () => {
  const now=Date.now(),createdAt=new Date(now).toISOString(),expiresAt=new Date(now+86400000).toISOString();
  const job={id:randomUUID(),fileId:'fixture_file_12345',createdAt,workerVersion:2} as PdfJob;
  const claim={version:1,sourceHash:digest(JSON.stringify({provider:'google_drive',fileId:job.fileId})),createdAt,expiresAt};
  const result={version:1,jobId:job.id,status:'COMPLETED',completedAt:createdAt,expiresAt,objectName:`jobs/${job.id}/output.pdf`,pages:1,bytes:123,sha256:'a'.repeat(64)};
  assert.equal(validatePdfResult(job,{claim,result},now).filename,undefined);
  assert.equal(validatePdfResult(job,{claim,result:{...result,filename:'Bài tập.pdf'}},now).filename,'Bài tập.pdf');
  for(const fields of [{filename:'../bad.pdf'},{filename:null},{filename:'x.pdf.pdf'},{filename:'ok.pdf',extra:true}]) {
    assert.throws(()=>validatePdfResult(job,{claim,result:{...result,...fields}},now),{code:'PDF_RESULT_SCHEMA_MISMATCH'});
  }
});
