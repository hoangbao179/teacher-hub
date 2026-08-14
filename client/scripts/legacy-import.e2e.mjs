/* global process, fetch, setTimeout, console, document, localStorage */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";
import ExcelJS from "exceljs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "legacy-import", {});
let artifactRunPassed = false;
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const apiPort = 4116;
const webPort = 5196;
const origin = `http://127.0.0.1:${webPort}`;
const workbookPath = path.join(os.tmpdir(), `teacher-hub-v16a-${process.pid}.xlsx`);
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "legacy-import-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: "legacy-import-e2e-password-123",
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const children = [];
let browser;

function run(command, args, cwd = root) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const executable = command === "npm" && process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command === "npm" ? npmCommand : command;
  const commandArgs = command === "npm" && process.platform === "win32" ? ["/d", "/s", "/c", npmCommand, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}
function start(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, env: testEnv, stdio: ["ignore", "pipe", "pipe"] });
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
async function makeWorkbook(studentName) {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  const blocks = [
    { dates: Array.from({ length: 10 }, (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`), paidAfter: 8 },
    { dates: Array.from({ length: 8 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`), paidAfter: 8 },
    { dates: ["2026-09-01", "2026-09-03", "2026-09-05"], paidAfter: null },
  ];
  const dates = blocks.flatMap((block) => block.dates);
  const learningDates = dates.filter((_, index) => index !== 7);
  for (let index = 0; index < learningDates.length; index += 1) {
    const start = index * 5 + 1;
    learning.getCell(start, 1).value = "DATE";
    learning.getCell(start, 2).value = learningDates[index];
    learning.getCell(start, 3).value = "CONTENT -NỘI DUNG HỌC";
    learning.getCell(start, 6).value = `Nội dung ${index + 1}`;
    learning.getCell(start + 1, 1).value = "TEACHER";
    learning.getCell(start + 1, 2).value = "Cô Vy";
    learning.getCell(start + 1, 3).value = "HOMEWORK";
    ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) => learning.getCell(start + 2, column + 1).value = value);
    learning.getCell(start + 3, 1).value = 1;
    learning.getCell(start + 3, 2).value = studentName;
    learning.getCell(start + 3, 5).value = `Bài tập ${index + 1}`;
  }
  const tuition = workbook.addWorksheet("Học phí");
  let row = 1;
  for (const block of blocks) {
    ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, column) => tuition.getCell(row, column + 1).value = value);
    row += 1;
    block.dates.forEach((date, index) => {
      tuition.getCell(row, 1).value = studentName;
      tuition.getCell(row, 2).value = "18:00-19:30";
      tuition.getCell(row, 3).value = new Date(`${date}T00:00:00Z`);
      tuition.getCell(row, 3).numFmt = "d/m/yyyy";
      row += 1;
      if (block.paidAfter === index + 1) { tuition.getCell(row, 6).value = "PAID"; row += 1; }
    });
    tuition.getCell(row, 1).value = "TOTAL";
    row += 1;
  }
  await workbook.xlsx.writeFile(workbookPath);
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:reset:dev"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));
  start([path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start([path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${origin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin`);
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  const fullName = "Học sinh Import E2E";
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/students`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, nickname: "E2E" }),
  });
  if (response.status !== 201) throw new Error(`Could not create isolated import student: ${response.status}`);
  const student = { id: (await response.json()).data.id, fullName };
  await makeWorkbook(student.fullName);
  await page.goto(`${origin}/admin/students/${student.id}`);
  await page.getByText("Công cụ nâng cao", { exact: true }).click();
  await page.getByRole("link", { name: "Import lịch sử" }).click();
  await page.waitForURL(`**/admin/students/${student.id}/legacy-import`);
  const studentNav = page.getByTestId("mobile-navigation").getByRole("button", { name: "Học sinh" });
  if (!(await studentNav.getAttribute("class"))?.includes("Mui-selected")) throw new Error("Student navigation is not active on legacy import route");
  await page.locator('input[type="file"]').setInputFiles({ name: "Synthetic Grade 9.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: fs.readFileSync(workbookPath) });
  await page.getByRole("heading", { name: "Tổng hợp kiểm tra" }).waitFor();
  await page.getByText("Miễn học phí sau đợt đã thu").waitFor();
  await page.getByText("Có 2 buổi miễn học phí sau đợt đã thanh toán", { exact: false }).waitFor();
  await page.getByText("Chờ bổ sung nhận xét").waitFor();
  await page.getByText("Đợt 1: Đã thu · Không rõ ngày").waitFor();
  if (await page.getByText("Sự kiện thanh toán cần xác nhận").count()) throw new Error("Clear PAID block created a payment review card");
  await page.getByText("được ghi trong sheet Học phí nhưng chưa xuất hiện ở Quá trình học tập", { exact: false }).waitFor();
  if (await page.getByRole("button", { name: "Bỏ qua dòng" }).count()) throw new Error("Paid tuition-only group can still be skipped");
  await page.getByRole("button", { name: "Tạo 1 buổi học" }).click();
  if (await page.getByLabel("Khối").count() !== 1) throw new Error("Workbook was split into multiple automatic grade periods");
  if (!(await page.getByLabel("Khối").textContent())?.includes("Lớp 9")) throw new Error("Workbook Grade 9 context was not proposed");
  await page.getByLabel("Chỉ xem mục cần xử lý").check();
  await page.getByRole("button", { name: "Xác nhận mapping" }).click();
  await page.getByText("Không còn mục cần xử lý.").waitFor();
  await page.getByText("Tất cả mục đã sẵn sàng.").waitFor();
  for (const width of [360, 375, 390, 393, 400, 412, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Legacy import overflows by ${overflow}px at ${width}px`);
  }
  await page.getByRole("button", { name: "Xác nhận import" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Import dữ liệu" }).click();
  await page.getByText(/Import #\d+ đã hoàn tất/).waitFor();
  await page.getByRole("link", { name: "Về chi tiết học sinh" }).click();
  await page.waitForURL(`**/admin/students/${student.id}`);
  console.log("Legacy preview, row resolution and Apply E2E passed at 360–430 px.");
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  fs.rmSync(workbookPath, { force: true });
  await new Promise((resolve) => setTimeout(resolve, 500));
}
