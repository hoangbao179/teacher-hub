/* global process, fetch, setTimeout, console, localStorage */
import { spawn, spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4132;
const webPort = 5232;
const origin = `http://127.0.0.1:${webPort}`;
const password = "vocabulary-media-e2e-password-123";
const env = {
  ...process.env, NODE_ENV: "test", DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306", DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "", DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "vocabulary-media-e2e-secret-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: password, PORT: String(apiPort), CORS_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const children = [];
let browser;
let createdId;
const assert = (value, message) => { if (!value) throw new Error(message); };
function run(command, args, cwd) {
  const executable = command === "npm" && process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = command === "npm" && process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}
function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
}
async function waitUrl(url) {
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* Server is not ready; retry. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout: ${url}`);
}
async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, {
    ...options, headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload.data;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);
  const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "covy", password }) });
  const auth = { Authorization: `Bearer ${login.token}` };
  const created = await api("/api/vocabulary/sets", {
    method: "POST", headers: auth,
    body: JSON.stringify({
      title: `Media flow ${Date.now()}`, sourceType: "MANUAL", ageBand: "G2_G3",
      items: ["apple", "bus", "cat", "bread", "book", "mother", "run", "happy", "rainy", "plane"]
        .map((word, index) => ({ displayOrder: index + 1, word, meaningVi: `nghĩa ${word}`,
          tier: "CUSTOM", illustration: { kind: "NONE" }, supportsImageGame: true })),
    }),
  });
  createdId = created.id;
  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((token) => localStorage.setItem("teacher-token", token), login.token);
  const page = await context.newPage();
  let searches = 0;
  let imported = 0;
  let uploaded = 0;
  const searchMediaTypes = [];
  await page.route("**/api/vocabulary/media/status", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { enabled: true, provider: "PIXABAY" } }),
  }));
  await page.route("**/api/vocabulary/media/search?*", (route) => {
    searches += 1;
    const url = new URL(route.request().url());
    const requestedMediaType = url.searchParams.get("mediaType");
    searchMediaTypes.push(requestedMediaType);
    const results = Array.from({ length: 6 }, (_, index) => ({
      provider: "PIXABAY", providerAssetId: `${searches}-${index}`,
      previewUrl: `${origin}/images/teacher-english-hero-720.jpg`,
      thumbnailUrl: `${origin}/images/teacher-english-hero-720.jpg`, width: 640, height: 640,
      mediaType: requestedMediaType, contributorName: "Pixabay test", attributionText: "Pixabay test",
      sourcePageUrl: "https://pixabay.com/",
    }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      data: { provider: "PIXABAY", safeSearch: true, cacheExpiresAt: "2026-08-01T00:00:00.000Z",
        page: 1, pageSize: 12, total: results.length, items: results },
    }) });
  });
  const stored = (id, provider) => ({
    id, provider, providerAssetId: String(id),
    url: `/api/public/vocabulary-media/${id}?variant=GAME`,
    thumbnailUrl: `/api/public/vocabulary-media/${id}?variant=THUMBNAIL`,
    width: 640, height: 640, mimeType: "image/webp", byteSize: 100, altText: "test",
    contributorName: "", attributionText: "", sourcePageUrl: "", licenseLabel: "",
  });
  await page.route("**/api/vocabulary/media/import", (route) => {
    imported += 1;
    return route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify({ data: stored(9001, "PIXABAY") }) });
  });
  await page.route("**/api/vocabulary/media/upload", (route) => {
    uploaded += 1;
    return route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify({ data: stored(9002, "USER_UPLOAD") }) });
  });
  const mockImage = fs.readFileSync(path.join(root, "client/public/images/teacher-english-hero-720.jpg"));
  await page.route("**/api/public/vocabulary-media/900*", (route) => route.fulfill({
    status: 200, contentType: "image/jpeg", body: mockImage,
  }));

  await page.goto(`${origin}/admin/vocabulary/${createdId}`, { waitUntil: "networkidle" });
  await page.locator('button:has([data-testid="CollectionsIcon"])').first().click();
  const modal = page.locator('[data-testid="vocabulary-bulk-image-suggestions"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "Chọn ảnh" }).first().waitFor();
  const illustrationSearches = searches;

  await modal.getByLabel("Loại ảnh").click();
  await page.getByRole("option", { name: "Ảnh thật" }).click();
  await modal.getByText("Chưa tìm").first().waitFor();
  await page.waitForTimeout(700);
  assert(searches === illustrationSearches, "changing PHOTO automatically started a search");
  await modal.getByRole("button", { name: "Bắt đầu tìm ảnh thật" }).click();
  await modal.getByRole("button", { name: "Chọn ảnh" }).first().waitFor();
  assert(searchMediaTypes.slice(illustrationSearches).every((value) => value === "PHOTO"),
    "PHOTO batch retained illustration searches");

  await modal.locator('img[src*="teacher-english"]').first().click();
  await modal.getByRole("button", { name: "Chọn ảnh" }).first().click();
  const input = modal.locator('input[type="file"]').nth(1);
  await input.setInputFiles({ name: "upload.png", mimeType: "image/png", buffer: Buffer.from("browser-upload") });
  const blobPreview = modal.getByAltText("Xem trước ảnh tải lên");
  await blobPreview.waitFor();
  assert((await blobPreview.getAttribute("src"))?.startsWith("blob:"), "upload preview is not a blob URL");
  await modal.getByRole("button", { name: "Dùng ảnh này" }).click();
  assert(imported === 1, `expected one import, got ${imported}`);
  assert(uploaded === 1, `expected one upload, got ${uploaded}`);
  await modal.getByRole("button", { name: "Xong" }).click();
  await modal.waitFor({ state: "hidden" });
  assert(await page.locator('img[src*="vocabulary-media/900"]').count() >= 2,
    "selected/uploaded thumbnails did not appear in vocabulary items");
  console.log("Vocabulary media targeted browser flow PASS");
  await context.close();
} finally {
  if (browser) await browser.close();
  if (createdId) {
    try {
      const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "covy", password }) });
      await api(`/api/vocabulary/sets/${createdId}/archive`, {
        method: "POST", headers: { Authorization: `Bearer ${login.token}` }, body: "{}",
      });
    } catch { /* Best-effort cleanup must not hide the test result. */ }
  }
  for (const child of children.reverse()) child.kill();
}
