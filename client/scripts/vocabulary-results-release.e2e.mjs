/* global process, fetch, setTimeout, document, console, sessionStorage */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "vocabulary-results-release", {});
let artifactRunPassed = false;
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4124;
const webPort = 5204;
const origin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const artifacts = artifactPolicy.runDir;
const password = "v20e-e2e-password-123";
const env = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "v20e-e2e-secret-with-at-least-32-characters",
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
    cwd, env, stdio: "inherit", shell: false,
  });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed`);
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
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out: ${url}`);
}
async function noOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert(overflow <= 1, `Horizontal overflow: ${overflow}`);
}

try {
  fs.mkdirSync(artifacts, { recursive: true });
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  db = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER,
    password: env.DB_PASSWORD, database: env.DB_NAME,
  });
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers", "learning_attempt_question_items",
    "learning_attempt_questions", "learning_attempts",
    "learning_access_sessions", "learning_assignment_recipients",
    "learning_assignment_audience_students", "learning_assignment_activities",
    "learning_assignment_items", "learning_assignments", "students",
  ]) await db.query(`TRUNCATE TABLE ${table}`);
  await db.query("SET FOREIGN_KEY_CHECKS=1");
  const [[admin]] = await db.query("SELECT id FROM users WHERE username='covy'");
  const [student] = await db.execute(
    "INSERT INTO students(full_name,status) VALUES ('Bé An','ACTIVE')",
  );
  const [assignment] = await db.execute(
    `INSERT INTO learning_assignments
      (teacher_user_id,title,audience_type,status,template_code,age_band,
       pass_score,answer_feedback_mode,published_at,closed_at)
     VALUES (?,'Ôn tập động vật','SELECTED_STUDENTS','CLOSED','CUSTOM','G2_G3',
       80,'IMMEDIATE',UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
    [admin.id],
  );
  await db.execute(
    "INSERT INTO learning_assignment_audience_students(assignment_id,student_id) VALUES (?,?)",
    [assignment.insertId, student.insertId],
  );
  const itemIds = [];
  for (const [index, word] of ["cat", "dog"].entries()) {
    const [item] = await db.execute(
      `INSERT INTO learning_assignment_items
        (assignment_id,display_order,word,normalized_word,meaning_vi,speech_text,
         tier,illustration_snapshot_json,supports_image_game)
       VALUES (?,?,?,?,?,?,'CORE',JSON_OBJECT('kind','NONE'),FALSE)`,
      [assignment.insertId, index + 1, word, word, `nghĩa ${word}`, word],
    );
    itemIds.push(item.insertId);
  }
  const [activity] = await db.execute(
    `INSERT INTO learning_assignment_activities
      (assignment_id,display_order,mechanic,presentation,required,config_json)
     VALUES (?,1,'SELECT_ONE','WORD_PICK_MEANING',TRUE,JSON_OBJECT())`,
    [assignment.insertId],
  );
  const [recipient] = await db.execute(
    `INSERT INTO learning_assignment_recipients
      (assignment_id,student_id,student_name_snapshot,access_token_hash,assigned_at,completed_at)
     VALUES (?,?,?, ?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
    [assignment.insertId, student.insertId, "Bé An",
      createHash("sha256").update("v20e-recipient").digest("hex")],
  );
  const sessionHash = createHash("sha256").update("v20e-session").digest("hex");
  const [session] = await db.execute(
    `INSERT INTO learning_access_sessions
      (assignment_id,recipient_id,session_token_hash,access_version_snapshot,
       expires_at,last_activity_at)
     VALUES (?,?,?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),UTC_TIMESTAMP())`,
    [assignment.insertId, recipient.insertId, sessionHash],
  );
  const [attempt] = await db.execute(
    `INSERT INTO learning_attempts
      (assignment_id,access_session_id,recipient_id,attempt_number,status,random_seed,
       session_token_hash,session_expires_at,generation_warnings_json,started_at,
       last_activity_at,completed_at,total_questions,graded_question_count,score_percent)
     VALUES (?,?,?,1,'COMPLETED',REPEAT('b',64),?,
       DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY(),UTC_TIMESTAMP(),
       UTC_TIMESTAMP(),UTC_TIMESTAMP(),2,2,50)`,
    [assignment.insertId, session.insertId, recipient.insertId, sessionHash],
  );
  await db.execute(
    `INSERT INTO learning_attempt_questions
      (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,
       mechanic,presentation,prompt_snapshot_json,options_snapshot_json,
       correct_answer_snapshot_json,graded,status,first_attempt_correct,final_correct,
       retry_count,completed_at)
     VALUES
      (?,?,?,'cat',1,'SELECT_ONE','WORD_PICK_MEANING',JSON_OBJECT(),JSON_ARRAY(),
       JSON_OBJECT(),TRUE,'ANSWERED',TRUE,TRUE,0,UTC_TIMESTAMP()),
      (?,?,?,'dog',2,'SELECT_ONE','WORD_PICK_MEANING',JSON_OBJECT(),JSON_ARRAY(),
       JSON_OBJECT(),TRUE,'ANSWERED',FALSE,FALSE,2,UTC_TIMESTAMP())`,
    [
      attempt.insertId, itemIds[0], activity.insertId,
      attempt.insertId, itemIds[1], activity.insertId,
    ],
  );

  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`${apiOrigin}/health`);
  await waitUrl(origin);
  const loginResponse = await fetch(`${apiOrigin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ username: "covy", password }),
  });
  const loginPayload = await loginResponse.json();
  assert(loginResponse.ok, "Admin login API failed");
  const authToken = loginPayload.data.token;
  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((token) => sessionStorage.setItem("teacher-token", token), authToken);
  const page = await context.newPage();
  await page.goto(`${origin}/admin/assignments/${assignment.insertId}/results`, { waitUntil: "networkidle" });
  await page.getByTestId("assignment-results-page").waitFor();
  await noOverflow(page);
  await page.screenshot({ path: path.join(artifacts, "overview-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(artifacts, "student-detail-390x844.png"), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, "teacher-result-390x844.png"), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, "google-sync-status-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Đóng" }).click();
  await page.getByRole("tab", { name: "Theo từ" }).click();
  await page.getByText("🔴 Cần ôn", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, "mastery-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Giao lại từ này" }).click();
  await page.screenshot({ path: path.join(artifacts, "review-draft-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Tạo bài nháp" }).click();
  await page.waitForURL(/\/admin\/assignments\/\d+\/edit/);
  const [[review]] = await db.query(
    "SELECT status,review_source_assignment_id,published_at FROM learning_assignments WHERE review_source_assignment_id=?",
    [assignment.insertId],
  );
  assert(review.status === "DRAFT" && review.published_at == null, "Review was auto-published");
  await page.goto(`${origin}/admin/assignments/${assignment.insertId}/results`, { waitUntil: "networkidle" });
  await page.getByLabel("Tìm học sinh").fill("không tồn tại");
  await page.getByText("Chưa có dữ liệu phù hợp.").waitFor();
  await page.screenshot({ path: path.join(artifacts, "empty-filter-390x844.png"), fullPage: true });
  await page.route("**/api/vocabulary/assignments/*/results/summary", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEST_ERROR", message: "Không tải được kết quả thử nghiệm." } }),
    }));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Không tải được kết quả thử nghiệm.").waitFor();
  await page.screenshot({ path: path.join(artifacts, "error-390x844.png"), fullPage: true });
  await context.close();

  for (const width of [360, 375, 390, 393, 400, 412, 430, 768, 1440]) {
    const responsive = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await responsive.addInitScript((token) => sessionStorage.setItem("teacher-token", token), authToken);
    const view = await responsive.newPage();
    await view.goto(`${origin}/admin/assignments/${assignment.insertId}/results`, { waitUntil: "networkidle" });
    await view.getByTestId("assignment-results-page").waitFor();
    await noOverflow(view);
    if (width === 360 || width === 1440)
      await view.screenshot({ path: path.join(artifacts, `dashboard-${width}x${width < 700 ? 844 : 900}.png`), fullPage: true });
    await responsive.close();
  }
  console.log(`V20E result/review responsive E2E PASS; screenshots: ${artifacts}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (db) await db.end();
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
}
