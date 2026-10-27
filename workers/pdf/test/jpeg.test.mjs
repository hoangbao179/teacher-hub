import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { encodeViewerJpeg } from '../src/jpeg.ts';
import { PDF_VIEWER_JPEG_QUALITIES, PDF_VIEWER_TARGET_PAGE_BYTES } from '@teacher/shared';
import { printPageSize } from '../src/print-policy.ts';

test('adaptive encoding stops early, retries from original pixels and keeps soft target soft', async t => {
  const png = Buffer.from('original native pixels');
  for (const [sizes, remaining, expected] of [
    [[100, 90, 80], 1000, [90]],
    [[600000, 480000, 400000], 1000000, [90, 85]],
    [[600000, 550000, 510000], 1000000, [90, 85, 80]],
    [[100, 90, 80], 85, [90, 85, 80]],
    [[600000, 610000, 620000], 1000000, [90, 85, 80]],
  ]) {
    const qualities = [];
    let next = 0;
    const jpeg = t.mock.method(sharp.prototype, 'jpeg', function (options) {
      assert.equal(options.chromaSubsampling, '4:4:4');
      assert.equal(this.options.input.buffer, png);
      qualities.push(options.quality);
      return this;
    });
    const buffer = t.mock.method(sharp.prototype, 'toBuffer', async () => Buffer.alloc(sizes[next++]));
    try {
      const result = await encodeViewerJpeg(png, new AbortController().signal, remaining);
      assert.deepEqual(qualities, expected);
      assert.equal(result.length, Math.min(...sizes.slice(0, expected.length)));
    } finally { jpeg.mock.restore(); buffer.mock.restore(); }
  }
  assert.deepEqual(PDF_VIEWER_JPEG_QUALITIES, [90, 85, 80]);
  assert.equal(PDF_VIEWER_TARGET_PAGE_BYTES, 500000);
});

test('real JPEG keeps native dimensions and decoded small Vietnamese text pixels close to source', async () => {
  const svg = Buffer.from(`<svg width="1800" height="2547"><rect width="100%" height="100%" fill="white"/>
    <text x="50" y="100" font-size="24">Tiếng Việt: ă â ê ô ơ ư đ — Lớp học cô Vy</text>
    <path d="M50 130H1750" stroke="black" stroke-width="1"/></svg>`);
  const png = await sharp(svg).png().toBuffer();
  const jpeg = await encodeViewerJpeg(png, AbortSignal.timeout(10000), 20000000);
  const metadata = await sharp(jpeg).metadata();
  assert.equal(metadata.width, 1800);
  assert.equal(metadata.height, 2547);
  const region = { left: 40, top: 60, width: 1200, height: 90 };
  const a = await sharp(png).flatten({ background: 'white' }).removeAlpha().extract(region).raw().toBuffer();
  const b = await sharp(jpeg).removeAlpha().extract(region).raw().toBuffer();
  let squared = 0;
  for (let i = 0; i < a.length; i++) squared += (a[i] - b[i]) ** 2;
  assert.ok(Math.sqrt(squared / a.length) < 5, 'coarse corruption guard, not paper-print acceptance');
  assert.ok(printPageSize(1800, 2547).dpi >= 200);
  assert.throws(() => printPageSize(1600, 2263), { reason: 'bitmap-dpi-low' });
});

test('abort before and during encoder never returns a candidate', async t => {
  await assert.rejects(encodeViewerJpeg(Buffer.alloc(0), AbortSignal.abort(), 1000), { name: 'AbortError' });
  const controller = new AbortController();
  t.mock.method(sharp.prototype, 'toBuffer', async () => { controller.abort(); return Buffer.alloc(10); });
  await assert.rejects(encodeViewerJpeg(Buffer.alloc(1), controller.signal, 1000), { name: 'AbortError' });
});
