import { writeFile } from 'node:fs/promises';
import { errors as playwrightErrors, type Page } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { JobError, type Limits } from './contract.ts';
import { assertPrintAction, printPageSize } from './print-policy.ts';
import { captureViewerPage } from './capture-page.ts';
import { withViewerAbort } from './viewer-ready.ts';

type ViewerAssemblyMode = 'print-gated' | 'view-only';

async function readViewerPageCount(page: Page, cap: Limits): Promise<number> {
  await page.locator('h2').filter({ hasText: /1\s*\/\s*\d+\s*$/ }).first().waitFor();
  const labels = await page.locator('h2').allTextContents();
  const first = labels.map(s => /(?:^|\D)1\s*\/\s*(\d+)\s*$/.exec(s)).find(Boolean);
  const count = Number(first?.[1]);
  if (!Number.isInteger(count) || count < 1) throw new JobError('UNSUPPORTED_SOURCE');
  if (count > cap.maxPages) throw new JobError('PAGE_LIMIT_EXCEEDED');
  return count;
}

export async function setViewerZoom(page: Page, signal: AbortSignal): Promise<void> {
  await withViewerAbort(page, signal, async () => {
    const end = Date.now() + 15000;
    const remaining = () => Math.max(1, end - Date.now());
    const zoom = page.getByRole('combobox');
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('[role="combobox"]');
      const input = inputs[0];
      return inputs.length === 1 && input instanceof HTMLInputElement &&
        input.getClientRects().length > 0 && getComputedStyle(input).visibility !== 'hidden' &&
        !input.disabled && !input.readOnly && input.getAttribute('aria-disabled') !== 'true';
    }, undefined, { timeout: remaining(), polling: 'raf' });
    // Locator actionability waits for a unique, visible, enabled/editable input.
    await zoom.fill('300%', { timeout: remaining() });
    await zoom.press('Enter', { timeout: remaining() });
    // Filling alone changes value. Observe it after Enter and blur so a rejected
    // or normalized zoom cannot be mistaken for acceptance. Bitmap readiness is
    // still the responsibility of the per-page capture stage.
    await zoom.blur({ timeout: remaining() });
    const state = await page.evaluateHandle(() => ({ since: performance.now() }));
    try {
      await page.waitForFunction(state => {
        const inputs = document.querySelectorAll('[role="combobox"]');
        const input = inputs[0];
        const busy = [...document.querySelectorAll('[aria-busy="true"], [role="progressbar"]')]
          .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
        const settled = inputs.length === 1 && input instanceof HTMLInputElement &&
          /^300\s*%?$/.test(input.value.trim()) && document.activeElement !== input && !busy;
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
    // View-only: anonymous viewer with page tiles but Print disabled or absent.
    await page.locator('h2').filter({ hasText: /1\s*\/\s*\d+\s*$/ }).first()
      .waitFor({ timeout: 30000 })
      .catch((error: unknown) => {
        if (error instanceof playwrightErrors.TimeoutError) throw new JobError('SOURCE_UNAVAILABLE', true);
        throw error;
      });
  }

  const count = await readViewerPageCount(page, cap);
  await setViewerZoom(page, signal);

  const doc = await PDFDocument.create();
  sharp.cache(false);
  sharp.concurrency(1);
  const maxCaptures = 32 * 1048576;
  let capturedBytes = 0, embeddedBytes = 0;
  for (let index = 1; index <= count; index++) {
    signal.throwIfAborted();
    if (checkPrint) await checkPrint();
    const captured = await captureViewerPage(page, index, count, maxCaptures - capturedBytes);
    signal.throwIfAborted();
    const paper = printPageSize(captured.width, captured.height);
    capturedBytes += captured.png.length;
    if (capturedBytes > maxCaptures) throw new JobError('FILE_TOO_LARGE');
    const jpeg = await sharp(captured.png).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toBuffer();
    embeddedBytes += jpeg.length;
    if (embeddedBytes > cap.maxBytes) throw new JobError('FILE_TOO_LARGE');
    const embedded = await doc.embedJpg(jpeg);
    const pdfPage = doc.addPage([paper.pageWidth, paper.pageHeight]);
    pdfPage.drawImage(embedded, { x: paper.x, y: paper.y, width: paper.width, height: paper.height });
    await doc.flush();
  }
  signal.throwIfAborted();
  if (checkPrint) await checkPrint();
  const finalLabels = await page.locator('h2').allTextContents();
  if (finalLabels.some(label => {
    const match = /\d+\s*\/\s*(\d+)\s*$/.exec(label);
    return match && Number(match[1]) !== count;
  })) throw new JobError('UNSUPPORTED_SOURCE');
  const bytes = await doc.save();
  if (bytes.length > cap.maxBytes) throw new JobError('FILE_TOO_LARGE');
  signal.throwIfAborted();
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600, signal });
}

/** Cloud Run renderer stage when Print is enabled. Caller owns the bounded browser. */
export async function assemblePrintableViewer(page: Page, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  await assembleViewerImagePdf(page, path, cap, signal, 'print-gated');
}

/** Image-only PDF from visible viewer tiles when Print is disabled or missing. */
export async function assembleViewOnlyViewer(page: Page, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  await assembleViewerImagePdf(page, path, cap, signal, 'view-only');
}
