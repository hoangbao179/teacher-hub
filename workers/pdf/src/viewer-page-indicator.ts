/** Drive-style page indicators: `1 / 5`, `Page 1 of 5`, `Trang 1 / 5`. */
export const PAGE_INDICATOR_RE = /(?:^|\D)(\d+)\s*(?:\/|of)\s*(\d+)\s*$/i;

export function parsePageIndicator(text: string): { index: number; total: number } | null {
  const match = PAGE_INDICATOR_RE.exec(text.trim());
  if (!match) return null;
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1) return null;
  return { index, total };
}

export const PAGE_INDICATOR_LOCATOR = /\d+\s*(?:\/|of)\s*\d+\s*$/i;
