/* global process, fetch, setTimeout, localStorage, URL, window, Event, document, console */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const origin = "http://127.0.0.1:5192";
const artifactPolicy = createArtifactPolicy(root, "calendar-midnight", {});
let artifactRunPassed = false;
let browser;
let web;

const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const shortDate = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function waitUrl(url, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function occurrence(date, overrides = {}) {
  return {
    key: `class-1:${date}`,
    originalKey: `class-1:${date}`,
    occurrenceDate: date,
    originalOccurrenceDate: date,
    recurringScheduleId: 1,
    classId: 1,
    className: `Lớp ngày ${date}`,
    scheduledStartTime: "18:00",
    scheduledEndTime: "19:30",
    projectionSource: "RECURRING",
    state: "UNRECORDED",
    linkedLessonId: null,
    linkedLessonStatus: null,
    exceptionId: null,
    replacementDate: null,
    replacementStartTime: null,
    replacementEndTime: null,
    conflicts: [],
    skipReason: null,
    makeupRequired: false,
    replacementCancelled: false,
    combinedGroupId: null,
    combinedGroupName: null,
    memberClasses: [],
    combinedTeachingOccurrenceId: null,
    ...overrides,
  };
}

function weekPayload(from) {
  return { data: { from, to: addDays(from, 6), occurrences: [], lessons: [], busyOccurrences: [], classSchedules: [], busySlots: [] } };
}

function dashboardPayload(date, title) {
  const regularOccurrence = occurrence(date, {
    className: title,
    state: "RECORDED",
    linkedLessonId: 401,
    linkedLessonStatus: "DRAFT",
  });
  const undraftedCombined = occurrence(date, {
    key: `combined-undrafted:${date}`,
    classId: undefined,
    className: "Nhóm 3A + 3B",
    combinedGroupId: 21,
    combinedGroupName: "Nhóm 3A + 3B",
    memberClasses: [{ id: 1, name: "Lớp 3A" }, { id: 2, name: "Lớp 3B" }],
  });
  const draftedCombined = occurrence(date, {
    key: `combined-drafted:${date}`,
    classId: undefined,
    className: "Nhóm 6A + 6B",
    state: "RECORDED",
    linkedLessonId: 501,
    linkedLessonStatus: "DRAFT",
    combinedGroupId: 22,
    combinedGroupName: "Nhóm 6A + 6B",
    combinedTeachingOccurrenceId: 91,
    memberClasses: [{ id: 3, name: "Lớp 6A" }, { id: 4, name: "Lớp 6B" }],
  });
  return { data: {
    paymentDueCount: 0,
    totalUnpaidAmount: 0,
    accumulatingStudentCount: 0,
    paidCycleCount: 0,
    unrecordedCount: 1,
    outstandingMakeupStudentCount: 0,
    openIncompleteCycleCount: 0,
    recentUnrecordedSessions: [],
    todaySchedule: {
      from: date,
      to: date,
      occurrences: [regularOccurrence, undraftedCombined, draftedCombined],
      lessons: [
        { id: 401, sourceKey: regularOccurrence.key, classId: 1, className: title, date, startTime: "18:00", endTime: "19:30", status: "DRAFT", lessonType: "REGULAR" },
        { id: 501, sourceKey: draftedCombined.key, classId: 3, className: "Lớp 6A", date, startTime: "18:00", endTime: "19:30", status: "DRAFT", lessonType: "REGULAR" },
      ],
      busyOccurrences: [],
      classSchedules: [],
      busySlots: [],
    },
  } };
}

async function installCommonMocks(context, handlers = {}) {
  await context.addInitScript(() => localStorage.setItem("teacher-token", "midnight-e2e-token"));
  await context.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { id: 1, username: "covy", displayName: "Cô Vy", role: "TEACHER" } }),
  }));
  await context.route("**/api/classes", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
  await context.route("**/api/dashboard", handlers.dashboard ?? ((route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboardPayload("2026-08-05", "Lịch cũ")) })));
  await context.route("**/api/schedule/week?from=*", handlers.week ?? ((route) => {
    const from = new URL(route.request().url()).searchParams.get("from");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weekPayload(from)) });
  }));
  await context.route("**/api/schedule/occurrences?*", handlers.occurrences ?? ((route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("to");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [occurrence(date)] }) });
  }));
}

