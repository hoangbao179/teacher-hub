/* global URL */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { bookRouteMetadata, stableBookPathnames } from "../src/features/books/seo/bookMetadata.ts";
import {
  enabledPublicBooks,
  findPublicBook,
  isAllowedInteractiveAudioUrl,
  isAllowedOfficialBookUrl,
  isAllowedOfficialPageImageUrl,
  isAllowedOfficialPageManifestUrl,
  publicBookSeries,
  publicBooksForGrade,
  publicBooksForType,
} from "../src/features/books/content/publicBookCatalog.ts";
import { validateOfficialPageManifest } from "../src/features/books/content/officialPageManifest.ts";
import {
  buildFlipPages,
  currentSpreadLabel,
  flipIndexToManifestPage,
  initialManifestPage,
  isFlipGestureEnabled,
  manifestPagesInSpread,
  manifestPageToFlipIndex,
  pageFlipDuration,
  readerModeForWidth,
} from "../src/features/books/components/bookFlipPages.ts";
import { productionSitemapPathnames } from "../src/features/learning/seo/learningSitemap.ts";

const clientRoot = path.resolve(import.meta.dirname, "..");
const officialViewerSource = fs.readFileSync(path.join(clientRoot, "src/features/books/components/OfficialBookViewer.tsx"), "utf8");
const officialBookReaderSource = fs.readFileSync(path.join(clientRoot, "src/features/books/components/OfficialBookReader.tsx"), "utf8");
const audioViewerSource = fs.readFileSync(path.join(clientRoot, "src/features/books/components/InteractiveAudioViewer.tsx"), "utf8");
const librarySource = fs.readFileSync(path.join(clientRoot, "src/features/books/pages/BookLibraryPage.tsx"), "utf8");
const nginxSource = fs.readFileSync(path.join(clientRoot, "../deploy/nginx.conf"), "utf8");

const students = publicBooksForType("STUDENT_BOOK");
const teachers = publicBooksForType("TEACHER_BOOK");

test("every grade has an enabled student book and verified volumes are preserved", () => {
  for (let grade = 1; grade <= 9; grade += 1) assert.ok(publicBooksForGrade(grade, students).length >= 1, `grade ${grade}`);
  for (const grade of [3, 4, 5, 6]) assert.deepEqual(publicBooksForGrade(grade, students).map((book) => book.volume), [1, 2]);
  for (const grade of [1, 2, 7, 8, 9]) assert.deepEqual(publicBooksForGrade(grade, students).map((book) => book.volume), [null]);
});

test("verified teacher books are unique, grade-scoped and never expose audio", () => {
  assert.deepEqual(teachers.map((book) => book.grade), [1, 2, 3, 4, 5, 7, 8, 9]);
  assert.equal(new Set(teachers.map((book) => book.officialViewerUrl)).size, teachers.length);
  for (const book of teachers) assert.equal(book.interactiveAudioUrl, undefined);
});

test("official and interactive sources use separate strict allowlists", () => {
  for (const book of enabledPublicBooks) {
    assert.equal(isAllowedOfficialBookUrl(book.officialDetailUrl), true);
    assert.equal(isAllowedOfficialBookUrl(book.officialViewerUrl), true);
    const url = new URL(book.officialViewerUrl);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "taphuan.nxbgd.vn");
    assert.ok(url.pathname.startsWith("/tap-huan/"));
    if (book.interactiveAudioUrl) {
      assert.equal(book.bookType, "STUDENT_BOOK");
      assert.equal(isAllowedInteractiveAudioUrl(book.interactiveAudioUrl), true);
    }
  }
  for (const rejected of ["http://taphuan.nxbgd.vn/tap-huan/doc-sach/a", "https://evil.example/tap-huan/a", "https://taphuan.nxbgd.vn/other/a", "not-a-url"])
    assert.equal(isAllowedOfficialBookUrl(rejected), false, rejected);
  for (const rejected of ["http://online.flipbuilder.com/sdtta/a/", "https://evil.example/sdtta/a/", "https://online.flipbuilder.com/other/a/", "not-a-url"])
    assert.equal(isAllowedInteractiveAudioUrl(rejected), false, rejected);
});

