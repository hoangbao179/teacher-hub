/* global process, fetch, setTimeout, document, localStorage, window */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const origin = "http://127.0.0.1:5191";
const screenshotDir = path.join(root, "screenshots");
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
let web;
let browser;

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function todayInHoChiMinh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function weekStart(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return addDays(date, 1 - weekday);
}

function shortDate(date) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalScroll(page, viewport) {
  await page.setViewportSize(viewport);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Horizontal overflow at ${viewport.width}x${viewport.height}: ${overflow}px`);
}

function weekPayload(from, populatedWeek) {
  const lessons = from === populatedWeek
    ? Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      sourceKey: null,
      classId: (index % 3) + 1,
      className: ["Tiếng Anh 3", "Tiếng Anh 6", "Tiếng Anh 9"][index % 3],
      date: addDays(from, index % 6),
      startTime: `${String(8 + (index % 5) * 2).padStart(2, "0")}:00`,
      endTime: `${String(9 + (index % 5) * 2).padStart(2, "0")}:00`,
      status: index % 2 ? "DRAFT" : "COMPLETED",
      lessonType: index % 3 === 1 ? "MAKEUP" : "REGULAR",
    }))
    : [];
  return {
    data: {
      from,
      to: addDays(from, 6),
      occurrences: [],
      lessons,
      busyOccurrences: [],
      classSchedules: [],
      busySlots: [],
    },
  };
}

try {
  fs.mkdirSync(screenshotDir, { recursive: true });
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  web = spawn(
    process.execPath,
    [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5191", "--strictPort"],
    { cwd: clientRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  web.stdout.on("data", (chunk) => process.stdout.write(chunk));
  web.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const currentWeek = weekStart(todayInHoChiMinh());
  const populatedWeek = addDays(currentWeek, -7);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("teacher-token", "calendar-ui-smoke-token"));
  await context.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { id: 1, username: "covy", displayName: "Cô Vy", role: "TEACHER" } }),
  }));
  await context.route("**/api/schedule/week?from=*", (route) => {
    const from = new URL(route.request().url()).searchParams.get("from");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(weekPayload(from, populatedWeek)),
    });
  });
  const page = await context.newPage();
  await page.goto(`${origin}/admin/calendar`, { waitUntil: "networkidle" });

  await page.getByRole("heading", { level: 1, name: "Lịch tuần" }).waitFor();
  await page.getByText("Tuần này", { exact: true }).waitFor();
  await page.getByTestId("week-date-range").getByText(`${shortDate(currentWeek)} – ${shortDate(addDays(currentWeek, 6))}`, { exact: true }).waitFor();
  assert(await page.getByLabel("Tuần bắt đầu").getAttribute("type") === "date", "Week range no longer exposes the native date picker");
  await page.getByRole("heading", { name: "Lịch dự kiến tuần này" }).waitFor();
  await page.getByText("0 buổi", { exact: true }).waitFor();
  await page.getByText("Tuần này chưa có lịch dự kiến", { exact: true }).waitFor();

  const currentHref = await page.getByRole("link", { name: "Ghi nhận buổi học", exact: true }).getAttribute("href");
  const makeupHref = await page.getByRole("link", { name: "Buổi học bù", exact: true }).getAttribute("href");
  const reconciliationHref = await page.getByRole("link", { name: "Kiểm tra lịch tuần", exact: true }).getAttribute("href");
  assert(currentHref === `/admin/lessons/new?date=${currentWeek}`, `Primary action changed: ${currentHref}`);
  assert(makeupHref === `/admin/lessons/new?type=MAKEUP&date=${currentWeek}`, `Makeup action changed: ${makeupHref}`);
  assert(reconciliationHref === `/admin/reconciliation?from=${currentWeek}&to=${addDays(currentWeek, 6)}&state=ALL`, `Reconciliation action changed: ${reconciliationHref}`);

  await page.getByTestId("weekly-calendar-empty-state").getByRole("button", { name: "Thêm lịch", exact: true }).click();
  await page.getByRole("menuitem", { name: "Lịch dạy tại trường/trung tâm" }).waitFor();
  await page.getByRole("menuitem", { name: "Lịch bận cá nhân" }).waitFor();
  await page.keyboard.press("Escape");
  await page.mouse.click(2, 2);
  await page.screenshot({ path: path.join(screenshotDir, "calendar-mobile-empty-390x844.png") });

  await page.getByLabel("Tuần trước").click();
  await page.getByRole("button", { name: "Về tuần hiện tại" }).waitFor();
  await page.getByRole("heading", { name: "Lịch dự kiến", exact: true }).waitFor();
  await page.getByText("10 buổi", { exact: true }).waitFor();
  assert(await page.getByTestId("calendar-event").count() === 10, "Rendered event count and badge diverged");
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
    await assertNoHorizontalScroll(page, viewport);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const navBefore = await page.getByTestId("mobile-navigation-shell").boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const navAfter = await page.getByTestId("mobile-navigation-shell").boundingBox();
  assert(navBefore && navAfter && Math.abs(navBefore.y - navAfter.y) <= 1, `Bottom navigation moved while scrolling: ${JSON.stringify({ navBefore, navAfter })}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(screenshotDir, "calendar-mobile-390x844.png") });

  await page.getByLabel("Tuần sau").click();
  await page.getByText("Tuần này", { exact: true }).waitFor();
  await page.getByLabel("Tuần sau").click();
  await page.getByText("Tuần đang xem chưa có lịch dự kiến", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Về tuần hiện tại" }).click();
  await page.getByText("Tuần này", { exact: true }).waitFor();

  const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
  await loginPage.getByText("Không sử dụng trên thiết bị dùng chung.", { exact: true }).waitFor();
  await assertNoHorizontalScroll(loginPage, { width: 360, height: 800 });
  await assertNoHorizontalScroll(loginPage, { width: 390, height: 844 });
  await loginPage.screenshot({ path: path.join(screenshotDir, "login-mobile-390x844.png") });
  await loginContext.close();
  await context.close();
  process.stdout.write(`Calendar/login mobile UI smoke PASS. Screenshots: ${screenshotDir}\n`);
} finally {
  if (browser) await browser.close();
  if (web && !web.killed) web.kill();
}
