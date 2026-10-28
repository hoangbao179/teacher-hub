import { normalizePdfFilename } from '@teacher/shared';
import type { Page } from 'playwright';

export function dispositionFilename(header: unknown): string | null {
  if (typeof header !== 'string' || header.length > 8192) return null;
  const extended = /(?:^|;)\s*filename\*\s*=\s*UTF-8'[^']*'([^;\s]+)/i.exec(header);
  if (extended) {
    try { const name = normalizePdfFilename(decodeURIComponent(extended[1])); if (name) return name; } catch { /* use ordinary filename */ }
  }
  const ordinary = /(?:^|;)\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header);
  return normalizePdfFilename(ordinary?.[1]?.replace(/\\(.)/g, '$1') ?? ordinary?.[2]?.trim());
}
export function viewerTitleFilename(title: string): string | null {
  const match = /^(.+) - Google Drive$/.exec(title.trim());
  if (!match || /^(?:Google Drive|Drive|Error|Not found|Page not found|Access denied|Sign in|Request access|Đăng nhập|Yêu cầu quyền truy cập|Không tìm thấy|Lỗi)(?:\b|$)/i.test(match[1])) return null;
  return normalizePdfFilename(match[1]);
}
/** Called only after successful Viewer discovery/render; title is best-effort, no extra navigation. */
export async function viewerFilename(page: Page, fileId: string): Promise<string | null> {
  try {
    const url = new URL(page.url());
    if (url.origin !== 'https://drive.google.com' || url.pathname !== `/file/d/${fileId}/view`) return null;
    return viewerTitleFilename(await page.title());
  } catch { return null; }
}
