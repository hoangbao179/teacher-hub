import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { selectViewerMode } from '../src/viewer-ready.ts';
import { setViewerZoom } from '../src/viewer-pdf.ts';

const viewer = '<h2>Page 1 / 1</h2><input role="combobox" value="100%">';

test('offline Viewer initialization and zoom readiness', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  async function fixture(t, html) {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    return page;
  }
  for (const flag of [false, true]) {
    await t.test(`immediate Viewer and enabled Print; screen capture=${flag}`, async t => {
      const page = await fixture(t, viewer + '<button>Print</button>');
      assert.equal(await selectViewerMode(page, flag, AbortSignal.timeout(3000)), 'print-gated');
    });
    for (const [html, code] of [['<button disabled>Print</button>', 'ACCESS_DENIED'], ['', 'PRINT_UNAVAILABLE'],
      ['<button>Print</button><button>In</button>', 'UNSUPPORTED_SOURCE']]) {
      await t.test(`${code}; screen capture=${flag}`, async t => {
        const page = await fixture(t, viewer + html);
        const selection = selectViewerMode(page, flag, AbortSignal.timeout(3000));
        if (flag && code !== 'UNSUPPORTED_SOURCE') assert.equal(await selection, 'view-only');
        else await assert.rejects(selection, { code });
      });
    }
  }
  await t.test('loading shell and Viewer precede a late enabled Print', async t => {
    const page = await fixture(t, '<main aria-busy="true"></main>');
    await page.evaluate(viewer => {
      setTimeout(() => { document.querySelector('main').innerHTML = viewer; }, 50);
      setTimeout(() => {
        document.querySelector('main').insertAdjacentHTML('beforeend', '<button>Print</button>');
        document.querySelector('main').removeAttribute('aria-busy');
      }, 800);
    }, viewer);
    assert.equal(await selectViewerMode(page, true, AbortSignal.timeout(3000)), 'print-gated');
  });
  await t.test('late Print during toolbar settling keeps print-gated mode', async t => {
    const page = await fixture(t, viewer);
    await page.evaluate(() => setTimeout(() => {
      document.body.insertAdjacentHTML('beforeend', '<button>Print</button>');
    }, 200));
    assert.equal(await selectViewerMode(page, true, AbortSignal.timeout(3000)), 'print-gated');
  });
  await t.test('absent Print finishes without waiting for the 15s ceiling', async t => {
    const page = await fixture(t, viewer);
    assert.equal(await selectViewerMode(page, true, AbortSignal.timeout(2000)), 'view-only');
  });
  await t.test('explicit cancellation during toolbar settling does not select view-only', async t => {
    const page = await fixture(t, viewer);
    const controller = new AbortController();
    const selection = selectViewerMode(page, true, controller.signal);
    const timer = setTimeout(() => controller.abort(), 100);
    try { await assert.rejects(selection, { name: 'AbortError' }); }
    finally { clearTimeout(timer); }
    assert.equal(page.isClosed(), true);
  });
  await t.test('late zoom control becomes editable and settles after Enter', async t => {
    const page = await fixture(t, '<h2>Page 1 / 1</h2>');
    await page.evaluate(() => setTimeout(() => {
      const input = document.createElement('input');
      input.setAttribute('role', 'combobox'); input.disabled = true;
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        document.body.setAttribute('aria-busy', 'true');
        setTimeout(() => {
          document.body.removeAttribute('aria-busy');
          document.body.dataset.zoomAccepted = input.value;
        }, 400);
      });
      document.body.append(input);
      setTimeout(() => { input.disabled = false; }, 100);
    }, 100));
    await setViewerZoom(page, AbortSignal.timeout(3000));
    assert.equal(await page.locator('body').getAttribute('data-zoom-accepted'), '300%');
  });
  await t.test('zoom waits for duplicate controls to resolve', async t => {
    const page = await fixture(t, viewer + '<input role="combobox">');
    await page.evaluate(() => setTimeout(() => document.querySelectorAll('input')[1].remove(), 150));
    await setViewerZoom(page, AbortSignal.timeout(3000));
    assert.equal(await page.getByRole('combobox').inputValue(), '300%');
  });
  for (const [name, work, html] of [
    ['Viewer loading', selectViewerMode, '<main aria-busy="true"></main>'],
    ['zoom waiting', (page, _flag, signal) => setViewerZoom(page, signal), '<h2>Page 1 / 1</h2>'],
    ['zoom rejected', (page, _flag, signal) => setViewerZoom(page, signal), viewer],
  ]) {
    await t.test(`cancellation/deadline while ${name}`, async t => {
      const page = await fixture(t, html);
      if (name === 'zoom rejected') await page.getByRole('combobox').evaluate(input => {
        input.addEventListener('keydown', event => { if (event.key === 'Enter') input.value = '100%'; });
      });
      await assert.rejects(work(page, true, AbortSignal.timeout(700)), { name: 'TimeoutError' });
      assert.equal(page.isClosed(), true, 'cancellation stops pending browser waits');
    });
  }
});
