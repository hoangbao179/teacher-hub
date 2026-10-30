// Offline cancellation latency, not successful-job throughput or Drive E2E.
// node test/viewer-seek-benchmark.mjs <label> [viewer-chunk-module-path]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const label=process.argv[2];assert.match(label??'',/^[a-z0-9-]+$/);
const {seekViewerPage}=await import(process.argv[3] ? pathToFileURL(resolve(process.argv[3])).href : '../src/viewer-chunk.ts');
const start=performance.now(),browser=await chromium.launch({headless:true});
const browserStartupMs=performance.now()-start;
try {
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 await page.setContent('<main>No mounted page headings</main>');
 const at=performance.now();
 await assert.rejects(seekViewerPage(page,131,139,AbortSignal.timeout(150)),{name:'TimeoutError'});
 console.log(JSON.stringify({label,kind:'offline-aborted-seek',platform:process.platform,node:process.version,
  browserStartupMs,seekWallMs:performance.now()-at,abortAfterMs:150,pageClosed:page.isClosed(),
  processPeakRssKiB:process.resourceUsage().maxRSS,hardCpuRamLimit:false,drive:false,cloudRun:false}));
} finally {await browser.close();}
