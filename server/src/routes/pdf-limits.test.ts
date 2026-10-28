import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { createRouter } from './index';
import { PublicPdfController } from '../controllers/public-pdf.controller';
import { PdfService } from '../services/pdf.service';
import { PdfRepository } from '../repositories/pdf.repository';
import { DisabledPdfProvider } from '../services/pdf-provider';
import { pdfSettings } from '../config/pdf-settings';

test('public capabilities and IP guards allow 20 v2 submissions with session refresh/replays', async t => {
  // Real route wiring and capability service, no database or cloud connections.
  const controller = new PublicPdfController(new PdfService(new PdfRepository(),
    new DisabledPdfProvider(), pdfSettings({ PDF_API_ENABLED: 'true', PDF_CHUNKED_JOBS_ENABLED: 'true' })));
  controller.session = async (_req, res) => { res.json({ data: { available: true } }); };
  controller.create = async (_req, res) => { res.status(201).json({ data: {} }); };
  controller.retry = async (_req, res) => { res.status(201).json({ data: {} }); };
  const app = express();
  app.set('trust proxy', 1);
  app.use(createRouter(controller));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/public/pdf`;
  const capabilities = (await (await fetch(`${base}/capabilities`)).json()).data;
  assert.deepEqual([capabilities.maxBatchesPerHour, capabilities.maxActiveJobs,
    capabilities.maxLinksPerBatch, capabilities.maxPages, capabilities.maxBytes], [20, 3, 1, 200, 150 * 1024 * 1024]);
  const post = (path: string, ip = '192.0.2.1') => fetch(base + path, {
    method: 'POST', headers: { 'X-Forwarded-For': ip },
  });
  // Twenty creations, twenty replays and twenty retries share one IP counter.
  for (let i = 0; i < 20; i++) {
    assert.equal((await post('/session')).status, 200);
    assert.equal((await post('/batches')).status, 201);
    assert.equal((await post('/batches')).status, 201);
    assert.equal((await post('/jobs/fixture/retry')).status, 201);
  }
  const blocked = await post('/jobs/fixture/retry');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'PDF_RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  for (let i = 20; i < 60; i++) assert.equal((await post('/session')).status, 200);
  assert.equal((await post('/session')).status, 429);
  assert.equal((await post('/session', '192.0.2.2')).status, 200);
  assert.equal((await post('/batches', '192.0.2.2')).status, 201);
});
