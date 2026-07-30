/* global process, fetch, setTimeout, console, document, localStorage, getComputedStyle */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4120;
const webPort = 5200;
const origin = `http://127.0.0.1:${webPort}`;
const artifactDir = path.join(root, ".agent-reports", "V20A-VOCABULARY-FOUNDATION");
const mediaArtifactDir = path.join(root, ".agent-reports", "V20F-VOCABULARY-STABILIZATION");
const password = "vocabulary-e2e-password-123";
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "vocabulary-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: password,
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const children = [];
let browser;
let createdId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, cwd) {
  const executable = command === "npm" && process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = command === "npm" && process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env: testEnv, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
}

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(`${pathname}: ${response.status} ${JSON.stringify(payload)}`);
  return payload.data;
}

async function auditPage(page, mobile) {
  const result = await page.evaluate((expectMobile) => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mobileNavDisplay: getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display,
    mobileActions: document.querySelectorAll('[data-testid="mobile-navigation"] .MuiBottomNavigationAction-root').length,
    desktopNavDisplay: getComputedStyle(document.querySelector('[data-testid="desktop-navigation"]')).display,
    vocabularyDesktopEntry: [...document.querySelectorAll('[data-testid="desktop-navigation"] .MuiListItemButton-root')].some((value) => value.textContent?.includes("Kho từ vựng")),
    expectedMobile: expectMobile,
  }), mobile);
  assert(result.overflow <= 1, `Horizontal overflow: ${result.overflow}px`);
  if (mobile) {
    assert(result.mobileNavDisplay !== "none" && result.mobileActions === 5, "Mobile navigation must keep exactly five items");
    assert(result.desktopNavDisplay === "none", "Desktop navigation visible on mobile");
  } else {
    assert(result.mobileNavDisplay === "none", "Mobile navigation visible on desktop");
    assert(result.desktopNavDisplay !== "none" && result.vocabularyDesktopEntry, "Desktop vocabulary entry missing");
  }
}

