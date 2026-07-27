/* global process, fetch, setTimeout, console */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4124;
const webPort = 5204;
const origin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const password = "hardening-e2e-password-123";
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "hardening-e2e-secret-with-at-least-32-characters",
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
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
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
  const response = await fetch(`${apiOrigin}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname}: ${response.status} ${JSON.stringify(payload)}`);
  return payload.data;
}
async function correctAnswer(questionId) {
  const [rows] = await db.query(
    "SELECT correct_answer_snapshot_json FROM learning_attempt_questions WHERE id=?",
    [questionId],
  );
  const value = rows[0].correct_answer_snapshot_json;
  return typeof value === "string" ? JSON.parse(value) : value;
}
async function waitForNextQuestion(sessionToken, previousId) {
  const end = Date.now() + 8_000;
  while (Date.now() < end) {
    const attempt = await api(`/api/public/learning-attempts/${sessionToken}`);
    if (!attempt.currentQuestion || attempt.currentQuestion.id !== previousId) return attempt;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Question ${previousId} did not advance`);
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
  db = await mysql.createConnection({
    host: testEnv.DB_HOST, port: Number(testEnv.DB_PORT), user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD, database: testEnv.DB_NAME,
  });

  const login = await api("/api/auth/login", {
    method: "POST", body: JSON.stringify({ username: "covy", password }),
  });
  const auth = { Authorization: `Bearer ${login.token}` };
  const items = [
    ["cat", "con mèo", "🐱"], ["dog", "con chó", "🐶"],
    ["bird", "con chim", "🐦"], ["fish", "con cá", "🐟"],
  ].map(([word, meaningVi, value], index) => ({
    displayOrder: index + 1, word, meaningVi, speechText: word, tier: "CORE",
    illustration: { kind: "EMOJI", value }, supportsImageGame: true,
  }));
  const draft = await api("/api/vocabulary/assignments", {
    method: "POST", headers: auth,
    body: JSON.stringify({
      title: "Student hardening flow", ageBand: "G4_G5", audienceType: "OPEN_LINK",
      templateCode: "CUSTOM", answerFeedbackMode: "IMMEDIATE", shuffleQuestions: false,
      passScore: 80, items,
      activities: [
        { displayOrder: 1, mechanic: "EXPLORE_CARD", presentation: "FLASHCARD", required: true },
        { displayOrder: 2, mechanic: "SELECT_ONE", presentation: "WORD_PICK_MEANING", required: true },
      ],
    }),
  });
  const published = await api(`/api/vocabulary/assignments/${draft.id}/publish`, {
    method: "POST", headers: auth, body: JSON.stringify({ version: draft.version }),
  });

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  let startRequests = 0;
  let answerRequests = 0;
  let completionRequests = 0;
  let abortFirstCompletion = true;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/learning-assignments\/[^/]+\/attempts$/.test(request.url())) startRequests += 1;
    if (request.method() === "POST" && /\/learning-attempts\/[^/]+\/answers$/.test(request.url())) answerRequests += 1;
  });
  await page.route("**/api/public/learning-attempts/*/complete", async (route) => {
    completionRequests += 1;
    if (abortFirstCompletion) {
      abortFirstCompletion = false;
      await route.abort("failed");
    } else await route.continue();
  });

  await page.goto(published.shares[0].shareUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Bắt đầu chơi" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.waitForURL(/\/play\/session\//);
  assert(startRequests === 1, `Double start sent ${startRequests} requests`);
  const sessionToken = decodeURIComponent(page.url().split("/play/session/")[1]);
  const [attemptRows] = await db.query(
    "SELECT COUNT(*) count FROM learning_attempts WHERE assignment_id=?",
    [draft.id],
  );
  assert(Number(attemptRows[0].count) === 1, "Start created more than one attempt");

  let attempt = await api(`/api/public/learning-attempts/${sessionToken}`);
  const firstFlashcardId = attempt.currentQuestion.id;
  assert(attempt.currentQuestion.presentation === "FLASHCARD", "First question is not flashcard");
  await page.getByRole("button", { name: "Lật thẻ xem nghĩa" }).click();
  const answerCountBeforeReview = answerRequests;
  await page.getByRole("button", { name: "Học lại nhé" }).evaluate((button) => {
    button.click();
    button.click();
  });
  attempt = await waitForNextQuestion(sessionToken, firstFlashcardId);
  assert(answerRequests - answerCountBeforeReview === 1, "Flashcard double click submitted twice");

  await page.reload({ waitUntil: "networkidle" });
  const [afterReloadRows] = await db.query(
    "SELECT COUNT(*) count FROM learning_attempts WHERE assignment_id=?",
    [draft.id],
  );
  assert(Number(afterReloadRows[0].count) === 1, "Reload created another attempt");
  assert((await api(`/api/public/learning-attempts/${sessionToken}`)).attemptId === attempt.attemptId,
    "Reload did not resume the same attempt");

  let sawAdaptiveReview = false;
  let checkedGradedDoubleSubmit = false;
  for (let guard = 0; guard < 30; guard += 1) {
    attempt = await api(`/api/public/learning-attempts/${sessionToken}`);
    const question = attempt.currentQuestion;
    if (!question) break;
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid="game-question"]').waitFor();
    if (question.presentation === "FLASHCARD") {
      await page.getByRole("button", { name: "Lật thẻ xem nghĩa" }).click();
      await page.getByRole("button", { name: "Con nhớ rồi" }).click();
      await waitForNextQuestion(sessionToken, question.id);
      continue;
    }
    if (question.questionKind === "REVIEW") sawAdaptiveReview = true;
    const correct = await correctAnswer(question.id);
    const option = page.locator(`[data-option-id="${correct.optionId}"]`);
    if (!checkedGradedDoubleSubmit) {
      const before = answerRequests;
      await option.evaluate((button) => { button.click(); button.click(); });
      await waitForNextQuestion(sessionToken, question.id);
      assert(answerRequests - before === 1, "Graded answer double click submitted twice");
      checkedGradedDoubleSubmit = true;
    } else {
      await option.click();
      await waitForNextQuestion(sessionToken, question.id);
    }
  }
  assert(sawAdaptiveReview, "Flashcard REVIEW did not appear adaptively");
  await page.waitForURL(/\/result$/);
  await page.getByRole("button", { name: "Thử tải lại kết quả" }).waitFor();
  await page.getByRole("button", { name: "Thử tải lại kết quả" }).click();
  await page.getByText("100%", { exact: true }).waitFor();
  await page.getByText(/Con đã đạt yêu cầu.*Mốc đạt 80%/).waitFor();
  assert(completionRequests === 2, `Completion retry expected 2 requests, got ${completionRequests}`);

  const firstResult = await api(`/api/public/learning-attempts/${sessionToken}/complete`, {
    method: "POST", body: "{}",
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("100%", { exact: true }).waitFor();
  const reloadedResult = await api(`/api/public/learning-attempts/${sessionToken}/complete`, {
    method: "POST", body: "{}",
  });
  assert(firstResult.passScore === 80 && firstResult.passed === true, "Result passScore/passed is incorrect");
  assert(JSON.stringify(firstResult) === JSON.stringify(reloadedResult), "Idempotent completion snapshot changed");
  console.log("VOCABULARY-GAME-HARDENING student E2E PASS");
} finally {
  await db?.end().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  for (const child of children.reverse()) child.kill();
}
