import type { OfficialPageManifestPage } from "../content/officialPageManifest.ts";

export type BookReaderMode = "single" | "double";

export interface FlipPage {
  flipIndex: number;
  manifestPage: OfficialPageManifestPage;
  density: "hard" | "soft";
}

export const BOOK_DOUBLE_PAGE_BREAKPOINT = 900;
export const BOOK_MIN_DOUBLE_PAGE_WIDTH = 360;
export const DEFAULT_BOOK_ASPECT_RATIO = 600 / 900;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value)));

export function buildFlipPages(pages: readonly OfficialPageManifestPage[]): readonly FlipPage[] {
  return pages.map((manifestPage, flipIndex) => ({
    flipIndex,
    manifestPage,
    density: flipIndex === 0 || flipIndex === pages.length - 1 ? "hard" : "soft",
  }));
}

export function manifestPageToFlipIndex(manifestPage: number, pageCount: number): number {
  return clamp(manifestPage, 1, Math.max(1, pageCount)) - 1;
}

export function initialManifestPage(value: string | null, pageCount: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? clamp(parsed, 1, Math.max(1, pageCount)) : 1;
}

export function flipIndexToManifestPage(flipIndex: number, pageCount: number): number {
  return clamp(flipIndex, 0, Math.max(0, pageCount - 1)) + 1;
}

export function readerModeForWidth(containerWidth: number): BookReaderMode {
  return containerWidth >= BOOK_DOUBLE_PAGE_BREAKPOINT
    && containerWidth / 2 >= BOOK_MIN_DOUBLE_PAGE_WIDTH
    ? "double"
    : "single";
}

export function manifestPagesInSpread(currentPage: number, pageCount: number, mode: BookReaderMode): readonly number[] {
  const page = clamp(currentPage, 1, Math.max(1, pageCount));
  if (mode === "single" || page === 1) return [page];
  const leftPage = page % 2 === 0 ? page : page - 1;
  return leftPage + 1 <= pageCount ? [leftPage, leftPage + 1] : [leftPage];
}

export function currentSpreadLabel(currentPage: number, pageCount: number, mode: BookReaderMode): string {
  const spread = manifestPagesInSpread(currentPage, pageCount, mode);
  return `${spread.join("–")} / ${pageCount}`;
}

export function isFlipGestureEnabled(zoom: number): boolean {
  return zoom <= 1;
}

export function pageFlipDuration(reducedMotion: boolean): number {
  return reducedMotion ? 80 : 650;
}
