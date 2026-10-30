import { createHash } from 'node:crypto';
import { errors as playwrightErrors, type Page } from 'playwright';
import { PDF_CHUNK_PAGES, PDF_INTERMEDIATE_PNG_PEAK_BYTES, type PdfManifest } from '@teacher/shared';
import { JobError, type Limits } from './contract.ts';
import { captureViewerPage, observeViewerBitmaps, disposeViewerBitmaps } from './capture-page.ts';
import { readViewerPageCount, setViewerZoom } from './viewer-pdf.ts';
import { encodeViewerJpeg } from './jpeg.ts';
import { ImagePdfWriter } from './image-pdf-writer.ts';
import { PAGE_INDICATOR_LOCATOR, parsePageIndicator } from './viewer-page-indicator.ts';
import { selectViewerMode, withViewerAbort } from './viewer-ready.ts';

/** Navigate only by the visible Viewer's scroll container; virtualized headings may not exist yet. */
export async function seekViewerPage(page: Page, index: number, total: number, signal: AbortSignal) {
  signal.throwIfAborted();
  try {
    await withViewerAbort(page, signal, async () => {
    const handle = await page.waitForFunction(({index,total,state})=>{
      const headings=[...document.querySelectorAll('h2')]
        .map(el=>({el,index:Number(el.textContent?.match(/(?:^|\D)(\d+)\s*(?:\/|of)\s*\d+\s*$/i)?.[1])}))
        .filter(v=>v.index>0 && v.index<=total);
      if(headings.some(h=>h.index===index))return true;
      // Keep the original scroll container while Drive unmounts virtual headings.
      // Falling back to document.scrollingElement loses the Viewer scroll position.
      // The DOM node is retained only inside Chromium; never serialize Element in Playwright arguments.
      const browserState=state as unknown as {scroller:Element | null};
      const cached=browserState.scroller;
      let scroller: Element | null=cached?.isConnected ? cached : headings[0]?.el.parentElement??null;
      while(scroller && !(scroller.scrollHeight>scroller.clientHeight+16 && /auto|scroll/.test(getComputedStyle(scroller).overflowY)))
        scroller=scroller.parentElement;
      scroller??=document.scrollingElement;
      if(!scroller || scroller.scrollHeight<=scroller.clientHeight+16)return false;
      browserState.scroller=scroller;
      const now=performance.now();
      if(now-state.at<175)return false;
      const frame=scroller.getBoundingClientRect();
      const visible=headings.filter(h=>{const r=h.el.getBoundingClientRect();return r.bottom>=Math.max(0,frame.top)&&r.top<=Math.min(innerHeight,frame.bottom);});
      const nearby=visible.length?visible:headings;
      const closest=nearby.length ? nearby.reduce((best,h)=>Math.abs(index-h.index)<Math.abs(index-best.index)?h:best) : null;
      if(closest){state.lastIndex=closest.index;state.lastSeen=now;}
      if(!state.started){
        scroller.scrollTop=Math.min(scroller.scrollHeight-scroller.clientHeight,(index-1)/total*scroller.scrollHeight);
        state.started=true;
      }else if(closest){
        const direction=Math.sign(index-closest.index);
        if(direction) {
          const approximate=Math.abs(index-closest.index)*scroller.scrollHeight/total*0.65;
          const step=Math.min(scroller.clientHeight*1.25,Math.max(scroller.clientHeight*0.55,approximate));
          scroller.scrollTop+=direction*step;
        }
      }else if(now-state.lastSeen>900){
        // Virtualized headings can all disappear during a distant jump. Nudge the
        // cached Viewer scroller instead of freezing until a heading reappears.
        const direction=Math.sign(index-(state.lastIndex??1));
        if(direction)scroller.scrollTop+=direction*Math.max(100,scroller.clientHeight*0.6);
      }
      state.at=now;return false;
    },{index,total,state:{started:false,at:0,lastSeen:0,lastIndex:1,scroller:null}},{timeout:30000,polling:'raf'});
    await handle.dispose();
    });
  } catch(error) {
    signal.throwIfAborted();
    throw new JobError('SOURCE_UNAVAILABLE',true,
      error instanceof playwrightErrors.TimeoutError ? 'viewer-seek-timeout' : 'viewer-seek-error',
      {pageIndex:index});
  }
}

