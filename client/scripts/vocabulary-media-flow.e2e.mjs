/* global process, fetch, setTimeout, console, localStorage, document, window, FormData, Blob */
import { spawn, spawnSync } from "node:child_process";
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
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const password = "vocabulary-media-e2e-password-123";
const env = {
  ...process.env, NODE_ENV: "test", DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306", DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "", DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "vocabulary-media-e2e-secret-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: password, PORT: String(apiPort), CORS_ORIGIN: origin,
  VITE_API_BASE_URL: apiOrigin,
};
const children = [];
const createdIds = [];
let browser;
let loginToken = "";
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
  const response = await fetch(`${apiOrigin}${pathname}`, {
    ...options, headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload.data;
}

async function uploadFixture(token) {
  const body = new FormData();
  const bytes = fs.readFileSync(path.join(root, "client/public/images/teacher-english-hero-720.jpg"));
  body.append("image", new Blob([bytes], { type: "image/jpeg" }), "fixture.jpg");
  body.append("altText", "ARASAAC fixture");
  const response = await fetch(`${apiOrigin}/api/vocabulary/media/upload`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload.data;
}

async function createSet(auth, words, title) {
  const created = await api("/api/vocabulary/sets", {
    method: "POST", headers: auth,
    body: JSON.stringify({
      title, sourceType: "MANUAL", ageBand: "G2_G3",
      items: words.map((word, index) => ({
        displayOrder: index + 1, word, meaningVi: `nghĩa ${word}`,
        tier: "CUSTOM", illustration: { kind: "NONE" }, supportsImageGame: false,
      })),
    }),
  });
  createdIds.push(created.id);
  return created;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`${apiOrigin}/health`);
  await waitUrl(origin);
  const login = await api("/api/auth/login", {
    method: "POST", body: JSON.stringify({ username: "covy", password }),
  });
  loginToken = login.token;
  const auth = { Authorization: `Bearer ${login.token}` };
  const storedFixture = await uploadFixture(login.token);
  const localSet = await createSet(
    auth,
    ["red", "blue", "yellow", "green"],
    `Local media draft ${Date.now()}`,
  );

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((token) => localStorage.setItem("teacher-token", token), login.token);
  const page = await context.newPage();
  const imageBytes = fs.readFileSync(path.join(root, "client/public/images/teacher-english-hero-720.jpg"));
  let providerMode = "success";
  let searches = 0;
  const imports = new Map();

  await page.route("https://static.arasaac.org/**", (route) => route.fulfill({
    status: 200, contentType: "image/jpeg", body: imageBytes,
  }));
  await page.route("**/api/vocabulary/media/status", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: {
      enabled: true, provider: "ARASAAC",
      providers: [{ provider: "ARASAAC", enabled: true }, { provider: "PIXABAY", enabled: false }],
    } }),
  }));
  await page.route("**/api/vocabulary/media/search?*", (route) => {
    searches += 1;
    if (providerMode === "unavailable") return route.fulfill({
      status: 503, contentType: "application/json", headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Expose-Headers": "Retry-After",
        "Retry-After": "1",
      },
      body: JSON.stringify({ error: {
        code: "IMAGE_PROVIDER_UNAVAILABLE", message: "Nguồn hình minh họa đang tạm gián đoạn.",
      } }),
    });
    const url = new URL(route.request().url());
    const query = url.searchParams.get("query") ?? "unknown";
    const providerAssetId = `asset-${query.replace(/[^a-z0-9]+/gi, "-")}`;
    const previewUrl = `https://static.arasaac.org/pictograms/${providerAssetId}/${providerAssetId}_300.png`;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      provider: "ARASAAC", safeSearch: true, cacheExpiresAt: "2026-08-06T00:00:00.000Z",
      page: 1, pageSize: 12, total: 1, items: [{
        provider: "ARASAAC", providerAssetId, previewUrl, thumbnailUrl: previewUrl,
        width: 500, height: 500, mediaType: "ILLUSTRATION",
        contributorName: "Sergio Palao / ARASAAC", attributionText: "ARASAAC fixture",
        sourcePageUrl: "https://arasaac.org",
      }],
    } }) });
  });
  await page.route("**/api/vocabulary/media/import", (route) => {
    const request = route.request().postDataJSON();
    const key = `${request.provider}:${request.providerAssetId}`;
    imports.set(key, (imports.get(key) ?? 0) + 1);
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: {
      ...storedFixture,
      provider: request.provider,
      providerAssetId: request.providerAssetId,
      altText: request.altText,
    } }) });
  });

  await page.goto(`${origin}/admin/vocabulary/${localSet.id}`, { waitUntil: "networkidle" });
  const openBulk = () => page.getByRole("button", { name: "Gợi ý ảnh cho tất cả" }).click();
  await openBulk();
  let modal = page.locator('[data-testid="vocabulary-bulk-image-suggestions"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "Áp dụng 4 ảnh" }).waitFor({ timeout: 15_000 });
  assert((await modal.getByText("Đã chọn", { exact: true }).count()) === 4,
    "local suggestions were not selected by default");
  await modal.getByRole("button", { name: "Hủy", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
  assert(await page.getByText("Chưa có hình", { exact: true }).count() === 4,
    "cancel leaked draft selections into the editor");
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await page.getByText("Mọi thay đổi đã được lưu").waitFor({ timeout: 15_000 });
  const cancelled = await api(`/api/vocabulary/sets/${localSet.id}`, { headers: auth });
  assert(cancelled.items.every((item) => item.illustration.kind === "NONE"),
    "saving after cancel persisted a draft selection");

  await openBulk();
  modal = page.locator('[data-testid="vocabulary-bulk-image-suggestions"]');
  await modal.getByRole("button", { name: "Áp dụng 4 ảnh" }).waitFor({ timeout: 15_000 });
  const screenshotDir = path.join(root, "test-results");
  fs.mkdirSync(screenshotDir, { recursive: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "bulk dialog overflows at 390x844");
  await page.screenshot({ path: path.join(screenshotDir, "vocabulary-media-draft-390x844.png") });
  await page.setViewportSize({ width: 1366, height: 768 });
  const dialogBox = await modal.boundingBox();
  assert(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 1366,
    "bulk dialog breaks at 1366x768");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "bulk dialog overflows at 1366x768");
  await page.screenshot({ path: path.join(screenshotDir, "vocabulary-media-draft-1366x768.png") });
  await page.setViewportSize({ width: 390, height: 844 });

  await modal.getByRole("button", { name: "Áp dụng 4 ảnh" }).click();
  await modal.waitFor({ state: "hidden", timeout: 15_000 });
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await page.getByText("Mọi thay đổi đã được lưu").waitFor({ timeout: 15_000 });
  const savedLocal = await api(`/api/vocabulary/sets/${localSet.id}`, { headers: auth });
  assert(savedLocal.items.every((item) =>
    item.illustration.kind === "PUBLIC_ASSET" && item.supportsImageGame === true),
  "PUBLIC_ASSET drafts were not persisted with image-game support");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('img[src*="/learning/"]').first().waitFor({ state: "attached", timeout: 15_000 });
  assert(await page.locator('img[src*="/learning/"]').count() >= 4,
    "saved PUBLIC_ASSET thumbnails did not survive reload");

  const remoteSet = await createSet(auth, ["apple", "cat", "bus"], `ARASAAC media draft ${Date.now()}`);
  await page.goto(`${origin}/admin/vocabulary/${remoteSet.id}`, { waitUntil: "networkidle" });
  await openBulk();
  modal = page.locator('[data-testid="vocabulary-bulk-image-suggestions"]');
  await modal.getByRole("button", { name: "Áp dụng 3 ảnh" }).waitFor({ timeout: 15_000 });
  await modal.getByRole("button", { name: "Áp dụng 3 ảnh" }).click();
  await modal.waitFor({ state: "hidden", timeout: 15_000 });
  assert(imports.size === 3 && [...imports.values()].every((count) => count === 1),
    `each selected ARASAAC asset must be imported once: ${JSON.stringify([...imports])}`);
  await page.getByRole("button", { name: "Lưu bộ từ" }).click();
  await page.getByText("Mọi thay đổi đã được lưu").waitFor({ timeout: 15_000 });
  const savedRemote = await api(`/api/vocabulary/sets/${remoteSet.id}`, { headers: auth });
  assert(savedRemote.items.every((item) =>
    item.illustration.kind === "STORED_MEDIA" && item.illustration.mediaId === storedFixture.id && item.supportsImageGame === true),
  "ARASAAC imports were not persisted as stored media");
  await page.reload({ waitUntil: "networkidle" });
  const storedImages = page.locator(`img[src*="vocabulary-media/${storedFixture.id}"]`);
  await storedImages.first().waitFor({ state: "attached", timeout: 15_000 });
  await storedImages.first().evaluate((image) => image.decode());
  assert(await storedImages.count() >= 3,
    "saved stored-media thumbnails did not survive reload");
  assert(await storedImages.first().evaluate((image) => image.naturalWidth > 0),
    "saved stored-media thumbnail was present but the browser could not decode it");

  providerMode = "unavailable";
  const outageSet = await createSet(auth, ["window", "pencil", "schoolbag"], `Provider outage ${Date.now()}`);
  await page.goto(`${origin}/admin/vocabulary/${outageSet.id}`, { waitUntil: "networkidle" });
  const beforeOutage = searches;
  await openBulk();
  modal = page.locator('[data-testid="vocabulary-bulk-image-suggestions"]');
  await modal.getByText("Nguồn hình minh họa đang tạm gián đoạn. Các từ chưa tìm vẫn được giữ lại.").waitFor();
  const tryLater = modal.getByRole("button", { name: "Thử tiếp" });
  assert(await tryLater.isDisabled(), "retry was enabled before the provider cooldown expired");
  await page.waitForTimeout(1_300);
  assert(searches - beforeOutage === 1, `provider outage cascaded to ${searches - beforeOutage} client searches`);
  assert(await modal.getByText("Chưa tìm", { exact: true }).count() === 2,
    "later outage candidates were consumed instead of staying pending");
  providerMode = "success";
  const retryDeadline = Date.now() + 3_000;
  while (Date.now() < retryDeadline && await tryLater.isDisabled())
    await page.waitForTimeout(200);
  assert(await tryLater.isEnabled(), "retry did not become available after the provider cooldown");
  await tryLater.click();
  await modal.getByRole("button", { name: "Áp dụng 3 ảnh" }).waitFor({ timeout: 15_000 });
  await modal.getByRole("button", { name: "Hủy", exact: true }).click();
  console.log("Vocabulary media targeted browser flow PASS (390x844, 1366x768)");
  await context.close();
} finally {
  if (browser) await browser.close();
  if (loginToken) {
    for (const id of createdIds) {
      try {
        await api(`/api/vocabulary/sets/${id}/archive`, {
          method: "POST", headers: { Authorization: `Bearer ${loginToken}` }, body: "{}",
        });
      } catch { /* Best-effort cleanup must not hide the test result. */ }
    }
  }
  for (const child of children.reverse()) child.kill();
}
