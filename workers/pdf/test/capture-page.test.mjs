import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { captureViewerPage, observeViewerBitmaps, disposeViewerBitmaps } from '../src/capture-page.ts';

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
  await assert.rejects(captureViewerPage(page, 1, 3, 32 * 1048576), { code: 'UNSUPPORTED_SOURCE' });
});

test('offline bitmap synchronization, recreation and identity failures', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const budget = 32 * 1048576;
  async function fixture(t) {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.route('**/*', route => route.abort());
    await page.setContent('<main><section><div><h2>Page 1 / 2</h2></div><div class="bitmap"><img style="width:300px"></div></section></main>');
    await page.evaluate(async () => {
      window.makeBitmap = async (width, height, color) => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        canvas.width = canvas.height = 1;
        return URL.createObjectURL(blob);
      };
      const image = document.querySelector('img');
      image.src = await window.makeBitmap(1770, 2503, 'red');
      await image.decode();
      window.sharper = await window.makeBitmap(2334, 3301, 'green');
    });
    return page;
  }
  async function verify(capture, width, height, expected) {
    assert.equal(capture.width, width); assert.equal(capture.height, height);
    const { data, info } = await sharp(capture.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, width); assert.equal(info.height, height);
    for (const offset of [0, Math.floor(width * height / 2) * 3, (width * height - 1) * 3])
      assert.deepEqual([...data.subarray(offset, offset + 3)], expected);
  }
  await t.test('unchanged maximum native bitmap remains valid without upscaling', async t => {
    const page = await fixture(t);
    await page.evaluate(() => {
      const unrelated = document.createElement('img'); unrelated.src = window.sharper;
      document.querySelector('main').prepend(unrelated);
    });
    await verify(await captureViewerPage(page, 1, 2, budget), 1770, 2503, [255, 0, 0]);
  });
  await t.test('pending replacement with a visible busy indicator outlasts the quiet window', async t => {
    const page = await fixture(t);
    const observation = await observeViewerBitmaps(page);
    t.after(() => disposeViewerBitmaps(observation));
    await page.evaluate(() => {
      document.querySelector('section').setAttribute('aria-busy', 'true');
      document.querySelector('img').src = 'blob:null/loading-placeholder';
      setTimeout(() => {
        document.querySelector('img').src = window.sharper;
        document.querySelector('section').removeAttribute('aria-busy');
      }, 1100);
    });
    await verify(await captureViewerPage(page, 1, 2, budget, observation), 2334, 3301, [0, 128, 0]);
  });
  await t.test('decode delay and source replacement cannot capture the previous decoded image', async t => {
    const page = await fixture(t);
    await page.evaluate(() => {
      const image = document.querySelector('img');
      const decode = image.decode.bind(image);
      image.decode = async () => {
        await new Promise(resolve => setTimeout(resolve, 900));
        await decode();
      };
      setTimeout(() => { image.src = window.sharper; }, 850);
    });
    await verify(await captureViewerPage(page, 1, 2, budget), 2334, 3301, [0, 128, 0]);
  });
  await t.test('missing page DOM is recreated and decoded during lazy loading', async t => {
    const page = await fixture(t);
    await page.evaluate(() => {
      const section = document.querySelector('section'); section.remove();
      setTimeout(() => {
        const replacement = section.cloneNode(true);
        replacement.querySelector('img').src = window.sharper;
        document.querySelector('main').append(replacement);
      }, 300);
    });
    await verify(await captureViewerPage(page, 1, 2, budget), 2334, 3301, [0, 128, 0]);
  });
  await t.test('recycled page node waits for its newly associated bitmap', async t => {
    const page = await fixture(t);
    const observation = await observeViewerBitmaps(page);
    t.after(() => disposeViewerBitmaps(observation));
    await page.evaluate(() => {
      const image = document.querySelector('img');
      // Finishing the previous page's in-flight load must not clear stale ownership.
      Object.defineProperty(image, 'complete', { configurable: true, value: false });
      document.querySelector('h2').textContent = 'Page 2 / 2';
      setTimeout(() => { delete image.complete; }, 200);
      setTimeout(() => { image.src = window.sharper; }, 1400);
    });
    await verify(await captureViewerPage(page, 2, 2, budget, observation), 2334, 3301, [0, 128, 0]);
  });
  for (const duplicate of ['heading', 'image']) {
    await t.test(`ambiguous ${duplicate} fails explicitly`, async t => {
      const page = await fixture(t);
      await page.evaluate(duplicate => {
        const element = document.querySelector(duplicate === 'heading' ? 'section' : 'img');
        element.parentElement.append(element.cloneNode(true));
      }, duplicate);
      await assert.rejects(captureViewerPage(page, 1, 2, budget), { code: 'UNSUPPORTED_SOURCE' });
    });
  }
  await t.test('unreadable blob is an explicit retryable source failure', async t => {
    const page = await fixture(t);
    await page.evaluate(() => { document.querySelector('img').src = 'blob:null/missing'; });
    await assert.rejects(captureViewerPage(page, 1, 2, budget), { code: 'SOURCE_UNAVAILABLE', retryable: true });
  });
  await t.test('canvas read failure is retryable rather than a permanent source rejection', async t => {
    const page = await fixture(t);
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toDataURL = () => { throw new DOMException('temporary read failure'); };
    });
    await assert.rejects(captureViewerPage(page, 1, 2, budget), { code: 'SOURCE_UNAVAILABLE', retryable: true });
  });
  await t.test('below-DPI bitmap remains pending until the global deadline', async t => {
    const page = await fixture(t);
    await page.evaluate(async () => {
      const image = document.querySelector('img'); image.src = await window.makeBitmap(600, 849, 'red'); await image.decode();
    });
    await assert.rejects(captureViewerPage(page, 1, 2, budget, undefined, AbortSignal.timeout(1000)), { name: 'TimeoutError' });
  });
  await t.test('unexpected page termination is a retryable rendering failure', async t => {
    const page = await fixture(t);
    const capture = captureViewerPage(page, 1, 2, budget);
    const rejected = assert.rejects(capture, { code: 'SOURCE_UNAVAILABLE', retryable: true });
    await page.close();
    await rejected;
  });
  await t.test('missing bitmap cannot silently skip a page', async t => {
    const page = await fixture(t);
    await page.evaluate(() => document.querySelector('img').remove());
    await assert.rejects(captureViewerPage(page, 1, 2, budget), { code: 'SOURCE_UNAVAILABLE', retryable: true });
  });
  await t.test('remaining job deadline interrupts bitmap waiting and disposes the page', async t => {
    const page = await fixture(t);
    await page.evaluate(() => document.querySelector('img').remove());
    await assert.rejects(captureViewerPage(page, 1, 2, budget, undefined, AbortSignal.timeout(100)), { name: 'TimeoutError' });
    assert.equal(page.isClosed(), true);
  });
});
