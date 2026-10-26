import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { chromium } from 'playwright';
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { limits } from '../src/contract.ts';
import { assemblePrintableViewer, assembleViewOnlyViewer } from '../src/viewer-pdf.ts';

test('owned local Viewer produces one ordered image-only PDF and retains all permission gates', async t => {
  const root = await mkdtemp(join(tmpdir(), 'owned-viewer-pdf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent('<button>Print</button><input role="combobox" value="100%"><div style="background:red">Toolbar</div><main></main>');
  await page.evaluate(async () => {
    for (const [index, width, height, color] of [
      [1, 1770, 2503, 'red'], [2, 1800, 2547, 'white'], [3, 2400, 1696, 'blue'],
      [4, 2334, 3301, 'green'],
    ]) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = color; context.fillRect(0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const section = document.createElement('section');
      section.innerHTML = `<div><h2>Page ${index} / 4</h2></div><img style="width:300px">`;
      document.querySelector('main').append(section);
      const image = section.querySelector('img');
      image.src = URL.createObjectURL(blob);
      await image.decode();
      canvas.width = canvas.height = 1;
    }
    document.querySelector('input').addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      // The old red preview is already ~220 DPI. The new green native bitmap
      // (~290 DPI) arrives after Task 1's zoom UI settling window.
      setTimeout(() => {
        const images = document.querySelectorAll('section img');
        images[0].src = images[3].src;
      }, 600);
    }, { once: true });
  });
  const cap = limits({ PDF_PRINT_FALLBACK_ENABLED: 'true' });
  const path = join(root, 'owned-output.pdf');
  await assemblePrintableViewer(page, path, cap, AbortSignal.timeout(30000));
  const bytes = await readFile(path);
  assert.ok(bytes.length <= cap.maxBytes);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 4);
  for (const [index, width, height, expected] of [
    [0, 2334, 3301, [0, 128, 0]], [1, 1800, 2547, [255, 255, 255]], [2, 2400, 1696, [0, 0, 255]],
    [3, 2334, 3301, [0, 128, 0]],
  ]) {
    const outputPage = pdf.getPage(index);
    assert.equal(outputPage.getWidth() > outputPage.getHeight(), index === 2);
    const objects = outputPage.node.Resources().lookup(PDFName.of('XObject'), PDFDict).values();
    assert.equal(objects.length, 1, 'one page image, no toolbar or other page');
    const image = pdf.context.lookup(objects[0], PDFRawStream);
    assert.equal(image.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(), width);
    assert.equal(image.dict.lookup(PDFName.of('Height'), PDFNumber).asNumber(), height);
    assert.equal(image.dict.get(PDFName.of('Filter')).toString(), '/DCTDecode');
    const { data, info } = await sharp(Buffer.from(image.getContents())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const offset of [0, Math.floor(width * height / 2) * info.channels, (width * height - 1) * info.channels]) {
      for (let channel = 0; channel < 3; channel++) {
        assert.ok(Math.abs(data[offset + channel] - expected[channel]) <= 2,
          `page ${index + 1} bitmap identity/blank page changed`);
      }
    }
  }

  const rejectedPath = join(root, 'must-not-exist.pdf');
  const render = (override = cap, signal = AbortSignal.timeout(30000)) =>
    assemblePrintableViewer(page, rejectedPath, override, signal);
  await page.getByRole('button', { name: 'Print', exact: true }).evaluate(button => { button.disabled = true; });
  await assert.rejects(render(), { code: 'ACCESS_DENIED' });
  await page.getByRole('button', { name: 'Print', exact: true }).evaluate(button => { button.disabled = false; });
  await assert.rejects(render({ ...cap, maxPages: 2 }), { code: 'PAGE_LIMIT_EXCEEDED' });
  await assert.rejects(render({ ...cap, maxBytes: 10 }), { code: 'FILE_TOO_LARGE' });
  await assert.rejects(render(cap, AbortSignal.abort()), { name: 'AbortError' });
  await page.getByRole('combobox').evaluate(input => {
    input.addEventListener('keyup', event => {
      if (event.key === 'Enter') document.querySelector('button').disabled = true;
    });
  });
  await assert.rejects(render(), { code: 'ACCESS_DENIED' });
  assert.deepEqual(await readdir(root), ['owned-output.pdf'], 'rejections must not publish a partial PDF');
});

test('view-only assembly captures tiles without an enabled Print control', async t => {
  const root = await mkdtemp(join(tmpdir(), 'owned-viewer-view-only-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent('<button disabled>Print</button><input role="combobox" value="100%"><main></main>');
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1800; canvas.height = 2547;
    const context = canvas.getContext('2d');
    context.fillStyle = 'purple'; context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const section = document.createElement('section');
    section.innerHTML = '<div><h2>Page 1 / 1</h2></div><img style="width:300px">';
    document.querySelector('main').append(section);
    const image = section.querySelector('img');
    image.src = URL.createObjectURL(blob);
    await image.decode();
    canvas.width = canvas.height = 1;
  });
  const cap = limits({ PDF_VIEWER_SCREEN_CAPTURE_ENABLED: 'true' });
  const path = join(root, 'view-only-output.pdf');
  await assembleViewOnlyViewer(page, path, cap, AbortSignal.timeout(30000));
  const pdf = await PDFDocument.load(await readFile(path));
  assert.equal(pdf.getPageCount(), 1);
});
