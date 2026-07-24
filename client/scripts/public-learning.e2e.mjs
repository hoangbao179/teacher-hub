/* global process, fetch, setTimeout, document, localStorage, URL, console */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5186;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), "covy-learning-v18a-"));
const viewports = [
  { width: 360, height: 800 }, { width: 375, height: 812 }, { width: 390, height: 844 },
  { width: 393, height: 852 }, { width: 400, height: 930 }, { width: 412, height: 915 },
  { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 900 },
];
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
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: clientRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  const prerendered = await (await fetch(`${origin}/hoc/index.html`)).text();
  assert(prerendered.includes("Góc học tiếng Anh miễn phí cùng cô Vy"), "Production /hoc is not prerendered");
  assert((prerendered.match(/<h1\b/g) ?? []).length === 1, "Prerendered /hoc must contain one H1");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem("teacher-token", "public-route-must-not-use-admin-token");
    localStorage.setItem("covy-learning-progress:v1", "{broken");
  });
  const page = await context.newPage();
  const apiRequests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.getByTestId("homepage-learning-cta").getByRole("link", { name: "Bắt đầu học" }).click();
  await page.waitForURL(`${origin}/hoc`);
  const hubHeading = page.getByRole("heading", { name: "Góc học tiếng Anh miễn phí cùng cô Vy", level: 1 });
  await hubHeading.waitFor();
  assert(await hubHeading.isVisible(), "Homepage CTA did not open /hoc");
  assert(apiRequests.length === 0, `Learning flow called Admin API: ${apiRequests.join(", ")}`);

  const levelGroups = page.locator('[data-testid^="level-group-"]');
  assert(await levelGroups.locator("article").count() === 10, "Hub must show preschool and grades 1–9 exactly");
  assert(await page.getByRole("link", { name: "Mở bài học Mầm non" }).isVisible(), "Preschool content must open");
  assert(await page.getByRole("link", { name: "Mở bài học Lớp 3" }).isVisible(), "Grade 3 content must open");
  assert(await page.getByText("Sắp có", { exact: true }).count() === 8, "Eight unpublished levels must show Sắp có");
  assert(await page.getByRole("link", { name: "Mở bài học Lớp 1" }).count() === 0, "Unpublished level must not navigate");

  await page.getByRole("link", { name: "Mở bài học Mầm non" }).click();
  await page.waitForURL(`${origin}/hoc/mam-non`);
  const levelHeading = page.getByRole("heading", { name: "Chọn bài học", level: 1 });
  await levelHeading.waitFor();
  assert(await levelHeading.isVisible(), "Available level page did not open");
  assert(await page.locator("main article").count() === 2, "Preschool must have two Unit cards");
  assert(await page.getByText("Bài học sắp mở", { exact: true }).count() === 2, "V18A Unit actions must be explicitly unavailable");

  await page.reload({ waitUntil: "networkidle" });
  await levelHeading.waitFor();
  assert(await levelHeading.isVisible(), "Direct level refresh failed");
  await page.goto(`${origin}/hoc/lop-khong-ton-tai`, { waitUntil: "networkidle" });
  const notFoundHeading = page.getByRole("heading", { name: "Bài học này chưa có trong cặp sách", level: 1 });
  await notFoundHeading.waitFor();
  assert(await notFoundHeading.isVisible(), "Invalid learning level must show public learning 404");
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,follow", "Invalid learning route must be noindex");

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/hoc`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `Learning hub horizontal overflow at ${viewport.width}px: ${overflow}px`);
    const targets = await page.getByRole("link").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0));
    assert(targets.every((rect) => rect.height >= 44), `Learning link touch target below 44px at ${viewport.width}px`);
    if (viewport.width === 360 || viewport.width === 1440) await page.screenshot({ path: path.join(screenshotDir, `hoc-${viewport.width}x${viewport.height}.png`), fullPage: true });

    await page.goto(`${origin}/hoc/lop-3`, { waitUntil: "networkidle" });
    const levelOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(levelOverflow <= 1, `Learning level horizontal overflow at ${viewport.width}px: ${levelOverflow}px`);
    if (viewport.width === 360 || viewport.width === 1440) await page.screenshot({ path: path.join(screenshotDir, `hoc-lop-3-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }

  assert(apiRequests.length === 0, `Public learning made API requests: ${apiRequests.join(", ")}`);
  console.log(`Public learning E2E passed; temporary screenshots: ${screenshotDir}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