try {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.mkdirSync(mediaArtifactDir, { recursive: true });
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));

  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "covy", password }),
  });
  const auth = { Authorization: `Bearer ${login.token}` };
  const created = await api("/api/vocabulary/sets", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: `V20A kiểm thử ${Date.now()}`,
      description: "Bộ từ dùng để xác minh giao diện V20A.",
      sourceType: "MANUAL",
      ageBand: "G2_G3",
      items: [
        { displayOrder: 1, word: "apple", meaningVi: "quả táo", tier: "CUSTOM", illustration: { kind: "EMOJI", value: "🍎" }, supportsImageGame: true },
        { displayOrder: 2, word: "family", meaningVi: "gia đình", tier: "CUSTOM", illustration: { kind: "NONE" }, supportsImageGame: false },
      ],
    }),
  });
  createdId = created.id;

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });

  for (const viewport of [
    { width: 360, height: 800, suffix: "mobile" },
    { width: 390, height: 844, suffix: "mobile" },
    { width: 1440, height: 900, suffix: "desktop" },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript((token) => localStorage.setItem("teacher-token", token), login.token);
    const page = await context.newPage();

    if (viewport.width === 1440) {
      await page.route("**/api/vocabulary/topics*", (route) => route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "TEST_ERROR", message: "Lỗi mô phỏng để kiểm tra retry." } }),
      }), { times: 1 });
    }
    await page.goto(`${origin}/admin/vocabulary`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="vocabulary-list-page"]').waitFor();
    if (viewport.width === 1440) {
      await page.getByText("Lỗi mô phỏng để kiểm tra retry.").waitFor();
      await page.getByRole("button", { name: "Thử lại" }).click();
    }
    await page.locator('[data-testid="vocabulary-topic-grid"]').waitFor();
    await auditPage(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `topic-list-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });
    await page.getByLabel("Tìm kiếm từ vựng").fill("Gia đình");
    await page.getByLabel("Độ tuổi").click();
    await page.getByRole("option", { name: "Mầm non – Lớp 1" }).click();
    await page.getByText("Gia đình", { exact: true }).waitFor();

    await page.goto(`${origin}/admin/vocabulary/new?topic=family`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="vocabulary-new-page"]').waitFor();
    await page.getByText("Từ cốt lõi").waitFor();
    await auditPage(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `new-topic-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });

    if (viewport.width === 390) {
      await page.goto(`${origin}/admin/vocabulary/new`, { waitUntil: "networkidle" });
      await page.getByLabel("Nguồn từ vựng").click();
      await page.getByRole("option", { name: "Nhập thủ công / dán danh sách" }).click();
      await page.getByLabel("Tên bộ từ").fill(`Bộ từ tạo từ UI ${Date.now()}`);
      await page.getByPlaceholder("apple, quả táo\nbanana, quả chuối").fill("cat, con mèo\ndog, con chó");
      await page.getByRole("button", { name: "Đọc danh sách" }).click();
      await page.getByText("Đã đọc 2 từ. Hãy kiểm tra trước khi lưu.").waitFor();
      await page.getByRole("button", { name: "Lưu bộ từ" }).click();
      await page.waitForURL(new RegExp(`${origin}/admin/vocabulary/\\d+$`));
      await page.locator('[data-testid="vocabulary-detail-page"]').waitFor();
    }

    await page.goto(`${origin}/admin/vocabulary/${createdId}`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="vocabulary-detail-page"]').waitFor();
    await page.getByText("Các từ trong bộ").waitFor();
    await auditPage(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `set-detail-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });
    await page.screenshot({ path: path.join(mediaArtifactDir, `word-editor-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });

    const mediaAccordion = page.locator(".MuiAccordion-root").last();
    await mediaAccordion.locator(".MuiAccordionSummary-root").click();
    const findImageButton = mediaAccordion.locator('button:has([data-testid="ImageSearchIcon"])');
    await findImageButton.click();
    await page.locator('[data-testid="vocabulary-image-picker"]').waitFor();
    await page.getByText(/Tìm ảnh đang tắt/).waitFor();
    await page.screenshot({ path: path.join(mediaArtifactDir, `provider-disabled-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });
    await page.locator('[data-testid="vocabulary-image-picker"] .MuiDialogActions-root button').click();
    await page.locator('[data-testid="vocabulary-image-picker"]').waitFor({ state: "hidden" });

    const searchResult = {
      provider: "PIXABAY",
      safeSearch: true,
      cacheExpiresAt: "2026-07-27T00:00:00.000Z",
      page: 1,
      pageSize: 20,
      total: 3,
      items: [1, 2, 3].map((id) => ({
        provider: "PIXABAY",
        providerAssetId: `mock-${id}`,
        previewUrl: `${origin}/images/teacher-english-hero-720.jpg`,
        thumbnailUrl: `${origin}/images/teacher-english-hero-720.jpg`,
        width: 640,
        height: 640,
        mediaType: id === 1 ? "PHOTO" : "ILLUSTRATION",
        contributorName: `Pixabay ${id}`,
        attributionText: `Ảnh của Pixabay ${id}`,
        sourcePageUrl: `https://pixabay.com/photos/mock-${id}/`,
      })),
    };
    await page.route("**/api/vocabulary/media/status", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {
        enabled: true,
        provider: "PIXABAY",
        providers: [
          { provider: "ARASAAC", enabled: false },
          { provider: "PIXABAY", enabled: true },
        ],
      } }),
    }));
    await page.route("**/api/vocabulary/media/search?*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: searchResult }),
    }));
    await findImageButton.click();
    const picker = page.locator('[data-testid="vocabulary-image-picker"]');
    await picker.locator('input[maxlength="100"]').fill("family gia đình");
    await picker.locator('button[type="submit"]').click();
    await picker.locator('button[aria-label^="Đánh dấu ảnh"]').first().waitFor();
    await auditPage(page, viewport.width < 600);
    await page.screenshot({ path: path.join(mediaArtifactDir, `image-picker-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });
    await picker.locator(".MuiDialogActions-root button").click();
    await picker.waitFor({ state: "hidden" });

    await page.locator('button:has([data-testid="CollectionsIcon"])').first().click();
    await page.locator('[data-testid="vocabulary-bulk-image-suggestions"]').waitFor();
    await page.locator('[data-testid="vocabulary-bulk-image-suggestions"] button[aria-label]').first().waitFor();
    await auditPage(page, viewport.width < 600);
    await page.screenshot({ path: path.join(mediaArtifactDir, `bulk-suggestions-${viewport.suffix}-${viewport.width}x${viewport.height}.png`), fullPage: false });
    await context.close();
  }

  await api(`/api/vocabulary/sets/${createdId}/archive`, { method: "POST", headers: auth, body: "{}" });
  console.log(`Vocabulary V20A/V20B E2E PASS; screenshots: ${artifactDir}, ${mediaArtifactDir}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
}
