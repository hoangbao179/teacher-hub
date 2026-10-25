// Experimental anonymous Drive Viewer -> image-only print PDF.
// Runs locally using scripts/pdf-poc dependencies; NOT wired to the production Worker.
// Accept only publicly viewable, print-enabled Drive PDFs. Never use login, cookies,
// internal tile endpoints, or owner-disabled Print to bypass download restrictions.
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { parsePublicDriveLink, allowedAnonymousRequest, printPageSize } from './anonymous-print-policy.mjs';

const [link, destination] = process.argv.slice(2);
if (!link || !destination || process.argv.length !== 4) {
  throw Error('Usage: node scripts/pdf-poc/anonymous-print.mjs DRIVE_FILE_VIEW_URL OUTPUT.pdf');
}
const fileId = parsePublicDriveLink(link);
if (!destination.toLowerCase().endsWith('.pdf')) throw Error('OUTPUT_MUST_BE_PDF');

const MAX_PAGES = 40, MAX_CAPTURED_BYTES = 32 * 1048576, MAX_OUTPUT_BYTES = 10 * 1048576;
const MAX_WIRE_BYTES = 64 * 1048576, MAX_REQUESTS = 500, DEADLINE_MS = 120000;
sharp.cache(false); sharp.concurrency(1);
let browser, ctx, timeout;
let requests = 0, wireBytes = 0, capturedBytes = 0;
const document = await PDFDocument.create();
const screenshotMeta = [];
try {
  browser = await chromium.launch({headless:true});
  ctx = await browser.newContext({
    locale:'vi-VN', viewport:{width:1280,height:900},deviceScaleFactor:1,
    acceptDownloads:false, serviceWorkers:'block',
  });
  timeout = setTimeout(() => { void ctx.close().catch(() => {}); }, DEADLINE_MS);
  await ctx.route('**/*', route => {
    requests++;
    if (requests > MAX_REQUESTS ||
        !allowedAnonymousRequest(route.request().url(),fileId,route.request().isNavigationRequest())) {
      return route.abort();
    }
    return route.continue();
  });
  ctx.on('requestfinished', async req => {
    try {
      wireBytes += (await req.sizes()).responseBodySize;
      if (wireBytes > MAX_WIRE_BYTES) await ctx.close();
    } catch { /* Context may be shutting down. */ }
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  await page.goto('https://drive.google.com/file/d/' + fileId + '/view', {
    waitUntil:'domcontentloaded',timeout:30000,
  });
  // This path requires an anonymous viewer with an enabled Print action.
  const print = page.getByRole('button',{name:/^(In|Print)$/i});
  if (await print.count() !== 1 || !(await print.isEnabled())) {
    throw Error('PRINT_NOT_PERMITTED_OR_LOGIN_REQUIRED');
  }
  const labels = await page.locator('h2').allTextContents();
  const first = labels.map(x => /(?:^|\D)1\s*\/\s*(\d+)\s*$/.exec(x)).find(Boolean);
  const count = Number(first?.[1]);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PAGES) {
    throw Error('PAGE_COUNT_UNAVAILABLE_OR_EXCEEDS_LIMIT');
  }
  const zoom = page.getByRole('combobox').first();
  if (await zoom.count() !== 1) throw Error('VIEWER_ZOOM_UNAVAILABLE');
  await zoom.fill('300%');
  await zoom.press('Enter');

  for (let index = 1; index <= count; index++) {
    const heading = page.locator('h2').filter({
      hasText:new RegExp('(?:^|\\D)' + index + '\\s*\\/\\s*' + count + '\\s*$'),
    }).first();
    await heading.scrollIntoViewIfNeeded();
    await page.waitForFunction(({ index, count }) => {
      const re = new RegExp('(?:^|\\D)' + index + '\\s*\\/\\s*' + count + '\\s*$');
      const heading = [...document.querySelectorAll('h2')].find(h => re.test(h.textContent||''));
      const image = heading?.parentElement?.parentElement?.querySelector('img');
      return Boolean(image?.complete && image.src.startsWith('blob:') &&
        image.naturalWidth > 0 && image.naturalHeight > 0);
    }, { index, count }, { timeout:15000 });
    // Use only the rendered image visible through ordinary canvas APIs.
    const captured = await heading.evaluate(h => {
      const image = h.parentElement?.parentElement?.querySelector('img');
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width * height > 12_000_000) throw Error('CAPTURE_TOO_LARGE');
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(image,0,0);
      const png = canvas.toDataURL('image/png');
      canvas.width = canvas.height = 1;
      return { width, height, png };
    });
    const paper = printPageSize(captured.width,captured.height);
    // Refuse deceptive "print quality" claims from tiny previews.
    if (paper.dpi < 150) throw Error('VIEWER_RESOLUTION_TOO_LOW');
    const source = Buffer.from(captured.png.split(',')[1], 'base64');
    capturedBytes += source.length;
    if (capturedBytes > MAX_CAPTURED_BYTES) throw Error('CAPTURE_BYTE_LIMIT');
    const jpeg = await sharp(source).jpeg({quality:93,chromaSubsampling:'4:4:4'}).toBuffer();
    const image = await document.embedJpg(jpeg);
    const outputPage = document.addPage([paper.width,paper.height]);
    outputPage.drawImage(image,{x:paper.x,y:paper.y,width:paper.outputWidth,height:paper.outputHeight});
    await document.flush();
    screenshotMeta.push({index, pixels:[captured.width,captured.height],effectiveDpi:Math.round(paper.dpi)});
  }
  if (screenshotMeta.length !== count) throw Error('INCOMPLETE_CAPTURE');
  const result = await document.save();
  if (result.length > MAX_OUTPUT_BYTES) throw Error('OUTPUT_TOO_LARGE');
  // No overwrites and no temporary page screenshots retained.
  await fs.writeFile(destination,result,{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PRINT_PDF_CREATED',pages:count,bytes:result.length,
    minDpi:Math.min(...screenshotMeta.map(p=>p.effectiveDpi)),output:destination}));
} finally {
  clearTimeout(timeout);
  await ctx?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
