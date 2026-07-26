/* global process, fetch, setTimeout, console, localStorage, document, getComputedStyle, window */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4122;
const webPort = 5202;
const origin = `http://127.0.0.1:${webPort}`;
const artifactDir = path.join(root, ".agent-reports", "V20F-VOCABULARY-STABILIZATION");
const targetedSourceSmoke = process.env.TARGETED_SOURCE_SMOKE === "1";
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
  const testDb = await mysql.createConnection({
    host: testEnv.DB_HOST,
    port: Number(testEnv.DB_PORT),
    user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD,
    database: testEnv.DB_NAME,
  });
  await testDb.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers", "learning_attempt_question_items",
    "learning_attempt_questions", "learning_attempts", "learning_access_sessions",
    "learning_assignment_recipients", "learning_assignment_audience_students",
    "learning_assignment_activities", "learning_assignment_items", "learning_assignments",
    "google_sheet_sync_outbox", "vocabulary_items", "vocabulary_sets",
  ]) await testDb.query(`TRUNCATE TABLE ${table}`);
  await testDb.query("SET FOREIGN_KEY_CHECKS=1");
  await testDb.end();
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
  let vocabularySet;
  if (targetedSourceSmoke) {
    vocabularySet = await api("/api/vocabulary/sets", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        title: "Bộ từ smoke đã lưu",
        sourceType: "MANUAL",
        ageBand: "G4_G5",
        items: [
          { displayOrder: 1, word: "red", meaningVi: "màu đỏ", tier: "CUSTOM", illustration: { kind: "NONE" }, supportsImageGame: true },
          { displayOrder: 2, word: "blue", meaningVi: "màu xanh", tier: "CUSTOM", illustration: { kind: "NONE" }, supportsImageGame: true },
        ],
      }),
    });
  }
  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });

  for (const viewport of targetedSourceSmoke ? [
    { width: 390, height: 844 },
  ] : [
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
    if (targetedSourceSmoke) {
      await page.getByRole("button", { name: /Bộ từ smoke đã lưu/ }).click();
      await page.getByRole("button", { name: "Lưu nháp" }).click();
      await page.getByText("Đã lưu bản nháp.").waitFor();

      await page.getByRole("tab", { name: "Chủ đề có sẵn" }).click();
      await page.getByLabel("Khối tuổi").click();
      await page.getByRole("option", { name: "Lớp 4–5" }).click();
      const colors = page.getByRole("button", { name: /Màu sắc/ }).first();
      await colors.waitFor();
      await colors.click();
      const coreChecks = page.locator('[data-tier="CORE"] input[type="checkbox"]');
      await coreChecks.first().waitFor();
      assert(await coreChecks.count() > 0, "G4_G5 colors must expose CORE words");
      assert(await coreChecks.evaluateAll((nodes) => nodes.every((node) => node.checked)), "CORE words must default selected");
      await page.screenshot({ path: path.join(artifactDir, "source-topic-core-390x844.png"), fullPage: true });

      await page.route("**/api/vocabulary/topic-suggestions", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], selectedCount: 0 } }),
      }));
      await page.getByRole("button", { name: /Gia đình/ }).first().click();
      await page.getByText("Chủ đề này chưa có từ phù hợp.").waitFor();
      await page.unroute("**/api/vocabulary/topic-suggestions");

      await page.getByRole("tab", { name: "Unit công khai" }).click();
      const unitSearch = page.getByLabel("Tìm Unit công khai");
      await unitSearch.fill("Unit 1");
      const options = page.getByRole("option");
      await options.first().waitFor();
      const optionTexts = await options.allTextContents();
      assert(optionTexts.every((value) => /^Lớp [45] ·/.test(value)), `Unexpected Unit level: ${optionTexts.join(" | ")}`);
      assert(optionTexts.every((value) => /Unit 1/i.test(value)), "Unit search must filter by text");
      await page.screenshot({ path: path.join(artifactDir, "source-unit-autocomplete-390x844.png"), fullPage: true });
      await options.first().click();
      await page.getByRole("button", { name: "Import Unit và sử dụng" }).click();
      await page.getByText(/Đã chọn \d+ từ/).waitFor();
      await page.getByRole("button", { name: "Lưu nháp" }).click();
      await page.getByText("Đã lưu bản nháp.").waitFor();
      await audit(page, true);
      await page.screenshot({ path: path.join(artifactDir, "source-assignment-saved-390x844.png"), fullPage: true });
      await context.close();
      continue;
    }
    if (!vocabularySet) {
      await page.getByText("Cô chưa có bộ từ nào.").waitFor();
      await page.screenshot({ path: path.join(artifactDir, "empty-set-wizard-360x800.png") });
      await page.evaluate(() => { window.__v20fWizardMarker = "same-page"; });
      await page.getByRole("tab", { name: "Chủ đề có sẵn" }).click();
      const colors = page.getByRole("button", { name: /Màu sắc/ }).first();
      await colors.waitFor();
      await colors.click();
      await page.getByRole("button", { name: "Tạo bộ từ và sử dụng" }).waitFor();
      const coreChecks = page.locator('[data-tier="CORE"] input[type="checkbox"]');
      const extendedChecks = page.locator('[data-tier="EXTENDED"] input[type="checkbox"]');
      assert(await coreChecks.count() > 0, "Topic must expose CORE words");
      assert(await coreChecks.evaluateAll((nodes) => nodes.every((node) => node.checked)), "CORE words must default selected");
      assert(await extendedChecks.evaluateAll((nodes) => nodes.every((node) => !node.checked)), "EXTENDED words must not exceed target by default");
      await page.screenshot({ path: path.join(artifactDir, "topic-chooser-360x800.png"), fullPage: true });
      await page.getByRole("button", { name: "Tạo bộ từ và sử dụng" }).click();
      await page.getByText(/Đã chọn \d+ từ/).waitFor();
      assert(await page.evaluate(() => window.__v20fWizardMarker) === "same-page", "Creating a topic set must not reload the wizard");
      await page.screenshot({ path: path.join(artifactDir, "created-set-selected-360x800.png") });
      const listed = await api("/api/vocabulary/sets?pageSize=50", { headers: auth });
      vocabularySet = listed.find((item) => item.title === "Màu sắc");
      assert(vocabularySet, "Created topic set must be owned and listed for the teacher");
    } else {
      await page.getByRole("button", { name: new RegExp(`Màu sắc.*${vocabularySet.itemCount}`) }).first().click();
    }
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
  console.log(`${targetedSourceSmoke ? "Vocabulary source smoke" : "V20F assignment E2E"} PASS; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
}
