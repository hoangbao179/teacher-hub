/* global process, fetch, setTimeout, console, document, localStorage */
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
  JWT_SECRET: "schedule-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_EMAIL: "schedule-e2e@example.test",
  BOOTSTRAP_ADMIN_PASSWORD: "schedule-e2e-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Schedule E2E Teacher",
  PORT: "4103",
  CORS_ORIGIN: "http://127.0.0.1:5177",
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
async function api(pathname, token, method = "GET", body) {
  const response = await fetch(`http://127.0.0.1:4103${pathname}`, {
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
async function assertNoRawEnums(page) {
  const raw = await page.locator("body").innerText();
  const match = raw.match(/\b(ACTIVE|PAUSED|CLOSED|PRESENT|ABSENT|FREE|ACCUMULATING|PAYMENT_DUE|PAID|INCOMPLETE|REGULAR|MAKEUP|EXTRA|DRAFT|COMPLETED)\b/);
  if (match) throw new Error(`Visible raw enum: ${match[0]}`);
}
function todayInHoChiMinh() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function weekdayIso(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day || 7;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5177"], path.join(root, "client"), { ...testEnv, VITE_API_BASE_URL: "http://127.0.0.1:4103" });
  await waitUrl("http://127.0.0.1:4103/health"); await waitUrl("http://127.0.0.1:5177");

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5177/admin/login");
  await page.getByLabel("Email").fill("schedule-e2e@example.test");
  await page.getByLabel("Mật khẩu").fill("schedule-e2e-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Login did not persist token");
  const baselineDashboard = await api("/api/dashboard", token);

  const today = todayInHoChiMinh();
  const suffix = Date.now();
  const className = `M5B Operations ${suffix}`;
  const times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  const klass = await api("/api/classes", token, "POST", {
    name: className, type: "GROUP", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 60, startDate: "2026-01-01",
    schedules: times.map((startTime) => ({ dayOfWeek: weekdayIso(today), startTime, endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00` })),
  });
  const studentName = `M5B Student ${suffix}`;
  const student = await api("/api/students", token, "POST", { fullName: studentName });
  const enrollment = await api(`/api/classes/${klass.id}/enrollments`, token, "POST", {
    studentId: student.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  for (let index = 20; index >= 13; index -= 1) {
    const draft = await api("/api/lessons", token, "POST", {
      classId: klass.id, sessionDate: addDays(today, -index), scheduledStartTime: "20:00", scheduledEndTime: "21:00",
      lessonType: "MAKEUP", selectedEnrollmentIds: [enrollment.id],
    });
    await api(`/api/lessons/${draft.id}/complete`, token, "POST", {
      actualStartTime: "20:00", actualEndTime: "21:00", attendances: [{ enrollmentId: enrollment.id, status: "PRESENT" }],
    });
  }
  const operationUnrecorded = await api(`/api/schedule/occurrences?from=${addDays(today, -14)}&to=${today}&classId=${klass.id}&state=UNRECORDED&lookbackDays=60`, token);
  const initialDashboard = await api("/api/dashboard", token);
  const expectedDue = baselineDashboard.paymentDueCount + 1;
  const expectedUnpaid = baselineDashboard.totalUnpaidAmount + 2_400_000;
  const expectedUnrecorded = baselineDashboard.unrecordedCount + operationUnrecorded.length;
  if (initialDashboard.paymentDueCount !== expectedDue || initialDashboard.totalUnpaidAmount !== expectedUnpaid || initialDashboard.unrecordedCount !== expectedUnrecorded)
    throw new Error(`Unexpected dashboard aggregate ${JSON.stringify(initialDashboard)}`);

  await page.reload();
  await page.getByTestId("dashboard-tuition-card").getByText(`${expectedDue} chu kỳ cần thu`).waitFor();
  await page.getByText(`${expectedUnpaid.toLocaleString("vi-VN")}đ chưa thu`).waitFor();
  await page.getByTestId("dashboard-tuition-card").click();
  await page.waitForURL("**/admin/tuition?status=PAYMENT_DUE");
  await page.goto("http://127.0.0.1:5177/admin");
  await page.getByTestId("dashboard-unrecorded-card").getByText(`${expectedUnrecorded} buổi chưa ghi`).waitFor();
  await page.getByTestId("dashboard-unrecorded-card").click();
  await page.waitForURL("**/admin/reconciliation");
  await page.goto(`http://127.0.0.1:5177/admin/reconciliation?from=${today}&to=${today}&classId=${klass.id}&state=UNRECORDED`);
  await page.getByTestId("occurrence-card").first().waitFor();
  if (await page.getByTestId("occurrence-card").count() !== 6) throw new Error("Reconciliation did not render six occurrences");

  const taughtCard = page.getByTestId("occurrence-card").filter({ hasText: "08:00–09:00" });
  await taughtCard.getByRole("button", { name: "Đã dạy" }).click();
  await page.waitForURL("**/admin/lessons/*/edit");
  await page.getByText(studentName).waitFor();
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByLabel("Nội dung buổi học").fill("M5B canonical reconciliation");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByTestId("lesson-success").waitFor();

  await page.goto("http://127.0.0.1:5177/admin");
  await page.getByRole("link", { name: "Thêm lịch bận" }).click();
  await page.waitForURL("**/admin/busy-slots/new");
  await page.getByLabel("Tiêu đề lịch bận").fill(`Dạy ở trường ${suffix}`);
  await page.getByLabel("Ngày bận").fill(today);
  await page.getByLabel("Bắt đầu").fill("18:30");
  await page.getByLabel("Kết thúc").fill("19:30");
  await page.getByLabel("Địa điểm (tùy chọn)").fill("Trường mẫu");
  await page.getByRole("button", { name: "Lưu lịch bận" }).click();
  await page.getByText("Đã tạo lịch bận.").waitFor();
  await page.getByTestId("busy-conflict-warning").waitFor();

  await page.goto(`http://127.0.0.1:5177/admin/reconciliation?from=${today}&to=${today}&classId=${klass.id}&state=ALL`);
  const skippedCard = page.getByTestId("occurrence-card").filter({ hasText: "10:00–11:00" });
  await skippedCard.getByRole("button", { name: "Nghỉ" }).click();
  await page.getByLabel("Lý do nghỉ").fill("Giáo viên bận");
  await page.getByRole("button", { name: "Xác nhận nghỉ" }).click();
  await page.getByText("Đã đánh dấu nghỉ cho buổi dự kiến.").waitFor();
  await skippedCard.getByText("Nghỉ", { exact: true }).waitFor();

  const movedCard = page.getByTestId("occurrence-card").filter({ hasText: "12:00–13:00" });
  await movedCard.getByRole("button", { name: "Đổi lịch" }).click();
  await page.getByLabel("Ngày thay thế").fill(today);
  await page.getByLabel("Bắt đầu mới").fill("18:15");
  await page.getByLabel("Kết thúc mới").fill("18:45");
  await page.getByLabel("Lý do đổi lịch").fill("Học sinh xin đổi");
  await page.getByRole("button", { name: "Lưu đổi lịch" }).click();
  await page.getByTestId("schedule-conflict-warning").waitFor();

  for (const time of ["14:00–15:00", "16:00–17:00"])
    await page.getByTestId("occurrence-card").filter({ hasText: time }).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Tạo 2 bản nháp" }).click();
  await page.getByTestId("confirm-bulk-drafts").click();
  await page.getByText("Đã tạo 2/2 bản nháp buổi học độc lập.", { exact: false }).waitFor();

  await page.goto(`http://127.0.0.1:5177/admin/lessons/new?type=MAKEUP&date=${today}`);
  await page.getByLabel("Loại buổi").waitFor();
  if ((await page.getByLabel("Loại buổi").textContent())?.includes("Học bù") !== true) throw new Error("Makeup entry did not preselect MAKEUP");
  const makeup = await api("/api/lessons", token, "POST", {
    classId: klass.id, sessionDate: today, scheduledStartTime: "20:00", scheduledEndTime: "21:00",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollment.id],
  });
  if (!makeup.id) throw new Error("Makeup draft did not persist");

  await page.goto("http://127.0.0.1:5177/admin/calendar");
  await page.getByTestId("calendar-event").first().waitFor();
  await page.getByText(`Dạy ở trường ${suffix}`).waitFor();
  await page.getByTestId("calendar-event").filter({ hasText: className }).filter({ hasText: "Buổi học bù · Bản nháp" }).waitFor();
  await page.getByTestId("calendar-event").filter({ hasText: className }).filter({ hasText: "Lịch thay thế" }).waitFor();
  await page.getByTestId("calendar-event").filter({ hasText: className }).filter({ hasText: "Nghỉ" }).waitFor();
  const weekBefore = await page.getByLabel("Tuần bắt đầu").inputValue();
  await page.getByLabel("Tuần sau").click();
  await page.waitForFunction((value) => document.querySelector('input[type="date"]')?.value !== value, weekBefore);
  await page.getByLabel("Tuần trước").click();
  await assertNoRawEnums(page);
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await noHorizontalScroll(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const screenshot = path.join(artifactDir, "weekly-calendar-390.png");
  await page.screenshot({ path: screenshot, fullPage: true });

  await page.getByTestId("calendar-event").filter({ hasText: `Dạy ở trường ${suffix}` }).click();
  await page.waitForURL("**/admin/busy-slots/*/edit");
  await page.getByLabel("Hằng tuần").check();
  await page.getByLabel("Thứ trong tuần").click();
  const weekdayLabel = weekdayIso(today) === 7 ? "Chủ nhật" : `Thứ ${weekdayIso(today) + 1}`;
  await page.getByRole("option", { name: weekdayLabel }).click();
  await page.getByLabel("Hiệu lực từ").fill(addDays(today, -7));
  await page.getByLabel("Hiệu lực đến (tùy chọn)").fill(addDays(today, 7));
  await page.getByRole("button", { name: "Lưu lịch bận" }).click();
  await page.getByText("Đã cập nhật lịch bận.").waitFor();

  await page.goto("http://127.0.0.1:5177/admin");
  const finalDashboard = await api("/api/dashboard", token);
  await page.getByTestId("dashboard-unrecorded-card").getByText(`${finalDashboard.unrecordedCount} buổi chưa ghi`).waitFor();
  await page.getByText(`Dạy ở trường ${suffix}`).waitFor();
  await page.route("**/api/dashboard", (route) => route.abort("failed"));
  await page.reload();
  await page.getByText("Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.").waitFor();
  console.log(`Playwright M5B operations passed at 390x844; inspected screenshot: ${screenshot}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
