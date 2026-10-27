import { open, rm } from 'node:fs/promises';
import { errors as playwrightErrors, type Page } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { PDF_INTERMEDIATE_PNG_PEAK_BYTES, PDF_VIEWER_JPEG_QUALITY } from '@teacher/shared';
import { JobError, type Limits } from './contract.ts';
import { assertPrintAction, printPageSize } from './print-policy.ts';
import { captureViewerPage, observeViewerBitmaps, disposeViewerBitmaps } from './capture-page.ts';
import { withViewerAbort } from './viewer-ready.ts';
import { PAGE_INDICATOR_LOCATOR, parsePageIndicator } from './viewer-page-indicator.ts';

type ViewerAssemblyMode = 'print-gated' | 'view-only';

// Abort stops awaiting a stage; native libvips and pdf-lib work may finish in
// the background. Always attach rejection handlers and never publish its result.
async function runStage<T>(signal: AbortSignal, work: () => Promise<T>, cancel = () => {}): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cancel(); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return work(); }).then(
      value => { signal.removeEventListener('abort', abort); if (signal.aborted) reject(signal.reason); else resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

/** Peak working-set budget for one decoded PNG tile (from shared product limits). */
export const INTERMEDIATE_PNG_PEAK_BYTES = PDF_INTERMEDIATE_PNG_PEAK_BYTES;

/** pdf-lib catalog/pages/xref overhead excluded from raw JPEG embed budget. */
export function pdfStructureOverhead(pageCount: number): number {
  return 65536 + pageCount * 8192;
}

/** Keep embedded JPEG sum inside the final PDF byte cap after structure overhead. */
export function embeddedJpegCeiling(outputBytes: number, pageCount: number): number {
  return Math.max(1, outputBytes - pdfStructureOverhead(pageCount));
}

/** Byte accounting is cumulative; PDF metadata/structure is checked separately after save. */
export function addImageBytes(used: number, next: number, ceiling: number, reason: string,
  detail?: { pageIndex?: number }): number {
  const attempted = used + next;
  if (next > ceiling - used) {
    throw new JobError('FILE_TOO_LARGE', false, reason, {
      pageIndex: detail?.pageIndex,
      usedBytes: attempted,
      limitBytes: ceiling,
    });
  }
  return attempted;
}

async function readViewerPageCount(page: Page, cap: Limits): Promise<number> {
  await page.locator('h2').filter({ hasText: PAGE_INDICATOR_LOCATOR }).first().waitFor();
  const labels = await page.locator('h2').allTextContents();
  const first = labels.map(s => parsePageIndicator(s)).find(p => p?.index === 1);
  const count = first?.total ?? NaN;
  if (!Number.isInteger(count) || count < 1) throw new JobError('UNSUPPORTED_SOURCE', false, 'page-count-unreadable');
  if (count > cap.maxPages) throw new JobError('PAGE_LIMIT_EXCEEDED');
  return count;
}

export async function setViewerZoom(page: Page, signal: AbortSignal): Promise<void> {
  await withViewerAbort(page, signal, async () => {
    const end = Date.now() + 15000;
    const remaining = () => Math.max(1, end - Date.now());
    const zoom = page.locator('[role="combobox"], select').first();
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('[role="combobox"], select');
      const input = inputs[0];
      if (inputs.length !== 1 || !input) return false;
      const visible = input.getClientRects().length > 0 && getComputedStyle(input).visibility !== 'hidden';
      if (!visible) return false;
      if (input instanceof HTMLSelectElement) return !input.disabled;
      if (input instanceof HTMLInputElement) {
        return !input.disabled && !input.readOnly && input.getAttribute('aria-disabled') !== 'true';
      }
      return input instanceof HTMLElement && input.getAttribute('aria-disabled') !== 'true';
    }, undefined, { timeout: remaining(), polling: 'raf' });
    const control = await zoom.evaluateHandle(el => el);
    const tag = await control.evaluate(el => el.tagName);
    await control.dispose();
    if (tag === 'SELECT') {
      try {
        await zoom.selectOption({ label: '300%' }, { timeout: remaining() });
      } catch {
        await zoom.selectOption({ value: '300%' }, { timeout: remaining() });
      }
    } else {
      await zoom.fill('300%', { timeout: remaining() });
      await zoom.press('Enter', { timeout: remaining() });
      await zoom.blur({ timeout: remaining() });
    }
    const state = await page.evaluateHandle(() => ({ since: performance.now() }));
    try {
      await page.waitForFunction(state => {
        const inputs = document.querySelectorAll('[role="combobox"], select');
        const input = inputs[0];
        const busy = [...document.querySelectorAll('[aria-busy="true"], [role="progressbar"]')]
          .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
        const zoomAccepted = input instanceof HTMLSelectElement
          ? /300\s*%/.test(input.options[input.selectedIndex]?.text ?? '')
          : input instanceof HTMLInputElement && /^300\s*%?$/.test(input.value.trim());
        const settled = inputs.length === 1 && zoomAccepted &&
          !(input instanceof HTMLElement && document.activeElement === input) && !busy;
        if (!settled) state.since = performance.now();
        return settled && performance.now() - state.since >= 250;
      }, state, { timeout: remaining(), polling: 'raf' });
    } finally { await state.dispose(); }
  });
}

