/* global process, fetch, setTimeout, console, document, localStorage, URL */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const artifactDir = path.join(os.tmpdir(), "teacher-hub-m6c-ui-audit");
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
  JWT_SECRET: "lesson-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_EMAIL: "lesson-e2e@example.test",
  BOOTSTRAP_ADMIN_PASSWORD: "lesson-e2e-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Lesson E2E Teacher",
  PORT: "4101",
  CORS_ORIGIN: "http://127.0.0.1:5175",
};
const children = [];
let browser;

function npmCli(command) {
  return path.join(path.dirname(process.execPath), "node_modules/npm/bin", command === "npx" ? "npx-cli.js" : "npm-cli.js");
}
function run(command, args, cwd = root) {
  const executable = ["npm", "npx"].includes(command) ? process.execPath : command;
  const commandArgs = ["npm", "npx"].includes(command) ? [npmCli(command), ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit" });
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
async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Horizontal page overflow: ${overflow}px`);
}
async function api(pathname, token) {
  const response = await fetch(`http://127.0.0.1:4101${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`API ${pathname} failed ${response.status}`);
  return (await response.json()).data;
}
async function apiMutation(pathname, token, method, body) {
  const response = await fetch(`http://127.0.0.1:4101${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`API ${method} ${pathname} failed ${response.status}: ${payload.error?.code ?? "unknown"}`);
  }
  return response.status === 204 ? undefined : (await response.json()).data;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5175"], path.join(root, "client"), { ...testEnv, VITE_API_BASE_URL: "http://127.0.0.1:4101" });
  await waitUrl("http://127.0.0.1:4101/health"); await waitUrl("http://127.0.0.1:5175");

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5175/admin/login");
  await page.getByLabel("Email").fill("lesson-e2e@example.test");
  await page.getByLabel("Mật khẩu").fill("lesson-e2e-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Login did not persist token");
  const classes = await api("/api/classes", token);
  const group = classes.find((item) => item.name === "DEV - Lớp nhóm A");
  if (!group) throw new Error("Seeded group class not found");

  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}`);
  await page.getByText("Thông tin buổi học", { exact: true }).first().waitFor();
  await page.locator('input[type="time"]').nth(3).fill("20:00");
  await noHorizontalScroll(page);
  const sticky = await page.getByRole("button", { name: "Lưu và tiếp tục" }).boundingBox();
  if (!sticky || sticky.y + sticky.height > 844) throw new Error("Sticky primary action is outside mobile viewport");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByText("Học sinh Mẫu Một").waitFor();
  const secondCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Hai" });
  await secondCard.getByRole("button", { name: "Nghỉ" }).click();
  const freeCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Ba" });
  if ((await freeCard.getByRole("button", { name: "Miễn phí" }).getAttribute("aria-pressed")) !== "true")
    throw new Error("Global FREE attendance did not default to FREE");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.reload();
  await page.getByLabel("Nội dung buổi học").waitFor();
  await page.getByLabel("Nội dung buổi học").fill("Nội dung Playwright M2C");
  await page.getByLabel("Bài tập về nhà").fill("Bài tập Playwright M2C");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByText("Xác nhận buổi học").waitFor();
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifactDir, "lesson-confirmation-390.png"), fullPage: true });
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByTestId("lesson-success").waitFor();
  const regularUrl = page.url();
  await page.reload();
  await page.getByText("Buổi học đã hoàn thành và được lưu.").waitFor();
  if (!page.url().includes("/edit")) throw new Error(`Unexpected persisted route ${regularUrl}`);

  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}&type=MAKEUP`);
  await page.getByText("Chọn học sinh tham gia").waitFor();
  await page.getByLabel("Học sinh Mẫu Một").check();
  await page.getByLabel("Học sinh Mẫu Hai").check();
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByLabel("Nhận xét riêng (tùy chọn)").first().waitFor();
  if (await page.getByText("Học sinh Mẫu Ba", { exact: true }).count()) throw new Error("Non-selected makeup student appeared in attendance");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByLabel("Nội dung buổi học").fill("Makeup content");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByTestId("lesson-success").waitFor();
  const makeupId = Number(new URL(page.url()).pathname.split("/")[3]);
  const makeupDetail = await api(`/api/lessons/${makeupId}`, token);
  if (makeupDetail.participants.length !== 2) throw new Error("Makeup snapshot did not persist exactly two participants");
  await noHorizontalScroll(page);
  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}`);
  await page.getByLabel("Ghi chú").fill("unsaved");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByText("Lớp học", { exact: true }).last().click();
  if (!page.url().includes("/admin/lessons/new")) throw new Error("Unsaved-change warning did not block navigation");

  const suffix = Date.now();
  const m3Class = await apiMutation("/api/classes", token, "POST", {
    name: `M3 E2E ${suffix}`, type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 90, startDate: "2026-01-01", schedules: [],
  });
  const m3Student = await apiMutation("/api/students", token, "POST", { fullName: `M3 E2E Student ${suffix}` });
  const m3Enrollment = await apiMutation(`/api/classes/${m3Class.id}/enrollments`, token, "POST", {
    studentId: m3Student.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  async function completeTechnical(date) {
    const draft = await apiMutation("/api/lessons", token, "POST", {
      classId: m3Class.id, sessionDate: date, scheduledStartTime: "18:00", scheduledEndTime: "19:30",
      lessonType: "MAKEUP", selectedEnrollmentIds: [m3Enrollment.id],
    });
    return apiMutation(`/api/lessons/${draft.id}/complete`, token, "POST", {
      actualStartTime: "18:00", actualEndTime: "19:30",
      attendances: [{ enrollmentId: m3Enrollment.id, status: "PRESENT" }],
    });
  }
  let lastResult;
  for (const date of ["2026-07-10", "2026-07-02", "2026-07-09", "2026-07-01", "2026-07-08", "2026-07-03", "2026-07-07", "2026-07-04", "2026-07-06"])
    lastResult = await completeTechnical(date);
  if (lastResult.tuitionImpacts[0].newProgress !== 1) throw new Error("Nine out-of-order lessons did not produce 8/8 + 1/8");
  await completeTechnical("2026-07-05");
  const cycles = await api(`/api/tuition-cycles?studentId=${m3Student.id}&pageSize=20`, token);
  if (cycles.length !== 2 || cycles.find((item) => item.status === "PAYMENT_DUE")?.progress !== 8 || cycles.find((item) => item.status === "ACCUMULATING")?.progress !== 2)
    throw new Error("Chronological E2E cycles are not 8/8 and 2/8");
  const due = cycles.find((item) => item.status === "PAYMENT_DUE");
  const dueDetail = await api(`/api/tuition-cycles/${due.id}`, token);
  const orderedDates = dueDetail.items.map((item) => item.sessionDate);
  if (JSON.stringify(orderedDates) !== JSON.stringify([...orderedDates].sort())) throw new Error("Cycle detail is not chronological");
  await apiMutation(`/api/tuition-cycles/${due.id}/mark-paid`, token, "POST", {
    paidAmount: due.packagePriceSnapshot, paidAt: "2026-07-31", paymentMethod: "CASH",
  });
  const conflictDraft = await apiMutation("/api/lessons", token, "POST", {
    classId: m3Class.id, sessionDate: "2026-06-30", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [m3Enrollment.id],
  });
  await apiMutation(`/api/lessons/${conflictDraft.id}/attendances`, token, "PUT", {
    attendances: [{ enrollmentId: m3Enrollment.id, status: "PRESENT" }],
  });
  await apiMutation(`/api/lessons/${conflictDraft.id}/content`, token, "PUT", { content: "Paid boundary conflict" });
  await page.goto(`http://127.0.0.1:5175/admin/lessons/${conflictDraft.id}/edit`);
  await page.getByText("Xác nhận buổi học").waitFor();
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByText("Xung đột:").waitFor();
  const conflictPersisted = await api(`/api/lessons/${conflictDraft.id}`, token);
  if (conflictPersisted.status !== "DRAFT") throw new Error("Paid conflict did not roll lesson back to DRAFT");
  console.log(`Playwright lesson E2E passed at 390x844; screenshot: ${path.join(artifactDir, "lesson-confirmation-390.png")}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
