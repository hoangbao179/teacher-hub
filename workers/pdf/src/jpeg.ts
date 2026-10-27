import sharp from 'sharp';
import { PDF_VIEWER_JPEG_QUALITIES, PDF_VIEWER_TARGET_PAGE_BYTES, PDF_VIEWER_MAX_PIXELS } from '@teacher/shared';

// Worker admission is sequential; avoid cross-job libvips caches and CPU oversubscription.
sharp.cache(false);
sharp.concurrency(1);

/** Encode every candidate from native PNG; never resize or recompress a JPEG. */
export async function encodeViewerJpeg(png: Buffer, signal: AbortSignal, remainingBytes: number): Promise<Buffer> {
  signal.throwIfAborted();
  let best: Buffer | undefined;
  for (const quality of PDF_VIEWER_JPEG_QUALITIES) {
    signal.throwIfAborted();
    const encoder = sharp(png, { limitInputPixels: PDF_VIEWER_MAX_PIXELS })
      .flatten({ background: '#ffffff' }).toColourspace('srgb')
      .jpeg({ quality, chromaSubsampling: '4:4:4' });
    const abort = () => { encoder.destroy(); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const candidate = await encoder.toBuffer();
      signal.throwIfAborted();
      // Keep the smallest candidate: byte size is not strictly monotonic for all inputs.
      if (!best || candidate.length < best.length) best = candidate;
      if (best.length <= PDF_VIEWER_TARGET_PAGE_BYTES && best.length <= remainingBytes) break;
    } finally {
      signal.removeEventListener('abort', abort);
      encoder.destroy();
    }
  }
  // A detailed page may exceed the soft target. Caller enforces the document cap.
  return best!;
}
