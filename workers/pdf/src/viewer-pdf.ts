import { writeFile } from 'node:fs/promises';
import { errors as playwrightErrors, type Page } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { JobError, type Limits } from './contract.ts';
import { assertPrintAction, printPageSize } from './print-policy.ts';
import { captureViewerPage } from './capture-page.ts';

/** Cloud Run renderer stage. The caller owns the anonymous, network-bounded browser. */
export async function assemblePrintableViewer(page: Page, path: string, cap: Limits, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const print = page.getByRole('button', { name: /^(In|Print)$/i });
  await print.first().waitFor({ state: 'visible', timeout: 15000 }).catch((error: unknown) => {
    if (error instanceof playwrightErrors.TimeoutError) throw new JobError('PRINT_UNAVAILABLE');
    throw error;
  });
  const checkPrint = async () => {
    const count = await print.count();
    assertPrintAction(count, count === 1 && await print.first().isEnabled());
  };
  await checkPrint();
  await page.locator('h2').filter({ hasText: /1\s*\/\s*\d+\s*$/ }).first().waitFor();
  const labels = await page.locator('h2').allTextContents();
  const first = labels.map(s => /(?:^|\D)1\s*\/\s*(\d+)\s*$/.exec(s)).find(Boolean);
  const count = Number(first?.[1]);
  if (!Number.isInteger(count) || count < 1) throw new JobError('UNSUPPORTED_SOURCE');
  if (count > cap.maxPages) throw new JobError('PAGE_LIMIT_EXCEEDED');
  const zoom = page.getByRole('combobox');
  if (await zoom.count() !== 1) throw new JobError('UNSUPPORTED_SOURCE');
  await zoom.fill('300%'); await zoom.press('Enter');

  const doc = await PDFDocument.create();
  sharp.cache(false); sharp.concurrency(1);
  const maxCaptures = 32 * 1048576;
  let capturedBytes = 0, embeddedBytes = 0;
  for (let index = 1; index <= count; index++) {
    signal.throwIfAborted();
    await checkPrint();
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
  await checkPrint();
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
