/* global process, fetch, setTimeout, console, document, localStorage, sessionStorage, indexedDB */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4108;
const webPort = 5188;
const origin = `http://127.0.0.1:${webPort}`;
const username = "auth-e2e";
const password = "auth-e2e-password-123";
const artifactDir = path.join(root, ".agent-reports", "v1-1-login-final");
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "auth-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_USERNAME: username,
  BOOTSTRAP_ADMIN_PASSWORD: password,
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Cô Vy",
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const children = [];
let browser;

function run(command, args, cwd = root) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const executable = command === "npm" ? process.execPath : command;
  const commandArgs = command === "npm" ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}`);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoPasswordPersisted(page, context) {
  const webStorage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  assert(!JSON.stringify(webStorage).includes(password), "Raw password was found in Web Storage");

  const databases = await page.evaluate(async () => {
    if (!("databases" in indexedDB)) return [];
    return (await indexedDB.databases()).map((database) => database.name ?? "");
  });
  assert(databases.length === 0, `Unexpected IndexedDB databases created by login: ${databases.join(", ")}`);

  const cookies = await context.cookies();
  assert(!JSON.stringify(cookies).includes(password), "Raw password was found in cookies");
}

async function login(page, remember) {
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.locator('input[name="password"]').fill(password);
  const checkbox = page.getByRole("checkbox", { name: "Ghi nhớ đăng nhập trên thiết bị này" });
  if ((await checkbox.isChecked()) !== remember) await checkbox.click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();
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

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();

  await page.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Lớp học tiếng Anh cô Vy" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Đăng nhập", exact: true }).waitFor();
  assert(await page.getByLabel("Tên đăng nhập").getAttribute("autocomplete") === "username", "Username autocomplete is not username");
  assert(await page.locator('input[name="password"]').getAttribute("autocomplete") === "current-password", "Password autocomplete is not current-password");
  await page.screenshot({ path: path.join(artifactDir, "login-390x844.png"), fullPage: true });

  await page.getByRole("link", { name: "Về trang chủ" }).click();
  await page.waitForURL(`${origin}/`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.goto(`${origin}/admin/login`);

  const passwordInput = page.locator('input[name="password"]');
  assert(await passwordInput.getAttribute("type") === "password", "Password is visible by default");
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  assert(await passwordInput.getAttribute("type") === "text", "Show-password control did not reveal the value");
  await page.getByRole("button", { name: "Ẩn mật khẩu" }).click();
  assert(await passwordInput.getAttribute("type") === "password", "Hide-password control did not restore masking");

  await page.getByLabel("Tên đăng nhập").fill(username);
  await passwordInput.fill("incorrect-password");
  await passwordInput.press("Enter");
  await page.getByText("Sai tên đăng nhập hoặc mật khẩu.", { exact: true }).waitFor();
  assert(!(await page.locator("body").innerText()).includes("INVALID_CREDENTIALS"), "Raw API error code is visible");

  await login(page, true);
  let storage = await page.evaluate(() => ({
    localToken: localStorage.getItem("teacher-token"),
    sessionToken: sessionStorage.getItem("teacher-token"),
    rememberedUsername: localStorage.getItem("teacher-remembered-username"),
  }));
  assert(Boolean(storage.localToken), "Remembered login did not use localStorage");
  assert(!storage.sessionToken, "Remembered login left a duplicate sessionStorage token");
  assert(storage.rememberedUsername === username, "Remembered username was not persisted");
  await assertNoPasswordPersisted(page, context);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();
  await page.goto(`${origin}/admin/login`);
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL(`${origin}/admin/login`);
  storage = await page.evaluate(() => ({
    localToken: localStorage.getItem("teacher-token"),
    sessionToken: sessionStorage.getItem("teacher-token"),
    rememberedUsername: localStorage.getItem("teacher-remembered-username"),
  }));
  assert(!storage.localToken && !storage.sessionToken, "Logout did not clear both token stores");
  assert(storage.rememberedUsername === username, "Explicitly remembered username was unexpectedly cleared on logout");
  assert(await page.getByLabel("Tên đăng nhập").inputValue() === username, "Remembered username did not populate the login form");

  await login(page, false);
  storage = await page.evaluate(() => ({
    localToken: localStorage.getItem("teacher-token"),
    sessionToken: sessionStorage.getItem("teacher-token"),
    rememberedUsername: localStorage.getItem("teacher-remembered-username"),
  }));
  assert(!storage.localToken, "Session-only login left a localStorage token");
  assert(Boolean(storage.sessionToken), "Session-only login did not use sessionStorage");
  assert(!storage.rememberedUsername, "Session-only login persisted the username");
  await assertNoPasswordPersisted(page, context);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();
  await page.goto(`${origin}/admin/login`);
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();

  const freshPage = await context.newPage();
  await freshPage.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  await freshPage.waitForURL(`${origin}/admin/login`);
  assert(await freshPage.getByLabel("Tên đăng nhập").inputValue() === "", "Session-only username leaked into a fresh browsing session");
  await freshPage.close();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL(`${origin}/admin/login`);
  await page.evaluate(() => {
    localStorage.setItem("teacher-token", "invalid-local-token");
    sessionStorage.setItem("teacher-token", "invalid-session-token");
  });
  await page.goto(`${origin}/admin`);
  await page.waitForURL(`${origin}/admin/login`);
  await page.getByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", { exact: true }).waitFor();
  storage = await page.evaluate(() => ({
    localToken: localStorage.getItem("teacher-token"),
    sessionToken: sessionStorage.getItem("teacher-token"),
  }));
  assert(!storage.localToken && !storage.sessionToken, "Invalid auth bootstrap did not clear both token stores");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `Login has ${overflow}px horizontal overflow at ${viewport.width}px`);
    await page.screenshot({ path: path.join(artifactDir, `login-${viewport.width}x${viewport.height}-final.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 360, height: 500 });
  await page.locator('input[name="password"]').focus();
  const submit = page.getByRole("button", { name: "Đăng nhập", exact: true });
  await submit.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const submitBox = await submit.boundingBox();
  assert(Boolean(submitBox) && submitBox.y >= 0 && submitBox.y + submitBox.height <= 500, "Submit button is unreachable in a short keyboard-like viewport");
  assert(await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight), "Login cannot scroll in a short viewport");

  console.log(`V11B auth-session E2E passed; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    try { child.kill(); } catch { /* already stopped */ }
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
}
