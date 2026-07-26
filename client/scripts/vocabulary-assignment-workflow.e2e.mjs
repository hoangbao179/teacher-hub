/* global process, fetch, setTimeout, console, localStorage, document, getComputedStyle, window */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4122;
const webPort = 5202;
const origin = `http://127.0.0.1:${webPort}`;
const artifactDir = path.join(root, ".agent-reports", "V20C-VOCABULARY-ASSIGNMENTS");
const password = "v20c-e2e-password-123";
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "v20c-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: password,
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  PUBLIC_APP_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const children = [];
let browser;

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
async function audit(page, mobile) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mobileNav: getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display,
    mobileItems: document.querySelectorAll('[data-testid="mobile-navigation"] .MuiBottomNavigationAction-root').length,
    sticky: document.querySelector('[data-testid="sticky-action-bar"]')?.getBoundingClientRect().bottom,
    height: window.innerHeight,
  }));
  assert(result.overflow <= 1, `Horizontal overflow: ${result.overflow}`);
  if (mobile) {
    assert(result.mobileNav !== "none" && result.mobileItems === 5, "Mobile navigation must keep five items");
    assert((result.sticky ?? 0) < result.height - 45, "Sticky actions overlap mobile navigation");
  }
}

try {
  fs.mkdirSync(artifactDir, { recursive: true });
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
  const vocabularySet = await api("/api/vocabulary/sets", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "Động vật V20C",
      sourceType: "MANUAL",
      ageBand: "G2_G3",
      items: [
        { displayOrder: 1, word: "cat", meaningVi: "con mèo", tier: "CORE", illustration: { kind: "EMOJI", value: "🐱" }, supportsImageGame: true },
        { displayOrder: 2, word: "dog", meaningVi: "con chó", tier: "CORE", illustration: { kind: "EMOJI", value: "🐶" }, supportsImageGame: true },
      ],
    }),
  });
  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript((token) => localStorage.setItem("teacher-token", token), login.token);
    const page = await context.newPage();
    await page.goto(`${origin}/admin/assignments`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="assignment-list-page"]').waitFor();
    await audit(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `list-${viewport.width}x${viewport.height}.png`) });

    await page.goto(`${origin}/admin/assignments/new`, { waitUntil: "networkidle" });
    await page.getByLabel("Người nhận").click();
    await page.getByRole("option", { name: "Liên kết mở" }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByLabel("Bộ từ vựng").click();
    await page.getByRole("option", { name: new RegExp(`Động vật V20C.*${vocabularySet.itemCount}`) }).first().click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByLabel("Tên bài tập").fill(`Bài mở ${viewport.width}`);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByText("XEM TRƯỚC", { exact: true }).waitFor();
    await audit(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `preview-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole("button", { name: "Giao bài" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Giao bài" }).click();
    await page.locator('[data-testid="assignment-detail-page"]').waitFor();
    await page.getByAltText("Mã QR liên kết mở").waitFor();
    await audit(page, viewport.width < 600);
    await page.screenshot({ path: path.join(artifactDir, `published-${viewport.width}x${viewport.height}.png`) });
    await context.close();
  }
  console.log(`V20C assignment E2E PASS; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
}
