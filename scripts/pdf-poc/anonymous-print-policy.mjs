// Request policy for an anonymous, print-enabled Drive viewer.
// Never accepts an arbitrary URL, credential, cookie or authenticated navigation.
export function parsePublicDriveLink(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' ||
      url.port || url.username || url.password || url.hash || url.search) {
    throw Error('UNSUPPORTED_LINK');
  }
  const match = /^\/file\/d\/([a-zA-Z0-9_-]{10,128})\/view$/.exec(url.pathname);
  if (!match) throw Error('UNSUPPORTED_LINK');
  return match[1];
}
export function allowedAnonymousRequest(raw, fileId, navigation) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  if (navigation) return url.hostname === 'drive.google.com' &&
    url.pathname === '/file/d/' + fileId + '/view' && !url.search && !url.hash;
  const host = url.hostname;
  return host === 'drive.google.com' || host === 'docs.google.com' ||
    host === 'www.gstatic.com' || host.endsWith('.gstatic.com') ||
    host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com');
}
export function printPageSize(pixelWidth, pixelHeight) {
  if (!Number.isSafeInteger(pixelWidth) || !Number.isSafeInteger(pixelHeight) ||
      pixelWidth < 1 || pixelHeight < 1 || pixelWidth * pixelHeight > 12_000_000) {
    throw Error('CAPTURE_TOO_LARGE');
  }
  const landscape = pixelWidth > pixelHeight;
  const width = landscape ? 841.89 : 595.28;
  const height = landscape ? 595.28 : 841.89;
  const margin = 8;
  const fit = Math.min((width - 2 * margin) / pixelWidth, (height - 2 * margin) / pixelHeight);
  const outputWidth = pixelWidth * fit, outputHeight = pixelHeight * fit;
  return { width, height, x: (width - outputWidth) / 2, y: (height - outputHeight) / 2,
    outputWidth, outputHeight, dpi: Math.min(pixelWidth * 72 / outputWidth, pixelHeight * 72 / outputHeight) };
}
