/* global process, fetch, setTimeout, console, document, getComputedStyle, navigator, URL, window */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "mobile-navigation", {});
let artifactRunPassed = false;
dotenv.config({ path: path.join(root, "server/.env") });
const apiPort = 4109;
const webPort = 5189;
const origin = `http://127.0.0.1:${webPort}`;
const artifactDir = artifactPolicy.runDir;
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "mobile-navigation-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: "mobile-nav-e2e-password-123",
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
const navigationRegressionViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];
const samsungUserAgent = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const stabilityFrameCount = 20;
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
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const executable = command === "npm" && process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command === "npm" ? npmCommand : command;
  const commandArgs = command === "npm" && process.platform === "win32" ? ["/d", "/s", "/c", npmCommand, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
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

async function inspectNavigationGeometry(page, frameCount = 1) {
  const samples = await page.evaluate(async (frames) => {
    function inspect() {
    const shell = document.querySelector('[data-testid="mobile-navigation-shell"]');
    const navigation = document.querySelector('[data-testid="mobile-navigation"]');
    const spacer = document.querySelector('[data-testid="mobile-navigation-safe-area"]');
    const root = document.querySelector('[data-testid="admin-layout"]');
    if (!shell || !navigation || !spacer || !root) throw new Error("Mobile navigation geometry target is missing");
    const shellRect = shell.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    const spacerRect = spacer.getBoundingClientRect();
    const shellStyle = getComputedStyle(shell);
    const navigationStyle = getComputedStyle(navigation);
    const spacerStyle = getComputedStyle(spacer);
    const rootStyle = getComputedStyle(root);
    const actions = [...navigation.querySelectorAll(".MuiBottomNavigationAction-root")].map((action) => {
      const actionRect = action.getBoundingClientRect();
      const iconRect = action.querySelector("svg")?.getBoundingClientRect();
      const labelRect = action.querySelector(".MuiBottomNavigationAction-label")?.getBoundingClientRect();
      const style = getComputedStyle(action);
      return {
        top: actionRect.top,
        bottom: actionRect.bottom,
        height: actionRect.height,
        iconTop: iconRect?.top ?? 0,
        iconBottom: iconRect?.bottom ?? 0,
        labelTop: labelRect?.top ?? 0,
        labelBottom: labelRect?.bottom ?? 0,
        transitionDuration: style.transitionDuration,
      };
    });
    const shellAlphaMatch = shellStyle.backgroundColor.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/);
    const navigationAlphaMatch = navigationStyle.backgroundColor.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/);
    const spacerAlphaMatch = spacerStyle.backgroundColor.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/);
    return {
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      userAgent: navigator.userAgent,
      safeBottom: Number.parseFloat(rootStyle.getPropertyValue("--admin-safe-bottom")) || 0,
      shell: {
        top: shellRect.top,
        bottom: shellRect.bottom,
        height: shellRect.height,
        backgroundColor: shellStyle.backgroundColor,
        backgroundAlpha: shellAlphaMatch?.[1] == null ? 1 : Number.parseFloat(shellAlphaMatch[1]),
        boxSizing: shellStyle.boxSizing,
        transitionDuration: shellStyle.transitionDuration,
      },
      navigation: {
        top: navigationRect.top,
        bottom: navigationRect.bottom,
        height: navigationRect.height,
        paddingBottom: Number.parseFloat(navigationStyle.paddingBottom),
        backgroundColor: navigationStyle.backgroundColor,
        backgroundAlpha: navigationAlphaMatch?.[1] == null ? 1 : Number.parseFloat(navigationAlphaMatch[1]),
        boxSizing: navigationStyle.boxSizing,
        transitionDuration: navigationStyle.transitionDuration,
      },
      spacer: {
        height: spacerRect.height,
        backgroundColor: spacerStyle.backgroundColor,
        backgroundAlpha: spacerAlphaMatch?.[1] == null ? 1 : Number.parseFloat(spacerAlphaMatch[1]),
      },
      rootPaddingBottom: Number.parseFloat(rootStyle.paddingBottom),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      runningAnimations: [shell, navigation, ...navigation.querySelectorAll(".MuiBottomNavigationAction-root")]
        .flatMap((element) => element.getAnimations())
        .filter((animation) => animation.playState === "running").length,
      actions,
    };
    }
    const results = [];
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      results.push(inspect());
    }
    return results;
  }, frameCount);
  return frameCount === 1 ? samples[0] : samples;
}

