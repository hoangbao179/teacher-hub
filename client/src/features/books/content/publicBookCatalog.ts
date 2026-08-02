import type { BookGrade, BookType, PublicBook } from "../types";

const audio = (code: string) => `https://online.flipbuilder.com/sdtta/${code}/`;
const cover = (slug: string) => `/images/books/global-success/${slug}.svg`;

interface StudentBookSource {
  grade: BookGrade;
  volume?: 1 | 2;
  detail: string;
  viewer: string;
  audioCode: string;
}

const studentSources: readonly StudentBookSource[] = [
  { grade: 1, detail: "tieng-anh-1-global.953746322", viewer: "sgk-tieng-anh-1-global-success.4914061146", audioCode: "rhkc" },
  { grade: 2, detail: "tieng-anh-2-global-success.953747559", viewer: "tieng-anh-2-global-success.4914084740", audioCode: "swxe" },
  { grade: 3, volume: 1, detail: "tieng-anh-3-tap-1-global-success-939799810.939799810", viewer: "shs-tieng-anh-3-tap-1-global-success.4537411435", audioCode: "jreh" },
  { grade: 3, volume: 2, detail: "tieng-anh-3-tap-2-global-success-940033537.940033537", viewer: "sgk-tieng-anh-3-tap-2-global-success.4914101275", audioCode: "boce" },
  { grade: 4, volume: 1, detail: "tieng-anh-4-global-success-tap-mot-939702978.939702978", viewer: "sgk-tieng-anh-4-global-success-tap-mot.4914111660", audioCode: "nhxm" },
  { grade: 4, volume: 2, detail: "tieng-anh-4-global-success-tap-hai-939706466.939706466", viewer: "sgk-tieng-anh-4-global-success-tap-hai.4914832178", audioCode: "hdnt" },
  { grade: 5, volume: 1, detail: "tieng-anh-5-global-success-tap-mot-940008529.940008529", viewer: "sgk-tieng-anh-5-global-success-tap-mot.4914842460", audioCode: "yqgr" },
  { grade: 5, volume: 2, detail: "tieng-anh-5-global-success-tap-hai-939704277.939704277", viewer: "sgk-tieng-anh-5-global-success-tap-hai.4914843136", audioCode: "fwzo" },
  { grade: 6, volume: 1, detail: "tieng-anh-6-tap-1-global-success-939897970.939897970", viewer: "shs-tieng-anh-6-tap-1-global-success.4537971287", audioCode: "xyup" },
  { grade: 6, volume: 2, detail: "tieng-anh-6-tap-2-global-success-939862160.939862160", viewer: "shs-tieng-anh-6-tap-2-global-success.4537817335", audioCode: "gupl" },
  { grade: 7, detail: "tieng-anh-7-global-success-940166686.940166686", viewer: "shs-tieng-anh-7-global-success.4539950416", audioCode: "izpd" },
  { grade: 8, detail: "tieng-anh-8-global-success-939880560.939880560", viewer: "shs-tieng-anh-8-global-success.4537898429", audioCode: "dnxb" },
  { grade: 9, detail: "tieng-anh-9-global-success-940174594.940174594", viewer: "shs-tieng-anh-9-global-success.4539971365", audioCode: "gqmy" },
];

const teacherSources = [
  { grade: 1, detail: studentSources[0].detail, viewer: "sgv-tieng-anh-1-global-success.4914064272" },
  { grade: 2, detail: studentSources[1].detail, viewer: "sgv-tieng-anh-1-global-success.4914087132" },
  { grade: 3, detail: studentSources[2].detail, viewer: "sgv-tieng-anh-3-global-success.4914826734" },
  { grade: 4, detail: studentSources[4].detail, viewer: "sgv-tieng-anh-4-global-success.4915421999" },
  { grade: 5, detail: studentSources[6].detail, viewer: "sgv-tieng-anh-5-global-success.4915599987" },
  { grade: 7, detail: studentSources[10].detail, viewer: "sgv-tieng-anh-7-global-success.4920457641" },
  { grade: 8, detail: studentSources[11].detail, viewer: "sgv-tieng-anh-8-global-success.4923606952" },
  { grade: 9, detail: studentSources[12].detail, viewer: "sgv-tieng-anh-9-global-success.4923774109" },
] as const;

