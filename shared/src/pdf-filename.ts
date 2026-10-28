/** Optional display metadata, never a filesystem path. Bound UTF-8 size for headers/GCS. */
export function normalizePdfFilename(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  let name = value.normalize('NFC').replace(/[\p{Cs}\p{Cf}\u0000-\u001f\u007f-\u009f/\\<>:"|?*]/gu, ' ')
    .replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '')
    .replace(/(?:\.pdf)+$/i, '').trim();
  if (!name || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) return null;
  let bounded = '';
  for (const char of name) {
    if (new TextEncoder().encode(bounded + char).length > 176) break;
    bounded += char;
  }
  name = bounded.replace(/[. ]+$/g, '');
  return name ? name + '.pdf' : null;
}
export function pdfFilename(name: unknown, fileId: string): string {
  return normalizePdfFilename(name) ?? `Tài liệu ${fileId}.pdf`;
}
export function pdfContentDisposition(name: string): string {
  const safe = normalizePdfFilename(name) ?? 'document.pdf';
  const ascii = safe.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ._-]/g, '_');
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
