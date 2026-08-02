/* global URL */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { bookRouteMetadata, stableBookPathnames } from "../src/features/books/seo/bookMetadata.ts";
import { enabledPublicBooks, findPublicBook, isAllowedBookPreviewUrl, publicBookSeries, publicBooksForGrade } from "../src/features/books/content/publicBookCatalog.ts";
import { productionSitemapPathnames } from "../src/features/learning/seo/learningSitemap.ts";

const clientRoot = path.resolve(import.meta.dirname, "..");
const viewerSource = fs.readFileSync(path.join(clientRoot, "src/features/books/components/BookViewer.tsx"), "utf8");
const librarySource = fs.readFileSync(path.join(clientRoot, "src/features/books/pages/BookLibraryPage.tsx"), "utf8");
const nginxSource = fs.readFileSync(path.join(clientRoot, "../deploy/nginx.conf"), "utf8");

test("Global Success catalog has the approved 13 unique books", () => {
  assert.equal(enabledPublicBooks.length, 13);
  assert.equal(new Set(enabledPublicBooks.map((book) => book.id)).size, 13);
  assert.equal(new Set(enabledPublicBooks.map((book) => book.slug)).size, 13);
  assert.deepEqual([1, 2, 7, 8, 9].map((grade) => publicBooksForGrade(grade).length), [1, 1, 1, 1, 1]);
  for (const grade of [3, 4, 5, 6]) assert.deepEqual(publicBooksForGrade(grade).map((book) => book.volume), [1, 2]);
});

test("series helper returns unique catalog-derived options", () => {
  assert.deepEqual(publicBookSeries(enabledPublicBooks), [{ slug: "global-success", name: "Global Success" }]);
  const futureBook = { ...enabledPublicBooks[0], id: "future-1", slug: "future-1", seriesSlug: "future-series", seriesName: "Future Series" };
  assert.deepEqual(publicBookSeries([enabledPublicBooks[0], enabledPublicBooks[1], futureBook]), [
    { slug: "global-success", name: "Global Success" },
    { slug: "future-series", name: "Future Series" },
  ]);
});

test("book sources are HTTPS and restricted to the FlipBuilder sdtta allowlist", () => {
  for (const book of enabledPublicBooks) {
    const url = new URL(book.previewUrl);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "online.flipbuilder.com");
    assert.ok(url.pathname.startsWith("/sdtta/"));
    assert.equal(isAllowedBookPreviewUrl(book.previewUrl), true);
  }
  for (const rejected of ["http://online.flipbuilder.com/sdtta/rhkc/", "https://evil.example/sdtta/rhkc/", "https://online.flipbuilder.com/other/rhkc/", "not-a-url"])
    assert.equal(isAllowedBookPreviewUrl(rejected), false, rejected);
});

test("slug lookup, metadata, prerender and sitemap are catalog-derived", () => {
  assert.equal(findPublicBook("tieng-anh-3-tap-1")?.grade, 3);
  assert.equal(findPublicBook("khong-ton-tai"), undefined);
  assert.equal(stableBookPathnames.length, 14);
  assert.equal(bookRouteMetadata("/sach").valid, true);
  assert.equal(bookRouteMetadata("/sach/global-success/tieng-anh-9").valid, true);
  assert.equal(bookRouteMetadata("/sach/global-success/khong-ton-tai").valid, false);
  for (const pathname of stableBookPathnames) assert.ok(productionSitemapPathnames.includes(pathname));
});

test("viewer and deployment preserve interactive audio safely", () => {
  assert.match(viewerSource, /loading="lazy"/);
  assert.match(viewerSource, /allow="autoplay; fullscreen"/);
  assert.doesNotMatch(viewerSource, />Mở toàn màn hình</);
  assert.doesNotMatch(viewerSource, />Mở sách ở tab mới</);
  assert.match(viewerSource, /allowFullScreen/);
  assert.match(viewerSource, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.match(viewerSource, /onLoad=\{handleLoad\}/);
  assert.match(viewerSource, /isSlow && !isLoaded/);
  assert.doesNotMatch(viewerSource, /dangerouslySetInnerHTML|sandbox=|PDF\.js|pdfjs/i);
  assert.doesNotMatch(librarySource, /component="iframe"|<iframe/);
  assert.match(nginxSource, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.google\.com https:\/\/online\.flipbuilder\.com;/);
  assert.match(nginxSource, /location = \/sach[\s\S]*?location \^~ \/sach\//);
  assert.doesNotMatch(nginxSource, /frame-src\s+(?:\*|https:)\s*;/);
});

test("library copy and filters are series-neutral", () => {
  assert.match(librarySource, /Tủ sách Tiếng Anh theo lớp/);
  assert.match(librarySource, /enabledPublicBookSeries\.length > 1/);
  assert.doesNotMatch(librarySource, /Chọn sách Global Success theo lớp|GLOBAL SUCCESS · 13 SÁCH|Em đang học lớp mấy\?|Chọn lớp của em/);
});
