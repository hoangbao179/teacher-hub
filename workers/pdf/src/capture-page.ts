import type { Page } from 'playwright';
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
        const pageLabel = /(?:^|\D)(\d+)\s*(?:\/|of)\s*(\d+)\s*$/i;
        const parseLabel = (text: string) => {
          const match = pageLabel.exec(text.trim());
          if (!match) return null;
          const pageIndex = Number(match[1]);
          const pageTotal = Number(match[2]);
          if (!Number.isInteger(pageIndex) || !Number.isInteger(pageTotal) || pageIndex < 1 || pageTotal < 1) return null;
          return { index: pageIndex, total: pageTotal };
        };
        const visibleToolbar = (root: ParentNode) => [...root.querySelectorAll('[role="toolbar"]')]
          .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
        const headings = [...document.querySelectorAll('h2')];
        const sameIndex = headings.filter(h => parseLabel(h.textContent ?? '')?.index === index);
        if (sameIndex.length > 1) return { error: 'UNSUPPORTED_SOURCE', reason: 'duplicate-page-heading' } as const;
        const heading = sameIndex[0];
        if (!heading) return {};
        if (parseLabel(heading.textContent ?? '')?.total !== total)
          return { error: 'UNSUPPORTED_SOURCE', reason: 'page-total-mismatch' } as const;
        // Known heading-wrapper + bitmap layout, allowing nested image wrappers.
        // Stop at document landmarks or a visible toolbar; never widen to the document.
        let container = heading.parentElement;
        for (let depth = 0; container && depth < 3; depth++, container = container.parentElement) {
          if (container.matches('body, html, main, header, nav, aside, [role="toolbar"]')) return {};
          if (container.querySelectorAll('h2').length !== 1 || visibleToolbar(container))
            return { error: 'UNSUPPORTED_SOURCE', reason: 'ambiguous-page-layout' } as const;
          const images = container.querySelectorAll('img');
          if (images.length > 1) return { error: 'UNSUPPORTED_SOURCE', reason: 'ambiguous-page-layout' } as const;
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
        const pageLabel = /(?:^|\D)(\d+)\s*(?:\/|of)\s*(\d+)\s*$/i;
        for (const heading of document.querySelectorAll('h2')) {
          const match = pageLabel.exec((heading.textContent ?? '').trim());
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
    let state = observation;
    try {
      state ??= await observeViewerBitmaps(page);
      // Scroll while polling: virtualized headings/images may disappear/reappear.
      const handle = await page.waitForFunction(({ state, index, total, remainingBytes }) => {
        const candidate = state.resolve(index, total);
        if ('error' in candidate) return { error: candidate.error, reason: candidate.reason };
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
        if (width * height > 12_000_000) return { error: 'UNSUPPORTED_SOURCE', reason: 'bitmap-oversized' };
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
        if ('error' in current) return { error: current.error, reason: current.reason };
        if (current.image !== image || current.heading !== heading || current.container !== container ||
            current.signature !== candidate.signature || current.stale || !image.isConnected ||
            performance.now() - state.changedAt < 750) return null;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        try {
          const context = canvas.getContext('2d');
          if (!context) return { error: 'SOURCE_UNAVAILABLE' };
          context.drawImage(image, 0, 0);
          const png = canvas.toDataURL('image/png');
          const encoded = png.slice('data:image/png;base64,'.length);
          const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
          if (bytes > remainingBytes) return { error: 'FILE_TOO_LARGE' };
          return { width, height, encoded };
        } catch { return { error: 'SOURCE_UNAVAILABLE' }; }
        finally { canvas.width = canvas.height = 1; }
      }, { state, index, total, remainingBytes }, { timeout: 15000, polling: 'raf' });
      try {
        const captured = await handle.jsonValue();
        if (!captured) throw new JobError('SOURCE_UNAVAILABLE', true);
        if ('error' in captured) {
          const reason = typeof captured.reason === 'string' ? captured.reason : undefined;
          throw new JobError(captured.error!, captured.error === 'SOURCE_UNAVAILABLE', reason);
        }
        const png = Buffer.from(captured.encoded!, 'base64');
        captured.encoded = '';
        return { width: captured.width!, height: captured.height!, png };
      } finally { await handle.dispose(); }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof JobError) throw error;
      // Timeout, closed browser and lost execution context are not permanent
      // evidence against the source document.
      throw new JobError('SOURCE_UNAVAILABLE', true);
    } finally { if (!observation && state) await disposeViewerBitmaps(state); }
  });
}