test("every image-mode book has a valid local manifest with ordered allowlisted pages", () => {
  let pageCount = 0;
  for (const book of enabledPublicBooks) {
    assert.equal(book.officialViewerMode, "PAGE_IMAGES");
    assert.equal(isAllowedOfficialPageManifestUrl(book.officialPageManifestUrl ?? ""), true);
    const manifestPath = path.join(clientRoot, "public", book.officialPageManifestUrl.slice(1));
    const manifest = validateOfficialPageManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")), book.id);
    assert.ok(manifest, book.id);
    assert.equal(manifest.sourceViewerUrl, book.officialViewerUrl);
    assert.ok(manifest.pages.length > 0);
    assert.deepEqual(manifest.pages.map((page) => page.index), Array.from({ length: manifest.pages.length }, (_, offset) => offset + 1));
    assert.equal(new Set(manifest.pages.map((page) => page.index)).size, manifest.pages.length);
    for (const page of manifest.pages) assert.equal(isAllowedOfficialPageImageUrl(page.imageUrl), true, page.imageUrl);
    pageCount += manifest.pages.length;
  }
  assert.equal(pageCount, 3442);
});

test("manifest validation rejects foreign books, unordered indexes and untrusted images", () => {
  const validPage = { index: 1, label: "Bìa", imageUrl: "https://cdn3.olm.vn/upload/taphuan/page-1.png" };
  const base = { bookId: "book-1", sourceViewerUrl: "https://taphuan.nxbgd.vn/tap-huan/doc-sach/book.1", pages: [validPage] };
  assert.ok(validateOfficialPageManifest(base, "book-1"));
  assert.equal(validateOfficialPageManifest({ ...base, bookId: "book-2" }, "book-1"), null);
  assert.equal(validateOfficialPageManifest({ ...base, pages: [{ ...validPage, imageUrl: "https://evil.example/upload/taphuan/page.png" }] }, "book-1"), null);
  assert.equal(validateOfficialPageManifest({ ...base, pages: [validPage, { ...validPage, index: 1 }] }, "book-1"), null);
});

test("catalog identity, lookup and combined filters are stable", () => {
  assert.equal(new Set(enabledPublicBooks.map((book) => book.id)).size, enabledPublicBooks.length);
  assert.equal(new Set(enabledPublicBooks.map((book) => `${book.seriesSlug}/${book.slug}`)).size, enabledPublicBooks.length);
  assert.equal(findPublicBook("global-success", "tieng-anh-3-tap-1")?.grade, 3);
  assert.equal(findPublicBook("future-series", "tieng-anh-3-tap-1"), undefined);
  assert.deepEqual(publicBooksForGrade(3, publicBooksForType("STUDENT_BOOK")).map((book) => book.volume), [1, 2]);
  assert.equal(publicBooksForGrade(3, publicBooksForType("TEACHER_BOOK")).length, 1);
});

test("series helper is catalog-derived", () => {
  assert.deepEqual(publicBookSeries(enabledPublicBooks), [{ slug: "global-success", name: "Global Success" }]);
  const futureBook = { ...enabledPublicBooks[0], id: "future-1", slug: "future-1", seriesSlug: "future-series", seriesName: "Future Series" };
  assert.equal(publicBookSeries([...enabledPublicBooks, futureBook]).length, 2);
});

test("stable reading routes feed prerender and sitemap without audio routes", () => {
  assert.equal(stableBookPathnames.length, enabledPublicBooks.length + 1);
  assert.ok(stableBookPathnames.every((pathname) => !pathname.endsWith("/nghe")));
  for (const pathname of stableBookPathnames) assert.ok(productionSitemapPathnames.includes(pathname));
  assert.equal(bookRouteMetadata("/sach/global-success/tieng-anh-9").valid, true);
  assert.equal(bookRouteMetadata("/sach/global-success/tieng-anh-9/nghe").robots, "noindex,follow");
  assert.equal(bookRouteMetadata("/sach/global-success/tieng-anh-9-sach-giao-vien/nghe").valid, false);
});

test("teacher metadata and library copy never claim audio", () => {
  const teacherMetadata = bookRouteMetadata("/sach/global-success/tieng-anh-3-sach-giao-vien");
  assert.match(teacherMetadata.title, /Sách giáo viên/);
  assert.doesNotMatch(`${teacherMetadata.title} ${teacherMetadata.description}`, /audio|bài nghe|nghe trực tiếp/i);
  assert.match(librarySource, /Sách học sinh và tài liệu giáo viên/);
  assert.doesNotMatch(librarySource, /tất cả.*audio|tất cả.*bài nghe|FlipBuilder|Có bài nghe/i);
});

