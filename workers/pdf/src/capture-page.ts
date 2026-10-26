import { errors, type Page } from 'playwright';
import { JobError } from './contract.ts';
import { withViewerAbort } from './viewer-ready.ts';

/** Start BEFORE zoom so DOM replacements and recycled image nodes are observable. */
export async function observeViewerBitmaps(page: Page) {
  return page.evaluateHandle(() => {
    const bindings = new WeakMap<HTMLImageElement, { key: string; source: string; signature: string; stale: boolean }>();
    const decodes = new WeakMap<HTMLImageElement, { signature: string; status: number }>();
    const state = {
      changedAt: performance.now(),
      decoded(image: HTMLImageElement, signature: string) {
        const old = decodes.get(image);
        if (old?.signature === signature) return old.status;
        const decode = { signature, status: 0 };
        decodes.set(image, decode);
        void image.decode().then(() => {
          decode.status = 1; state.changedAt = performance.now();
        }, () => { decode.status = -1; state.changedAt = performance.now(); });
        return 0;
      },
      resolve(index: number, total: number) {
        const headings = [...document.querySelectorAll('h2')];
        const sameIndex = headings.filter(h => {
          const match = /(?:^|\D)(\d+)\s*\/\s*(\d+)\s*$/.exec(h.textContent ?? '');
          return match && Number(match[1]) === index;
        });
        if (sameIndex.length > 1) return { error: 'UNSUPPORTED_SOURCE' } as const;
        const heading = sameIndex[0];
        if (!heading) return {};
        if (Number(/\/\s*(\d+)\s*$/.exec(heading.textContent ?? '')?.[1]) !== total)
          return { error: 'UNSUPPORTED_SOURCE' } as const;
        // Known heading-wrapper + bitmap layout, allowing nested image wrappers.
        // Stop at any other page heading or toolbar; never widen to the document.
        let container = heading.parentElement;
        for (let depth = 0; container && depth < 3; depth++, container = container.parentElement) {
          if (container.matches('body, html, main, header, nav, aside, [role="toolbar"]')) return {};
          if (container.querySelectorAll('h2').length !== 1 ||
              container.querySelector('button, [role="button"], [role="toolbar"]'))
            return { error: 'UNSUPPORTED_SOURCE' } as const;
          const images = container.querySelectorAll('img');
          if (images.length > 1) return { error: 'UNSUPPORTED_SOURCE' } as const;
          if (images.length === 1) {
            const image = images[0];
            const key = `${index}/${total}`;
            const source = `${image.src}|${image.srcset}`;
            const signature = `${image.currentSrc}|${source}|${image.naturalWidth}|${image.naturalHeight}|${image.complete}`;
            const old = bindings.get(image);
            // Finishing an old in-flight decode is not a new page source.
            const stale = !!old && (old.key !== key || old.stale) && old.source === source;
            if (!old || old.key !== key || old.signature !== signature || old.stale !== stale) {
              bindings.set(image, { key, source, signature, stale });
              state.changedAt = performance.now();
            }
            return { heading, container, image, stale, signature };
          }
        }
        return {};
      },
      scan() {
        for (const heading of document.querySelectorAll('h2')) {
          const match = /(?:^|\D)(\d+)\s*\/\s*(\d+)\s*$/.exec(heading.textContent ?? '');
          if (match) state.resolve(Number(match[1]), Number(match[2]));
        }
      },
      observer: new MutationObserver(() => { state.changedAt = performance.now(); state.scan(); }),
    };
    state.observer.observe(document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['src', 'srcset', 'width', 'height', 'aria-busy', 'class', 'style'] });
    state.scan();
    return state;
  });
}

export async function disposeViewerBitmaps(state: Awaited<ReturnType<typeof observeViewerBitmaps>>) {
  // Abort/navigation may already have destroyed the observer's execution context.
  try { await state.evaluate(state => state.observer.disconnect()).catch(() => {}); }
  finally { await state.dispose(); }
}

/** Native bitmap only. A 750ms quiet window is a heuristic, not a Drive render guarantee. */
export async function captureViewerPage(page: Page, index: number, total: number, remainingBytes: number,
  observation?: Awaited<ReturnType<typeof observeViewerBitmaps>>, signal: AbortSignal = new AbortController().signal) {
  return withViewerAbort(page, signal, async () => {
    const state = observation ?? await observeViewerBitmaps(page);
    try {
      // Scroll while polling: virtualized headings/images may disappear/reappear.
      const handle = await page.waitForFunction(({ state, index, total, remainingBytes }) => {
        const candidate = state.resolve(index, total);
        if ('error' in candidate) return { error: candidate.error };
        if (!candidate.image) return null;
        const { image, heading, container } = candidate;
        if (!image.getClientRects().length || getComputedStyle(image).visibility === 'hidden') return null;
        const rect = heading.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight) {
          heading.scrollIntoView({ block: 'center' });
          state.changedAt = performance.now();
          return null;
        }
        const busy = [...document.querySelectorAll('[aria-busy="true"], [role="progressbar"]')]
          .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
        if (busy) { state.changedAt = performance.now(); return null; }
        const { naturalWidth: width, naturalHeight: height } = image;
        if (width * height > 12_000_000) return { error: 'UNSUPPORTED_SOURCE' };
        if (image.complete && (!width || !height) && performance.now() - state.changedAt >= 750)
          return { error: 'SOURCE_UNAVAILABLE' };
        if (!image.complete || !image.src.startsWith('blob:') || !width || !height) return null;
        const decoded = state.decoded(image, candidate.signature);
        if (decoded < 0) return { error: 'SOURCE_UNAVAILABLE' };
        const landscape = width > height;
        const scale = Math.min(((landscape ? 841.89 : 595.28) - 16) / width,
          ((landscape ? 595.28 : 841.89) - 16) / height);
        if (!decoded || candidate.stale || 72 / scale < 200 || performance.now() - state.changedAt < 750) return null;
        // decode() may finish after a source/node/heading replacement.
        const current = state.resolve(index, total);
        if ('error' in current) return { error: current.error };
        if (current.image !== image || current.heading !== heading || current.container !== container ||
            current.signature !== candidate.signature || current.stale || !image.isConnected ||
            performance.now() - state.changedAt < 750) return null;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        try {
          const context = canvas.getContext('2d');
          if (!context) return { error: 'UNSUPPORTED_SOURCE' };
          context.drawImage(image, 0, 0);
          const png = canvas.toDataURL('image/png');
          const encoded = png.slice('data:image/png;base64,'.length);
          const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
          if (bytes > remainingBytes) return { error: 'FILE_TOO_LARGE' };
          return { width, height, encoded };
        } catch { return { error: 'UNSUPPORTED_SOURCE' }; }
        finally { canvas.width = canvas.height = 1; }
      }, { state, index, total, remainingBytes }, { timeout: 15000, polling: 'raf' });
      try {
        const captured = await handle.jsonValue();
        if (!captured) throw new JobError('SOURCE_UNAVAILABLE', true);
        if ('error' in captured) throw new JobError(captured.error!, captured.error === 'SOURCE_UNAVAILABLE');
        return { width: captured.width!, height: captured.height!, png: Buffer.from(captured.encoded!, 'base64') };
      } finally { await handle.dispose(); }
    } catch (error) {
      if (error instanceof errors.TimeoutError) throw new JobError('SOURCE_UNAVAILABLE', true);
      throw error;
    } finally { if (!observation) await disposeViewerBitmaps(state); }
  });
}
