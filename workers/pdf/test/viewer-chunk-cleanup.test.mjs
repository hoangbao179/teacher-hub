import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { captureViewerChunk } from '../src/viewer-chunk.ts';
import { ImagePdfWriter } from '../src/image-pdf-writer.ts';
import { longCap } from './chunk-fixture.mjs';

test('chunk failures release handles, observers and only their owned output', async t => {
  const root = await mkdtemp(join(tmpdir(), 'chunk-cleanup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const mode of ['pre-abort', 'page-close', 'encode-error', 'write-error', 'encode-abort', 'loading-abort', 'existing-output']) {
    await t.test(mode, async t => {
      const page = await browser.newPage(); t.after(() => page.close());
      await page.route('**/*', route => route.abort());
      await page.setContent('<div id="loader"></div><input role="combobox" value="100%"><main><section><h2>Page 1 / 1</h2><img style="width:300px"></section></main>');
      await page.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 2547;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1800, 2547);
        const img = document.querySelector('img'); img.src = URL.createObjectURL(await new Promise(r => canvas.toBlob(r)));
        await img.decode(); canvas.width = canvas.height = 1;
        window.activeObservers = 0; const live = new WeakSet();
        const observe = MutationObserver.prototype.observe, disconnect = MutationObserver.prototype.disconnect;
        MutationObserver.prototype.observe = function (...args) {
          // Count the Worker's bitmap observer, excluding Playwright's own
          // persistent injected-script observers used for locator execution.
          if (args[0] === document.body && args[1]?.attributeFilter?.includes('srcset') && !live.has(this)) {
            live.add(this); window.activeObservers++;
          }
          return observe.apply(this, args);
        };
        MutationObserver.prototype.disconnect = function () {
          if (live.delete(this)) window.activeObservers--;
          return disconnect.call(this);
        };
      });
      const handles = new Set();
      for (const method of ['evaluateHandle', 'waitForFunction']) {
        const original = page[method].bind(page);
        t.mock.method(page, method, async (...args) => {
          const handle = await original(...args); handles.add(handle);
          const dispose = handle.dispose.bind(handle);
          handle.dispose = async () => { handles.delete(handle); await dispose(); };
          return handle;
        });
      }
      const controller = new AbortController(), path = join(root, mode + '.pdf');
      const failure = new Error('synthetic local stage failure');
      if (mode === 'pre-abort') controller.abort();
      if (mode === 'existing-output') await writeFile(path, 'existing-owned-by-caller');
      if (mode === 'encode-error' || mode === 'encode-abort') {
        t.mock.method(sharp.prototype, 'toBuffer', async function () {
          assert.ok(this.options.input.buffer.length > 0, 'PNG remains available until encoding settles');
          if (mode === 'encode-error') throw failure;
          controller.abort(); await Promise.resolve(); return Buffer.alloc(10);
        });
      }
      if (mode === 'write-error') t.mock.method(ImagePdfWriter.prototype, 'page', async () => { throw failure; });
      if (mode === 'page-close' || mode === 'loading-abort') {
        const create = ImagePdfWriter.create;
        t.mock.method(ImagePdfWriter, 'create', async (...args) => {
          const writer = await create.apply(ImagePdfWriter, args);
          if (mode === 'page-close') await page.close();
          else {
            await page.evaluate(() => {
              const loader = document.querySelector('#loader');
              loader.style.cssText = 'position:fixed;width:20px;height:20px'; loader.role = 'progressbar';
            });
            const timer = setTimeout(() => controller.abort(), 150); t.after(() => clearTimeout(timer));
          }
          return writer;
        });
      }
      await assert.rejects(captureViewerChunk(page, path, longCap, controller.signal, { firstPage: 1, lastPage: 1 }), error => {
        if (mode === 'page-close') return error.code === 'SOURCE_UNAVAILABLE' && error.retryable === true;
        if (mode.endsWith('abort')) return error.name === 'AbortError';
        if (mode === 'existing-output') return error.code === 'EEXIST';
        return error === failure;
      });
      assert.equal(handles.size, 0, 'all acquired page handles were disposed');
      if (!page.isClosed()) assert.equal(await page.evaluate(() => window.activeObservers), 0);
      if (mode === 'existing-output') {
        assert.equal(await readFile(path, 'utf8'), 'existing-owned-by-caller'); await rm(path);
      }
      assert.deepEqual(await readdir(root), []);
    });
  }
});
