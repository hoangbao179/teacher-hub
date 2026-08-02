import { isAllowedOfficialBookUrl, isAllowedOfficialPageImageUrl } from "./publicBookCatalog.ts";

export interface OfficialPageManifestPage {
  index: number;
  label: string;
  imageUrl: string;
}

export interface OfficialPageManifest {
  bookId: string;
  sourceViewerUrl: string;
  pages: readonly OfficialPageManifestPage[];
}

export function validateOfficialPageManifest(value: unknown, expectedBookId: string): OfficialPageManifest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<OfficialPageManifest>;
  if (candidate.bookId !== expectedBookId || !isAllowedOfficialBookUrl(candidate.sourceViewerUrl ?? "")) return null;
  if (!Array.isArray(candidate.pages) || candidate.pages.length === 0) return null;

  let previousIndex = 0;
  for (const page of candidate.pages) {
    if (!page || typeof page !== "object") return null;
    if (!Number.isInteger(page.index) || page.index <= previousIndex) return null;
    if (typeof page.label !== "string" || page.label.length === 0) return null;
    if (typeof page.imageUrl !== "string" || !isAllowedOfficialPageImageUrl(page.imageUrl)) return null;
    previousIndex = page.index;
  }

  return candidate as OfficialPageManifest;
}
