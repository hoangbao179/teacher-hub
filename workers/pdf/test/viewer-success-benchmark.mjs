// Successful offline Viewer discovery + every chunk, with real Chromium/Sharp/PDF
// writer. No Drive, queue, GCS, qpdf or final merge; never a production E2E claim.
// Run sequentially: node test/viewer-success-benchmark.mjs <git-sha|working> <pages> <runs>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { ImagePdfWriter } from '../src/image-pdf-writer.ts';
import { longCap } from './chunk-fixture.mjs';

const [ref, pageArg = '17', runArg = '3'] = process.argv.slice(2);
assert.match(ref ?? '', /^(working|[a-f0-9]{7,40})$/);
const pages = Number(pageArg), runs = Number(runArg);
assert.ok([5, 17, 50, 100, 139, 200].includes(pages));
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 5);
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const artifacts = join(repo, '.artifacts/pdf-pr73-deep-audit');
await mkdir(artifacts, { recursive: true });
const scratch = await mkdtemp(join(artifacts, 'success-'));
let active;
const originalBuffer = sharp.prototype.toBuffer, originalWrite = ImagePdfWriter.prototype.page;
sharp.prototype.toBuffer = async function (...args) {
  if (!active || this.options.formatOut !== 'jpeg') return originalBuffer.apply(this, args);
  const metrics = active, at = performance.now(); metrics.jpegAttempts++;
  try { return await originalBuffer.apply(this, args); }
  finally { metrics.jpegMs += performance.now() - at; }
};
ImagePdfWriter.prototype.page = async function (...args) {
  const at = performance.now();
  try { return await originalWrite.apply(this, args); }
  finally { if (active) active.writerMs += performance.now() - at; }
};
try {
  let moduleUrl = new URL('../src/viewer-chunk.ts', import.meta.url).href;
  if (ref !== 'working') {
    // Freeze the four audited modules at a Git commit. Other dependencies are
    // identical installed modules. Keep snapshots outside tracked source.
    const files = ['capture-page.ts', 'viewer-chunk.ts', 'viewer-ready.ts', 'viewer-pdf.ts'];
    for (const file of files) {
      let source = execFileSync('git', ['show', `${ref}:workers/pdf/src/${file}`], { cwd: repo, encoding: 'utf8' });
      source = source.replace(/from '(.*?)'/g, (_match, name) => {
        const url = name.startsWith('./')
          ? files.includes(name.slice(2)) ? pathToFileURL(join(scratch, name)).href
            : new URL('../src/' + name.slice(2), import.meta.url).href
          : import.meta.resolve(name);
        return `from '${url}'`;
      });
      await writeFile(join(scratch, file), source);
    }
    moduleUrl = pathToFileURL(join(scratch, 'viewer-chunk.ts')).href;
  }
  const { captureViewerChunk } = await import(moduleUrl);
  for (let run = 1; run <= runs; run++) {
    const m = { launchMs: 0, contextMs: 0, fixtureMs: 0, readinessMs: 0, zoomMs: 0,
      seekMs: 0, captureMs: 0, transferMs: 0, jpegMs: 0, jpegAttempts: 0, writerMs: 0,
      closeMs: 0, pngMs: 0, decodeMs: 0, fixtureRenderMs: 0, pngExports: {}, partBytes: 0 };
    let expected;
    const cpu = process.cpuUsage(), start = performance.now();
    for (let step = 0; step <= Math.ceil(pages / 10); step++) {
      let at = performance.now(); const browser = await chromium.launch({ headless: true });
      m.launchMs += performance.now() - at;
      try {
        at = performance.now();
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage(); await page.route('**/*', route => route.abort());
        m.contextMs += performance.now() - at;
        at = performance.now();
        await page.setContent(`<input role="combobox" value="100%"><main style="height:600px;overflow:auto">
          <div style="position:relative;height:${pages * 600}px"><section style="position:absolute;left:0;top:0">
          <h2 style="margin:0"></h2><img style="width:300px"></section></div></main>`);
        await page.evaluate(async total => {
          const metrics = window.metrics = { pngMs: 0, decodeMs: 0, fixtureRenderMs: 0, pngExports: {} };
          const decode = HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode = async function () {
            const at = performance.now(); try { return await decode.call(this); }
            finally { metrics.decodeMs += performance.now() - at; }
          };
          const draw = CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
            this.canvas.pageIndex = image.dataset?.pageIndex; return draw.call(this, image, ...args);
          };
          const png = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function (...args) {
            const at = performance.now();
            try { return png.apply(this, args); }
            finally {
              metrics.pngMs += performance.now() - at;
              metrics.pngExports[this.pageIndex] = (metrics.pngExports[this.pageIndex] ?? 0) + 1;
            }
          };
          let current = 0;
          const main = document.querySelector('main'), section = document.querySelector('section');
          async function render(index) {
            if (index === current) return; current = index;
            const at = performance.now(); main.setAttribute('aria-busy', 'true');
            section.style.top = `${(index - 1) * 600}px`; section.querySelector('h2').textContent = `Page ${index} / ${total}`;
            const canvas = document.createElement('canvas');
            [canvas.width, canvas.height] = index % 10 === 0 ? [2547, 1800] : [1800, 2547];
            const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (index % 17 !== 0) {
              ctx.fillStyle = `rgb(${index * 37 % 256},${index * 71 % 256},${index * 113 % 256})`;
              ctx.fillRect(0, 0, canvas.width, 40); ctx.fillStyle = 'black'; ctx.font = '24px sans-serif';
              ctx.fillText(`Trang ${index}: Tiếng Việt — ă â ê ô ơ ư đ`, 50, 100);
              ctx.fillRect(50, 130, 1200, 1);
              const noise = ctx.createImageData(700, 700); let seed = index;
              for (let p = 0; p < noise.data.length; p += 4) {
                for (let c = 0; c < 3; c++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noise.data[p + c] = seed >>> 24; }
                noise.data[p + 3] = 255;
              }
              ctx.putImageData(noise, 50, 250);
            }
            const src = URL.createObjectURL(await new Promise(r => canvas.toBlob(r)));
            canvas.width = canvas.height = 1;
            const old = section.querySelector('img'), image = old.cloneNode();
            image.src = src; image.dataset.pageIndex = String(index); old.replaceWith(image); await image.decode();
            if (old.src.startsWith('blob:')) URL.revokeObjectURL(old.src);
            main.removeAttribute('aria-busy'); metrics.fixtureRenderMs += performance.now() - at;
          }
          await render(1);
          main.addEventListener('scroll', () => { void render(Math.min(total, Math.floor(main.scrollTop / 600) + 1)); });
          metrics.fixtureRenderMs = metrics.decodeMs = 0;
        }, pages);
        m.fixtureMs += performance.now() - at;
        const wait = page.waitForFunction.bind(page);
        page.waitForFunction = async (fn, ...args) => {
          const source = String(fn), key = source.includes('maxPixels') ? 'captureMs'
            : source.includes('lastSeen') ? 'seekMs' : source.includes('state.signature') ? 'readinessMs' : 'zoomMs';
          const at = performance.now(); const handle = await wait(fn, ...args); m[key] += performance.now() - at;
          const json = handle.jsonValue.bind(handle);
          handle.jsonValue = async () => { const at = performance.now(); try { return await json(); } finally { m.transferMs += performance.now() - at; } };
          return handle;
        };
        const path = step ? join(scratch, `part-${step}.pdf`) : null;
        active = m;
        const info = await captureViewerChunk(page, path, longCap, AbortSignal.timeout(120000),
          step ? { firstPage: (step - 1) * 10 + 1, lastPage: Math.min(pages, step * 10) } : undefined, expected);
        active = undefined; expected ??= info;
        const metrics = await page.evaluate(() => window.metrics);
        for (const key of ['pngMs', 'decodeMs', 'fixtureRenderMs']) m[key] += metrics[key];
        for (const [index, count] of Object.entries(metrics.pngExports)) m.pngExports[index] = (m.pngExports[index] ?? 0) + count;
        at = performance.now(); await context.close(); m.closeMs += performance.now() - at;
      } finally { active = undefined; at = performance.now(); await browser.close(); m.closeMs += performance.now() - at; }
    }
    const wallMs = performance.now() - start, usage = process.cpuUsage(cpu);
    // Verify every page's identity marker, blank/landscape dimensions and count
    // outside the benchmark timer. This does not replace mandatory qpdf validation.
    for (let step = 1; step <= Math.ceil(pages / 10); step++) {
      const path = join(scratch, `part-${step}.pdf`), bytes = await readFile(path); m.partBytes += bytes.length;
      const pdf = await PDFDocument.load(bytes); assert.equal(pdf.getPageCount(), Math.min(10, pages - (step - 1) * 10));
      for (const [offset, page] of pdf.getPages().entries()) {
        const index = (step - 1) * 10 + offset + 1;
        const refs = page.node.Resources().lookup(PDFName.of('XObject'), PDFDict).values(); assert.equal(refs.length, 1);
        const image = pdf.context.lookup(refs[0], PDFRawStream), jpeg = Buffer.from(image.getContents());
        const meta = await sharp(jpeg).metadata(); assert.equal(meta.width, index % 10 === 0 ? 2547 : 1800);
        assert.equal(meta.height, index % 10 === 0 ? 1800 : 2547);
        const pixel = await sharp(jpeg).extract({ left: 8, top: 8, width: 1, height: 1 }).raw().toBuffer();
        const color = index % 17 === 0 ? [255, 255, 255] : [index * 37 % 256, index * 71 % 256, index * 113 % 256];
        color.forEach((value, c) => assert.ok(Math.abs(pixel[c] - value) < 5, `ordered page ${index}`));
      }
      await rm(path);
    }
    const result = { ref, pages, run, platform: process.platform, node: process.version,
      wallMs, wallWithoutFixtureSetupMs: wallMs - m.fixtureMs, nodeCpuMs: (usage.user + usage.system) / 1000,
      nodePeakRssKiB: process.resourceUsage().maxRSS, ...m, successfulPartsAndOrder: 'PASS',
      hardCpuRamLimit: false, qpdf: 'NOT_VERIFIED', cloud: false,
      note: 'PNG/decode are nested in capture; fixtureRender overlaps seek/capture. CPU/RSS exclude Chromium.' };
    await writeFile(join(artifacts, `${ref}-${pages}-${run}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
} finally {
  sharp.prototype.toBuffer = originalBuffer; ImagePdfWriter.prototype.page = originalWrite;
  await rm(scratch, { recursive: true, force: true });
}
