/* global process, fetch, setTimeout, document, URL, console */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4123;
const webPort = 5203;
const origin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const artifactDir = path.join(root, ".agent-reports", "V20D-VOCABULARY-GAMES");
const password = "v20d-e2e-password-123";
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "v20d-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: password,
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  PUBLIC_APP_ORIGIN: origin,
  VITE_API_BASE_URL: apiOrigin,
};
const children = [];
let browser;
let db;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function run(command, args, cwd) {
  const executable = command === "npm" && process.platform === "win32"
    ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = command === "npm" && process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env: testEnv,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}
function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: testEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
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
  const response = await fetch(`${apiOrigin}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname}: ${response.status} ${JSON.stringify(payload)}`);
  return payload.data;
}
async function noOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `Horizontal overflow: ${overflow}`);
}
async function answerCurrent(sessionToken, submittedAnswer) {
  const attempt = await api(`/api/public/learning-attempts/${sessionToken}`);
  return api(`/api/public/learning-attempts/${sessionToken}/answers`, {
    method: "POST",
    body: JSON.stringify({
      questionId: attempt.currentQuestion.id,
      clientAnswerId: randomUUID(),
      answerSequence: attempt.currentQuestion.answerSequence,
      submittedAnswer,
    }),
  });
}
async function correctAnswer(questionId) {
  const [rows] = await db.query(
    "SELECT correct_answer_snapshot_json FROM learning_attempt_questions WHERE id=?",
    [questionId],
  );
  const value = rows[0].correct_answer_snapshot_json;
  return typeof value === "string" ? JSON.parse(value) : value;
}

try {
  fs.mkdirSync(artifactDir, { recursive: true });
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`${apiOrigin}/health`);
  await waitUrl(origin);
  db = await mysql.createConnection({
    host: testEnv.DB_HOST,
    port: Number(testEnv.DB_PORT),
    user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD,
    database: testEnv.DB_NAME,
  });
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "covy", password }),
  });
  const auth = { Authorization: `Bearer ${login.token}` };
  const items = [
    ["cat", "con mèo", "🐱"],
    ["dog", "con chó", "🐶"],
    ["bird", "con chim", "🐦"],
    ["fish", "con cá", "🐟"],
    ["frog", "con ếch", "🐸"],
  ].map(([word, meaningVi, value], index) => ({
    displayOrder: index + 1,
    word,
    meaningVi,
    speechText: word,
    tier: "CORE",
    illustration: { kind: "EMOJI", value },
    supportsImageGame: true,
  }));
  const draft = await api("/api/vocabulary/assignments", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "Cuộc phiêu lưu từ vựng",
      instruction: "Nghe, nhìn và chinh phục từng thử thách nhé!",
      ageBand: "G4_G5",
      audienceType: "OPEN_LINK",
      templateCode: "CUSTOM",
      answerFeedbackMode: "IMMEDIATE",
      shuffleQuestions: true,
      items,
      activities: [
        { displayOrder: 1, mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_IMAGE", required: true },
        { displayOrder: 2, mechanic: "SELECT_ONE", presentation: "FEED_MONSTER", required: true },
        { displayOrder: 3, mechanic: "MATCH_PAIRS", presentation: "MATCH_WORD_MEANING", required: true },
        { displayOrder: 4, mechanic: "MEMORY_PAIRS", presentation: "MEMORY_WORD_IMAGE", required: true },
        { displayOrder: 5, mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD", required: true },
      ],
    }),
  });
  const published = await api(`/api/vocabulary/assignments/${draft.id}/publish`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ version: draft.version }),
  });
  const shareUrl = published.shares[0].shareUrl;

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(shareUrl, { waitUntil: "networkidle" });
  await noOverflow(page);
  await page.screenshot({ path: path.join(artifactDir, "start-390x844.png") });
  await page.getByRole("button", { name: "Bắt đầu chơi" }).click();
  await page.waitForURL(/\/play\/session\//);
  const sessionToken = decodeURIComponent(page.url().split("/play/session/")[1]);
  assert(!page.url().includes("access="), "Access token remains in URL");

  let capturedRetry = false;
  const captures = new Set();
  for (let guard = 0; guard < 80; guard += 1) {
    const attempt = await api(`/api/public/learning-attempts/${sessionToken}`);
    if (!attempt.currentQuestion) break;
    const question = attempt.currentQuestion;
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid="game-question"]').waitFor();
    await noOverflow(page);
    const key = question.mechanic === "SELECT_ONE" ? question.presentation : question.mechanic;
    const filenames = {
      LISTEN_PICK_IMAGE: "listen-pick-image-390x844.png",
      FEED_MONSTER: "feed-monster-390x844.png",
      MATCH_PAIRS: "matching-390x844.png",
      MEMORY_PAIRS: "memory-390x844.png",
      BUILD_WORD: "letter-building-390x844.png",
    };
    if (filenames[key] && !captures.has(key)) {
      await page.screenshot({ path: path.join(artifactDir, filenames[key]) });
      captures.add(key);
    }
    const correct = await correctAnswer(question.id);
    if (!capturedRetry && question.mechanic === "SELECT_ONE") {
      const wrong = question.options.find((option) => option.id !== correct.optionId);
      await answerCurrent(sessionToken, { optionId: wrong.id });
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('[data-testid="game-question"]').waitFor();
      await page.screenshot({ path: path.join(artifactDir, "wrong-retry-390x844.png") });
      capturedRetry = true;
      continue;
    }
    await answerCurrent(sessionToken, correct);
  }
  await page.goto(`${origin}/play/session/${encodeURIComponent(sessionToken)}/result`, { waitUntil: "networkidle" });
  await page.getByText("Con đã hoàn thành!").waitFor();
  await page.screenshot({ path: path.join(artifactDir, "final-reward-390x844.png") });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(shareUrl, { waitUntil: "networkidle" });
  await noOverflow(desktopPage);
  await desktopPage.screenshot({ path: path.join(artifactDir, "start-desktop-1440x900.png") });
  await desktop.close();

  const shared = new URL(shareUrl);
  const secondAccess = await api(`/api/public/learning-assignments/${published.assignment.publicCode}/access`, {
    method: "POST",
    body: JSON.stringify({ accessToken: shared.searchParams.get("access") }),
  });
  await api(`/api/public/learning-assignments/${published.assignment.publicCode}/attempts`, {
    method: "POST",
    body: JSON.stringify({ sessionToken: secondAccess.sessionToken }),
  });
  const reconnect = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const reconnectPage = await reconnect.newPage();
  await reconnectPage.route("**/api/public/learning-attempts/**", (route) => route.abort("internetdisconnected"));
  await reconnectPage.goto(
    `${origin}/play/session/${encodeURIComponent(secondAccess.sessionToken)}`,
    { waitUntil: "networkidle" },
  );
  await reconnectPage.getByRole("button", { name: "Thử lại" }).waitFor();
  await noOverflow(reconnectPage);
  await reconnectPage.screenshot({ path: path.join(artifactDir, "error-reconnect-360x800.png") });
  await reconnect.close();
  await context.close();
  console.log(`V20D vocabulary game E2E PASS; screenshots: ${artifactDir}`);
} finally {
  if (db) await db.end();
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
}