function assertNavigationGeometry(geometry, width, expectedSafeBottom = 0) {
  const expectedShellHeight = 64 + expectedSafeBottom;
  const actionAreaBottom = geometry.navigation.top + 64;
  assert(Math.abs(geometry.safeBottom - expectedSafeBottom) <= 1, `Safe bottom is ${geometry.safeBottom}px instead of ${expectedSafeBottom}px at ${width}px`);
  assert(Math.abs(geometry.shell.height - expectedShellHeight) <= 1, `Navigation shell height is ${geometry.shell.height}px instead of ${expectedShellHeight}px at ${width}px`);
  assert(Math.abs(geometry.navigation.height - 64) <= 1, `Action area height is ${geometry.navigation.height}px instead of 64px at ${width}px`);
  assert(Math.abs(geometry.spacer.height - expectedSafeBottom) <= 1, `Safe-area spacer is ${geometry.spacer.height}px instead of ${expectedSafeBottom}px at ${width}px`);
  assert(Math.abs(geometry.navigation.paddingBottom) <= 1, `Action area has ${geometry.navigation.paddingBottom}px bottom padding at ${width}px`);
  assert(geometry.shell.boxSizing === "border-box", `Navigation shell does not use border-box at ${width}px`);
  assert(geometry.navigation.boxSizing === "border-box", `Navigation does not use border-box at ${width}px`);
  assert(Math.abs(geometry.shell.bottom - geometry.viewportHeight) <= 1, `Navigation shell is not fixed to the viewport bottom at ${width}px`);
  assert(geometry.rootPaddingBottom >= expectedShellHeight + 15 && geometry.rootPaddingBottom <= expectedShellHeight + 17, `Content reserve is not synchronized at ${width}px`);
  assert(geometry.shell.backgroundAlpha === 1 && geometry.shell.backgroundColor === "rgb(255, 255, 255)", `Navigation background is not opaque white at ${width}px`);
  assert(geometry.navigation.backgroundAlpha === 1 && geometry.navigation.backgroundColor === "rgb(255, 255, 255)", `Action area background is not opaque white at ${width}px`);
  assert(geometry.spacer.backgroundAlpha === 1 && geometry.spacer.backgroundColor === "rgb(255, 255, 255)", `Safe-area background is not opaque white at ${width}px`);
  assert(geometry.shell.transitionDuration === "0s" && geometry.navigation.transitionDuration === "0s" && geometry.actions.every((action) => action.transitionDuration === "0s"), `Navigation has an active CSS transition at ${width}px`);
  assert(geometry.runningAnimations === 0, `Navigation has ${geometry.runningAnimations} running animations at ${width}px`);
  assert(geometry.overflow <= 1, `Page has ${geometry.overflow}px horizontal overflow at ${width}px`);
  assert(geometry.actions.length === 5, `Expected five navigation actions at ${width}px`);
  assert(geometry.actions.every((action) => Math.abs(action.height - 64) <= 1), `An action is not 64px high at ${width}px`);
  assert(geometry.actions.every((action) => action.top >= geometry.navigation.top - 1 && action.bottom <= actionAreaBottom + 1), `An action stretches into the safe area at ${width}px`);
  assert(geometry.actions.every((action) => action.iconTop >= geometry.navigation.top - 1 && action.iconBottom <= actionAreaBottom + 1 && action.labelTop >= geometry.navigation.top - 1 && action.labelBottom <= actionAreaBottom + 1), `An icon or label leaves the 64px action area at ${width}px`);
}

function assertActionPositionsUnchanged(before, after, description) {
  assert(before.actions.length === after.actions.length, `Action count changed ${description}`);
  before.actions.forEach((action, index) => {
      const next = after.actions[index];
      for (const key of ["iconTop", "iconBottom", "labelTop", "labelBottom"]) {
        const beforeOffset = action[key] - before.navigation.top;
      const afterOffset = next[key] - after.navigation.top;
      assert(Math.abs(beforeOffset - afterOffset) <= 1, `Action ${index + 1} ${key} moved ${description}`);
    }
  });
}

