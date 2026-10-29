import assert from "node:assert/strict";
import test from "node:test";
import { pdfBatchNeedsPolling } from "../src/api/pdfPolling.ts";
import { createPdfRequestBarrier } from './pdf-request-barrier.mjs';

test("poll only recoverable unexpired PDF batches, including late-result states", () => {
  const now = Date.parse("2026-10-24T10:00:00Z");
  const batch = (status, expiresAt = new Date(now + 60_000).toISOString()) => ({ jobs: [{ status, expiresAt }] });
  for (const status of ["ENQUEUE_PENDING", "ENQUEUE_RETRY", "QUEUED", "RESULT_UNCONFIRMED", "RETRY_EXHAUSTED"]) {
    assert.equal(pdfBatchNeedsPolling(batch(status), now), true, status);
    assert.equal(pdfBatchNeedsPolling(batch(status, new Date(now).toISOString()), now), false, status);
  }
  for (const status of ["COMPLETED", "FAILED", "EXPIRED"]) assert.equal(pdfBatchNeedsPolling(batch(status), now), false, status);
  assert.equal(pdfBatchNeedsPolling({jobs: []}, now), false);
  assert.equal(pdfBatchNeedsPolling({jobs: [...batch("COMPLETED").jobs, ...batch("RESULT_UNCONFIRMED").jobs]}, now), true);
});

test('recovery handoff drains an in-flight poll and rejects arrivals after draining until resumed',async()=>{
  const barrier=createPdfRequestBarrier();
  let release,calls=0,drained=false;
  const held=new Promise(resolve=>{release=resolve;});
  const handler=barrier.wrap(async()=>{calls++;await held;return 'finished';});
  const statuses=[],response={sendStatus:status=>{statuses.push(status);return response;}};
  const active=handler({},response);
  assert.equal(barrier.size,1);
  barrier.pause();
  const drain=barrier.drain().then(()=>{drained=true;});
  await handler({},response); // Arrives while the older poll is still running.
  assert.equal(calls,1);assert.equal(drained,false);
  release();assert.equal(await active,'finished');await drain;
  assert.equal(barrier.size,0);
  await handler({},response); // Arrives after the old Set-only drain was empty.
  assert.equal(calls,1);assert.deepEqual(statuses,[503,503]);
  barrier.resume();assert.equal(await handler({},response),'finished');
  await barrier.drain();assert.equal(calls,2);assert.equal(barrier.size,0);
});
