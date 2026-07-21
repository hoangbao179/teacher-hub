/* global process, fetch, setTimeout, console, document, localStorage */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";

const root = path.resolve(import.meta.dirname, "../..");
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
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const executable = command === "npm" ? process.execPath : command;
  const commandArgs = command === "npm" ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit" });
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
async function makeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  for (let index = 0; index < 10; index += 1) {
    const start = index * 5 + 1;
    learning.getCell(start, 1).value = "DATE";
    learning.getCell(start, 2).value = `${String(index + 1).padStart(2, "0")}/07`;
    learning.getCell(start, 3).value = "CONTENT -NỘI DUNG HỌC";
    learning.getCell(start, 6).value = `Nội dung ${index + 1}`;
    learning.getCell(start + 1, 1).value = "TEACHER";
    learning.getCell(start + 1, 2).value = "Cô Vy";
    learning.getCell(start + 1, 3).value = "HOMEWORK";
    ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) => learning.getCell(start + 2, column + 1).value = value);
    learning.getCell(start + 3, 1).value = 1;
    learning.getCell(start + 3, 2).value = "Học sinh Mẫu";
    learning.getCell(start + 3, 5).value = `Bài tập ${index + 1}`;
  }
  const tuition = workbook.addWorksheet("Học phí");
  ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, column) => tuition.getCell(1, column + 1).value = value);
  for (let index = 0; index < 10; index += 1) {
    const row = index + 2;
    tuition.getCell(row, 1).value = "Học sinh Mẫu";
    tuition.getCell(row, 2).value = "18:00-19:30";
    tuition.getCell(row, 3).value = new Date(`2026-07-${String(index + 1).padStart(2, "0")}T00:00:00Z`);
    tuition.getCell(row, 3).numFmt = "d/m/yyyy";
    tuition.getCell(row, 4).value = 45_000 + index;
  }
  tuition.getCell(12, 6).value = "PAID";
  await workbook.xlsx.writeFile(workbookPath);
}

try {
  await makeWorkbook();
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));
  start([path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start([path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${origin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin`);
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/students`, { headers: { Authorization: `Bearer ${token}` } });
  const students = (await response.json()).data;
  const student = students[0];
  await page.goto(`${origin}/admin/students/${student.id}`);
  await page.getByRole("link", { name: "Import lịch sử" }).click();
  await page.waitForURL(`**/admin/students/${student.id}/legacy-import`);
  const studentNav = page.getByTestId("mobile-navigation").getByRole("button", { name: "Học sinh" });
  if (!(await studentNav.getAttribute("class"))?.includes("Mui-selected")) throw new Error("Student navigation is not active on legacy import route");
  await page.locator('input[type="file"]').setInputFiles({ name: "Synthetic Grade 9.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: fs.readFileSync(workbookPath) });
  await page.getByRole("heading", { name: "Kết quả sẽ trở thành gì?" }).waitFor();
  await page.getByText("8/8 · Đủ buổi").waitFor();
  await page.getByText("2/8 · Đang tích lũy").waitFor();
  if ((await page.getByLabel("Khối").first().textContent())?.replaceAll("\u200B", "").trim()) throw new Error("Filename grade was applied to an academic period");
  await page.getByLabel("Cách hiểu sự kiện PAID").click();
  await page.getByRole("option", { name: "Trả đợt trước" }).click();
  await page.getByText("Đợt đã thu").locator("..").getByText("1", { exact: true }).waitFor();
  for (const width of [360, 375, 390, 393, 400, 412, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Legacy import overflows by ${overflow}px at ${width}px`);
  }
  await page.getByRole("link", { name: "Quay lại chi tiết học sinh" }).click();
  await page.waitForURL(`**/admin/students/${student.id}`);
  console.log("Legacy import targeted E2E passed at 360–430 px.");
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  fs.rmSync(workbookPath, { force: true });
  await new Promise((resolve) => setTimeout(resolve, 500));
}
