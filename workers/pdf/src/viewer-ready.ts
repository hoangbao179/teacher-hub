import { errors, type Page } from 'playwright';
import { JobError } from './contract.ts';
import { assertPrintAction } from './print-policy.ts';

/** These pages are disposable. Closing on abort also cancels pending Playwright work. */
export async function withViewerAbort<T>(page: Page, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  const abort = () => { void page.close().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    return await work();
  } finally {
    signal.removeEventListener('abort', abort);
    signal.throwIfAborted();
  }
}

export async function selectViewerMode(page: Page, screenCapture: boolean, signal: AbortSignal): Promise<'print-gated' | 'view-only'> {
  return withViewerAbort(page, signal, async () => {
    // DOMContentLoaded is only the shell. Require page identity, a usable zoom
    // control, no visible loading indicator, and a short quiet toolbar window.
    // Missing Print must not consume the entire readiness timeout.
    const state = await page.evaluateHandle(() => ({ signature: '', since: performance.now() }));
    try {
      await page.waitForFunction(state => {
        const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const controls = [...document.querySelectorAll('button, [role="button"], [role="combobox"], select')].filter(visible);
        const zoom = controls.filter(el => el.matches('[role="combobox"], select'));
        const headings = [...document.querySelectorAll('h2')].filter(visible);
        const busy = [...document.querySelectorAll('[aria-busy="true"], [role="progressbar"]')].some(visible);
        const ready = headings.some(el => /(?:^|\D)1\s*(?:\/|of)\s*\d+\s*$/i.test(el.textContent ?? '')) &&
          zoom.length === 1 && !zoom[0].matches(':disabled, [aria-disabled="true"], [readonly]') && !busy;
        const signature = JSON.stringify([ready, controls.map(el => el.outerHTML), headings.map(el => el.textContent)]);
        if (signature !== state.signature) { state.signature = signature; state.since = performance.now(); }
        return ready && performance.now() - state.since >= 500;
      }, state, { timeout: 15000, polling: 'raf' });
    } catch (error) {
      if (error instanceof errors.TimeoutError) throw new JobError('SOURCE_UNAVAILABLE', true, 'viewer-readiness');
      throw error;
    } finally { await state.dispose(); }
    signal.throwIfAborted();
    const print = page.getByRole('button', { name: /^(In|Print)$/i });
    const count = await print.count();
    const enabled = count === 1 && await print.isVisible() && await print.isEnabled();
    if (enabled) return 'print-gated';
    if (count > 1 || !screenCapture) assertPrintAction(count, enabled);
    return 'view-only';
  });
}
