/* global process, fetch, setTimeout, console, document, localStorage, URL, getComputedStyle */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "lesson-wizard", {});
let artifactRunPassed = false;
const artifactDir = artifactPolicy.runDir;
fs.mkdirSync(artifactDir, { recursive: true });
dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
const testEnv = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "lesson-e2e-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_PASSWORD: "lesson-e2e-password-123",
  PORT: "4101",
  CORS_ORIGIN: "http://127.0.0.1:5175",
};
const children = [];
let browser;

function run(command, args, cwd = root) {
  const useWindowsCommand = ["npm", "npx"].includes(command) && process.platform === "win32";
  const packageCommand = useWindowsCommand ? `${command}.cmd` : command;
  const executable = useWindowsCommand ? process.env.ComSpec ?? "cmd.exe" : packageCommand;
  const commandArgs = useWindowsCommand ? ["/d", "/s", "/c", packageCommand, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env: testEnv, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.status}`);
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
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
async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Horizontal page overflow: ${overflow}px`);
}
function todayInHoChiMinh() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function weekdayIso(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day || 7;
}
async function api(pathname, token) {
  const response = await fetch(`http://127.0.0.1:4101${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`API ${pathname} failed ${response.status}`);
  return (await response.json()).data;
}
async function apiMutation(pathname, token, method, body) {
  const response = await fetch(`http://127.0.0.1:4101${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`API ${method} ${pathname} failed ${response.status}: ${payload.error?.code ?? "unknown"}`);
  }
  return response.status === 204 ? undefined : (await response.json()).data;
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  run("npm", ["run", "db:seed:dev"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5175"], path.join(root, "client"), { ...testEnv, VITE_API_BASE_URL: "http://127.0.0.1:4101" });
  await waitUrl("http://127.0.0.1:4101/health"); await waitUrl("http://127.0.0.1:5175");

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5175/admin/login");
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.locator('input[name="password"]').fill("lesson-e2e-password-123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
  const token = await page.evaluate(() => localStorage.getItem("teacher-token"));
  if (!token) throw new Error("Login did not persist token");
  const classes = await api("/api/classes", token);
  const group = classes.find((item) => item.name === "DEV - Tiếng Anh lớp 6 nhóm nhỏ");
  if (!group) throw new Error("Seeded group class not found");

  const quickToday = todayInHoChiMinh();
  const quickSuffix = Date.now();
  const quickClassName = `Simple Mode ${quickSuffix}`;
  const quickClass = await apiMutation("/api/classes", token, "POST", {
    name: quickClassName, type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 60, startDate: "2026-01-01", schedules: [
      { dayOfWeek: weekdayIso(quickToday), startTime: "09:00", endTime: "10:00" },
      { dayOfWeek: weekdayIso(quickToday), startTime: "11:00", endTime: "12:00" },
    ],
  });
  const quickStudents = [];
  for (const [name, tuitionMode] of [["Simple An", "CLASS_DEFAULT"], ["Simple Bình", "CLASS_DEFAULT"], ["Simple Chi", "FREE"]]) {
    const student = await apiMutation("/api/students", token, "POST", { fullName: `${name} ${quickSuffix}` });
    const enrollment = await apiMutation(`/api/classes/${quickClass.id}/enrollments`, token, "POST", {
      studentId: student.id, joinedAt: "2026-01-01", tuitionMode,
    });
    quickStudents.push({ name: `${name} ${quickSuffix}`, enrollmentId: enrollment.id, tuitionMode });
  }
  const externalTitle = `Lịch trường Simple ${quickSuffix}`;
  await apiMutation("/api/teacher-busy-slots", token, "POST", {
    slotType: "EXTERNAL_CLASS", organizationType: "SCHOOL", organizationName: "Trường mẫu",
    title: externalTitle, recurrenceType: "ONCE", specificDate: quickToday, startTime: "13:00", endTime: "14:00",
  });

  await page.goto("http://127.0.0.1:5175/admin");
  await page.getByTestId("dashboard-unrecorded-card").getByText(/buổi chưa ghi/).waitFor();
  const externalCard = page.getByTestId("dashboard-today-event").filter({ hasText: externalTitle });
  await externalCard.waitFor();
  if (await externalCard.getByRole("button").count()) throw new Error("External school event exposed a lesson CTA");
  const firstQuickCard = page.getByTestId("dashboard-today-event").filter({ hasText: quickClassName }).filter({ hasText: "09:00" });
  await firstQuickCard.getByRole("button", { name: "Ghi buổi" }).click();
  await page.waitForURL("**/admin/lessons/*/edit?mode=quick");
  await page.locator('[data-testid="lesson-wizard"][data-lesson-mode="quick"]').waitFor();
  const firstQuickId = Number(new URL(page.url()).pathname.split("/")[3]);
  for (const student of quickStudents) await page.getByText(student.name, { exact: true }).waitFor();
  const firstQuickDraft = await api(`/api/lessons/${firstQuickId}`, token);
  for (const student of quickStudents) {
    const expected = student.tuitionMode === "FREE" ? "FREE" : "PRESENT";
    const card = page.locator(".MuiCard-root").filter({ hasText: student.name });
    const label = expected === "FREE" ? "Có mặt · miễn phí" : "Có mặt";
    if ((await card.getByRole("button", { name: label, exact: true }).getAttribute("aria-pressed")) !== "true")
      throw new Error(`Simple Mode did not default ${student.name} to ${expected}`);
  }
  if (firstQuickDraft.status !== "DRAFT" || firstQuickDraft.sourceOccurrenceKey == null) throw new Error("Simple Mode did not reuse the scheduled draft");
  await page.getByRole("link", { name: "Chỉnh sửa đầy đủ" }).click();
  await page.waitForURL(`**/admin/lessons/${firstQuickId}/edit`);
  await page.getByText("Thông tin", { exact: true }).first().waitFor();
  if (page.url().includes("mode=quick")) throw new Error("Full editor kept the quick-mode query");
  await page.goto("http://127.0.0.1:5175/admin");
  const continuedCard = page.getByTestId("dashboard-today-event").filter({ hasText: quickClassName }).filter({ hasText: "09:00" });
  await continuedCard.getByRole("button", { name: "Tiếp tục ghi" }).click();
  await page.waitForURL(`**/admin/lessons/${firstQuickId}/edit?mode=quick`);
  await page.locator('[data-testid="lesson-wizard"][data-lesson-mode="quick"]').waitFor();
  await page.getByLabel("Nội dung buổi học (tùy chọn)").fill("Simple Mode: cả lớp có mặt");
  await page.getByRole("button", { name: "Lưu & hoàn tất" }).click();
  await page.getByTestId("lesson-success").waitFor();
  await page.getByRole("link", { name: "Về Hôm nay" }).waitFor();
  const firstCompleted = await api(`/api/lessons/${firstQuickId}`, token);
  if (firstCompleted.status !== "COMPLETED" || firstCompleted.content !== "Simple Mode: cả lớp có mặt"
    || firstCompleted.participants.some((item) => item.attendance?.status !== (item.tuitionMode === "FREE" ? "FREE" : "PRESENT")))
    throw new Error("Simple Mode did not complete default attendance/content correctly");

  await page.getByRole("link", { name: "Về Hôm nay" }).click();
  const completedCard = page.getByTestId("dashboard-today-event").filter({ hasText: quickClassName }).filter({ hasText: "09:00" });
  await completedCard.getByText("Đã hoàn thành", { exact: false }).waitFor();
  if (await completedCard.getByRole("button", { name: "Ghi buổi" }).count()) throw new Error("Completed occurrence exposed a new draft action");
  const secondQuickCard = page.getByTestId("dashboard-today-event").filter({ hasText: quickClassName }).filter({ hasText: "11:00" });
  await secondQuickCard.getByRole("button", { name: "Ghi buổi" }).click();
  await page.waitForURL("**/admin/lessons/*/edit?mode=quick");
  const secondQuickId = Number(new URL(page.url()).pathname.split("/")[3]);
  const absentCard = page.locator(".MuiCard-root").filter({ hasText: quickStudents[1].name });
  await absentCard.getByRole("button", { name: "Nghỉ", exact: true }).click();
  await page.getByLabel("Nội dung buổi học (tùy chọn)").fill("Simple Mode: một học sinh nghỉ");
  await page.getByRole("button", { name: "Lưu & hoàn tất" }).click();
  await page.getByTestId("lesson-success").waitFor();
  const secondCompleted = await api(`/api/lessons/${secondQuickId}`, token);
  const absentParticipant = secondCompleted.participants.find((item) => item.enrollmentId === quickStudents[1].enrollmentId);
  if (secondCompleted.status !== "COMPLETED" || absentParticipant?.attendance?.status !== "ABSENT")
    throw new Error("Simple Mode did not persist an absent student");

  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}`);
  await page.getByText("Thông tin", { exact: true }).first().waitFor();
  const lessonTypography = await page.evaluate(async () => {
    await document.fonts.ready;
    const titleStyle = getComputedStyle(document.querySelector("h1"));
    return {
      fontLoaded: document.fonts.check('400 16px "Be Vietnam Pro"'),
      family: getComputedStyle(document.body).fontFamily,
      titleSize: titleStyle.fontSize,
      titleWeight: titleStyle.fontWeight,
      rawEnums: document.body.innerText.match(/\b(ACTIVE|PRESENT|ABSENT|FREE|REGULAR|MAKEUP|EXTRA|DRAFT|COMPLETED)\b/g) ?? [],
    };
  });
  if (!lessonTypography.fontLoaded || !lessonTypography.family.includes("Be Vietnam Pro")) throw new Error(`Lesson wizard font is not loaded: ${JSON.stringify(lessonTypography)}`);
  if (lessonTypography.titleSize !== "21px" || lessonTypography.titleWeight !== "700") throw new Error(`Unexpected lesson title typography: ${JSON.stringify(lessonTypography)}`);
  if (lessonTypography.rawEnums.length) throw new Error(`Lesson wizard exposes raw enum labels: ${lessonTypography.rawEnums.join(", ")}`);
  await page.locator('input[type="time"]').nth(3).fill("20:00");
  await page.waitForTimeout(150);
  await noHorizontalScroll(page);
  const sticky = await page.getByRole("button", { name: "Lưu và tiếp tục" }).boundingBox();
  if (!sticky || sticky.y + sticky.height > 844) throw new Error("Sticky primary action is outside mobile viewport");
  const mobileNavigation = await page.getByTestId("mobile-navigation").boundingBox();
  const stickyBar = await page.getByTestId("sticky-action-bar").boundingBox();
  if (!mobileNavigation || !stickyBar || stickyBar.y + stickyBar.height > mobileNavigation.y) throw new Error("Sticky primary action overlaps mobile navigation");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  const continueDespiteConflict = page.getByRole("button", { name: "Tiếp tục dù trùng" });
  if (await continueDespiteConflict.isVisible().catch(() => false)) {
    await continueDespiteConflict.click();
    await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  }
  await page.getByText("Học sinh Mẫu Một").waitFor();
  await page.getByRole("button", { name: "Tất cả có mặt" }).click();
  await page.getByText(/Tất cả có mặt: \d+ học sinh\. Chưa lưu\./).waitFor();
  const firstCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Một" });
  await firstCard.getByRole("button", { name: "Thêm nhận xét riêng" }).click();
  await page.getByLabel("Nhận xét riêng (tùy chọn)").first().fill("Nhận xét chung từ học sinh mẫu");
  await firstCard.getByRole("button", { name: "Dùng làm nhận xét chung cho cả lớp" }).click();
  const commonDialog = page.getByRole("dialog", { name: "Dùng nhận xét riêng làm nhận xét chung?" });
  await commonDialog.getByText(/Nhận xét riêng của các học sinh khác vẫn được giữ nguyên/).waitFor();
  await commonDialog.getByRole("button", { name: "Xác nhận" }).click();
  const secondCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Hai" });
  await secondCard.getByRole("button", { name: "Nghỉ", exact: true }).click();
  await secondCard.getByRole("button", { name: "Thêm nhận xét riêng" }).click();
  await page.getByLabel("Nhận xét riêng (tùy chọn)").last().fill("Nghỉ có phép");
  const freeCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Ba" });
  if ((await freeCard.getByRole("button", { name: "Miễn phí" }).getAttribute("aria-pressed")) !== "true")
    throw new Error("Global FREE attendance did not default to FREE");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.reload();
  await page.getByLabel("Nội dung buổi học").waitFor();
  const mobileTextareaHeights = await page.locator("textarea").evaluateAll((elements) => elements.filter((element) => element.offsetParent !== null).map((element) => element.getBoundingClientRect().height));
  if (!mobileTextareaHeights.length || mobileTextareaHeights.some((height) => height > 110)) throw new Error(`Empty mobile multiline fields are too tall: ${mobileTextareaHeights.join(", ")}`);
  await noHorizontalScroll(page);
  await page.screenshot({ path: path.join(artifactDir, "lesson-content-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopContentMetrics = await page.getByTestId("lesson-wizard").evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    textareaHeights: [...element.querySelectorAll("textarea")].filter((textarea) => textarea.offsetParent !== null).map((textarea) => textarea.getBoundingClientRect().height),
  }));
  if (desktopContentMetrics.width < 600 || desktopContentMetrics.width > 640 || desktopContentMetrics.overflow > 1 || desktopContentMetrics.textareaHeights.some((height) => height > 100)) throw new Error(`Invalid desktop lesson-content density: ${JSON.stringify(desktopContentMetrics)}`);
  await page.screenshot({ path: path.join(artifactDir, "lesson-content-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Nội dung buổi học").fill("Nội dung Playwright M2C");
  await page.getByLabel("Bài tập về nhà").fill("Bài tập Playwright M2C");
  if (await page.getByLabel("Nhận xét chung").inputValue() !== "Nhận xét chung từ học sinh mẫu")
    throw new Error("Student note was not moved to the general comment");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByText("Xác nhận buổi học").waitFor();
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await noHorizontalScroll(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifactDir, "lesson-confirmation-390.png"), fullPage: true });
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByTestId("lesson-success").waitFor();
  const regularUrl = page.url();
  await page.reload();
  await page.getByText("Buổi học đã hoàn thành và được lưu.").waitFor();
  if (!page.url().includes("/edit")) throw new Error(`Unexpected persisted route ${regularUrl}`);

  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}&type=MAKEUP`);
  await page.getByText("Chọn học sinh tham gia").waitFor();
  await page.getByLabel("Học sinh Mẫu Một").check();
  await page.getByLabel("Học sinh Mẫu Hai").check();
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  if (await continueDespiteConflict.isVisible().catch(() => false)) {
    await continueDespiteConflict.click();
    await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  }
  const makeupStudentCard = page.locator(".MuiCard-root").filter({ hasText: "Học sinh Mẫu Một" });
  await makeupStudentCard.getByRole("button", { name: "Thêm nhận xét riêng" }).click();
  await makeupStudentCard.getByLabel("Nhận xét riêng (tùy chọn)").waitFor();
  if (await page.getByText("Học sinh Mẫu Ba", { exact: true }).count()) throw new Error("Non-selected makeup student appeared in attendance");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByLabel("Nội dung buổi học").fill("Makeup content");
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByTestId("lesson-success").waitFor();
  const makeupId = Number(new URL(page.url()).pathname.split("/")[3]);
  const makeupDetail = await api(`/api/lessons/${makeupId}`, token);
  if (makeupDetail.participants.length !== 2) throw new Error("Makeup snapshot did not persist exactly two participants");
  await noHorizontalScroll(page);
  await page.goto(`http://127.0.0.1:5175/admin/lessons/new?classId=${group.id}`);
  await page.getByLabel("Ghi chú nội bộ").fill("unsaved");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByText("Lớp học", { exact: true }).last().click();
  if (!page.url().includes("/admin/lessons/new")) throw new Error("Unsaved-change warning did not block navigation");

  const suffix = Date.now();
  const m3Class = await apiMutation("/api/classes", token, "POST", {
    name: `M3 E2E ${suffix}`, type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 90, startDate: "2026-01-01", schedules: [],
  });
  const m3Student = await apiMutation("/api/students", token, "POST", { fullName: `M3 E2E Student ${suffix}` });
  const m3Enrollment = await apiMutation(`/api/classes/${m3Class.id}/enrollments`, token, "POST", {
    studentId: m3Student.id, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  async function completeTechnical(date) {
    const draft = await apiMutation("/api/lessons", token, "POST", {
      classId: m3Class.id, sessionDate: date, scheduledStartTime: "18:00", scheduledEndTime: "19:30",
      lessonType: "MAKEUP", selectedEnrollmentIds: [m3Enrollment.id],
    });
    return apiMutation(`/api/lessons/${draft.id}/complete`, token, "POST", {
      actualStartTime: "18:00", actualEndTime: "19:30",
      attendances: [{ enrollmentId: m3Enrollment.id, status: "PRESENT" }],
    });
  }
  let lastResult;
  for (const date of ["2026-07-10", "2026-07-02", "2026-07-09", "2026-07-01", "2026-07-08", "2026-07-03", "2026-07-07", "2026-07-04", "2026-07-06"])
    lastResult = await completeTechnical(date);
  if (lastResult.tuitionImpacts[0].newProgress !== 1) throw new Error("Nine out-of-order lessons did not produce 8/8 + 1/8");
  await completeTechnical("2026-07-05");
  const cycles = await api(`/api/tuition-cycles?studentId=${m3Student.id}&pageSize=20`, token);
  if (cycles.length !== 2 || cycles.find((item) => item.status === "PAYMENT_DUE")?.progress !== 8 || cycles.find((item) => item.status === "ACCUMULATING")?.progress !== 2)
    throw new Error("Chronological E2E cycles are not 8/8 and 2/8");
  const due = cycles.find((item) => item.status === "PAYMENT_DUE");
  const dueDetail = await api(`/api/tuition-cycles/${due.id}`, token);
  const orderedDates = dueDetail.items.map((item) => item.sessionDate);
  if (JSON.stringify(orderedDates) !== JSON.stringify([...orderedDates].sort())) throw new Error("Cycle detail is not chronological");
  await apiMutation(`/api/tuition-cycles/${due.id}/mark-paid`, token, "POST", {
    paidAmount: due.packagePriceSnapshot, paidAt: "2026-07-31", paymentMethod: "CASH",
  });
  const conflictDraft = await apiMutation("/api/lessons", token, "POST", {
    classId: m3Class.id, sessionDate: "2026-06-30", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [m3Enrollment.id],
  });
  await apiMutation(`/api/lessons/${conflictDraft.id}/attendances`, token, "PUT", {
    attendances: [{ enrollmentId: m3Enrollment.id, status: "PRESENT" }],
  });
  await apiMutation(`/api/lessons/${conflictDraft.id}/content`, token, "PUT", { content: "Paid boundary conflict" });
  await page.goto(`http://127.0.0.1:5175/admin/lessons/${conflictDraft.id}/edit`);
  await page.getByText("Xác nhận buổi học").waitFor();
  await page.getByRole("button", { name: "Hoàn tất ghi nhận" }).click();
  await page.getByText("Xung đột:").waitFor();
  const conflictPersisted = await api(`/api/lessons/${conflictDraft.id}`, token);
  if (conflictPersisted.status !== "DRAFT") throw new Error("Paid conflict did not roll lesson back to DRAFT");
  console.log(`Playwright lesson E2E passed at 390x844; screenshot: ${path.join(artifactDir, "lesson-confirmation-390.png")}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
