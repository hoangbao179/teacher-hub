/* global process, fetch, setTimeout, console, document, localStorage, getComputedStyle */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const output = path.resolve(root, option("output", ".agent-reports/ui-capture"));
const requestedScreens = new Set(option("screens", "all").split(","));
const viewports = option("viewports", "390x844,1440x900").split(",").map((entry) => {
  const [width, height] = entry.split("x").map(Number);
  if (!width || !height) throw new Error(`Invalid viewport: ${entry}`);
  return { width, height };
});
const apiPort = 4106;
const webPort = 5186;
const origin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "ui-capture-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_USERNAME: "ui-capture",
  BOOTSTRAP_ADMIN_PASSWORD: "ui-capture-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Cô Vy",
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  VITE_API_BASE_URL: apiOrigin,
};
const children = [];
let browser;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env: testEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}

function runNpm(args, cwd) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  run(process.execPath, [npmCli, ...args], cwd);
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
    try { if ((await fetch(url)).ok) return; } catch { /* wait for process */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(pathname, token) {
  const response = await fetch(`${apiOrigin}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GET ${pathname} failed: ${response.status}`);
  return (await response.json()).data;
}

function wants(name) {
  return requestedScreens.has("all") || requestedScreens.has(name);
}

try {
  fs.mkdirSync(output, { recursive: true });
  run(process.execPath, ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  runNpm(["run", "db:migrate"], path.join(root, "server"));
  runNpm(["run", "db:bootstrap-admin"], path.join(root, "server"));
  runNpm(["run", "db:seed:dev"], path.join(root, "server"));
  start([path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start([path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], clientRoot);
  await waitUrl(`${apiOrigin}/health`);
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: viewports[0], reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="#ded7f8"/></svg>' }));

  await page.goto(`${origin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill(testEnv.BOOTSTRAP_ADMIN_USERNAME);
  await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Capture login did not return a token");

  const [classes, students, cycles] = await Promise.all([
    api("/api/classes", token),
    api("/api/students", token),
    api("/api/tuition-cycles?page=1&pageSize=100", token),
  ]);
  const firstClass = classes[0];
  const firstStudent = students[0];
  const firstCycle = cycles[0];
  const dueCycle = cycles.find((cycle) => cycle.status === "PAYMENT_DUE") ?? firstCycle;
  const screens = [
    { name: "public-home", path: "/", public: true },
    { name: "login", path: "/admin/login", public: true },
    { name: "dashboard", path: "/admin" },
    { name: "class-list", path: "/admin/classes" },
    { name: "class-form", path: "/admin/classes/new" },
    { name: "class-detail", path: firstClass ? `/admin/classes/${firstClass.id}` : null },
    { name: "student-list", path: "/admin/students" },
    { name: "student-detail", path: firstStudent ? `/admin/students/${firstStudent.id}` : null },
    { name: "lesson-wizard", path: firstClass ? `/admin/lessons/new?classId=${firstClass.id}` : "/admin/lessons/new" },
    { name: "tuition-list", path: "/admin/tuition" },
    { name: "tuition-detail", path: firstCycle ? `/admin/tuition/${firstCycle.id}` : null },
    { name: "mark-paid", path: dueCycle ? `/admin/tuition/${dueCycle.id}/mark-paid` : null },
    { name: "reconciliation", path: "/admin/reconciliation" },
    { name: "weekly-calendar", path: "/admin/calendar" },
    { name: "busy-slot", path: "/admin/busy-slots/new" },
  ].filter((screen) => screen.path && wants(screen.name));

  const manifest = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const screen of screens) {
      if (screen.public) await page.evaluate(() => localStorage.removeItem("teacher-token"));
      else await page.evaluate((value) => localStorage.setItem("teacher-token", value), token);
      await page.goto(`${origin}${screen.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.fonts.status === "loaded" && !document.querySelector(".MuiCircularProgress-root"));
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fontFamily: getComputedStyle(document.body).fontFamily,
        title: document.querySelector("h1")?.textContent?.trim() ?? "",
      }));
      const filename = `${screen.name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(output, filename), fullPage: true });
      manifest.push({ screen: screen.name, viewport, filename, ...metrics });
      console.log(`Captured ${filename} (overflow ${metrics.overflow}px)`);
    }
  }
  fs.writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
}