export async function captureViewerChunk(page: Page, path: string | null, cap: Limits, signal: AbortSignal,
  range?: { firstPage: number; lastPage: number }, expected?: PdfManifest) {
  await selectViewerMode(page, true, signal);
  await page.locator('h2').filter({ hasText: PAGE_INDICATOR_LOCATOR }).first()
    .waitFor({ timeout: 30000 })
    .catch((error: unknown) => {
      if (error instanceof playwrightErrors.TimeoutError) throw new JobError('SOURCE_UNAVAILABLE', true);
      throw error;
    });
  const totalPages = await readViewerPageCount(page, cap);
  if (expected && totalPages !== expected.totalPages) throw new JobError('UNSUPPORTED_SOURCE', false, 'page-total-mismatch');
  if (range && (range.firstPage < 1 || range.lastPage > totalPages || range.lastPage - range.firstPage >= PDF_CHUNK_PAGES)) throw new JobError('INVALID_REQUEST');
  const observation = await observeViewerBitmaps(page);
  let writer: ImagePdfWriter | undefined;
  let anchor: Awaited<ReturnType<typeof captureViewerPage>> | undefined;
  try {
    await setViewerZoom(page, signal);
    await observation.evaluate(s=>{s.changedAt=performance.now();});
    // Anchor first native page across independent browser sessions; never upscale.
    anchor = await captureViewerPage(page, 1, totalPages, PDF_INTERMEDIATE_PNG_PEAK_BYTES, observation, signal);
    const fingerprint = createHash('sha256').update(anchor.png).digest('hex');
    // Only chunk 1 can reuse its verified first-page bitmap; all others release it immediately.
    if (!path || range?.firstPage !== 1) anchor.png = Buffer.alloc(0);
    if (expected && fingerprint !== expected.fingerprint)
      throw new JobError('UNSUPPORTED_SOURCE', false, 'anchor-fingerprint-mismatch', { pageIndex: 1 });
    if (path && range) {
      writer = await ImagePdfWriter.create(path, cap.maxBytes, signal);
      for (let index = range.firstPage; index <= range.lastPage; index++) {
        signal.throwIfAborted();
        await seekViewerPage(page,index,totalPages,signal);
        // DOM replacement/scroll must invalidate the anchor, even if its pixels look plausible.
        // On any change, capture again and refuse a new page-1 bitmap with a different fingerprint.
        const reuseAnchor = index === 1 && await observation.evaluate((state, stamp) => {
          const current = state.resolve(1, stamp.total);
          return !('error' in current) && !!current.image && !current.stale &&
            current.signature === stamp.signature && state.changedAt === stamp.changedAt &&
            performance.now() - state.changedAt >= 750;
        }, {total:totalPages, signature:anchor.signature, changedAt:anchor.changedAt});
        // A fallback must release the old PNG BEFORE allocating a replacement.
        if (!reuseAnchor) anchor.png = Buffer.alloc(0);
        const image = reuseAnchor ? anchor :
          await captureViewerPage(page,index,totalPages,PDF_INTERMEDIATE_PNG_PEAK_BYTES,observation,signal);
        try {
          if (index === 1 && !reuseAnchor &&
              createHash('sha256').update(image.png).digest('hex') !== fingerprint) {
            throw new JobError('UNSUPPORTED_SOURCE', false, 'anchor-fingerprint-mismatch', { pageIndex: 1 });
          }
          const jpeg = await encodeViewerJpeg(image.png,signal,cap.maxBytes);
          await writer.page(jpeg,image.width,image.height);
        }
        finally { image.png = Buffer.alloc(0); }
      }
      const labels=(await page.locator('h2').allTextContents()).map(parsePageIndicator).filter(Boolean);
      if (!labels.length) throw new JobError('SOURCE_UNAVAILABLE',true);
      if (labels.some(label=>label!.total!==totalPages)) throw new JobError('UNSUPPORTED_SOURCE',false,'page-total-mismatch');
      await writer.finish();
    }
    return { totalPages, fingerprint };
  } catch (e) { await writer?.abort(); throw e; }
  finally { if (anchor) anchor.png = Buffer.alloc(0); await disposeViewerBitmaps(observation); }
}
