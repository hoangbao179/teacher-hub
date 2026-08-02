/* global URL */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { bookRouteMetadata, stableBookPathnames } from "../src/features/books/seo/bookMetadata.ts";
import { enabledPublicBooks, findPublicBook, isAllowedBookPreviewUrl, publicBooksForGrade } from "../src/features/books/content/publicBookCatalog.ts";
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
  assert.match(viewerSource, /allowFullScreen/);
  assert.match(viewerSource, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(viewerSource, /dangerouslySetInnerHTML|sandbox=|PDF\.js|pdfjs/i);
  assert.doesNotMatch(librarySource, /component="iframe"|<iframe/);
  assert.match(nginxSource, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.google\.com https:\/\/online\.flipbuilder\.com;/);
  assert.match(nginxSource, /location = \/sach[\s\S]*?location \^~ \/sach\//);
  assert.doesNotMatch(nginxSource, /frame-src\s+(?:\*|https:)\s*;/);
});
