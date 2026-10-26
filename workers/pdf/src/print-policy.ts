import { JobError } from './contract.ts';

export function allowedPrintRequest(raw: string, fileId: string, navigation: boolean): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return false;
  if (navigation) return u.hostname === 'drive.google.com' &&
    u.pathname === `/file/d/${fileId}/view` && !u.search;
  const h = u.hostname;
  return h === 'drive.google.com' || h === 'docs.google.com' ||
    h === 'www.gstatic.com' || h.endsWith('.gstatic.com') ||
    h === 'googleusercontent.com' || h.endsWith('.googleusercontent.com');
}

/**
 * Missing/ambiguous Print UI does not prove that Google denied access.
 * An explicitly disabled Print action is a known restriction; never bypass it.
 */
export function assertPrintAction(count: number, enabled?: boolean): void {
  if (count === 0) throw new JobError('PRINT_UNAVAILABLE');
  if (count !== 1) throw new JobError('UNSUPPORTED_SOURCE');
  if (enabled !== true) throw new JobError('ACCESS_DENIED');
}

export function printPageSize(w: number, h: number) {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) ||
      w < 1 || h < 1 || w * h > 12_000_000) throw new JobError('UNSUPPORTED_SOURCE');
  const landscape = w > h;
  const pageWidth = landscape ? 841.89 : 595.28;
  const pageHeight = landscape ? 595.28 : 841.89;
  const margin = 8;
  const scale = Math.min((pageWidth-2*margin)/w, (pageHeight-2*margin)/h);
  const width = w*scale, height = h*scale;
  const dpi = Math.min(w*72/width, h*72/height);
  if (dpi < 150) throw new JobError('UNSUPPORTED_SOURCE');
  return {pageWidth,pageHeight,x:(pageWidth-width)/2,y:(pageHeight-height)/2,width,height,dpi};
}
