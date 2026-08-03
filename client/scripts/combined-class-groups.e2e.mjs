/* global process, fetch, setTimeout, console, document, window */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "combined-class-groups", {});
let artifactRunPassed = false;
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const apiOrigin = "http://127.0.0.1:4110";
const webOrigin = "http://127.0.0.1:5176";
const artifactDir = artifactPolicy.runDir;
fs.mkdirSync(artifactDir, { recursive: true });
const env = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "combined-group-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: "combined-group-password-123",
  PORT: "4110",
  CORS_ORIGIN: webOrigin,
  VITE_API_BASE_URL: apiOrigin,
};
const children = [];
let browser;
const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const currentDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
const currentWeekday = new Date(`${currentDate}T00:00:00Z`).getUTCDay() || 7;

function run(command, args, cwd) {
  const useWindowsCommand = ["npm", "npx"].includes(command) && process.platform === "win32";
  const executable = useWindowsCommand ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs = useWindowsCommand
    ? ["/d", "/s", "/c", `${command}.cmd`, ...args]
    : args;
  const result = spawnSync(executable, commandArgs, { cwd, env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
}

async function waitUrl(url, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the targeted services are ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(pathname, token, options = {}) {
  const response = await fetch(`${apiOrigin}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `${pathname}: ${response.status}`);
  return payload.data;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:reset:dev"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));

  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5176"], path.join(root, "client"));
  await waitUrl(`${apiOrigin}/health`);
  await waitUrl(webOrigin);

  const login = await api("/api/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ username: "covy", password: "combined-group-password-123" }),
  });
  const classes = (await api("/api/classes", login.token)).filter((item) => item.status === "ACTIVE");
  if (classes.length < 2) throw new Error("Seed data must contain at least two active classes.");
  const group = await api("/api/combined-class-groups", login.token, {
    method: "POST",
    body: JSON.stringify({
      name: classes.slice(0, 2).map((item) => item.name).join(" + "),
      classIds: classes.slice(0, 2).map((item) => item.id),
      effectiveFrom: currentDate,
      effectiveTo: "2026-08-31",
      schedules: [{ dayOfWeek: currentWeekday, startTime: "08:30", endTime: "11:00" }],
    }),
  });

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(chrome) ? chrome : undefined });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${webOrigin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill("combined-group-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(`${webOrigin}/admin`);

  await page.goto(`${webOrigin}/admin/combined-class-groups`);
  await page.getByTestId("combined-group-card").waitFor();
  await page.screenshot({ path: path.join(artifactDir, "01-danh-sach-nhom-hoc-ghep.png"), fullPage: true });

  await page.goto(`${webOrigin}/admin/combined-class-groups/new`);
  await page.getByTestId("combined-group-form").waitFor();
  await page.screenshot({ path: path.join(artifactDir, "02-form-tao-nhom-hoc-ghep.png"), fullPage: true });

  await page.goto(`${webOrigin}/admin/calendar`);
  await page.getByText(group.name, { exact: true }).waitFor();
  const calendarOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (calendarOverflow > 1) throw new Error(`Calendar overflows mobile viewport by ${calendarOverflow}px`);
  await page.screenshot({ path: path.join(artifactDir, "03-lich-tuan-card-hoc-ghep.png"), fullPage: true });

  await page.goto(`${webOrigin}/admin/reconciliation?from=${currentDate}&to=${currentDate}&state=ALL`);
  const groupCard = page.getByTestId("occurrence-card").filter({ hasText: group.name });
  await groupCard.waitFor();
  await page.screenshot({ path: path.join(artifactDir, "04-xac-nhan-lich-day-nhom.png"), fullPage: true });
  await groupCard.getByRole("button", { name: "Đã dạy" }).click();
  await page.waitForURL(/combined-class-groups\/occurrences\/\d+$/);
  await page.getByTestId("combined-occurrence-page").waitFor();
  if (await page.getByTestId("combined-occurrence-class").count() !== 2)
    throw new Error("Combined occurrence must render students grouped into two class cards.");
  if (await page.getByLabel("Điểm danh").count() < 2)
    throw new Error("Combined occurrence must render attendance controls for seeded students.");
  const occurrenceOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (occurrenceOverflow > 1) throw new Error(`Combined occurrence overflows mobile viewport by ${occurrenceOverflow}px`);
  await page.screenshot({ path: path.join(artifactDir, "05-hoc-sinh-chia-theo-lop.png"), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const bottomSpacing = await page.evaluate(() => {
    const action = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Đã dạy"));
    const navigation = document.querySelector('[data-testid="mobile-navigation"]');
    if (!action || !navigation) return null;
    return navigation.getBoundingClientRect().top - action.getBoundingClientRect().bottom;
  });
  if (bottomSpacing == null || bottomSpacing < 8)
    throw new Error(`Sticky action is obscured by mobile navigation: ${bottomSpacing}`);

  console.log(`Combined class group smoke passed; screenshots: ${artifactDir}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  await browser?.close();
  for (const child of children) child.kill();
}
