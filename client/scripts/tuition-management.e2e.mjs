/* global process, fetch, setTimeout, console, document, localStorage */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";

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
  JWT_SECRET: "tuition-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_EMAIL: "tuition-e2e@example.test",
  BOOTSTRAP_ADMIN_PASSWORD: "tuition-e2e-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Tuition E2E Teacher",
  PORT: "4102",
  CORS_ORIGIN: "http://127.0.0.1:5176",
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
async function completeLesson(classId, enrollmentId, date, token) {
  const draft = await api("/api/lessons", token, "POST", {
    classId, sessionDate: date, scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollmentId],
  });
  await api(`/api/lessons/${draft.id}/complete`, token, "POST", {
    actualStartTime: "18:05", actualEndTime: "19:35",
    attendances: [{ enrollmentId, status: "PRESENT" }],
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5176/admin/login");
  await page.getByLabel("Email").fill("tuition-e2e@example.test");
  await page.locator('input[name="password"]').fill("tuition-e2e-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Login did not persist token");

  const suffix = Date.now();
  const klass = await api("/api/classes", token, "POST", {
    name: `M4B Tuition ${suffix}`, type: "GROUP", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 90, startDate: "2026-01-01", schedules: [],
  });
  const dueStudentName = `M4B Due ${suffix}`;
  const dueStudent = await api("/api/students", token, "POST", { fullName: dueStudentName });
  const dueEnrollment = await api(`/api/classes/${klass.id}/enrollments`, token, "POST", {
    studentId: dueStudent.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  for (let day = 1; day <= 10; day += 1)
    await completeLesson(klass.id, dueEnrollment.id, `2026-07-${String(day).padStart(2, "0")}`, token);

  const incompleteStudentName = `M4B Incomplete ${suffix}`;
  const incompleteStudent = await api("/api/students", token, "POST", { fullName: incompleteStudentName });
  const incompleteEnrollment = await api(`/api/classes/${klass.id}/enrollments`, token, "POST", {
    studentId: incompleteStudent.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  for (let day = 11; day <= 15; day += 1)
    await completeLesson(klass.id, incompleteEnrollment.id, `2026-07-${day}`, token);
  await api(`/api/enrollments/${incompleteEnrollment.id}/end`, token, "POST", { endedAt: "2026-07-20", reason: "E2E" });

  const beforeCycles = await api(`/api/tuition-cycles?studentId=${dueStudent.id}&pageSize=20`, token);
  const due = beforeCycles.find((item) => item.status === "PAYMENT_DUE");
  const accumulatingBefore = beforeCycles.find((item) => item.status === "ACCUMULATING");
  if (!due || !accumulatingBefore || accumulatingBefore.itemCount !== 2) throw new Error("Expected due 8/8 and accumulating 2/8 cycles");
  const dashboardBeforePayment = await api("/api/dashboard", token);

  await page.goto("http://127.0.0.1:5176/admin/tuition");
  await page.getByRole("heading", { name: "Học phí" }).waitFor();
  await page.getByLabel("Tìm học sinh").fill(dueStudentName);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  const dueCard = page.getByTestId("tuition-cycle-card").filter({ hasText: dueStudentName });
  await dueCard.waitFor();
  await dueCard.getByRole("link", { name: "Xem chi tiết" }).click();
  await page.waitForURL(`**/admin/tuition/${due.id}`);
  await page.getByTestId("tuition-cycle-item").first().waitFor();
  const detailItemCount = await page.getByTestId("tuition-cycle-item").count();
  if (detailItemCount !== 8) throw new Error(`Tuition detail rendered ${detailItemCount} items instead of eight`);
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Đánh dấu đã thu" }).click();
  await page.waitForURL(`**/admin/tuition/${due.id}/mark-paid`);
  if (await page.getByLabel("Số tiền").inputValue() !== String(due.packagePriceSnapshot)) throw new Error("Payment amount did not default to snapshot");
  await page.getByLabel("Chuyển khoản").check();
  await page.getByLabel("Ghi chú (tùy chọn)").fill("Thanh toán E2E");
  await page.getByRole("button", { name: "Xác nhận đã thu" }).click();
  await page.getByRole("dialog").waitFor();
  await page.route("**/api/tuition-cycles/*/mark-paid", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  const confirm = page.getByTestId("confirm-mark-paid");
  await confirm.click({ noWaitAfter: true });
  if (!(await confirm.isDisabled())) throw new Error("Duplicate payment submission was not disabled");
  await page.waitForURL(`**/admin/tuition/${due.id}`);
  await page.getByText("Đã ghi nhận thanh toán toàn bộ chu kỳ.").waitFor();
  await page.reload();
  await page.getByText("Chu kỳ đã thu và đang ở trạng thái chỉ đọc.").waitFor();
  if (await page.getByRole("link", { name: "Đánh dấu đã thu" }).count()) throw new Error("PAID detail still exposed payment action");
  await page.screenshot({ path: path.join(artifactDir, "tuition-paid-390.png"), fullPage: true });

  await page.goto(`http://127.0.0.1:5176/admin/students/${dueStudent.id}`);
  await page.getByRole("heading", { name: dueStudentName }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất báo cáo Excel" }).click();
  const download = await downloadPromise;
  const downloadPath = path.join(os.tmpdir(), `teacher-hub-m6b-${suffix}.xlsx`);
  await download.saveAs(downloadPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fs.readFileSync(downloadPath));
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  if (JSON.stringify(sheetNames) !== JSON.stringify(["Quá trình học tập", "Học phí", "Tổng hợp"]))
    throw new Error(`Unexpected workbook sheets: ${sheetNames.join(", ")}`);
  if (workbook.getWorksheet("Quá trình học tập").rowCount !== 11 || workbook.getWorksheet("Học phí").rowCount !== 11)
    throw new Error("Downloaded workbook row counts do not match canonical data");
  if (workbook.getWorksheet("Học phí").getCell("F2").value !== due.packagePriceSnapshot)
    throw new Error("Downloaded workbook did not preserve numeric price snapshot");
  await page.getByText(/Đã tải báo cáo Excel:/).waitFor();

  const paidDetail = await api(`/api/tuition-cycles/${due.id}`, token);
  const dashboardAfterPayment = await api("/api/dashboard", token);
  if (dashboardAfterPayment.paymentDueCount !== dashboardBeforePayment.paymentDueCount - 1 ||
      dashboardAfterPayment.totalUnpaidAmount !== dashboardBeforePayment.totalUnpaidAmount - due.packagePriceSnapshot)
    throw new Error("Dashboard tuition aggregate did not refresh after payment");
  await page.goto("http://127.0.0.1:5176/admin");
  await page.getByTestId("dashboard-tuition-card").getByText(`${dashboardAfterPayment.paymentDueCount} chu kỳ cần thu`).waitFor();
  const replay = await api(`/api/tuition-cycles/${due.id}/mark-paid`, token, "POST", {
    paidAmount: due.packagePriceSnapshot,
    paidAt: paidDetail.paidAt,
    paymentMethod: "BANK_TRANSFER",
    paymentNote: "Thanh toán E2E",
  });
  if (!replay.idempotent) throw new Error("Identical payment replay was not idempotent");
  const afterCycles = await api(`/api/tuition-cycles?studentId=${dueStudent.id}&pageSize=20`, token);
  const accumulatingAfter = afterCycles.find((item) => item.status === "ACCUMULATING");
  if (JSON.stringify(accumulatingAfter) !== JSON.stringify(accumulatingBefore)) throw new Error("Next accumulating cycle changed after payment");

  await page.goto("http://127.0.0.1:5176/admin/tuition");
  await page.getByRole("tab", { name: "Đang tích lũy" }).click();
  await page.getByLabel("Tìm học sinh").fill(dueStudentName);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await page.getByText("2/8", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Chưa hoàn thành" }).click();
  await page.getByLabel("Tìm học sinh").fill(incompleteStudentName);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await page.getByTestId("tuition-cycle-card").filter({ hasText: incompleteStudentName }).waitFor();
  await page.getByLabel("Tìm học sinh").fill("Không có học sinh này");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await page.getByText("Không có chu kỳ học phí phù hợp.").waitFor();
  await page.setViewportSize({ width: 360, height: 800 });
  await noHorizontalScroll(page);
  console.log(`Playwright tuition E2E passed; screenshot: ${path.join(artifactDir, "tuition-paid-390.png")}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