async function assembleViewerImagePdf(
  page: Page, path: string, cap: Limits, signal: AbortSignal, mode: ViewerAssemblyMode,
): Promise<void> {
  signal.throwIfAborted();
  const print = page.getByRole('button', { name: /^(In|Print)$/i });
  let checkPrint: (() => Promise<void>) | undefined;
  if (mode === 'print-gated') {
    await print.first().waitFor({ state: 'visible', timeout: 15000 }).catch((error: unknown) => {
      if (error instanceof playwrightErrors.TimeoutError) throw new JobError('PRINT_UNAVAILABLE');
      throw error;
    });
    checkPrint = async () => {
      const count = await print.count();
      assertPrintAction(count, count === 1 && await print.first().isEnabled());
    };
    await checkPrint();
  } else {
    await page.locator('h2').filter({ hasText: PAGE_INDICATOR_LOCATOR }).first()
      .waitFor({ timeout: 30000 })
      .catch((error: unknown) => {
        if (error instanceof playwrightErrors.TimeoutError) throw new JobError('SOURCE_UNAVAILABLE', true);
        throw error;
      });
  }

  const count = await readViewerPageCount(page, cap);
  const observation = await observeViewerBitmaps(page);
  try {
    await setViewerZoom(page, signal);
    // Even a maximum-resolution bitmap must settle after the zoom UI completes.
    await observation.evaluate(state => { state.changedAt = performance.now(); });

    const doc = await PDFDocument.create();
    sharp.cache(false);
    sharp.concurrency(1);
    const peakPngBytes = INTERMEDIATE_PNG_PEAK_BYTES;
    const maxEmbedded = embeddedJpegCeiling(cap.maxBytes, count);
    let embeddedBytes = 0;
    for (let index = 1; index <= count; index++) {
      signal.throwIfAborted();
      if (checkPrint) await checkPrint();
      const captured = await captureViewerPage(page, index, count, peakPngBytes, observation, signal);
      signal.throwIfAborted();
      const paper = printPageSize(captured.width, captured.height);
      if (captured.png.length > peakPngBytes) {
        throw new JobError('FILE_TOO_LARGE', false, 'intermediate-png-page',
          { pageIndex: index, usedBytes: captured.png.length, limitBytes: peakPngBytes });
      }
      const encoder = sharp(captured.png, { limitInputPixels: 12_000_000 })
        .jpeg({ quality: PDF_VIEWER_JPEG_QUALITY, chromaSubsampling: '4:4:4' });
      let jpeg: Buffer;
      try { jpeg = await runStage(signal, () => encoder.toBuffer(), () => { encoder.destroy(); }); }
      finally {
        encoder.destroy();
        captured.png = Buffer.alloc(0); // Release PNG before pdf-lib embedding/next capture.
      }
      embeddedBytes = addImageBytes(embeddedBytes, jpeg.length, maxEmbedded, 'embedded-jpeg-total',
        { pageIndex: index });
      const embedded = await runStage(signal, () => doc.embedJpg(jpeg));
      const pdfPage = doc.addPage([paper.pageWidth, paper.pageHeight]);
      pdfPage.drawImage(embedded, { x: paper.x, y: paper.y, width: paper.width, height: paper.height });
      await runStage(signal, () => doc.flush());
    }
    signal.throwIfAborted();
    if (checkPrint) await checkPrint();
    const checkTotal = async () => {
      const labels = await page.locator('h2').allTextContents();
      const totals = labels.map(label => parsePageIndicator(label)).filter(Boolean);
      if (!totals.length) throw new JobError('SOURCE_UNAVAILABLE', true);
      if (totals.some(page => page!.total !== count)) throw new JobError('UNSUPPORTED_SOURCE', false, 'page-total-mismatch');
    };
    await checkTotal();
    if (doc.getPageCount() !== count) throw new JobError('UNSUPPORTED_SOURCE', false, 'assembled-page-mismatch');
    const bytes = await runStage(signal, () => doc.save());
    if (bytes.length > cap.maxBytes) {
      throw new JobError('FILE_TOO_LARGE', false, 'output-pdf-bytes',
        { usedBytes: bytes.length, limitBytes: cap.maxBytes });
    }
    await checkTotal(); // Serialization can yield while the Viewer changes.
    signal.throwIfAborted();
    const file = await open(path, 'wx', 0o600);
    try {
      await file.writeFile(bytes, { signal });
      await file.close();
      signal.throwIfAborted();
    } catch (error) {
      await file.close().catch(() => {});
      await rm(path, { force: true }); // Only remove a file this invocation created.
      throw error;
    }
  } finally { await disposeViewerBitmaps(observation); }
}

/** Cloud Run renderer stage when Print is enabled. Caller owns the bounded browser. */
export async function assemblePrintableViewer(page: Page, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  await withViewerAbort(page, signal, () => assembleViewerImagePdf(page, path, cap, signal, 'print-gated'));
}

/** Image-only PDF from visible viewer tiles when Print is missing or disabled. */
export async function assembleViewOnlyViewer(page: Page, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  await withViewerAbort(page, signal, () => assembleViewerImagePdf(page, path, cap, signal, 'view-only'));
}
