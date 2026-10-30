import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { captureViewerChunk } from '../src/viewer-chunk.ts';
import { ImagePdfWriter } from '../src/image-pdf-writer.ts';
import { longCap } from './chunk-fixture.mjs';

test('anchor reuse waits for loading that leaves the bitmap signature unchanged', async t => {
  const root = await mkdtemp(join(tmpdir(), 'anchor-loading-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const mode of ['role', 'css-visibility', 'overlap', 'offscreen', 'changed-source']) {
    await t.test(mode, async t => {
      const page = await browser.newPage();
      t.after(() => page.close());
      await page.route('**/*', route => route.abort());
      await page.setContent(`<style>#loader {position:fixed;left:500px;top:0;width:20px;height:20px}</style>
        <div id="loader"></div><input role="combobox" value="100%">
        <main><section><h2>Page 1 / 1</h2><img style="width:300px"></section></main>`);
      await page.evaluate(async mode => {
        const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 2547;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'green'; ctx.fillRect(0, 0, 1800, 2547);
        const img = document.querySelector('img');
        img.src = URL.createObjectURL(await new Promise(r => canvas.toBlob(r))); await img.decode();
        ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, 1800, 2547);
        window.newSource = URL.createObjectURL(await new Promise(r => canvas.toBlob(r)));
        canvas.width = canvas.height = 1;
        if (mode === 'css-visibility') {
          document.querySelector('#loader').role = 'progressbar';
          document.styleSheets[0].insertRule('#loader {visibility:hidden}', 1);
        }
        const original = HTMLCanvasElement.prototype.toDataURL; window.pngExports = 0;
        HTMLCanvasElement.prototype.toDataURL = function (...args) {
          window.pngExports++; return original.apply(this, args);
        };
      }, mode);
      const create = ImagePdfWriter.create;
      t.mock.method(ImagePdfWriter, 'create', async (...args) => {
        const writer = await create.apply(ImagePdfWriter, args);
        // The anchor is already captured. Changing role/CSSOM does not change its
        // node, source or geometry and was not observed by the original guard.
        await page.evaluate(mode => {
          if (mode === 'css-visibility') document.styleSheets[0].deleteRule(1);
          else document.querySelector('#loader').role = 'progressbar';
          if (mode === 'overlap') {
            const extra = document.querySelector('img').cloneNode(true); extra.id = 'transient';
            document.querySelector('section').append(extra);
          }
          if (mode === 'offscreen') {
            const spacer = document.createElement('div'); spacer.style.height = '1600px';
            document.querySelector('main').before(spacer);
          }
          window.loadingEnded = false;
          const complete = async () => {
            const old = document.querySelector('img'); const next = old.cloneNode(true);
            if (mode === 'changed-source') next.src = window.newSource;
            document.querySelector('#transient')?.remove();
            old.replaceWith(next); await next.decode();
            const loader = document.querySelector('#loader'); loader.replaceWith(document.createElement('div'));
            window.loadingEnded = true;
          };
          if (mode === 'offscreen') window.addEventListener('scroll', () => { void complete(); }, { once: true });
          else setTimeout(complete, 900);
        }, mode);
        const writePage = writer.page.bind(writer);
        writer.page = async (...values) => {
          assert.equal(await page.evaluate(() => window.loadingEnded), true,
            'must not publish the old anchor while a visible progressbar is active');
          return writePage(...values);
        };
        return writer;
      });
      const path = join(root, mode + '.pdf');
      const capture = captureViewerChunk(page, path, longCap, AbortSignal.timeout(15000), { firstPage: 1, lastPage: 1 });
      if (mode === 'changed-source') {
        await assert.rejects(capture, { code: 'UNSUPPORTED_SOURCE', reason: 'anchor-fingerprint-mismatch' });
      } else {
        await capture;
        assert.equal((await PDFDocument.load(await readFile(path))).getPageCount(), 1);
      }
      assert.equal(await page.evaluate(() => window.pngExports), 2, 'loading forces one recapture after replacement');
    });
  }
  assert.deepEqual((await readdir(root)).sort(), ['css-visibility.pdf', 'offscreen.pdf', 'overlap.pdf', 'role.pdf']);
});
