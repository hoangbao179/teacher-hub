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

function reconciliationPayload(from, classId, state) {
  const definitions = [
    { classId: 1, className: "Lớp 3A", state: "UNRECORDED", conflictCount: 1 },
    { classId: 2, className: "Lớp 6B", state: "UNRECORDED", conflictCount: 2 },
    { classId: 1, className: "Lớp 3A", state: "RECORDED", conflictCount: 0 },
    { classId: 2, className: "Lớp 6B", state: "SKIPPED", conflictCount: 0 },
    { classId: 1, className: "Lớp 3A", state: "UNRECORDED", conflictCount: 0 },
    { classId: 2, className: "Lớp 6B", state: "RECORDED", conflictCount: 0 },
  ];
  return definitions.map((item, index) => {
    const date = addDays(from, index % 5);
    const startHour = 8 + index * 2;
    return {
      key: `occurrence-${index}-${date}`,
      originalKey: `occurrence-${index}-${date}`,
      occurrenceDate: date,
      originalOccurrenceDate: date,
      recurringScheduleId: index + 1,
      classId: item.classId,
      className: item.className,
      scheduledStartTime: `${String(startHour).padStart(2, "0")}:00`,
      scheduledEndTime: `${String(startHour + 1).padStart(2, "0")}:00`,
      projectionSource: "RECURRING",
      state: item.state,
      linkedLessonId: item.state === "RECORDED" ? 100 + index : null,
      linkedLessonStatus: item.state === "RECORDED" ? "COMPLETED" : null,
      exceptionId: item.state === "SKIPPED" ? 200 + index : null,
      replacementDate: null,
      replacementStartTime: null,
      replacementEndTime: null,
      conflicts: Array.from({ length: item.conflictCount }, (_, conflictIndex) => ({
        kind: "PROJECTED_OCCURRENCE",
        id: null,
        occurrenceKey: `conflict-${index}-${conflictIndex}`,
        title: `Lớp trùng ${conflictIndex + 1}`,
        date,
        startTime: `${String(startHour).padStart(2, "0")}:30`,
        endTime: `${String(startHour + 1).padStart(2, "0")}:30`,
      })),
      skipReason: item.state === "SKIPPED" ? "Nghỉ theo kế hoạch" : null,
      makeupRequired: item.state === "SKIPPED",
      replacementCancelled: false,
    };
  }).filter((item) => (!classId || item.classId === classId) && (!state || item.state === state));
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
  const occurrenceRequests = [];
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
  await context.route("**/api/classes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [
      { id: 1, name: "Lớp 3A", type: "GROUP", subject: "Tiếng Anh", status: "ACTIVE", defaultPackagePrice: 800000, defaultDurationMinutes: 60, activeStudentCount: 3, paymentDueCount: 0 },
      { id: 2, name: "Lớp 6B", type: "GROUP", subject: "Tiếng Anh", status: "ACTIVE", defaultPackagePrice: 900000, defaultDurationMinutes: 90, activeStudentCount: 4, paymentDueCount: 0 },
    ] }),
  }));
  await context.route("**/api/schedule/occurrences?*", (route) => {
    const url = new URL(route.request().url());
    const query = {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      classId: Number(url.searchParams.get("classId") ?? 0),
      state: url.searchParams.get("state"),
    };
    occurrenceRequests.push(query);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: reconciliationPayload(query.from, query.classId, query.state) }),
    });
  });
  const page = await context.newPage();
  await page.goto(`${origin}/admin/calendar`, { waitUntil: "networkidle" });

  await page.getByRole("heading", { level: 1, name: "Lịch tuần" }).waitFor();
  await page.getByText("Tuần này", { exact: true }).waitFor();
  await page.getByTestId("week-date-range").getByText(`${shortDate(currentWeek)} – ${shortDate(addDays(currentWeek, 6))}`, { exact: true }).waitFor();
  assert(await page.getByLabel("Tuần bắt đầu").getAttribute("type") === "date", "Week range no longer exposes the native date picker");
  const [previousWeekBox, weekRangeBox, nextWeekBox] = await Promise.all([
    page.getByLabel("Tuần trước").boundingBox(),
    page.getByTestId("week-range-control").boundingBox(),
    page.getByLabel("Tuần sau").boundingBox(),
  ]);
  const leftGap = previousWeekBox && weekRangeBox ? weekRangeBox.x - previousWeekBox.x - previousWeekBox.width : 0;
  const rightGap = nextWeekBox && weekRangeBox ? nextWeekBox.x - weekRangeBox.x - weekRangeBox.width : 0;
  assert(
    previousWeekBox && weekRangeBox && nextWeekBox
      && Math.abs(leftGap - rightGap) <= 1
      && weekRangeBox.width >= 200
      && weekRangeBox.height >= 52,
    `Week navigator is not balanced: ${JSON.stringify({ previousWeekBox, weekRangeBox, nextWeekBox, leftGap, rightGap })}`,
  );
  await page.getByRole("heading", { name: "Lịch dự kiến tuần này" }).waitFor();
  await page.getByText("0 buổi dạy", { exact: true }).waitFor();
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
  await page.getByText("10 buổi dạy", { exact: true }).waitFor();
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

  await page.getByRole("link", { name: "Kiểm tra lịch tuần", exact: true }).click();
  await page.waitForURL(`${origin}/admin/reconciliation?from=${currentWeek}&to=${addDays(currentWeek, 6)}&state=ALL`);
  await page.getByRole("heading", { name: "Xác nhận lịch dạy" }).waitFor();
  await page.getByTestId("occurrence-card").first().waitFor();
  const initialRequest = occurrenceRequests.at(-1);
  assert(initialRequest?.from === currentWeek && initialRequest?.to === addDays(currentWeek, 6) && initialRequest?.state === null, `Reconciliation lost the selected week: ${JSON.stringify(initialRequest)}`);
  const filterSummary = page.getByTestId("reconciliation-filter-summary");
  await filterSummary.getByText(`${shortDate(currentWeek)}–${shortDate(addDays(currentWeek, 6))}`, { exact: true }).waitFor();
  await filterSummary.getByText("Tất cả lớp", { exact: true }).waitFor();
  await filterSummary.getByRole("button", { name: "Bộ lọc", exact: true }).waitFor();
  assert(!(await page.getByTestId("reconciliation-filter-card").isVisible()), "Large filter card is still visible on mobile");
  await page.getByText("0 đã chọn", { exact: true }).waitFor();
  assert(await page.getByTestId("reconciliation-mobile-bulk-actions").count() === 0, "Zero-selection bulk bar is visible");
  await page.getByText("Trùng lịch với một buổi khác", { exact: true }).waitFor();
  await page.getByText("Trùng với 2 buổi khác", { exact: true }).waitFor();
  await page.getByText("Chưa ghi nhận", { exact: true }).first().waitFor();
  await page.getByText("Đã ghi nhận", { exact: true }).first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshotDir, "reconciliation-mobile-390x844.png") });

  const requestsBeforeCancel = occurrenceRequests.length;
  await filterSummary.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  const filterSheet = page.getByTestId("reconciliation-filter-sheet");
  await filterSheet.getByRole("heading", { name: "Bộ lọc lịch dạy" }).waitFor();
  assert(await filterSheet.getByLabel("Từ ngày").inputValue() === currentWeek, "Filter draft lost from date");
  assert(await filterSheet.getByLabel("Đến ngày").inputValue() === addDays(currentWeek, 6), "Filter draft lost to date");
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(screenshotDir, "reconciliation-filter-sheet-390x844.png") });
  await filterSheet.getByLabel("Từ ngày").fill(addDays(currentWeek, -1));
  await filterSheet.getByRole("button", { name: "Hủy" }).click();
  await page.waitForTimeout(100);
  assert(occurrenceRequests.length === requestsBeforeCancel, "Canceling draft filters called the occurrences API");
  await filterSummary.getByText(`${shortDate(currentWeek)}–${shortDate(addDays(currentWeek, 6))}`, { exact: true }).waitFor();

  await filterSummary.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  await filterSheet.getByLabel("Lớp").click();
  await page.getByRole("option", { name: "Lớp 6B" }).click();
  await filterSheet.getByLabel("Trạng thái").click();
  await page.getByRole("option", { name: "Đã ghi nhận" }).click();
  await filterSheet.getByRole("button", { name: "Áp dụng" }).click();
  await filterSummary.getByText("Lớp 6B", { exact: true }).waitFor();
  await filterSummary.getByText("Đã ghi nhận", { exact: true }).waitFor();
  await assertNoHorizontalScroll(page, { width: 360, height: 800 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const classStateRequest = occurrenceRequests.at(-1);
  assert(classStateRequest?.classId === 2 && classStateRequest?.state === "RECORDED", `Applied class/state filters are incorrect: ${JSON.stringify(classStateRequest)}`);

  const changedFrom = addDays(currentWeek, -1);
  const changedTo = addDays(currentWeek, 5);
  await filterSummary.getByRole("button", { name: "Bộ lọc (2)" }).click();
  await filterSheet.getByLabel("Từ ngày").fill(changedFrom);
  await filterSheet.getByLabel("Đến ngày").fill(changedTo);
  await filterSheet.getByRole("button", { name: "Áp dụng" }).click();
  await filterSummary.getByText(`${shortDate(changedFrom)}–${shortDate(changedTo)}`, { exact: true }).waitFor();
  await page.waitForTimeout(100);
  const dateRequest = occurrenceRequests.at(-1);
  assert(dateRequest?.from === changedFrom && dateRequest?.to === changedTo, `Applied date range is incorrect: ${JSON.stringify(dateRequest)}`);

  await filterSummary.getByRole("button", { name: "Bộ lọc (2)" }).click();
  await filterSheet.getByRole("button", { name: "Xóa bộ lọc" }).click();
  assert(await filterSheet.getByLabel("Từ ngày").inputValue() === changedFrom && await filterSheet.getByLabel("Đến ngày").inputValue() === changedTo, "Clear filters reset the selected date range");
  await filterSheet.getByRole("button", { name: "Áp dụng" }).click();
  await filterSummary.getByText("Tất cả lớp", { exact: true }).waitFor();
  await filterSummary.getByRole("button", { name: "Bộ lọc", exact: true }).waitFor();
  await page.getByTestId("occurrence-card").first().waitFor();

  const firstSelectable = page.getByTestId("occurrence-card").filter({ hasText: "Chưa ghi nhận" }).first().getByRole("checkbox");
  await firstSelectable.check();
  const mobileBulk = page.getByTestId("reconciliation-mobile-bulk-actions");
  await mobileBulk.getByText("1 buổi đã chọn", { exact: true }).waitFor();
  await firstSelectable.uncheck();
  await mobileBulk.waitFor({ state: "detached" });
  await page.getByRole("checkbox", { name: "Chọn tất cả" }).check();
  await page.getByText("3 đã chọn", { exact: true }).waitFor();
  await mobileBulk.getByText("3 buổi đã chọn", { exact: true }).waitFor();
  await mobileBulk.getByRole("button", { name: "Tạo 3 buổi để ghi nhận" }).click();
  const bulkDraftDialog = page.getByRole("dialog", { name: "Tạo 3 buổi để ghi nhận?" });
  await bulkDraftDialog.waitFor();
  await bulkDraftDialog.getByRole("button", { name: "Hủy" }).click();
  await mobileBulk.getByRole("button", { name: "Cho 3 buổi nghỉ" }).click();
  const bulkSkipDialog = page.getByRole("dialog", { name: "Cho 3 buổi nghỉ" });
  await bulkSkipDialog.waitFor();
  await bulkSkipDialog.getByRole("button", { name: "Hủy" }).click();

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
    await assertNoHorizontalScroll(page, viewport);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const [lastCardBox, bulkBarBox, navigationBox] = await Promise.all([
    page.getByTestId("occurrence-card").last().boundingBox(),
    mobileBulk.boundingBox(),
    page.getByTestId("mobile-navigation-shell").boundingBox(),
  ]);
  assert(lastCardBox && bulkBarBox && navigationBox
    && lastCardBox.y + lastCardBox.height <= bulkBarBox.y
    && bulkBarBox.y + bulkBarBox.height <= navigationBox.y,
  `Reconciliation bottom spacing is incorrect: ${JSON.stringify({ lastCardBox, bulkBarBox, navigationBox })}`);

  const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${origin}/admin/login`, { waitUntil: "networkidle" });
  await loginPage.getByText("Không sử dụng trên thiết bị dùng chung.", { exact: true }).waitFor();
  await assertNoHorizontalScroll(loginPage, { width: 360, height: 800 });
  await assertNoHorizontalScroll(loginPage, { width: 390, height: 844 });
  await loginPage.screenshot({ path: path.join(screenshotDir, "login-mobile-390x844.png") });
  await loginContext.close();
  await context.close();
  process.stdout.write(`Calendar/reconciliation/login mobile UI smoke PASS. Screenshots: ${screenshotDir}\n`);
} finally {
  if (browser) await browser.close();
  if (web && !web.killed) web.kill();
}
