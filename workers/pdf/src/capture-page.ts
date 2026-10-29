import { errors as playwrightErrors, type Page } from 'playwright';
import { JobError } from './contract.ts';
import { withViewerAbort } from './viewer-ready.ts';
import { PDF_VIEWER_MIN_DPI, PDF_VIEWER_MAX_PIXELS } from '@teacher/shared';

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
        const visible = (el: Element) => {
          if (el instanceof HTMLElement && el.hidden) return false;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') return false;
          return el.getClientRects().length > 0;
        };
        const visibleToolbar = (root: ParentNode) => [...root.querySelectorAll('[role="toolbar"]')]
          .some(el => visible(el));
        const headings = [...document.querySelectorAll('h2')];
        const sameIndex = headings.filter(h => parseLabel(h.textContent ?? '')?.index === index);
        if (sameIndex.length > 1) return { error: 'UNSUPPORTED_SOURCE', reason: 'duplicate-page-heading' } as const;
        const heading = sameIndex[0];
        if (!heading) return {};
        if (parseLabel(heading.textContent ?? '')?.total !== total)
          return { error: 'UNSUPPORTED_SOURCE', reason: 'page-total-mismatch' } as const;
        // Resolve the smallest structural page scope first. Some Viewer versions
        // put the accessibility and bitmap layers in separate sibling trees; in
        // that case only disjoint, single-heading page rectangles prove ownership.
        // Stop at document landmarks or a visible toolbar; never widen to the document.
        let container = heading.parentElement;
        for (let depth = 0; container && depth < 12; depth++, container = container.parentElement) {
          if (container.matches('body, html, main, header, nav, aside, [role="toolbar"]')) return {};
          const headingsInContainer = [...container.querySelectorAll('h2')].filter(visible);
          if (visibleToolbar(container)) {
            return { error: 'UNSUPPORTED_SOURCE', reason: 'ambiguous-layout-toolbar-visible', ancestorLevel: depth } as const;
          }
          const images = [...container.querySelectorAll('img')].filter(visible);
          if (!images.length) continue;
          let pageImages = images;
          if (headingsInContainer.length > 1) {
            const ambiguous = { error: 'UNSUPPORTED_SOURCE', reason: 'ambiguous-layout-multiple-headings', ancestorLevel: depth } as const;
            const scopes = headingsInContainer.map(h => {
              let scope: HTMLElement = h;
              while (scope.parentElement && scope.parentElement !== container &&
                [...scope.parentElement.querySelectorAll('h2')].filter(visible).length === 1) scope = scope.parentElement;
              return { heading: h, scope, rect: scope.getBoundingClientRect(), label: parseLabel(h.textContent ?? '') };
            });
            const overlaps = (a: DOMRect, b: DOMRect) =>
              Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
              Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
            if (scopes.some((s, i) => !s.label || s.label.total !== total || s.rect.width <= 0 || s.rect.height <= 0 ||
              scopes.some((other, j) => i !== j && (s.scope === other.scope || overlaps(s.rect, other.rect))))) return ambiguous;
            const target = scopes.find(s => s.heading === heading);
            if (!target) return ambiguous;
            const contains = (a: DOMRect, b: DOMRect) => b.width > 0 && b.height > 0 &&
              b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom;
            // Full bitmap containment, never nearest-heading or DOM-order guesses.
            // A bitmap crossing a page boundary is ambiguous, even if its centre fits.
            if (images.some(image => {
              const rect = image.getBoundingClientRect();
              return overlaps(target.rect, rect) && !contains(target.rect, rect);
            })) return ambiguous;
            pageImages = images.filter(image => contains(target.rect, image.getBoundingClientRect()));
            if (!pageImages.length) return {};
          }
          if (pageImages.length > 1) {
            return { error: 'UNSUPPORTED_SOURCE', reason: 'ambiguous-layout-multiple-images', ancestorLevel: depth } as const;
          }
          if (pageImages.length === 1 && headingsInContainer.includes(heading)) {
            const image = pageImages[0];
            const key = `${index}/${total}`;
            const source = `${image.src}|${image.srcset}`;
            const rect = image.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            const signature = `${image.currentSrc}|${source}|${image.naturalWidth}|${image.naturalHeight}|${image.complete}|` +
              `${rect.x},${rect.y},${rect.width},${rect.height}|${headingRect.x},${headingRect.y},${headingRect.width},${headingRect.height}`;
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
      layoutChanged: () => { state.changedAt = performance.now(); },
    };
    state.observer.observe(document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['src', 'srcset', 'width', 'height', 'aria-busy', 'class', 'style'] });
    state.scan();
    document.addEventListener('scroll', state.layoutChanged, true);
    window.addEventListener('resize', state.layoutChanged);
    return state;
  });
}

