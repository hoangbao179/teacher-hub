/* global process, fetch, setTimeout, console, document, getComputedStyle, URL, window */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4109;
const webPort = 5189;
const origin = `http://127.0.0.1:${webPort}`;
const artifactDir = path.join(root, ".agent-reports", "v1-1-mobile-nav");
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "mobile-navigation-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_USERNAME: "mobile-nav-e2e",
  BOOTSTRAP_ADMIN_PASSWORD: "mobile-nav-e2e-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Cô Vy",
  PORT: String(apiPort),
  CORS_ORIGIN: origin,
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
};
const mobileViewports = [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
];
const tabs = [
  { label: "Hôm nay", path: "/admin", slug: "today" },
  { label: "Lịch", path: "/admin/calendar", slug: "calendar" },
  { label: "Lớp học", path: "/admin/classes", slug: "classes" },
  { label: "Học phí", path: "/admin/tuition", slug: "tuition" },
  { label: "Học sinh", path: "/admin/students", slug: "students" },
];
const children = [];
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, cwd = root) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const executable = command === "npm" ? process.execPath : command;
  const commandArgs = command === "npm" ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}`);
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env: testEnv, stdio: ["ignore", "pipe", "pipe"] });
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

async function inspectMobileNavigation(page, width, expectedLabel) {
  const result = await page.evaluate(() => {
    const navigation = document.querySelector('[data-testid="mobile-navigation"]');
    const desktop = document.querySelector('[data-testid="desktop-navigation"]');
    const actions = [...(navigation?.querySelectorAll(".MuiBottomNavigationAction-root") ?? [])];
    return {
      navigationDisplay: navigation ? getComputedStyle(navigation).display : "missing",
      desktopDisplay: desktop ? getComputedStyle(desktop).display : "missing",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      actions: actions.map((action) => {
        const label = action.querySelector(".MuiBottomNavigationAction-label");
        const icon = action.querySelector("svg");
        const style = label ? getComputedStyle(label) : null;
        return {
          text: label?.textContent?.trim() ?? "",
          selected: action.classList.contains("Mui-selected"),
          width: action.getBoundingClientRect().width,
          whiteSpace: style?.whiteSpace,
          fontSize: style?.fontSize,
          labelHeight: label?.getBoundingClientRect().height ?? 0,
          lineHeight: style ? Number.parseFloat(style.lineHeight) : 0,
          clipped: label ? label.scrollWidth > label.clientWidth + 1 : true,
          iconSize: icon?.getBoundingClientRect().width ?? 0,
        };
      }),
    };
  });
  assert(result.navigationDisplay !== "none" && result.navigationDisplay !== "missing", `Mobile navigation hidden at ${width}px`);
  assert(result.desktopDisplay === "none", `Desktop navigation visible at ${width}px`);
  assert(result.overflow <= 1, `Page has ${result.overflow}px horizontal overflow at ${width}px`);
  assert(result.actions.length === 5, `Expected five actions at ${width}px`);
  assert(result.actions.map((item) => item.text).join("|") === tabs.map((item) => item.label).join("|"), `Unexpected labels at ${width}px`);
  const widths = result.actions.map((item) => item.width);
  assert(Math.max(...widths) - Math.min(...widths) <= 1, `Navigation actions are not equal width at ${width}px`);
  assert(result.actions.every((item) => item.whiteSpace === "nowrap" && !item.clipped && item.labelHeight <= item.lineHeight + 1), `A navigation label wraps or clips at ${width}px`);
  assert(new Set(result.actions.map((item) => item.fontSize)).size === 1, `Selected label changes font size at ${width}px`);
  assert(result.actions.every((item) => item.iconSize >= 19 && item.iconSize <= 21), `Navigation icon outside 19–21px at ${width}px`);
  const selected = result.actions.filter((item) => item.selected);
  assert(selected.length === 1 && selected[0].text === expectedLabel, `${expectedLabel} is not the sole selected tab at ${width}px`);
}

async function waitForSelectedLabel(page, containerTestId, label, itemClass) {
  await page.waitForFunction(({ containerTestId: testId, expected, itemClass: className }) => {
    const items = [...(document.querySelector(`[data-testid="${testId}"]`)?.querySelectorAll(className) ?? [])];
    return items.some((item) => item.classList.contains("Mui-selected") && item.textContent?.trim() === expected);
  }, { containerTestId, expected: label, itemClass });
}

try {
  fs.mkdirSync(artifactDir, { recursive: true });
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));

  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();

  for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 852 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Lớp học tiếng Anh cô Vy" }).waitFor();
    await page.screenshot({ path: path.join(artifactDir, `login-${viewport.width}x${viewport.height}.png`), fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Tên đăng nhập").fill(testEnv.BOOTSTRAP_ADMIN_USERNAME);
  await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();
  await page.getByRole("heading", { level: 1, name: "Xin chào, cô Vy 👋" }).waitFor();

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="mobile-navigation"]').waitFor({ state: "visible" });
    for (const tab of tabs) {
      if (new URL(page.url()).pathname !== tab.path) {
        await page.getByRole("button", { name: tab.label, exact: true }).click();
        await page.waitForURL(`${origin}${tab.path}`);
      }
      await waitForSelectedLabel(page, "mobile-navigation", tab.label, ".MuiBottomNavigationAction-root");
      await inspectMobileNavigation(page, viewport.width, tab.label);
      if (tab.label === "Học phí") {
        const tuitionTabsFit = await page.locator('[aria-label="Trạng thái học phí"] .MuiTab-root').evaluateAll((items) =>
          items.every((item) => item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1));
        assert(tuitionTabsFit, `A tuition status tab clips at ${viewport.width}px`);
      }
      if ([390, 393, 412].includes(viewport.width)) {
        await page.mouse.move(viewport.width - 12, 80);
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(artifactDir, `${tab.slug}-${viewport.width}x${viewport.height}.png`), fullPage: false });
      }
    }

    await page.goto(`${origin}/admin/lessons/new`, { waitUntil: "networkidle" });
    const sticky = await page.locator('[data-testid="sticky-action-bar"]').boundingBox();
    const navigation = await page.locator('[data-testid="mobile-navigation"]').boundingBox();
    assert(Boolean(sticky) && Boolean(navigation) && sticky.y + sticky.height <= navigation.y + 1, `Sticky action overlaps navigation at ${viewport.width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/admin`);
  for (const action of [
    { label: "Ghi nhận buổi học", path: "/admin/lessons/new" },
    { label: "Buổi học bù", path: "/admin/lessons/new?type=MAKEUP" },
    { label: "Thêm lịch bận", path: "/admin/busy-slots/new" },
  ]) {
    await page.goto(`${origin}/admin`);
    await page.getByRole("link", { name: action.label, exact: true }).click();
    await page.waitForURL(`${origin}${action.path}`);
  }

  await page.goto(`${origin}/admin/students`, { waitUntil: "networkidle" });
  const firstStudent = page.locator('[data-testid="student-card-grid"] a').first();
  await firstStudent.waitFor();
  const studentName = (await firstStudent.locator(".MuiTypography-subtitle1").textContent())?.trim();
  assert(Boolean(studentName), "Student card has no name");
  await firstStudent.click();
  await page.waitForURL(new RegExp(`${origin}/admin/students/\\d+$`));

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    storageState: await context.storageState(),
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  await desktopPage.locator('[data-testid="desktop-navigation"]').waitFor({ state: "attached" });
  for (const tab of tabs) {
    if (new URL(desktopPage.url()).pathname !== tab.path) {
      await desktopPage.locator('[data-testid="desktop-navigation"] .MuiListItemButton-root', { hasText: tab.label }).click();
      await desktopPage.waitForURL(`${origin}${tab.path}`);
    }
    await waitForSelectedLabel(desktopPage, "desktop-navigation", tab.label, ".MuiListItemButton-root");
    await desktopPage.locator('[data-testid="mobile-navigation"]').waitFor({ state: "attached" });
    const shell = await desktopPage.evaluate(() => ({
      innerWidth: window.innerWidth,
      desktopMedia: window.matchMedia("(min-width: 768px)").matches,
      mobile: getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display,
      desktop: getComputedStyle(document.querySelector('[data-testid="desktop-navigation"]')).display,
      brand: document.body.innerText.includes("Lớp học cô Vy"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert(shell.mobile === "none" && shell.desktop !== "none", `Wrong desktop navigation visibility on ${tab.label}: ${JSON.stringify(shell)}`);
    assert(shell.brand && shell.overflow <= 1, `Desktop brand/overflow failure on ${tab.label}`);
    const desktopAction = desktopPage.locator('[data-testid="desktop-navigation"] .MuiListItemButton-root', { hasText: tab.label });
    assert((await desktopAction.getAttribute("class"))?.includes("Mui-selected"), `Desktop ${tab.label} is not selected`);
    await desktopPage.mouse.move(1000, 40);
    await desktopPage.waitForTimeout(600);
    await desktopPage.screenshot({ path: path.join(artifactDir, `${tab.slug}-1440x900.png`), fullPage: false });
  }

  assert(await desktopPage.locator('[data-testid="student-navigation-icon"]').count() >= 1, "Student navigation does not render the person icon");
  await desktopContext.close();
  console.log(`V11C mobile-navigation E2E passed at all seven target viewports; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    try { child.kill(); } catch { /* already stopped */ }
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
}