function assertStableFrames(reference, samples, width, description, expectedSafeBottom = 0) {
  assert(samples.length === stabilityFrameCount, `Expected ${stabilityFrameCount} frames ${description}`);
  const firstSample = samples[0];
  for (const sample of samples) {
    assertNavigationGeometry(sample, width, expectedSafeBottom);
    assertActionPositionsUnchanged(reference, sample, description);
    assert(Math.abs(sample.shell.height - firstSample.shell.height) <= 1, `Shell height changed ${description}`);
    assert(Math.abs(sample.shell.bottom - sample.viewportHeight) <= 1, `Shell bottom detached ${description}`);
    assert(sample.navigation.paddingBottom === reference.navigation.paddingBottom, `Navigation padding changed ${description}`);
    assert(sample.shell.backgroundColor === reference.shell.backgroundColor, `Navigation background changed ${description}`);
  }
}

try {
  fs.mkdirSync(artifactDir, { recursive: true });
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:reset:dev"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));

  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"));
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(webPort)], path.join(root, "client"));
  await waitUrl(`http://127.0.0.1:${apiPort}/health`);
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: samsungUserAgent,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 852 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Chào mừng cô Vy trở lại" }).waitFor();
    await page.screenshot({ path: path.join(artifactDir, `login-${viewport.width}x${viewport.height}.png`), fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill(testEnv.BOOTSTRAP_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin`);
  await page.locator('[data-testid="dashboard-page"]').waitFor();
  await page.getByRole("heading", { level: 1, name: "Xin chào, cô Vy 👋" }).waitFor();

  await page.getByTestId("account-menu-button").click();
  for (const label of ["Kho từ vựng", "Bài tập từ vựng", "Tài khoản", "Đăng xuất"]) {
    assert(await page.getByRole("menuitem", { name: label, exact: true }).isVisible(), `Account menu is missing ${label}`);
  }
  const accountMenuItems = await page.getByRole("menuitem").allTextContents();
  assert(JSON.stringify(accountMenuItems) === JSON.stringify(["Tài khoản", "Kho từ vựng", "Bài tập từ vựng", "Đăng xuất"]), `Unexpected account menu order: ${accountMenuItems.join(" | ")}`);
  assert(await page.getByText("Công cụ học tập", { exact: true }).isVisible(), "Account menu is missing the learning-tools group");
  await page.waitForTimeout(250);
  if (artifactPolicy.mode === "review") await page.screenshot({ path: path.join(artifactDir, "account-menu-390x844.png"), fullPage: false });
  await page.getByRole("menuitem", { name: "Tài khoản", exact: true }).click();
  await page.waitForURL(`${origin}/admin/account`);
  const accountPage = page.getByTestId("account-page");
  await accountPage.getByRole("heading", { level: 1, name: "Tài khoản" }).waitFor();
  await accountPage.getByText("Cô Vy", { exact: true }).waitFor();
  await accountPage.getByText("Tên đăng nhập: covy", { exact: true }).waitFor();
  await accountPage.getByText("Đang đăng nhập", { exact: true }).waitFor();
  await accountPage.getByRole("button", { name: "Đăng xuất", exact: true }).waitFor();
  await accountPage.getByText("Cài đặt tài khoản đang được hoàn thiện", { exact: true }).waitFor();
  const accountText = await accountPage.innerText();
  assert(!accountText.includes("Bản xem trước") && !accountText.includes("Sắp mở") && !accountText.includes("ẩn khỏi điều hướng"), "Account page still exposes prototype copy");
  assert(await page.locator('[data-testid="mobile-navigation"] .MuiBottomNavigationAction-root').count() === 5, "Account route changed the five-item mobile navigation");
  await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });

  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
    await page.getByTestId("admin-layout").waitFor();
    const shell = await page.evaluate(() => ({
      mobile: document.querySelector('[data-testid="mobile-navigation"]') ? getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display : "missing",
      desktop: document.querySelector('[data-testid="desktop-navigation"]') ? getComputedStyle(document.querySelector('[data-testid="desktop-navigation"]')).display : "missing",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert(shell.mobile !== "none" && shell.desktop === "none" && shell.overflow <= 1, `Tablet navigation breakpoint failed at ${viewport.width}px: ${JSON.stringify(shell)}`);
    if (artifactPolicy.mode === "review" && viewport.width === 1024) await page.screenshot({ path: path.join(artifactDir, "today-1024x768.png"), fullPage: false });
  }

  for (const viewport of navigationRegressionViewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="mobile-navigation"]').waitFor({ state: "visible" });

    const atTop = await inspectNavigationGeometry(page);
    assert(atTop.scrollY === 0, `Dashboard did not open at scrollY=0 at ${viewport.width}px`);
    assert(atTop.userAgent === samsungUserAgent, `Samsung-like user agent is missing at ${viewport.width}px`);
    assertNavigationGeometry(atTop, viewport.width);
    if (viewport.width === 390) {
      await page.screenshot({ path: path.join(artifactDir, "android-top.png"), fullPage: false });
    }

    await page.locator('[data-testid="admin-content"]').evaluate((content) => {
      const currentPadding = Number.parseFloat(getComputedStyle(content).paddingBottom);
      content.style.paddingBottom = `${currentPadding + 400}px`;
    });
    const scrollRange = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    assert(scrollRange >= 400, `Scroll harness did not create enough range at ${viewport.width}px`);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    const scrollStops = [
      { name: "down", top: 300 },
      { name: "top", top: 0 },
      { name: "bottom", top: scrollRange },
      { name: "middle", top: Math.floor(scrollRange / 2) },
    ];
    for (let iteration = 0; iteration < 10; iteration += 1) {
      for (const stop of scrollStops) {
        await page.evaluate((top) => window.scrollTo(0, top), stop.top);
        await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, Math.min(stop.top, scrollRange));
        const samples = await inspectNavigationGeometry(page, stabilityFrameCount);
        assertStableFrames(atTop, samples, viewport.width, `during ${stop.name}, iteration ${iteration + 1}, at ${viewport.width}px`);
        if (viewport.width === 390 && iteration === 0 && stop.name === "down") {
          await page.screenshot({ path: path.join(artifactDir, "android-scrolled.png"), fullPage: false });
        }
        if (viewport.width === 390 && iteration === 0 && stop.name === "top") {
          await page.screenshot({ path: path.join(artifactDir, "android-returned-top.png"), fullPage: false });
        }
      }
    }

    await page.locator('[data-testid="admin-content"]').evaluate((content) => {
      content.style.removeProperty("padding-bottom");
    });
    const naturalScrollRange = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction((top) => Math.abs(window.scrollY - top) <= 1, naturalScrollRange);
    const contentAtBottom = await page.evaluate(() => {
      const content = document.querySelector('[data-testid="admin-content"]')?.getBoundingClientRect();
      const shell = document.querySelector('[data-testid="mobile-navigation-shell"]')?.getBoundingClientRect();
      return { contentBottom: content?.bottom ?? 0, shellTop: shell?.top ?? 0 };
    });
    const contentGap = contentAtBottom.shellTop - contentAtBottom.contentBottom;
    assert(contentGap >= 15 && contentGap <= 25, `Final content gap is ${contentGap}px at ${viewport.width}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="mobile-navigation"]').waitFor({ state: "visible" });
  const beforeResize = await inspectNavigationGeometry(page);
  for (const height of [844, 760, 720, 800, 844]) {
    await page.setViewportSize({ width: 390, height });
    const resizeSamples = await inspectNavigationGeometry(page, stabilityFrameCount);
    assertStableFrames(beforeResize, resizeSamples, 390, `during resize to ${height}px`);
    if (height === 720) {
      await page.screenshot({ path: path.join(artifactDir, "android-resized.png"), fullPage: false });
    }
  }

  await page.locator('[data-testid="admin-layout"]').evaluate((layout) => {
    layout.style.setProperty("--admin-safe-bottom", "34px");
  });
  const iosSafeAreaFrames = await inspectNavigationGeometry(page, stabilityFrameCount);
  assertStableFrames(beforeResize, iosSafeAreaFrames, 390, "with a 34px iOS safe area", 34);
  await page.screenshot({ path: path.join(artifactDir, "ios-safe-area.png"), fullPage: false });
  await page.locator('[data-testid="admin-layout"]').evaluate((layout) => {
    layout.style.removeProperty("--admin-safe-bottom");
  });

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
    const navigationShell = await page.locator('[data-testid="mobile-navigation-shell"]').boundingBox();
    assert(Boolean(sticky) && Boolean(navigationShell) && sticky.y + sticky.height <= navigationShell.y + 1, `Sticky action overlaps navigation at ${viewport.width}px`);
    if (viewport.width === 390) {
      await page.locator('[data-testid="admin-layout"]').evaluate((layout) => {
        layout.style.setProperty("--admin-safe-bottom", "34px");
      });
      const safeGeometry = await inspectNavigationGeometry(page);
      const safeSticky = await page.locator('[data-testid="sticky-action-bar"]').boundingBox();
      const safeNavigation = await page.locator('[data-testid="mobile-navigation-shell"]').boundingBox();
      assertNavigationGeometry(safeGeometry, viewport.width, 34);
      assert(Boolean(safeSticky) && Boolean(safeNavigation) && safeSticky.y + safeSticky.height <= safeNavigation.y + 1, "Sticky action overlaps the simulated iOS safe area");
      await page.locator('[data-testid="admin-layout"]').evaluate((layout) => {
        layout.style.removeProperty("--admin-safe-bottom");
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/admin`);
  for (const action of [
    { label: "Buổi học ngoài lịch", path: "/admin/lessons/new" },
    { label: "Buổi học bù", path: "/admin/lessons/new?type=MAKEUP" },
    { label: "Thêm lịch dạy ngoài", path: "/admin/busy-slots/new?type=EXTERNAL_CLASS" },
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
  await desktopPage.setViewportSize({ width: 1200, height: 900 });
  const wideShell = await desktopPage.evaluate(() => ({
    mobile: getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display,
    desktop: getComputedStyle(document.querySelector('[data-testid="desktop-navigation"]')).display,
  }));
  assert(wideShell.mobile === "none" && wideShell.desktop !== "none", `Desktop navigation breakpoint failed at 1200px: ${JSON.stringify(wideShell)}`);
  assert(await desktopPage.locator('[data-testid="desktop-navigation"] .MuiListItemButton-root').count() === 5, "Desktop navigation does not contain exactly five primary items");
  const desktopNavText = await desktopPage.getByTestId("desktop-navigation").innerText();
  assert(!desktopNavText.includes("Kho từ vựng") && !desktopNavText.includes("Bài tập từ vựng") && !desktopNavText.includes("Tài khoản"), "Secondary routes leaked into desktop primary navigation");
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  for (const tab of tabs) {
    if (new URL(desktopPage.url()).pathname !== tab.path) {
      await desktopPage.locator('[data-testid="desktop-navigation"] .MuiListItemButton-root', { hasText: tab.label }).click();
      await desktopPage.waitForURL(`${origin}${tab.path}`);
    }
    await waitForSelectedLabel(desktopPage, "desktop-navigation", tab.label, ".MuiListItemButton-root");
    await desktopPage.locator('[data-testid="mobile-navigation"]').waitFor({ state: "attached" });
    const shell = await desktopPage.evaluate(() => ({
      innerWidth: window.innerWidth,
      desktopMedia: window.matchMedia("(min-width: 1200px)").matches,
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
  await desktopPage.getByTestId("account-menu-button").click();
  await desktopPage.getByRole("menuitem", { name: "Tài khoản", exact: true }).click();
  await desktopPage.waitForURL(`${origin}/admin/account`);
  await desktopPage.getByTestId("account-page").waitFor();
  assert(await desktopPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, "Account page overflows at desktop width");
  await desktopContext.close();
  console.log(`V11C mobile-navigation E2E passed at all seven target viewports; screenshots: ${artifactDir}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    try { child.kill(); } catch { /* already stopped */ }
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
}
