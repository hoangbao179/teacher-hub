import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { JobError, type Limits } from './contract.ts';
import { allowedPrintRequest, printPageSize } from './print-policy.ts';

// Anonymous, print-enabled Drive viewer ONLY.  Never accepts an arbitrary URL,
// credentials, storage state or a login-only document. The browser is disposable.
export async function renderPrintablePdf(fileId: string, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(fileId)) throw new JobError('UNSUPPORTED_SOURCE');
  signal.throwIfAborted();
  const maxBytes = cap.maxBytes, maxPages = cap.maxPages;
  const maxCaptures = 32 * 1048576, maxWireBytes = 64 * 1048576;
  const doc = await PDFDocument.create();
  sharp.cache(false); sharp.concurrency(1);
  let ctx: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>> | undefined;
  const browser = await chromium.launch({ headless: true, chromiumSandbox: false,
    args: ['--disable-background-networking'] });
  const abort = () => { void browser.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  let requests = 0, wireBytes = 0, capturedBytes = 0;
  try {
    signal.throwIfAborted();
    ctx = await browser.newContext({locale:'vi-VN', viewport:{width:1280,height:900},
      deviceScaleFactor:1, acceptDownloads:false, serviceWorkers:'block'});
    await ctx.route('**/*', route => {
      if (++requests > 500 || !allowedPrintRequest(route.request().url(), fileId, route.request().isNavigationRequest()))
        return route.abort();
      return route.continue();
    });
    ctx.on('requestfinished', async request => {
      try {
        wireBytes += (await request.sizes()).responseBodySize;
        if (wireBytes > maxWireBytes) await ctx?.close();
      } catch { /* browser context is being closed */ }
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`https://drive.google.com/file/d/${fileId}/view`,
      {waitUntil:'domcontentloaded',timeout:30000});
    signal.throwIfAborted();
    const print = page.getByRole('button', {name:/^(In|Print)$/i});
    await print.first().waitFor({state:'visible',timeout:15000})
      .catch(() => { throw new JobError('ACCESS_DENIED'); });
    if (await print.count() !== 1 || !(await print.isEnabled()))
      throw new JobError('ACCESS_DENIED');

    await page.locator('h2').filter({hasText:/1\s*\/\s*\d+\s*$/}).first().waitFor();
    const labels = await page.locator('h2').allTextContents();
    const first = labels.map(s => /(?:^|\D)1\s*\/\s*(\d+)\s*$/.exec(s)).find(Boolean);
    const count = Number(first?.[1]);
    if (!Number.isInteger(count) || count < 1) throw new JobError('UNSUPPORTED_SOURCE');
    if (count > maxPages) throw new JobError('PAGE_LIMIT_EXCEEDED');

    const zoom = page.getByRole('combobox').first();
    if (await zoom.count() !== 1) throw new JobError('UNSUPPORTED_SOURCE');
    await zoom.fill('300%'); await zoom.press('Enter');
    for (let n = 1; n <= count; n++) {
      signal.throwIfAborted();
      const re = new RegExp('(?:^|\\D)' + n + '\\s*\\/\\s*' + count + '\\s*$');
      const heading = page.locator('h2').filter({hasText:re}).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForFunction(({index,total}) => {
        const re = new RegExp('(?:^|\\D)' + index + '\\s*\\/\\s*' + total + '\\s*$');
        const h = [...document.querySelectorAll('h2')].find(e => re.test(e.textContent||''));
        const image = h?.parentElement?.parentElement?.querySelector('img');
        return Boolean(image?.complete && image.src.startsWith('blob:') &&
          image.naturalWidth > 0 && image.naturalHeight > 0);
      }, {index:n,total:count}, {timeout:15000});
      const captured = await heading.evaluate(h => {
        const image = h.parentElement?.parentElement?.querySelector('img');
        if (!image) throw Error('UNSUPPORTED_SOURCE');
        const {naturalWidth:width,naturalHeight:height} = image;
        if (!width || !height || width*height > 12_000_000) throw Error('UNSUPPORTED_SOURCE');
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(image,0,0);
        const png = canvas.toDataURL('image/png');
        canvas.width = canvas.height = 1;
        return {width,height,png};
      });
      const paper = printPageSize(captured.width,captured.height);
      const png = Buffer.from(captured.png.split(',')[1] ?? '', 'base64');
      capturedBytes += png.length;
      if (capturedBytes > maxCaptures) throw new JobError('FILE_TOO_LARGE');
      const jpeg = await sharp(png).jpeg({quality:93,chromaSubsampling:'4:4:4'}).toBuffer();
      const embedded = await doc.embedJpg(jpeg);
      const pdfPage = doc.addPage([paper.pageWidth,paper.pageHeight]);
      pdfPage.drawImage(embedded,{x:paper.x,y:paper.y,width:paper.width,height:paper.height});
      await doc.flush();
    }
    signal.throwIfAborted();
    const bytes = await doc.save();
    if (bytes.length > maxBytes) throw new JobError('FILE_TOO_LARGE');
    await writeFile(path,bytes,{flag:'wx',mode:0o600});
  } catch (e) {
    if (signal.aborted) throw new JobError('TIMEOUT',true);
    if (e instanceof JobError) throw e;
    // Browser/Drive failure is not proof the source is permanently unavailable.
    throw new JobError('SOURCE_UNAVAILABLE',true);
  } finally {
    signal.removeEventListener('abort',abort);
    await ctx?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
