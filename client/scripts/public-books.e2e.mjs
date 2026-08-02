/* global process, fetch, setTimeout, document, window, console, getComputedStyle */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { stableBookPathnames } from "../src/features/books/seo/bookMetadata.ts";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5191;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), "covy-books-v21b-"));
let child;
let browser;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function loadLazyImagesForScreenshot(page) {
  const images = page.locator("img");
  for (let index = 0; index < await images.count(); index += 1) {
    await images.nth(index).scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
}

try {
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: clientRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  for (const pathname of stableBookPathnames) {
    const html = await (await fetch(`${origin}${pathname}/index.html`)).text();
    assert(html.includes('id="root" data-prerendered="true"'), `Prerender missing: ${pathname}`);
    assert((html.match(/<h1\b/g) ?? []).length === 1, `Prerender must contain one H1: ${pathname}`);
    assert(html.includes(`rel="canonical" href="https://tienganhcovy.com${pathname}"`), `Canonical missing: ${pathname}`);
  }

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext();
  await context.route("https://online.flipbuilder.com/**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>FlipBuilder test viewer</title>" }));
  const page = await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("header-books").isVisible(), "Homepage Tủ sách navigation is missing");
  assert(await page.getByTestId("header-learning").isVisible(), "Homepage Góc học navigation is missing");
  assert(await page.getByTestId("header-home").isVisible(), "Desktop Trang chủ navigation is missing");
  assert(await page.getByTestId("homepage-book-library-cta").getByRole("heading", { name: "Tủ sách Tiếng Anh theo lớp", exact: true }).isVisible(), "Homepage library copy is not series-neutral");
  await page.screenshot({ path: path.join(screenshotDir, "homepage-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("header-brand").isHidden(), "Mobile brand text must be hidden");
  assert(await page.getByTestId("header-learning").getByText("Góc học", { exact: true }).isVisible(), "Mobile Góc học label is missing");
  assert(await page.getByTestId("header-books").getByText("Tủ sách", { exact: true }).isVisible(), "Mobile Tủ sách label is missing");
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "Homepage overflows horizontally on mobile");
  await page.screenshot({ path: path.join(screenshotDir, "homepage-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("homepage-book-library-cta").getByRole("link", { name: "Mở Tủ sách" }).click();
  await page.waitForURL(`${origin}/sach`);
  const libraryHeading = page.getByRole("heading", { name: "Tủ sách Tiếng Anh theo lớp", level: 1 });
  await libraryHeading.waitFor();
  assert(await libraryHeading.isVisible(), "Library did not open");
  assert(await page.locator("iframe").count() === 0, "Library route must not create iframes");
  assert(await page.getByText("Chọn sách Global Success theo lớp", { exact: true }).count() === 0, "Series-specific hero copy remains");
  assert(await page.getByText("Em đang học lớp mấy?", { exact: true }).count() === 0, "Duplicate grade heading remains");
  assert(await page.getByRole("button", { name: "Chọn lớp của em", exact: true }).count() === 0, "Duplicate hero CTA remains");
  assert(await page.getByTestId("book-series-filter").count() === 0, "Single-series catalog must hide the series filter");
  assert(await page.getByRole("button", { name: "Tất cả", exact: true }).getAttribute("aria-pressed") === "true", "All grades must be active by default");
  assert(await page.locator('[data-testid^="book-group-"]').count() === 9, "Default library must show all nine grade groups");
  assert(await page.locator('[data-testid^="book-card-"]').count() === 13, "Default library must show all 13 books");
  const grade1Box = await page.getByTestId("book-group-1").boundingBox();
  const grade2Box = await page.getByTestId("book-group-2").boundingBox();
  assert(grade1Box && grade2Box && Math.abs(grade1Box.y - grade2Box.y) <= 1 && grade1Box.x < grade2Box.x, "Wide desktop must place two grade panels on one row");
  const firstCard = page.getByTestId("book-card-tieng-anh-1");
  assert(await firstCard.getByRole("link").count() === 1, "Each book card must have exactly one CTA");
  assert(await firstCard.getByRole("link", { name: "Mở sách", exact: true }).isVisible(), "Book CTA is missing");
  assert(await firstCard.getByText("Global Success · Lớp 1", { exact: true }).isVisible(), "Series and grade badge is missing");
  const coverStyle = await firstCard.locator("img").evaluate((image) => ({ objectFit: getComputedStyle(image).objectFit, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height }));
  assert(coverStyle.objectFit === "contain" && Math.abs(coverStyle.height / coverStyle.width - 4 / 3) < 0.02, "Book cover must keep the uncropped 3:4 ratio");

  await page.getByRole("button", { name: "Lớp 3" }).click();
  const grade3Group = page.locator('[data-testid="book-group-3"]');
  await grade3Group.waitFor();
  assert(await page.locator('[data-testid^="book-group-"]').count() === 1, "Grade 3 filter must hide every other grade group");
  assert(await grade3Group.locator("article").count() === 2, "Grade 3 must show two volumes");
  await page.getByRole("button", { name: "Lớp 9" }).click();
  const grade9Group = page.locator('[data-testid="book-group-9"]');
  await grade9Group.waitFor();
  await grade3Group.waitFor({ state: "detached" });
  assert(await grade9Group.locator("article").count() === 1, "Grade 9 must show one book");
  await page.getByTestId("book-card-tieng-anh-9").getByRole("link", { name: "Mở sách" }).click();
  await page.waitForURL(`${origin}/sach/global-success/tieng-anh-9`);
  const iframe = page.locator("iframe");
  await iframe.waitFor();
  assert(await iframe.count() === 1, "Preview must create exactly one iframe");
  assert(await iframe.getAttribute("src") === "https://online.flipbuilder.com/sdtta/gqmy/", "Iframe source is not catalog-derived");
  assert((await iframe.getAttribute("allow")) === "autoplay; fullscreen", "Iframe audio/fullscreen permission is missing");
  assert(await page.getByRole("button", { name: "Mở toàn màn hình", exact: true }).count() === 0, "Standalone fullscreen action remains");
  assert(await page.getByRole("link", { name: "Mở sách ở tab mới", exact: true }).count() === 0, "Standalone external action remains");
  await page.waitForTimeout(8200);
  assert(await page.getByText("Sách có thể đang tải chậm.", { exact: false }).count() === 0, "Slow-load warning appeared after iframe load");

  await page.goto(`${origin}/sach/global-success/khong-ton-tai`, { waitUntil: "networkidle" });
  const missingHeading = page.getByRole("heading", { name: "Chưa tìm thấy cuốn sách này", level: 1 });
  await missingHeading.waitFor();
  assert(await missingHeading.isVisible(), "Invalid slug did not show friendly state");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!hasOverflow, `Horizontal overflow at ${viewport.width}px`);
    if (viewport.width <= 390) {
      assert(await page.getByTestId("header-brand").isHidden(), `Mobile brand text remains at ${viewport.width}px`);
      assert(await page.getByTestId("header-learning").isVisible(), `Mobile Góc học label is missing at ${viewport.width}px`);
      assert(await page.getByTestId("header-books").isVisible(), `Mobile Tủ sách label is missing at ${viewport.width}px`);
      assert(await page.getByTestId("header-books").getAttribute("aria-current") === "page", `Tủ sách active state is missing at ${viewport.width}px`);
    }
    if (viewport.width === 390 || viewport.width === 1440) {
      await loadLazyImagesForScreenshot(page);
      await page.screenshot({ path: path.join(screenshotDir, `library-all-${viewport.width}.png`), fullPage: true });
    }
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/sach?grade=3`, { waitUntil: "networkidle" });
    await loadLazyImagesForScreenshot(page);
    await page.screenshot({ path: path.join(screenshotDir, `library-grade-3-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotDir, "viewer-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "Viewer overflows horizontally on mobile");
  await page.screenshot({ path: path.join(screenshotDir, "viewer-390.png"), fullPage: true });
  console.log(`Public books E2E passed; temporary screenshots: ${screenshotDir}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
