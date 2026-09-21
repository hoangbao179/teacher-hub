/* global process, fetch, setTimeout, console, document, localStorage */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "monthly-tuition", {});
const artifactDir = artifactPolicy.runDir;
let artifactRunPassed = false;
fs.mkdirSync(artifactDir, { recursive: true });
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "monthly-tuition-e2e-secret-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: "tuition-e2e-password-123",
  PORT: "4102",
  CORS_ORIGIN: "http://127.0.0.1:5176",
};
const children = [];
let browser;

function run(command, args, cwd = root) {
  const windowsCommand = ["npm", "npx"].includes(command) && process.platform === "win32";
  const packageCommand = windowsCommand ? `${command}.cmd` : command;
  const executable = windowsCommand ? process.env.ComSpec ?? "cmd.exe" : packageCommand;
  const commandArgs = windowsCommand ? ["/d", "/s", "/c", packageCommand, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
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
async function api(pathname, token, method = "GET", body) {
  const response = await fetch(`http://127.0.0.1:4102${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`API ${method} ${pathname} failed ${response.status}: ${payload?.error?.code ?? "unknown"}`);
  return payload?.data;
}
async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Horizontal page overflow: ${overflow}px`);
}
async function completeLesson(classId, enrollmentId, date, status, token) {
  const lesson = await api("/api/lessons", token, "POST", {
    classId, sessionDate: date, scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollmentId],
  });
  await api(`/api/lessons/${lesson.id}/complete`, token, "POST", {
    actualStartTime: "18:05", actualEndTime: "19:35",
    attendances: [{ enrollmentId, status }],
  });
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5176"], path.join(root, "client"), { ...testEnv, VITE_API_BASE_URL: "http://127.0.0.1:4102" });
  await waitUrl("http://127.0.0.1:4102/health");
  await waitUrl("http://127.0.0.1:5176");

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5176/admin/login");
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill("tuition-e2e-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Login did not persist token");

  const suffix = Date.now();
  const klass = await api("/api/classes", token, "POST", {
    name: `Monthly ${suffix}`, type: "GROUP", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 90, startDate: "2026-01-01", schedules: [],
  });
  const studentName = `Monthly Student ${suffix}`;
  const student = await api("/api/students", token, "POST", { fullName: studentName });
  const enrollment = await api(`/api/classes/${klass.id}/enrollments`, token, "POST", {
    studentId: student.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  for (let day = 1; day <= 6; day += 1)
    await completeLesson(klass.id, enrollment.id, `2026-09-${String(day).padStart(2, "0")}`, "PRESENT", token);
  for (let day = 7; day <= 8; day += 1)
    await completeLesson(klass.id, enrollment.id, `2026-09-${String(day).padStart(2, "0")}`, "ABSENT", token);
  const freeStudent = await api("/api/students", token, "POST", { fullName: `Free ${suffix}` });
  const freeEnrollment = await api(`/api/classes/${klass.id}/enrollments`, token, "POST", {
    studentId: freeStudent.id, joinedAt: "2026-01-01", tuitionMode: "FREE",
  });
  await completeLesson(klass.id, freeEnrollment.id, "2026-09-09", "PRESENT", token);

  const board = await api("/api/tuition/monthly?year=2026&month=9", token);
  const row = board.rows.find((item) => item.enrollmentId === enrollment.id);
  if (row?.attendance.present !== 6 || row?.attendance.absent !== 2 || row?.attendance.total !== 8)
    throw new Error("Monthly board did not aggregate 6 present and 2 absent lessons");
  if (board.rows.some((item) => item.enrollmentId === freeEnrollment.id))
    throw new Error("FREE enrollment appeared on the monthly tuition board");

  await page.goto("http://127.0.0.1:5176/admin/tuition");
  await page.getByRole("heading", { name: "Học phí theo tháng" }).waitFor();
  await page.getByLabel("Tìm học sinh").fill(studentName);
  const card = page.getByTestId("tuition-board-card").filter({ hasText: studentName });
  await card.getByText("6/8 buổi", { exact: true }).waitFor();
  await card.getByText("Vắng 2", { exact: true }).waitFor();
  await noHorizontalScroll(page);
  await page.getByLabel("Tháng trước").click();
  await page.getByText("Tháng 8/2026", { exact: true }).waitFor();
  await page.getByLabel("Tháng sau").click();
  await page.getByText("Tháng 9/2026", { exact: true }).waitFor();
  await page.getByLabel("Tìm học sinh").fill(studentName);
  await card.getByRole("button", { name: "Đã thu" }).click();
  await page.getByLabel("Số tiền (tùy chọn)").fill("1200000");
  await page.getByLabel("Ghi chú (tùy chọn)").fill("Thanh toán E2E");
  const confirm = page.getByTestId("confirm-monthly-payment");
  await confirm.click({ noWaitAfter: true });
  await page.getByText(`Đã ghi nhận học phí tháng 9 của ${studentName}.`).waitFor();
  await card.getByText("Đã thu", { exact: true }).waitFor();

  const replay = await api(`/api/tuition/monthly/${enrollment.id}/2026/9/paid`, token, "PUT", {
    amount: 1_200_000, paidAt: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }), note: "Thanh toán E2E",
  });
  if (!replay.idempotent) throw new Error("Identical monthly payment replay was not idempotent");
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport);
    await noHorizontalScroll(page);
    await page.screenshot({ path: path.join(artifactDir, `monthly-tuition-${viewport.width}.png`), fullPage: false });
  }
  console.log(`Playwright monthly tuition E2E passed; review artifacts: ${artifactDir}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
