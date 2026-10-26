import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { captureViewerPage } from '../src/capture-page.ts';

test('browser capture waits for zoom detail, preserves blank/landscape pages and excludes toolbar', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort()); // Entirely local owned fixture.
  await page.setContent('<button>Toolbar must not appear</button><main></main>');
  await page.evaluate(async () => {
    const main = document.querySelector('main');
    window.replaceBitmap = async (index, width, height, color) => {
      let image = document.querySelector(`[data-page="${index}"] img`);
      if (!image) {
        const wrapper = document.createElement('section');
        wrapper.dataset.page = String(index);
        wrapper.innerHTML = `<div><h2>Page ${index} / 3</h2></div><img style="width:300px">`;
        main.append(wrapper);
        image = wrapper.querySelector('img');
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = color; context.fillRect(0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const old = image.src;
      image.src = URL.createObjectURL(blob);
      await image.decode();
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      canvas.width = canvas.height = 1;
    };
    await window.replaceBitmap(1, 600, 849, 'red');
    await window.replaceBitmap(2, 2400, 3396, 'white');
    await window.replaceBitmap(3, 2400, 1696, 'blue');
    // Simulate the lazy replacement caused by zoom, after an already complete blob.
    setTimeout(() => { void window.replaceBitmap(1, 2400, 3396, 'green'); }, 400);
  });
  for (const [index, width, height, pixel] of [
    [1, 2400, 3396, [0, 128, 0]], [2, 2400, 3396, [255, 255, 255]],
    [3, 2400, 1696, [0, 0, 255]],
  ]) {
    const capture = await captureViewerPage(page, index, 3, 32 * 1048576);
    assert.equal(capture.width, width);
    assert.equal(capture.height, height);
    const { data, info } = await sharp(capture.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 3);
    // All pixels belong to the chosen page; no toolbar, other page or stale red preview.
    for (let offset = 0; offset < data.length; offset += 3) {
      if (data[offset] !== pixel[0] || data[offset + 1] !== pixel[1] || data[offset + 2] !== pixel[2]) {
        assert.fail(`Unexpected pixel on page ${index} at ${offset}`);
      }
    }
  }
  await assert.rejects(captureViewerPage(page, 1, 3, 10), { code: 'FILE_TOO_LARGE' });
  // Exercise the canvas preflight without making Chromium allocate/decode a
  // deliberately oversized image (which can stall independently of our guard).
  await page.evaluate(() => {
    const image = document.querySelector('[data-page="1"] img');
    Object.defineProperties(image, {
      naturalWidth: { value: 4000 }, naturalHeight: { value: 4000 },
    });
  });
  await assert.rejects(captureViewerPage(page, 1, 3, 32 * 1048576), { code: 'UNSUPPORTED_SOURCE' });
  await page.evaluate(() => document.querySelector('main').append(document.querySelector('section').cloneNode(true)));
  await assert.rejects(captureViewerPage(page, 1, 3, 32 * 1048576), /strict mode violation/);
});
