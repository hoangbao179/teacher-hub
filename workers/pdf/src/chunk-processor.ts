import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizePdfFilename, isPdfManifest, isPdfPart, pdfPartCount, pdfPartRange, PDF_CHUNK_MAX_BYTES, PDF_LONG_OUTPUT_MAX_BYTES,
  PDF_NORMAL_MAX_PAGES, type PdfChunkJob, type PdfManifest, type PdfPart } from '@teacher/shared';
import { JobError, type Limits, type Result } from './contract.ts';
import { type Dependencies } from './processor.ts';
import { download } from './download.ts';
import { validatePDF } from './pdf.ts';
import { qpdfParts } from './qpdf-parts.ts';
import { viewerFilename } from './filename.ts';
import { withDriveViewer } from './renderer.ts';
import { captureViewerChunk } from './viewer-chunk.ts';

export interface ChunkDependencies extends Dependencies {
  discoverViewer?: (id: string, cap: Limits, signal: AbortSignal)=>Promise<{totalPages: number; fingerprint: string; filename?: string}>;
  renderChunk?: (id: string, path: string, cap: Limits, signal: AbortSignal, range: {firstPage:number;lastPage:number}, m: PdfManifest)=>Promise<void>;
  merge?: typeof qpdfParts;
}
/** Each invocation performs discovery, ONE bounded part, or final file-based merge. */
export async function processChunkJob(job: PdfChunkJob, cap: Limits, signal: AbortSignal, deps: ChunkDependencies) {
  const store = deps.store, prefix = `jobs/${job.jobId}/`;
  const sourceHash = createHash('sha256').update(JSON.stringify({provider:job.source.provider,fileId:job.source.fileId})).digest('hex');
  await store.ready(signal);
  const now = Date.now();
  await store.create(prefix+'request.json', {json:{version:1,sourceHash,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString()}},signal);
  const claim = await store.json<{version:number;sourceHash:string;createdAt:string;expiresAt:string}>(prefix+'request.json',signal);
  if (!claim || claim.version !== 1 || claim.sourceHash !== sourceHash || Date.parse(claim.expiresAt)-Date.parse(claim.createdAt)!==86400000) throw new JobError('JOB_CONFLICT');
  const result = async () => {
    const value=await store.json<Result>(prefix+'result.json',signal);
    if(value && (value.version!==1 || value.jobId!==job.jobId || value.expiresAt!==claim.expiresAt || !Number.isFinite(Date.parse(value.completedAt)) ||
      (value.status==='COMPLETED' ? value.objectName!==prefix+'output.pdf' || !Number.isInteger(value.bytes) || value.bytes!<1 || value.bytes!>cap.maxBytes ||
        !Number.isInteger(value.pages) || value.pages!<1 || value.pages!>cap.maxPages || !/^[a-f0-9]{64}$/.test(value.sha256??'') :
        value.status!=='FAILED' || !['ACCESS_DENIED','PRINT_UNAVAILABLE','UNSUPPORTED_SOURCE','INVALID_PDF','FILE_TOO_LARGE','PAGE_LIMIT_EXCEEDED','JOB_EXPIRED'].includes(value.errorCode??''))))
      throw new JobError('STORAGE_UNAVAILABLE',true);
    return value;
  };
  const existing = await result(); if (existing) return existing;
  const finish = async (fields: Partial<Result>) => {
    const value = {version:1 as const,jobId:job.jobId,completedAt:new Date().toISOString(),expiresAt:claim.expiresAt,...fields} as Result;
    await store.create(prefix+'result.json',{json:value},signal);
    const winner = await result(); if (!winner) throw new JobError('STORAGE_UNAVAILABLE',true); return winner;
  };
  if (Date.now() >= Date.parse(claim.expiresAt)) return await finish({status:'FAILED',errorCode:'JOB_EXPIRED'});
  const dir = await mkdtemp(join(deps.tempRoot ?? tmpdir(),'teacher-pdf-'));
  const validate = deps.validate ?? validatePDF;
  const get = async (name: string, path: string, bytes: number) => {
    if (!store.download) throw new JobError('SERVICE_UNAVAILABLE',true);
    await store.download(prefix+name,path,bytes,signal);
  };
  try {
    const out = await store.head(prefix+'output.pdf',signal);
    if (out) {
      const m = out.metadata;
      if (m.sourceHash !== sourceHash || !/^[a-f0-9]{64}$/.test(m.sha256) || !Number.isInteger(Number(m.bytes)) || !(Number(m.bytes)>0 && Number(m.bytes)<=cap.maxBytes) ||
        !Number.isInteger(Number(m.pages)) || Number(m.pages)<1 || Number(m.pages)>cap.maxPages) throw new JobError('STORAGE_UNAVAILABLE',true);
      return await finish({status:'COMPLETED',objectName:prefix+'output.pdf',bytes:Number(m.bytes),pages:Number(m.pages),sha256:m.sha256,...(normalizePdfFilename(m.filename) ? {filename:normalizePdfFilename(m.filename)!} : {})});
    }
    let manifest = await store.json<PdfManifest>(prefix+'manifest.json',signal);
    if (manifest && !isPdfManifest(manifest,job.jobId,sourceHash,claim.expiresAt)) throw new JobError('STORAGE_UNAVAILABLE',true);
    if (!manifest) {
      if (job.step !== 0) throw new JobError('SOURCE_UNAVAILABLE',true);
      const path = join(dir,'source.pdf');
      let discovery: Pick<PdfManifest,'mode'|'fingerprint'|'totalPages'|'filename'>;
      let filename: string | null = null;
      try {
        // Recover an immutable source snapshot uploaded before discovery checkpoint failed.
        const storedSource = await store.head(prefix+'source.pdf',signal);
        if (storedSource) { await get('source.pdf',path,cap.maxSourceBytes!); filename = normalizePdfFilename(storedSource.metadata.filename); }
        else filename = normalizePdfFilename(await (deps.download ?? download)(job.source.fileId,path,{...cap,maxBytes:cap.maxSourceBytes!},signal));
        const info = await validate(path,{...cap,maxBytes:cap.maxSourceBytes!},signal);
        if (info.pages <= PDF_NORMAL_MAX_PAGES) {
          await store.create(prefix+'output.pdf',{path,metadata:{sourceHash,...(filename ? {filename} : {}),bytes:String(info.bytes),pages:String(info.pages),sha256:info.sha256}},signal);
          const winner=await store.head(prefix+'output.pdf',signal);
          if (!winner || winner.metadata.sha256!==info.sha256) throw new JobError('STORAGE_UNAVAILABLE',true);
          const winningName = normalizePdfFilename(winner.metadata.filename);
          return await finish({status:'COMPLETED',objectName:prefix+'output.pdf',...info,...(winningName ? {filename:winningName} : {})});
        }
        await store.create(prefix+'source.pdf',{path,metadata:{sourceHash,...(filename ? {filename} : {}),sha256:info.sha256}},signal);
        // Read back the winning immutable source when duplicate discovery races.
        await rm(path,{force:true}); await get('source.pdf',path,cap.maxSourceBytes!);
        const snapshot = await validate(path,{...cap,maxBytes:cap.maxSourceBytes!},signal);
        const winningSource = await store.head(prefix+'source.pdf',signal);
        filename = normalizePdfFilename(winningSource?.metadata.filename);
        discovery = {mode:'direct',fingerprint:snapshot.sha256,totalPages:snapshot.pages,...(filename ? {filename} : {})};
      } catch (e) {
        const eligible = e instanceof JobError && !e.retryable && ['ACCESS_DENIED','UNSUPPORTED_SOURCE'].includes(e.code) && e.reason !== 'encrypted-pdf';
        if (!eligible || !deps.enablePrintFallback) throw e;
        const info = await (deps.discoverViewer ?? ((id,c,s)=>withDriveViewer(id,c,s,async p=>{const info=await captureViewerChunk(p,null,c,s); const filename=await viewerFilename(p,id); return {...info,...(filename ? {filename} : {})};})))(job.source.fileId,cap,signal);
        discovery = {mode:'viewer',...info};
      }
      const candidate: PdfManifest = {version:2,jobId:job.jobId,sourceHash,expiresAt:claim.expiresAt,...discovery};
      if (!isPdfManifest(candidate,job.jobId,sourceHash,claim.expiresAt)) throw new JobError('PAGE_LIMIT_EXCEEDED');
      await store.create(prefix+'manifest.json',{json:candidate},signal);
      manifest = await store.json<PdfManifest>(prefix+'manifest.json',signal);
      if (!isPdfManifest(manifest,job.jobId,sourceHash,claim.expiresAt)) throw new JobError('STORAGE_UNAVAILABLE',true);
    }
    const m = manifest;
    if (job.step === 0) return {version:2,jobId:job.jobId,step:0,status:'CHECKPOINTED'};
    const count = pdfPartCount(m.totalPages);
    if (job.step > count+1) throw new JobError('INVALID_REQUEST');
    const parts: PdfPart[] = [];
    // Validate all preceding checkpoints, never skip holes or trust supplied offsets.
    for (let i=1;i<=Math.min(job.step-1,count);i++) {
      const part = await store.json<PdfPart>(prefix+`parts/${i}.json`,signal);
      if (!isPdfPart(part,m,i)) throw new JobError('STORAGE_UNAVAILABLE',true);
      parts.push(part);
    }
    const budget = Math.min(cap.maxBytes,PDF_LONG_OUTPUT_MAX_BYTES)-2*1048576;
    if (parts.reduce((n,p)=>n+p.bytes,0)>budget) throw new JobError('FILE_TOO_LARGE');
    if (job.step <= count) {
      const index = job.step, range = pdfPartRange(m.totalPages,index), name = `parts/${index}.pdf`, marker = `parts/${index}.json`;
      const done = await store.json<PdfPart>(prefix+marker,signal);
      if (done) { if (!isPdfPart(done,m,index)) throw new JobError('STORAGE_UNAVAILABLE',true); return {version:2,jobId:job.jobId,step:index,status:'CHECKPOINTED'}; }
      const path = join(dir,'part.pdf'), partCap = {...cap,maxBytes:PDF_CHUNK_MAX_BYTES};
      const uploaded = await store.head(prefix+name,signal);
      if (uploaded) await get(name,path,PDF_CHUNK_MAX_BYTES);
      else if (m.mode === 'direct') {
        const source = join(dir,'source.pdf'); await get('source.pdf',source,cap.maxSourceBytes!);
        const info = await validate(source,{...cap,maxBytes:cap.maxSourceBytes!},signal);
        if (info.sha256 !== m.fingerprint || info.pages !== m.totalPages) throw new JobError('STORAGE_UNAVAILABLE',true);
        await (deps.merge ?? qpdfParts)([{path:source,range:`${range.firstPage}-${range.lastPage}`}],path,signal);
      } else {
        await (deps.renderChunk ?? ((id,path,c,s,r,m)=>withDriveViewer(id,c,s,async p=>{await captureViewerChunk(p,path,c,s,r,m);})))
          (job.source.fileId,path,partCap,signal,range,m);
      }
      const info = await validate(path,partCap,signal);
      if (info.pages !== range.lastPage-range.firstPage+1) throw new JobError('INVALID_PDF');
      if (parts.reduce((n,p)=>n+p.bytes,info.bytes)>budget) throw new JobError('FILE_TOO_LARGE');
      const checkpoint: PdfPart = {version:2,jobId:job.jobId,sourceHash,expiresAt:claim.expiresAt,fingerprint:m.fingerprint,index,...range,bytes:info.bytes,sha256:info.sha256};
      if (uploaded && (uploaded.metadata.sourceHash!==sourceHash || uploaded.metadata.fingerprint!==m.fingerprint || uploaded.metadata.sha256!==info.sha256)) throw new JobError('STORAGE_UNAVAILABLE',true);
      if (!uploaded) {
        const created = await store.create(prefix+name,{path,metadata:{sourceHash,fingerprint:m.fingerprint,sha256:info.sha256}},signal);
        if (!created) throw new JobError('STORAGE_UNAVAILABLE',true); // retry reads the winning PDF before checkpointing
      }
      await store.create(prefix+marker,{json:checkpoint},signal);
      const winner = await store.json<PdfPart>(prefix+marker,signal);
      if (!isPdfPart(winner,m,index)) throw new JobError('STORAGE_UNAVAILABLE',true);
      return {version:2,jobId:job.jobId,step:index,status:'CHECKPOINTED'};
    }
    const files: {path:string}[] = [];
    for (const p of parts) {
      const path=join(dir,`part-${p.index}.pdf`); await get(`parts/${p.index}.pdf`,path,p.bytes);
      const info=await validate(path,{...cap,maxBytes:p.bytes},signal);
      if (info.sha256!==p.sha256 || info.pages!==p.lastPage-p.firstPage+1) throw new JobError('STORAGE_UNAVAILABLE',true);
      files.push({path});
    }
    const filename = normalizePdfFilename(m.filename);
    const path=join(dir,'output.pdf'); await (deps.merge ?? qpdfParts)(files,path,signal);
    const info=await validate(path,cap,signal);
    if (info.pages!==m.totalPages) throw new JobError('INVALID_PDF');
    await store.create(prefix+'output.pdf',{path,metadata:{sourceHash,...(filename ? {filename} : {}),bytes:String(info.bytes),pages:String(info.pages),sha256:info.sha256}},signal);
    // Retry recovery validates the immutable winning output metadata too.
    const winner=await store.head(prefix+'output.pdf',signal);
    if (!winner || winner.metadata.sha256!==info.sha256) throw new JobError('STORAGE_UNAVAILABLE',true);
    const winningName = normalizePdfFilename(winner.metadata.filename);
    return await finish({status:'COMPLETED',objectName:prefix+'output.pdf',...info,...(winningName ? {filename:winningName} : {})});
  } catch (e) {
    if (signal.aborted || !(e instanceof JobError) || e.retryable) throw e;
    if (['ACCESS_DENIED','PRINT_UNAVAILABLE','UNSUPPORTED_SOURCE','INVALID_PDF','FILE_TOO_LARGE','PAGE_LIMIT_EXCEEDED','JOB_EXPIRED'].includes(e.code))
      return await finish({status:'FAILED',errorCode:e.code});
    throw e;
  } finally { await rm(dir,{recursive:true,force:true}); }
}
