/* global process, fetch, setTimeout, document, console */
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

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("header-books").isVisible(), "Homepage Tủ sách navigation is missing");
  await page.getByTestId("homepage-book-library-cta").getByRole("link", { name: "Mở Tủ sách" }).click();
  await page.waitForURL(`${origin}/sach`);
  const libraryHeading = page.getByRole("heading", { name: "Chọn sách Global Success theo lớp", level: 1 });
  await libraryHeading.waitFor();
  assert(await libraryHeading.isVisible(), "Library did not open");
  assert(await page.locator("iframe").count() === 0, "Library route must not create iframes");

  await page.getByRole("button", { name: "Lớp 3" }).click();
  const grade3Group = page.locator('[data-testid="book-group-3"]');
  await grade3Group.waitFor();
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
  assert(await page.getByRole("button", { name: "Mở toàn màn hình" }).isVisible(), "Fullscreen action is missing");
  assert(await page.getByRole("link", { name: "Mở sách ở tab mới" }).isVisible(), "External fallback is missing");

  await page.goto(`${origin}/sach/global-success/khong-ton-tai`, { waitUntil: "networkidle" });
  const missingHeading = page.getByRole("heading", { name: "Chưa tìm thấy cuốn sách này", level: 1 });
  await missingHeading.waitFor();
  assert(await missingHeading.isVisible(), "Invalid slug did not show friendly state");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/sach?grade=3`, { waitUntil: "networkidle" });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!hasOverflow, `Horizontal overflow at ${viewport.width}px`);
    if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: path.join(screenshotDir, `library-${viewport.width}.png`), fullPage: true });
  }
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
