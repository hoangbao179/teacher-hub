import { chromium } from 'playwright';
import { JobError, type Limits } from './contract.ts';
import { allowedPrintRequest, assertPrintAction } from './print-policy.ts';
import { assemblePrintableViewer, assembleViewOnlyViewer } from './viewer-pdf.ts';

function viewOnlyScreenCaptureEnabled(): boolean {
  return process.env.PDF_VIEWER_SCREEN_CAPTURE_ENABLED === 'true';
}

// Anonymous Google Drive viewer ONLY. Never accepts an arbitrary URL,
// credentials, storage state or a login-only document. The browser is disposable.
export async function renderPrintablePdf(fileId: string, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(fileId)) throw new JobError('UNSUPPORTED_SOURCE');
  signal.throwIfAborted();
  const maxWireBytes = 64 * 1048576;
  let ctx: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>> | undefined;
  const browser = await chromium.launch({ headless: true, chromiumSandbox: false,
    args: ['--disable-background-networking'] });
  const abort = () => { void browser.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  let requests = 0, wireBytes = 0;
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
    const print = page.getByRole('button', { name: /^(In|Print)$/i });
    const printCount = await print.count();
    const printEnabled = printCount === 1 && await print.first().isEnabled().catch(() => false);
    if (printEnabled) {
      await assemblePrintableViewer(page, path, cap, signal);
    } else if (viewOnlyScreenCaptureEnabled()) {
      await assembleViewOnlyViewer(page, path, cap, signal);
    } else {
      assertPrintAction(printCount, printEnabled ? true : printCount === 1 ? false : undefined);
    }
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