export async function disposeViewerBitmaps(state: Awaited<ReturnType<typeof observeViewerBitmaps>>) {
  // Abort/navigation may already have destroyed the observer's execution context.
  try { await state.evaluate(state => {
    state.observer.disconnect();
    document.removeEventListener('scroll', state.layoutChanged, true);
    window.removeEventListener('resize', state.layoutChanged);
  }).catch(() => {}); }
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
      const handle = await page.waitForFunction(({ state, index, total, remainingBytes, minDpi, maxPixels }) => {
        const layoutReasons = new Set(['ambiguous-layout-multiple-headings', 'ambiguous-layout-multiple-images',
          'ambiguous-layout-toolbar-visible']);
        const settleLayout = (candidate: {
          error?: string; reason?: string; ancestorLevel?: number;
          image?: HTMLImageElement; heading?: HTMLElement; container?: HTMLElement;
          stale?: boolean; signature?: string;
        }) => {
          if (!('error' in candidate)) return candidate;
          const reason = typeof candidate.reason === 'string' ? candidate.reason : '';
          if (layoutReasons.has(reason) && performance.now() - state.changedAt < 750) return null;
          return { error: candidate.error, reason: candidate.reason, ancestorLevel: candidate.ancestorLevel };
        };
        const candidate = settleLayout(state.resolve(index, total));
        if (!candidate) return null;
        if ('error' in candidate) return candidate;
        if (!candidate.image || !candidate.heading) return null;
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
        if (width * height > maxPixels) return { error: 'UNSUPPORTED_SOURCE', reason: 'bitmap-oversized' };
        if (image.complete && (!width || !height) && performance.now() - state.changedAt >= 750)
          return { error: 'SOURCE_UNAVAILABLE' };
        if (!image.complete || !image.src.startsWith('blob:') || !width || !height) return null;
        const decoded = state.decoded(image, candidate.signature ?? '');
        if (decoded < 0) return { error: 'SOURCE_UNAVAILABLE' };
        const landscape = width > height;
        const scale = Math.min(((landscape ? 841.89 : 595.28) - 16) / width,
          ((landscape ? 595.28 : 841.89) - 16) / height);
        if (!decoded || candidate.stale || 72 / scale < minDpi || performance.now() - state.changedAt < 750) return null;
        // decode() may finish after a source/node/heading replacement.
        const current = settleLayout(state.resolve(index, total));
        if (!current) return null;
        if ('error' in current) return current;
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
          if (bytes > remainingBytes) {
            return { error: 'FILE_TOO_LARGE', reason: 'intermediate-png-page', usedBytes: bytes, limitBytes: remainingBytes };
          }
          return { width, height, encoded };
        } catch { return { error: 'SOURCE_UNAVAILABLE' }; }
        finally { canvas.width = canvas.height = 1; }
      }, { state, index, total, remainingBytes, minDpi: PDF_VIEWER_MIN_DPI, maxPixels: PDF_VIEWER_MAX_PIXELS }, { timeout: 15000, polling: 'raf' });
      try {
        const captured = await handle.jsonValue() as Record<string, unknown> | null;
        if (!captured) throw new JobError('SOURCE_UNAVAILABLE', true);
        if ('error' in captured && typeof captured.error === 'string') {
          const reason = typeof captured.reason === 'string' ? captured.reason : undefined;
          const ancestorLevel = typeof captured.ancestorLevel === 'number' ? captured.ancestorLevel : undefined;
          const usedBytes = typeof captured.usedBytes === 'number' ? captured.usedBytes : undefined;
          const limitBytes = typeof captured.limitBytes === 'number' ? captured.limitBytes : undefined;
          throw new JobError(captured.error, captured.error === 'SOURCE_UNAVAILABLE', reason,
            { pageIndex: index, ancestorLevel, usedBytes, limitBytes });
        }
        const encoded = typeof captured.encoded === 'string' ? captured.encoded : '';
        const width = typeof captured.width === 'number' ? captured.width : 0;
        const height = typeof captured.height === 'number' ? captured.height : 0;
        const png = Buffer.from(encoded, 'base64');
        return { width, height, png };
      } finally { await handle.dispose(); }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof JobError) throw error;
      // Timeout, closed browser and lost execution context are not permanent
      // evidence against the source document.
      throw new JobError('SOURCE_UNAVAILABLE', true,
        error instanceof playwrightErrors.TimeoutError ? 'viewer-bitmap-timeout' : 'viewer-bitmap-error',
        {pageIndex:index});
    } finally { if (!observation && state) await disposeViewerBitmaps(state); }
  });
}
