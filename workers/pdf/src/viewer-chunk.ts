import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { PDF_CHUNK_PAGES, PDF_INTERMEDIATE_PNG_PEAK_BYTES, type PdfManifest } from '@teacher/shared';
import { JobError, type Limits } from './contract.ts';
import { captureViewerPage, observeViewerBitmaps, disposeViewerBitmaps } from './capture-page.ts';
import { readViewerPageCount, setViewerZoom } from './viewer-pdf.ts';
import { encodeViewerJpeg } from './jpeg.ts';
import { assertPrintAction } from './print-policy.ts';
import { ImagePdfWriter } from './image-pdf-writer.ts';
import { parsePageIndicator } from './viewer-page-indicator.ts';

/** Navigate only by the visible Viewer's scroll container; virtualized headings may not exist yet. */
export async function seekViewerPage(page: Page, index: number, total: number, signal: AbortSignal) {
  signal.throwIfAborted();
  try {
    await page.waitForFunction(({index,total,state})=>{
      const headings=[...document.querySelectorAll('h2')].map(el=>({el,index:Number(el.textContent?.match(/(?:^|\D)(\d+)\s*(?:\/|of)\s*\d+\s*$/i)?.[1])})).filter(v=>v.index>0);
      if(headings.some(h=>h.index===index))return true;
      let scroller: Element | null=headings[0]?.el.parentElement??null;
      while(scroller && !(scroller.scrollHeight>scroller.clientHeight+16 && /auto|scroll/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
      scroller??=document.scrollingElement;
      if(!scroller || !headings.length || performance.now()-state.at<100)return false;
      if(!state.started){scroller.scrollTop=(index-1)/total*scroller.scrollHeight;state.started=true;}
      else {
        const frame=scroller.getBoundingClientRect();
        const visible=headings.filter(h=>{const r=h.el.getBoundingClientRect();return r.bottom>=Math.max(0,frame.top)&&r.top<=Math.min(innerHeight,frame.bottom);});
        const low=Math.min(...(visible.length?visible:headings).map(h=>h.index));
        scroller.scrollTop+=(index<low?-1:1)*scroller.clientHeight*0.8;
      }
      state.at=performance.now();return false;
    },{index,total,state:{started:false,at:0}},{timeout:15000,polling:'raf'});
  } catch { signal.throwIfAborted(); throw new JobError('SOURCE_UNAVAILABLE',true); }
}

export async function captureViewerChunk(page: Page, path: string | null, cap: Limits, signal: AbortSignal,
  range?: { firstPage: number; lastPage: number }, expected?: PdfManifest) {
  const check = async () => { const print = page.getByRole('button', {name:/^(In|Print)$/i}); const n = await print.count(); assertPrintAction(n, n === 1 && await print.isEnabled()); };
  await check();
  const totalPages = await readViewerPageCount(page, cap);
  if (expected && totalPages !== expected.totalPages) throw new JobError('UNSUPPORTED_SOURCE', false, 'page-total-mismatch');
  if (range && (range.firstPage < 1 || range.lastPage > totalPages || range.lastPage - range.firstPage >= PDF_CHUNK_PAGES)) throw new JobError('INVALID_REQUEST');
  const observation = await observeViewerBitmaps(page);
  let writer: ImagePdfWriter | undefined;
  try {
    await setViewerZoom(page, signal);
    await observation.evaluate(s=>{s.changedAt=performance.now();});
    // Anchor first native page across independent browser sessions; never upscale.
    const anchor = await captureViewerPage(page, 1, totalPages, PDF_INTERMEDIATE_PNG_PEAK_BYTES, observation, signal);
    const fingerprint = createHash('sha256').update(anchor.png).digest('hex'); anchor.png = Buffer.alloc(0);
    if (expected && fingerprint !== expected.fingerprint) throw new JobError('UNSUPPORTED_SOURCE', false, 'page-total-mismatch');
    if (path && range) {
      writer = await ImagePdfWriter.create(path, cap.maxBytes, signal);
      for (let index = range.firstPage; index <= range.lastPage; index++) {
        await check(); signal.throwIfAborted();
        await seekViewerPage(page,index,totalPages,signal);
        const image = await captureViewerPage(page,index,totalPages,PDF_INTERMEDIATE_PNG_PEAK_BYTES,observation,signal);
        try { const jpeg = await encodeViewerJpeg(image.png,signal,cap.maxBytes); await writer.page(jpeg,image.width,image.height); }
        finally { image.png = Buffer.alloc(0); }
      }
      await check();
      const labels=(await page.locator('h2').allTextContents()).map(parsePageIndicator).filter(Boolean);
      if (!labels.length) throw new JobError('SOURCE_UNAVAILABLE',true);
      if (labels.some(label=>label!.total!==totalPages)) throw new JobError('UNSUPPORTED_SOURCE',false,'page-total-mismatch');
      await writer.finish();
    }
    return { totalPages, fingerprint };
  } catch (e) { await writer?.abort(); throw e; }
  finally { await disposeViewerBitmaps(observation); }
}
