import type { Page } from 'playwright';
import { JobError } from './contract.ts';

/** Capture only the page bitmap, after lazy loading/zoom supplies printable detail. */
export async function captureViewerPage(page: Page, index: number, total: number, remainingBytes: number) {
  const heading = page.locator('h2').filter({
    hasText: new RegExp('(?:^|\\D)' + index + '\\s*/\\s*' + total + '\\s*$'),
  });
  // Strict locator: an ambiguous page must never silently select another bitmap.
  await heading.scrollIntoViewIfNeeded();
  const handle = await page.waitForFunction(({ index, total, remainingBytes }) => {
    const re = new RegExp('(?:^|\\D)' + index + '\\s*/\\s*' + total + '\\s*$');
    const headings = [...document.querySelectorAll('h2')].filter(h => re.test(h.textContent || ''));
    if (headings.length !== 1) return null;
    const images = headings[0].parentElement?.parentElement?.querySelectorAll('img');
    if (images?.length !== 1) return null;
    const image = images[0];
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!image.complete || !image.src.startsWith('blob:') || !width || !height) return null;
    if (width * height > 12_000_000) return { error: 'UNSUPPORTED_SOURCE' };
    const landscape = width > height;
    const scale = Math.min(((landscape ? 841.89 : 595.28) - 16) / width,
      ((landscape ? 595.28 : 841.89) - 16) / height);
    // A complete blob can still be the old low-resolution preview after zoom.
    // Wait for >=200 effective DPI at the actual A4 placement, without upscaling.
    if (72 / scale < 200) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    try {
      const context = canvas.getContext('2d');
      if (!context) return { error: 'UNSUPPORTED_SOURCE' };
      context.drawImage(image, 0, 0);
      const png = canvas.toDataURL('image/png');
      const encoded = png.slice('data:image/png;base64,'.length);
      const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
      // Reject before transferring the base64 string to the Node process.
      if (bytes > remainingBytes) return { error: 'FILE_TOO_LARGE' };
      return { width, height, encoded };
    } finally {
      canvas.width = canvas.height = 1;
    }
  }, { index, total, remainingBytes }, { timeout: 15000 });
  try {
    const captured = await handle.jsonValue();
    if (!captured) throw new JobError('SOURCE_UNAVAILABLE', true);
    if ('error' in captured) throw new JobError(captured.error!);
    return { width: captured.width!, height: captured.height!, png: Buffer.from(captured.encoded!, 'base64') };
  } finally {
    await handle.dispose();
  }
}
