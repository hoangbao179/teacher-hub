/* global document, fetch, localStorage, process, setTimeout, URL */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const origin = "http://127.0.0.1:5194";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
let web;
let browser;

async function waitUrl(url, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitUntil(predicate, message, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

function student(id, fullName, enrollmentId = null) {
  return {
    id,
    fullName,
    nickname: null,
    status: "ACTIVE",
    parentName: null,
    parentPhone: null,
    classId: enrollmentId == null ? null : 42,
    className: enrollmentId == null ? null : "Lớp kiểm thử ghi danh",
    enrollmentId,
    enrollmentStatus: enrollmentId == null ? null : "ACTIVE",
    tuitionMode: enrollmentId == null ? null : "CLASS_DEFAULT",
    customPackagePrice: null,
    currentProgress: enrollmentId == null ? null : 0,
    hasPaymentDue: false,
  };
}

async function runViewport(viewport) {
  const enrolled = new Map();
  const requestCounts = { classDetail: 0, students: 0, enrollByStudent: new Map() };
  let slowRefresh = false;
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("teacher-token", "class-enrollment-test-token"));
  await context.route(`${origin}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const apiPath = url.pathname;
    if (apiPath === "/api/auth/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: 1, username: "covy", displayName: "Cô Vy", role: "TEACHER" } }),
      });
    }
    if (apiPath === "/api/classes/42" && request.method() === "GET") {
      requestCounts.classDetail += 1;
      if (slowRefresh) await new Promise((resolve) => setTimeout(resolve, 600));
      const classStudents = [...enrolled.entries()].map(([studentId, enrollmentId]) => ({
        enrollmentId,
        studentId,
        fullName: ["", "An", "Bình", "Chi"][studentId],
        nickname: null,
        tuitionMode: "CLASS_DEFAULT",
        currentProgress: 0,
        hasPaymentDue: false,
      }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {
          id: 42,
          name: "Lớp kiểm thử ghi danh",
          type: "GROUP",
          subject: "Tiếng Anh",
          status: "ACTIVE",
          defaultPackagePrice: 800000,
          defaultDurationMinutes: 60,
          activeStudentCount: classStudents.length,
          paymentDueCount: 0,
          startDate: "2026-07-01",
          expectedEndDate: null,
          closedAt: null,
          note: null,
          schedules: [],
          students: classStudents,
        } }),
      });
    }
    if (apiPath === "/api/students" && request.method() === "GET") {
      requestCounts.students += 1;
      if (slowRefresh) await new Promise((resolve) => setTimeout(resolve, 600));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [1, 2, 3].map((studentId) =>
          student(studentId, ["", "An", "Bình", "Chi"][studentId], enrolled.get(studentId) ?? null)) }),
      });
    }
    if (apiPath === "/api/classes/42/enrollments" && request.method() === "POST") {
      const input = request.postDataJSON();
      const count = requestCounts.enrollByStudent.get(input.studentId) ?? 0;
      requestCounts.enrollByStudent.set(input.studentId, count + 1);
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (input.studentId === 1) {
        enrolled.set(1, 101);
        slowRefresh = true;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: 101 } }),
        });
      }
      if (input.studentId === 3) {
        enrolled.set(3, 103);
        slowRefresh = false;
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: {
            code: "STUDENT_ACTIVE_ENROLLMENT",
            message: "Học sinh đã có một ghi danh đang hoạt động.",
          } }),
        });
      }
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: {
          code: "ENROLLMENT_FAILED",
          message: "Không thể ghi danh lúc này. Vui lòng thử lại.",
        } }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: `Unexpected API call: ${apiPath}` } }),
    });
  });

  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(`${origin}/admin/classes/42`, { waitUntil: "networkidle" });
  try {
    await page.getByRole("heading", { name: "Lớp kiểm thử ghi danh" }).waitFor({ timeout: 8_000 });
  } catch {
    const body = await page.locator("body").innerText().catch(() => "");
    const html = await page.content().catch(() => "");
    throw new Error(`Class detail did not render at ${page.url()}: ${body.slice(0, 500)}; page errors: ${pageErrors.join(" | ")}; failed requests: ${failedRequests.join(" | ")}; html: ${html.slice(0, 500)}`);
  }
  const initialClassRequests = requestCounts.classDetail;
  const initialStudentRequests = requestCounts.students;
  assert(initialClassRequests >= 1, "Class detail did not load initially");
  assert(initialStudentRequests >= 1, "Enrollment candidates did not load initially");

  const openEnrollmentDialog = async () => {
    await page.getByRole("button", { name: "Ghi danh", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ghi danh học sinh" });
    await dialog.waitFor();
    return dialog;
  };
  const chooseStudent = async (dialog, name) => {
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name, exact: true }).click();
  };

  let dialog = await openEnrollmentDialog();
  const selectedStudentInput = () => dialog.locator("input.MuiSelect-nativeInput").first();
  const emptyValue = await selectedStudentInput().inputValue();
  assert.equal(emptyValue, "", "The enrollment selection was not empty when the dialog opened");
  assert(await dialog.getByRole("button", { name: "Ghi danh", exact: true }).isDisabled(),
    "The enrollment submit button was enabled without a selected student");
  await chooseStudent(dialog, "An");
  const submit = dialog.getByRole("button", { name: "Ghi danh", exact: true });
  await submit.evaluate((button) => {
    button.click();
    button.click();
  });
  await waitUntil(
    () => Promise.resolve(requestCounts.enrollByStudent.get(1) === 1),
    "The enrollment request was not sent",
  );
  assert.equal(requestCounts.enrollByStudent.get(1), 1, "Double click sent duplicate enrollment requests");
  await dialog.getByRole("button", { name: "Đang ghi danh…" }).waitFor();
  assert(await dialog.getByRole("button", { name: "Đang ghi danh…" }).isDisabled(),
    "The enrollment submit button was not disabled while loading");
  assert(await dialog.isVisible(), "The dialog closed before the enrollment API succeeded");
  await dialog.waitFor({ state: "detached" });
  await page.getByTestId("class-student-card").filter({ hasText: "An" }).waitFor();
  assert(!(await page.getByRole("button", { name: "Ghi danh", exact: true }).isDisabled()),
    "Loading did not end after the class and candidate refreshes completed");
  assert.equal(requestCounts.classDetail, initialClassRequests + 1, "Class students were not refreshed after enrollment");
  assert.equal(requestCounts.students, initialStudentRequests + 1, "Enrollment candidates were not refreshed after enrollment");

  const toast = page.getByText("Đã ghi danh học sinh.", { exact: true });
  await toast.waitFor();
  assert(await toast.evaluate((element) => Boolean(element.closest(".MuiSnackbar-root"))),
    "Enrollment success was rendered outside the shared Snackbar");
  assert.equal(await page.locator(".MuiAlert-root").filter({ hasText: "Đã ghi danh học sinh." })
    .evaluateAll((elements) => elements.filter((element) => !element.closest(".MuiSnackbar-root")).length), 0,
  "A fixed enrollment success banner is still rendered in the page");
  const toastShownAt = Date.now();
  await toast.waitFor({ state: "detached", timeout: 4_000 });
  const toastVisibleFor = Date.now() - toastShownAt;
  assert(toastVisibleFor >= 2_000 && toastVisibleFor <= 3_300,
    `Success toast auto-hide was outside 2–3 seconds: ${toastVisibleFor}ms`);

  slowRefresh = false;
  dialog = await openEnrollmentDialog();
  assert.equal(await selectedStudentInput().inputValue(), "",
    "The selected student was not reset after successful enrollment");
  assert(await dialog.getByRole("button", { name: "Ghi danh", exact: true }).isDisabled(),
    "The submit button was not reset to disabled");
  await dialog.getByRole("combobox").first().click();
  assert.equal(await page.getByRole("option", { name: "An", exact: true }).count(), 0,
    "The enrolled student remained in the enrollment dropdown");
  await page.keyboard.press("Escape");

  await chooseStudent(dialog, "Bình");
  const classRequestsBeforeError = requestCounts.classDetail;
  const studentRequestsBeforeError = requestCounts.students;
  const classCardsBeforeError = await page.getByTestId("class-student-card").count();
  await dialog.getByRole("button", { name: "Ghi danh", exact: true }).click();
  await dialog.getByText("Không thể ghi danh lúc này. Vui lòng thử lại.", { exact: true }).waitFor();
  assert(await dialog.isVisible(), "The dialog closed after an enrollment API error");
  assert.equal(await selectedStudentInput().inputValue(), "2",
    "The selected student was cleared after an enrollment API error");
  assert.equal(requestCounts.classDetail, classRequestsBeforeError, "A non-conflict API error refreshed class students");
  assert.equal(requestCounts.students, studentRequestsBeforeError, "A non-conflict API error refreshed candidates");
  assert.equal(await page.getByTestId("class-student-card").count(), classCardsBeforeError,
    "The class student list changed after a failed enrollment");
  assert.equal(await page.getByText("Đã ghi danh học sinh.", { exact: true }).count(), 0,
    "A success toast appeared after a failed enrollment");
  await dialog.getByRole("button", { name: "Hủy" }).click();

  dialog = await openEnrollmentDialog();
  await chooseStudent(dialog, "Chi");
  const classRequestsBeforeConflict = requestCounts.classDetail;
  const studentRequestsBeforeConflict = requestCounts.students;
  await dialog.getByRole("button", { name: "Ghi danh", exact: true }).click();
  await dialog.getByText("Học sinh đã có một ghi danh đang hoạt động.", { exact: true }).waitFor();
  await page.getByTestId("class-student-card").filter({ hasText: "Chi" }).waitFor();
  assert(await dialog.isVisible(), "The dialog closed after an enrollment conflict");
  assert.equal(await selectedStudentInput().inputValue(), "3",
    "The selected student was cleared after an enrollment conflict");
  assert.equal(requestCounts.classDetail, classRequestsBeforeConflict + 1,
    "An enrollment conflict did not refresh class students");
  assert.equal(requestCounts.students, studentRequestsBeforeConflict + 1,
    "An enrollment conflict did not refresh candidates");
  await dialog.getByRole("combobox").first().click();
  assert.equal(await page.getByRole("option", { name: "Chi", exact: true }).count(), 0,
    "The conflicted student remained in the dropdown after refresh");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0,
    `The class enrollment flow overflowed at ${viewport.width}x${viewport.height}`);

  await context.close();
}

try {
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  web = spawn(
    process.execPath,
    [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5194", "--strictPort"],
    { cwd: clientRoot, env: { ...process.env, VITE_API_BASE_URL: origin }, stdio: ["ignore", "pipe", "pipe"] },
  );
  web.stdout.on("data", (chunk) => process.stdout.write(chunk));
  web.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);
  browser = await chromium.launch({ headless: true, executablePath: chrome });

  await runViewport({ width: 1366, height: 768 });
  await runViewport({ width: 390, height: 844 });
  process.stdout.write("Class enrollment flow E2E PASS at 1366x768 and 390x844.\n");
} finally {
  if (browser) await browser.close();
  if (web && !web.killed) web.kill();
}
