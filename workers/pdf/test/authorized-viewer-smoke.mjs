#!/usr/bin/env node
/**
 * Opt-in, operator-only, anonymous Google Drive Viewer E2E.
 * Uses the real Worker renderer (print-gated or view-only per env). This
 * never changes cloud traffic, server flags, permissions or IAM.
 * The temporary PDF is validated and deleted, not published or retained.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPrintablePdf } from '../src/renderer.ts';
import { validatePDF } from '../src/pdf.ts';

const IDENTIFIER = /^[A-Za-z0-9_-]{10,128}$/;
const CAP = Object.freeze({maxBytes:10*1048576,maxPages:40,deadlineMs:120000,redirects:3});

export function viewerConfig(env) {
  if (env.PDF_AUTHORIZED_VIEWER_E2E_APPROVED !== 'true') throw Error('PDF_VIEWER_SMOKE_EXPLICIT_APPROVAL_REQUIRED');
  const fileId = env.PDF_AUTHORIZED_VIEWER_FILE_ID;
  if (typeof fileId !== 'string' || !IDENTIFIER.test(fileId))
    throw Error('PDF_VIEWER_SMOKE_FILE_ID_REQUIRED');
  return {fileId};
}

export async function runViewerSmoke(fileId, ops={}) {
  if (typeof fileId !== 'string' || !IDENTIFIER.test(fileId))
    throw Error('PDF_VIEWER_SMOKE_FILE_ID_REQUIRED');
  const render = ops.render ?? renderPrintablePdf;
  const validate = ops.validate ?? validatePDF;
  const makeDir = ops.makeDir ?? mkdtemp;
  const remove = ops.remove ?? rm;
  const controller = new AbortController();
  const directory = await makeDir(join(tmpdir(), 'pdf-authorized-viewer-'));
  const destination = join(directory,'result.pdf');
  const timeout = setTimeout(()=>controller.abort(),CAP.deadlineMs);
  try {
    await render(fileId,destination,CAP,controller.signal);
    controller.signal.throwIfAborted();
    const result = await validate(destination,CAP,controller.signal);
    controller.signal.throwIfAborted();
    if (!Number.isInteger(result.pages) || result.pages<1 || result.pages>CAP.maxPages ||
      !Number.isInteger(result.bytes) || result.bytes<1 || result.bytes>CAP.maxBytes ||
      !/^[a-f0-9]{64}$/.test(result.sha256))
      throw Error('PDF_VIEWER_SMOKE_INVALID_PDF_RESULT');
    return {status:'AUTHORIZED_VIEWER_RENDER_OK',pages:result.pages,bytes:result.bytes,
      sha256:result.sha256,outputRetained:false,cloudE2E:false,
      viewerScreenCapture:'NOT_VERIFIED',
      printRestrictedViewer:'NOT_SUPPORTED'};
  } finally {
    clearTimeout(timeout);
    await remove(directory,{recursive:true,force:true});
  }
}

export async function main(argv=process.argv.slice(2), env=process.env, ops={}) {
  if (argv.length!==1 || argv[0]!=='--run') {
    console.error('Usage: PDF_AUTHORIZED_VIEWER_FILE_ID and PDF_AUTHORIZED_VIEWER_E2E_APPROVED=true required; run --run');
    return 2;
  }
  try {
    const {fileId}=viewerConfig(env);
    const result=await runViewerSmoke(fileId,{...ops,env});
    console.log(JSON.stringify(result));
    return 0;
  } catch(error) {
    // No raw Drive URL, response body or browser error is printed.
    const code = error instanceof Error && /^PDF_VIEWER_SMOKE_[A-Z_]+$/.test(error.message)
      ? error.message
      : error?.code === 'ACCESS_DENIED' || error?.code === 'PRINT_UNAVAILABLE'
        ? 'PDF_VIEWER_SMOKE_PRINT_NOT_PERMITTED_OR_UNAVAILABLE'
        : 'PDF_VIEWER_SMOKE_FAILED';
    console.error(code);
    return 2;
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  process.exitCode = await main();
