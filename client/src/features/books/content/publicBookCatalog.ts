import type { BookGrade, PublicBook } from "../types";

const source = (code: string) => `https://online.flipbuilder.com/sdtta/${code}/`;
const cover = (slug: string) => `/images/books/global-success/${slug}.svg`;

function book(grade: BookGrade, code: string, displayOrder: number, volume: 1 | 2 | null = null): PublicBook {
  const slug = `tieng-anh-${grade}${volume ? `-tap-${volume}` : ""}`;
  const volumeLabel = volume ? ` — Tập ${volume}` : "";
  return {
    id: `gs-${grade}${volume ? `-${volume}` : ""}`,
    slug,
    title: `Tiếng Anh ${grade} — Global Success${volumeLabel}`,
    shortTitle: `Tiếng Anh ${grade}${volumeLabel}`,
    grade,
    volume,
    seriesSlug: "global-success",
    seriesName: "Global Success",
    coverUrl: cover(slug),
    previewUrl: source(code),
    sourceHost: "online.flipbuilder.com",
    hasInteractiveAudio: true,
    enabled: true,
    displayOrder,
  };
}

export const publicBookCatalog: readonly PublicBook[] = [
  book(1, "rhkc", 1),
  book(2, "swxe", 2),
  book(3, "jreh", 3, 1),
  book(3, "boce", 4, 2),
  book(4, "nhxm", 5, 1),
  book(4, "hdnt", 6, 2),
  book(5, "yqgr", 7, 1),
  book(5, "fwzo", 8, 2),
  book(6, "xyup", 9, 1),
  book(6, "gupl", 10, 2),
  book(7, "izpd", 11),
  book(8, "dnxb", 12),
  book(9, "gqmy", 13),
];

export const enabledPublicBooks = publicBookCatalog.filter((item) => item.enabled);

export function isAllowedBookPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "online.flipbuilder.com"
      && url.pathname.startsWith("/sdtta/");
  } catch {
    return false;
  }
}

export function findPublicBook(slug: string): PublicBook | undefined {
  return enabledPublicBooks.find((item) => item.slug === slug);
}

export function publicBooksForGrade(grade: BookGrade): readonly PublicBook[] {
  return enabledPublicBooks.filter((item) => item.grade === grade);
}