test("flip pages preserve every manifest page and mark only covers as hard", () => {
  for (const count of [1, 4, 5]) {
    const pages = Array.from({ length: count }, (_, offset) => ({ index: offset + 1, label: `Trang ${offset + 1}`, imageUrl: `https://cdn3.olm.vn/upload/taphuan/page-${offset + 1}.png` }));
    const flipPages = buildFlipPages(pages);
    assert.deepEqual(flipPages.map((page) => page.manifestPage.index), pages.map((page) => page.index));
    assert.equal(new Set(flipPages.map((page) => page.manifestPage.index)).size, count);
    assert.equal(flipPages[0].density, "hard");
    assert.equal(flipPages.at(-1).density, "hard");
    assert.equal(flipPages.length, count, "technical blank must not count as a page");
  }
});

test("manifest and flip indexes map without off-by-one errors", () => {
  for (let page = 1; page <= 78; page += 1) {
    const flipIndex = manifestPageToFlipIndex(page, 78);
    assert.equal(flipIndexToManifestPage(flipIndex, 78), page);
  }
  assert.equal(initialManifestPage("10", 78), 10);
  assert.equal(initialManifestPage("999", 78), 78);
  assert.equal(initialManifestPage("invalid", 78), 1);
});

test("single and double modes create real-book spreads and labels", () => {
  assert.equal(readerModeForWidth(390), "single");
  assert.equal(readerModeForWidth(768), "single");
  assert.equal(readerModeForWidth(900), "double");
  assert.deepEqual(manifestPagesInSpread(1, 78, "double"), [1]);
  assert.deepEqual(manifestPagesInSpread(2, 78, "double"), [2, 3]);
  assert.deepEqual(manifestPagesInSpread(3, 78, "double"), [2, 3]);
  assert.deepEqual(manifestPagesInSpread(78, 78, "double"), [78]);
  assert.deepEqual(manifestPagesInSpread(79, 79, "double"), [78, 79]);
  assert.deepEqual(manifestPagesInSpread(10, 78, "single"), [10]);
  assert.equal(currentSpreadLabel(10, 78, "double"), "10–11 / 78");
  assert.equal(currentSpreadLabel(10, 78, "single"), "10 / 78");
});

test("zoom and reduced-motion policies are deterministic", () => {
  assert.equal(isFlipGestureEnabled(1), true);
  assert.equal(isFlipGestureEnabled(1.25), false);
  assert.ok(pageFlipDuration(true) < pageFlipDuration(false));
  assert.ok(pageFlipDuration(false) >= 500 && pageFlipDuration(false) <= 800);
});

test("official image reader uses controlled flipbook zoom and safe fallback", () => {
  assert.match(officialViewerSource, /OfficialSourceFallback/);
  assert.match(officialViewerSource, /officialPageManifestUrl/);
  assert.doesNotMatch(officialViewerSource, /component="iframe"|<iframe|contentDocument/);
  assert.match(officialBookReaderSource, /ResponsivePageFlip/);
  assert.match(officialBookReaderSource, /single-page-reader-fallback/);
  assert.match(officialBookReaderSource, /scrollTo\(\{ left: 0, top: 0 \}\)/);
  assert.doesNotMatch(officialBookReaderSource, /component="iframe"|<iframe|transform:/i);
  assert.match(nginxSource, /img-src 'self' data: https:\/\/i\.ytimg\.com https:\/\/cdn3\.olm\.vn;/);
});

test("interactive audio viewer remains isolated from the official reader", () => {
  assert.match(audioViewerSource, /allow="autoplay; fullscreen"/);
  assert.match(audioViewerSource, /sandbox=\{iframeSandbox\}/);
  assert.doesNotMatch(audioViewerSource, /allow-top-navigation|orientation|requestFullscreen|clickToRead|contentDocument/);
  assert.match(nginxSource, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.google\.com https:\/\/taphuan\.nxbgd\.vn https:\/\/online\.flipbuilder\.com;/);
  assert.match(nginxSource, /location = \/sach[\s\S]*?location \^~ \/sach\//);
  assert.doesNotMatch(nginxSource, /frame-src\s+(?:\*|https:)\s*;/);
});