const detailUrl = (value: string) => `https://taphuan.nxbgd.vn/tap-huan/chi-tiet-sach/${value}`;
const viewerUrl = (value: string) => `https://taphuan.nxbgd.vn/tap-huan/doc-sach/${value}`;
const manifestUrl = (slug: string) => `/book-pages/global-success/${slug}.json`;

function studentBook(source: StudentBookSource, displayOrder: number): PublicBook {
  const { grade, detail, viewer, audioCode } = source;
  const volume = source.volume ?? null;
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
    bookType: "STUDENT_BOOK",
    coverUrl: cover(slug),
    officialDetailUrl: detailUrl(detail),
    officialViewerUrl: viewerUrl(viewer),
    officialViewerMode: "PAGE_IMAGES",
    officialPageManifestUrl: manifestUrl(slug),
    interactiveAudioUrl: audio(audioCode),
    enabled: true,
    displayOrder,
  };
}

function teacherBook(source: (typeof teacherSources)[number], displayOrder: number): PublicBook {
  const slug = `tieng-anh-${source.grade}-sach-giao-vien`;
  const coverSlug = source.grade >= 3 && source.grade <= 6
    ? `tieng-anh-${source.grade}-tap-1`
    : `tieng-anh-${source.grade}`;
  return {
    id: `gs-${source.grade}-teacher`,
    slug,
    title: `Sách giáo viên Tiếng Anh ${source.grade} — Global Success`,
    shortTitle: `Sách giáo viên Tiếng Anh ${source.grade}`,
    grade: source.grade,
    volume: null,
    seriesSlug: "global-success",
    seriesName: "Global Success",
    bookType: "TEACHER_BOOK",
    coverUrl: cover(coverSlug),
    officialDetailUrl: detailUrl(source.detail),
    officialViewerUrl: viewerUrl(source.viewer),
    officialViewerMode: "PAGE_IMAGES",
    officialPageManifestUrl: manifestUrl(slug),
    enabled: true,
    displayOrder,
  };
}

export const publicBookCatalog: readonly PublicBook[] = [
  ...studentSources.map((source, index) => studentBook(source, index + 1)),
  ...teacherSources.map((source, index) => teacherBook(source, 100 + index)),
];

export const enabledPublicBooks = publicBookCatalog.filter((item) => item.enabled);

export interface PublicBookSeries {
  slug: string;
  name: string;
}

export function publicBookSeries(books: readonly PublicBook[]): readonly PublicBookSeries[] {
  const uniqueSeries = new Map<string, PublicBookSeries>();
  for (const book of books) {
    if (!uniqueSeries.has(book.seriesSlug)) uniqueSeries.set(book.seriesSlug, { slug: book.seriesSlug, name: book.seriesName });
  }
  return [...uniqueSeries.values()];
}

export const enabledPublicBookSeries = publicBookSeries(enabledPublicBooks);

export function isAllowedOfficialBookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "taphuan.nxbgd.vn"
      && url.pathname.startsWith("/tap-huan/");
  } catch {
    return false;
  }
}

export function isAllowedOfficialPageManifestUrl(value: string): boolean {
  return /^\/book-pages\/[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(value);
}

export function isAllowedOfficialPageImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "cdn3.olm.vn"
      && url.pathname.startsWith("/upload/taphuan/");
  } catch {
    return false;
  }
}

export function isAllowedInteractiveAudioUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "online.flipbuilder.com"
      && url.pathname.startsWith("/sdtta/");
  } catch {
    return false;
  }
}

export function findPublicBook(seriesSlug: string, bookSlug: string): PublicBook | undefined {
  return enabledPublicBooks.find((item) => item.seriesSlug === seriesSlug && item.slug === bookSlug);
}

export function publicBooksForGrade(grade: BookGrade, books: readonly PublicBook[] = enabledPublicBooks): readonly PublicBook[] {
  return books.filter((item) => item.grade === grade);
}

export function publicBooksForType(bookType: BookType, books: readonly PublicBook[] = enabledPublicBooks): readonly PublicBook[] {
  return books.filter((item) => item.bookType === bookType);
}
