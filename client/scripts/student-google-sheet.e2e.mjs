/* global process, fetch, setTimeout, console, document, localStorage */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const apiPort = 4117; const webPort = 5197; const origin = `http://127.0.0.1:${webPort}`;
const testEnv = { ...process.env, NODE_ENV: "test", DB_HOST: process.env.DB_HOST ?? "127.0.0.1", DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root", DB_PASSWORD: process.env.DB_PASSWORD ?? "", DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "google-sheet-e2e-secret-at-least-32-characters", BOOTSTRAP_ADMIN_PASSWORD: "google-sheet-e2e-password-123",
  PORT: String(apiPort), CORS_ORIGIN: origin, GOOGLE_DRIVE_ENABLED: "true", GOOGLE_DRIVE_CLIENT_ID: "fake-client",
  GOOGLE_DRIVE_CLIENT_SECRET: "fake-secret", GOOGLE_DRIVE_REFRESH_TOKEN: "fake-refresh", GOOGLE_DRIVE_ROOT_FOLDER_ID: "fake-root",
  GOOGLE_DRIVE_OWNER_LABEL: "Cô Vy test", GOOGLE_SHEETS_TEMPLATE_VERSION: "v1", GOOGLE_DRIVE_FAKE: "1",
  GOOGLE_DRIVE_FAKE_FAIL_ONCE: "1", GOOGLE_DRIVE_FAKE_DELAY_MS: "400",
  GOOGLE_SHEET_SYNC_ENABLED: "true" };
const children = []; let browser;
function run(command, args, cwd = root) {
  const windows = ["npm", "npx"].includes(command) && process.platform === "win32";
  const executable = windows ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = windows ? ["/d", "/s", "/c", `${command}.cmd`, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error; if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk)); child.stderr.on("data", (chunk) => process.stderr.write(chunk)); children.push(child);
}
async function waitUrl(url) { const end = Date.now() + 30_000; while (Date.now() < end) {
  try { if ((await fetch(url)).ok) return; } catch { /* retry */ } await new Promise((resolve) => setTimeout(resolve, 200));
} throw new Error(`Timed out waiting for ${url}`); }
async function apiMutation(pathname, token, method, body) {
  const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(`${method} ${pathname} failed with ${response.status}`);
  return response.status === 204 ? undefined : (await response.json()).data;
}
async function noOverflow(page, width) { await page.setViewportSize({ width, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Google Sheet card overflows ${overflow}px at ${width}px`); }

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server")); run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  start([path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start([path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"),
    { ...testEnv, VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}` });
  await waitUrl(`http://127.0.0.1:${apiPort}/health`); await waitUrl(origin);
  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage(); await page.goto(`${origin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill("covy"); await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await page.waitForURL(`${origin}/admin`);
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  const created = await fetch(`http://127.0.0.1:${apiPort}/api/students`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Học sinh Google E2E" }) });
  const studentId = (await created.json()).data.id; await page.goto(`${origin}/admin/students/${studentId}`);
  const card = page.getByTestId("student-google-sheet-card"); await card.getByText("Chưa tạo Google Sheet").waitFor();
  await card.getByRole("button", { name: "Tạo sổ theo dõi" }).click();
  await page.getByText("Đang tạo…").waitFor(); await card.getByText("Tạo chưa thành công").waitFor();
  await card.getByRole("button", { name: "Thử tạo lại" }).click(); await card.getByText("Đã liên kết").waitFor();
  const open = card.getByRole("link", { name: "Mở Google Sheet" }); const firstUrl = await open.getAttribute("href");
  if (!firstUrl?.startsWith("https://docs.google.com/spreadsheets/")) throw new Error("Unsafe or missing Google Sheet URL");
  if (await open.getAttribute("rel") !== "noopener noreferrer") throw new Error("External Google Sheet link is missing rel safety");
  await card.getByRole("button", { name: "Sao chép liên kết" }).click(); await page.getByText("Đã sao chép liên kết Google Sheet.").waitFor();
  await card.getByRole("button", { name: "Tạo lại nội dung" }).click(); const dialog = page.getByRole("dialog", { name: "Tạo lại nội dung Sheet" });
  await dialog.getByRole("button", { name: "Xác nhận" }).click(); await page.getByText("Đã tạo lại nội dung từ dữ liệu Teacher Hub.").waitFor();
  if (await open.getAttribute("href") !== firstUrl) throw new Error("Regenerate changed the spreadsheet URL");
  const suffix = Date.now();
  const group = await apiMutation("/api/classes", token, "POST", {
    name: `Google sync E2E ${suffix}`, type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 90, startDate: "2026-07-01", schedules: [],
  });
  const enrollment = await apiMutation(`/api/classes/${group.id}/enrollments`, token, "POST", {
    studentId, joinedAt: "2026-07-01", tuitionMode: "CLASS_DEFAULT",
  });
  const lesson = await apiMutation("/api/lessons", token, "POST", {
    classId: group.id, sessionDate: "2026-07-26", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR",
  });
  await apiMutation(`/api/lessons/${lesson.id}/complete`, token, "POST", {
    actualStartTime: "18:00", actualEndTime: "19:30", content: "Nội dung sync E2E",
    homework: "Bài tập sync E2E", generalComment: "Tiến bộ tốt",
    attendances: [{ enrollmentId: enrollment.id, status: "PRESENT", studentNote: "Riêng đúng học sinh" }],
  });
  await page.reload();
  await card.getByText("Đang chờ đồng bộ 1 mục…").waitFor();
  await card.getByRole("button", { name: "Đồng bộ lại" }).click();
  const resyncDialog = page.getByRole("dialog", { name: "Đồng bộ lại lịch sử" });
  await resyncDialog.getByRole("button", { name: "Xác nhận" }).click();
  await page.getByText("Đã xếp hàng đồng bộ lại 1 buổi học.").waitFor();
  for (const width of [360, 375, 390, 393, 400, 412, 430]) await noOverflow(page, width);
  console.log("Student Google Sheet create/retry/resync-pending E2E passed at 360–430 px.");
} finally {
  if (browser) await browser.close(); for (const child of children.reverse()) { try { child.kill(); } catch { /* stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
