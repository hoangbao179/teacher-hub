// Offline capacity probe, NOT a Viewer/browser/Cloud Run benchmark or a raised product cap.
// Run one document per disposable 1 CPU / 2 GiB container to measure cgroup peaks.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { encodeViewerJpeg } from '../src/jpeg.ts';
import { printPageSize } from '../src/print-policy.ts';
import { PDF_OUTPUT_MAX_BYTES, PDF_SOURCE_MAX_BYTES } from '@teacher/shared';

const count = Number(process.argv[2]);
assert.ok([17, 50, 100, 200].includes(count));
const dir = await mkdtemp(join(tmpdir(), 'compression-probe-'));
const start = performance.now();
const cpu = process.cpuUsage();
const doc = await PDFDocument.create();
sharp.cache(false); sharp.concurrency(1);
let jpegBytes = 0, largestPageBytes = 0;
const identities = [];
try {
  for (let index = 1; index <= count; index++) {
    // Unique index, Vietnamese diacritics, rules and deterministic photo-like texture.
    // A4 native detail ~220 DPI; alternating orientation, blank every 20th page.
    const landscape = index % 10 === 0;
    const [width, height] = landscape ? [2547, 1800] : [1800, 2547];
    const blank = index % 20 === 0;
    const noise = Buffer.alloc(700 * 700 * 3);
    let seed = index;
    for (let i = 0; i < noise.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noise[i] = seed >>> 24; }
    const svg = Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>
      ${blank ? '' : `<text x="40" y="90" font-family="sans-serif" font-size="24">Trang ${index}: Tiếng Việt — ă â ê ô ơ ư đ</text>
        <path d="M40 120H1500M40 160H1500M40 200H1500" stroke="black" stroke-width="1"/>`}</svg>`);
    let pipeline = sharp(svg);
    if (!blank) pipeline = pipeline.composite([{ input: noise, raw: { width: 700, height: 700, channels: 3 }, left: 40, top: 250 }]);
    let png = await pipeline.png().toBuffer();
    const jpeg = await encodeViewerJpeg(png, AbortSignal.timeout(20000), 150 * 1048576 - jpegBytes);
    png = null;
    const paper = printPageSize(width, height);
    assert.ok(paper.dpi >= 200);
    jpegBytes += jpeg.length; largestPageBytes = Math.max(largestPageBytes, jpeg.length);
    identities.push(createHash('sha256').update(jpeg).digest('hex'));
    const embedded = await doc.embedJpg(jpeg);
    doc.addPage([paper.pageWidth, paper.pageHeight]).drawImage(embedded,
      { x: paper.x, y: paper.y, width: paper.width, height: paper.height });
    await doc.flush();
  }
  const bytes = await doc.save();
  const path = join(dir, 'result.pdf');
  await writeFile(path, bytes, { flag: 'wx' });
  execFileSync('qpdf', ['--check', path], { stdio: 'pipe', timeout: 15000 });
  assert.equal(Number(execFileSync('qpdf', ['--show-npages', path], { encoding: 'utf8' })), count);
  const reopened = await PDFDocument.load(bytes);
  for (let index = 0; index < count; index++) {
    const page = reopened.getPage(index);
    assert.equal(page.getWidth() > page.getHeight(), (index + 1) % 10 === 0);
    const refs = page.node.Resources().lookup(PDFName.of('XObject'), PDFDict).values();
    assert.equal(refs.length, 1);
    const image = reopened.context.lookup(refs[0], PDFRawStream);
    assert.equal(createHash('sha256').update(image.getContents()).digest('hex'), identities[index], 'ordered page bytes survive serialization');
  }
  let peak = null;
  try { peak = Number(await readFile('/sys/fs/cgroup/memory.peak', 'utf8')); } catch { /* local non-Linux run */ }
  const usage = process.cpuUsage(cpu);
  console.log(JSON.stringify({ kind: 'offline-compression-capacity', pages: count, bytes: bytes.length,
    jpegBytes, averagePageBytes: Math.round(jpegBytes / count), largestPageBytes,
    withinCurrentOutputCap: bytes.length <= PDF_OUTPUT_MAX_BYTES, proposed150MiB: bytes.length <= 150 * 1048576,
    sourceCapBytes: PDF_SOURCE_MAX_BYTES, wallSeconds: (performance.now() - start) / 1000,
    nodeCpuSeconds: (usage.user + usage.system) / 1e6, cgroupPeakBytes: peak,
    nodeMaxRssKiB: process.resourceUsage().maxRSS, qpdf: 'PASS', pageOrder: 'PASS', nativeDpi: '>=200',
    viewerE2E: false, paperPrintQuality: 'NOT_VERIFIED', note: 'Synthetic texture, no browser; includes verification allocations' }));
} finally { await rm(dir, { recursive: true, force: true }); }