async function dashboardRolloverScenario() {
  let rolledOver = false;
  let requests = 0;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Ho_Chi_Minh" });
  await installCommonMocks(context, { dashboard: (route) => {
    requests += 1;
    const payload = rolledOver
      ? dashboardPayload("2026-08-06", "Lịch ngày mới")
      : dashboardPayload("2026-08-05", "Lịch ngày cũ");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  } });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-08-05T16:59:00.000Z") });
  await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("dashboard-page").getByText("Thứ Tư, 05/08", { exact: true }).waitFor();
  await page.getByText("Lịch ngày cũ", { exact: true }).waitFor();
  const initialRequests = requests;

  const undraftedHref = await page.getByTestId("dashboard-today-event").filter({ hasText: "Nhóm 3A + 3B" }).getByRole("link", { name: "Xem", exact: true }).getAttribute("href");
  const draftedHref = await page.getByTestId("dashboard-today-event").filter({ hasText: "Nhóm 6A + 6B" }).getByRole("link", { name: "Xem", exact: true }).getAttribute("href");
  assert(undraftedHref === "/admin/reconciliation?from=2026-08-05&to=2026-08-05&state=ALL", `Undrafted combined group link is wrong: ${undraftedHref}`);
  assert(draftedHref === "/admin/combined-class-groups/occurrences/91", `Drafted combined group link is wrong: ${draftedHref}`);
  await page.getByTestId("dashboard-today-event").filter({ hasText: "Lịch ngày cũ" }).getByRole("button", { name: "Tiếp tục ghi", exact: true }).waitFor();
  await page.getByTestId("dashboard-today-event").filter({ hasText: "Nhóm 6A + 6B" }).getByText("Ca học ghép", { exact: true }).waitFor();

  rolledOver = true;
  await page.clock.fastForward(62_000);
  await page.getByTestId("dashboard-page").getByText("Thứ Năm, 06/08", { exact: true }).waitFor();
  await page.getByText("Lịch ngày mới", { exact: true }).waitFor();
  assert(await page.getByText("Lịch ngày cũ", { exact: true }).count() === 0, "Dashboard mixed the old payload with the new date");
  assert(requests === initialRequests + 1, `Dashboard rollover caused duplicate requests: ${initialRequests} -> ${requests}`);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(50);
  assert(requests === initialRequests + 1, "Focus after rollover caused a duplicate dashboard request");
  await context.close();
}

async function calendarRolloverScenario(keepCustomWeek) {
  const weekRequests = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Ho_Chi_Minh" });
  await installCommonMocks(context, { week: (route) => {
    const from = new URL(route.request().url()).searchParams.get("from");
    weekRequests.push(from);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weekPayload(from)) });
  } });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-08-02T16:59:00.000Z") });
  await page.goto(`${origin}/admin/calendar`, { waitUntil: "networkidle" });
  const sundayWeek = "2026-07-27";
  const mondayWeek = "2026-08-03";
  await page.getByTestId("week-date-range").getByText(`${shortDate(sundayWeek)} – ${shortDate(addDays(sundayWeek, 6))}`, { exact: true }).waitFor();
  if (keepCustomWeek) {
    await page.getByLabel("Tuần trước").click();
    await page.getByTestId("week-date-range").getByText("20/07 – 26/07", { exact: true }).waitFor();
  }
  await page.clock.fastForward(62_000);
  if (keepCustomWeek) {
    await page.getByTestId("week-date-range").getByText("20/07 – 26/07", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Về tuần hiện tại" }).click();
  }
  await page.getByTestId("week-date-range").getByText(`${shortDate(mondayWeek)} – ${shortDate(addDays(mondayWeek, 6))}`, { exact: true }).waitFor();
  await page.getByText("Tuần này", { exact: true }).waitFor();
  assert(weekRequests.at(-1) === mondayWeek, `Calendar requested the wrong rollover week: ${weekRequests.join(", ")}`);
  await page.getByTestId("calendar-quick-actions").getByRole("button", { name: "Thêm", exact: true }).click();
  assert(await page.getByRole("menuitem", { name: "Buổi học ngoài lịch / ghi thủ công", exact: true }).getAttribute("href") === `/admin/lessons/new?date=${mondayWeek}`, "Manual calendar action kept the old week");
  assert(await page.getByRole("menuitem", { name: "Buổi học bù", exact: true }).getAttribute("href") === `/admin/lessons/new?type=MAKEUP&date=${mondayWeek}`, "Makeup action kept the old week");
  await page.keyboard.press("Escape");
  assert(await page.getByRole("link", { name: "Kiểm tra lịch tuần", exact: true }).getAttribute("href") === `/admin/reconciliation?from=${mondayWeek}&to=${addDays(mondayWeek, 6)}&state=ALL`, "Reconciliation action kept the old week");
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `Calendar overflowed horizontally at ${viewport.width}px by ${overflow}px`);
  }
  await context.close();
}

async function reconciliationRolloverScenario(customRange) {
  const occurrenceRequests = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Ho_Chi_Minh" });
  await installCommonMocks(context, { occurrences: (route) => {
    const url = new URL(route.request().url());
    const query = { from: url.searchParams.get("from"), to: url.searchParams.get("to") };
    occurrenceRequests.push(query);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [occurrence(query.to)] }) });
  } });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-08-02T16:59:00.000Z") });
  await page.goto(`${origin}/admin/reconciliation`, { waitUntil: "networkidle" });
  await page.getByTestId("occurrence-card").waitFor();
  if (customRange) {
    await page.getByRole("button", { name: /Bộ lọc/ }).click();
    const filterSheet = page.getByTestId("reconciliation-filter-sheet");
    await filterSheet.getByLabel("Từ ngày").fill("2026-07-01");
    await filterSheet.getByLabel("Đến ngày").fill("2026-07-15");
    await filterSheet.getByRole("button", { name: "Áp dụng" }).click();
    await page.getByTestId("reconciliation-filter-summary").getByText("01/07–15/07", { exact: true }).waitFor();
  }
  await page.clock.fastForward(62_000);
  const expected = customRange ? { from: "2026-07-01", to: "2026-07-15" } : { from: "2026-07-20", to: "2026-08-03" };
  await page.getByTestId("reconciliation-filter-summary").getByText(`${shortDate(expected.from)}–${shortDate(expected.to)}`, { exact: true }).waitFor();
  const latest = occurrenceRequests.at(-1);
  assert(latest?.from === expected.from && latest?.to === expected.to, `Reconciliation rollover range is wrong: ${JSON.stringify(occurrenceRequests)}`);
  await page.getByRole("button", { name: "Đổi lịch" }).click();
  assert(await page.getByLabel("Ngày thay thế").inputValue() === expected.to, "Reschedule dialog retained a stale replacement date");
  await context.close();
}

async function errorBoundaryScenario() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installCommonMocks(context);
  await context.route("**/src/pages/DashboardPage.tsx*", (route) => route.abort("failed"));
  const page = await context.newPage();
  await page.goto(`${origin}/admin`);
  await page.getByTestId("app-error-fallback").waitFor();
  await page.getByRole("heading", { name: "Trang này đang gặp sự cố" }).waitFor();
  await page.getByRole("button", { name: "Tải lại trang" }).waitFor();
  assert(await page.getByRole("link", { name: "Về trang quản trị" }).getAttribute("href") === "/admin", "Error fallback home link is unsafe");
  assert(await page.getByText(/stack|token|request body/i).count() === 0, "Error fallback exposed technical or sensitive details");
  await context.close();
}

try {
  web = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5192", "--strictPort"], { cwd: clientRoot, stdio: ["ignore", "pipe", "pipe"] });
  web.stdout.on("data", (chunk) => process.stdout.write(chunk));
  web.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);
  const configuredChrome = process.env.CHROME_PATH;
  browser = await chromium.launch({ headless: true, executablePath: configuredChrome && fs.existsSync(configuredChrome) ? configuredChrome : undefined });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  await dashboardRolloverScenario();
  await calendarRolloverScenario(false);
  await calendarRolloverScenario(true);
  await reconciliationRolloverScenario(false);
  await reconciliationRolloverScenario(true);
  await errorBoundaryScenario();
  console.log("Calendar midnight, combined navigation, and global error fallback regression passed.");
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  await browser?.close();
  web?.kill();
}
