/* global process, fetch, setTimeout, localStorage, document, console */
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const origin = "http://127.0.0.1:5193";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
let web;
let browser;

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

const recurringSlot = {
  id: 42,
  slotType: "EXTERNAL_CLASS",
  organizationType: "SCHOOL",
  organizationName: "Mầm non Hoa Thủy Tiên",
  title: "Mầm non Hoa Thủy Tiên · Thứ 2 08:00",
  recurrenceType: "WEEKLY",
  schedules: [{ id: 1, dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
  specificDate: null,
  startTime: null,
  endTime: null,
  effectiveFrom: "2026-07-31",
  effectiveTo: null,
  location: null,
  note: null,
  conflicts: [],
};

try {
  const node = process.execPath;
  web = spawn(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5193"], {
    cwd: clientRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  web.stdout.on("data", (chunk) => process.stdout.write(chunk));
  web.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("teacher-token", "busy-slot-ui-token"));
  await context.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { id: 1, username: "covy", displayName: "Cô Vy", role: "TEACHER" } }),
  }));

  let createBody;
  let updateBodies = [];
  await context.route("**/api/teacher-busy-slots", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createBody = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { slot: recurringSlot, conflicts: [] } }),
    });
  });
  await context.route("**/api/teacher-busy-slots/42", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: recurringSlot }),
  }));
  await context.route("**/api/teacher-busy-slots/42", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON();
    updateBodies.push(body);
    const title = body.title?.trim() || "Mầm non Hoa Thủy Tiên · Thứ 2 08:00";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { slot: { ...recurringSlot, title }, conflicts: [] } }),
    });
  });

  const page = await context.newPage();
  await page.goto(`${origin}/admin/busy-slots/new?type=EXTERNAL_CLASS`);
  const title = page.getByLabel("Tên lớp (tùy chọn)");
  await title.waitFor();
  await page.getByText("Để trống, hệ thống sẽ tự đặt tên theo trường và lịch học.").waitFor();
  assert(await title.getAttribute("placeholder") === "Ví dụ: Lớp Mầm 5 tuổi", "Missing optional title placeholder");
  await page.getByLabel("Tên trường/trung tâm").fill("Mầm non Hoa Thủy Tiên");
  const save = page.getByRole("button", { name: "Lưu lịch" });
  assert(await save.isEnabled(), "Save must be enabled when only the optional title is blank");
  await assertNoHorizontalScroll(page, { width: 390, height: 844 });
  await save.click();
  await page.getByText("Đã tạo lịch.").waitFor();
  assert(!Object.prototype.hasOwnProperty.call(createBody, "title"), "Create should omit a blank title");
  assert(await title.inputValue() === recurringSlot.title, "Generated title should render immediately");

  await page.goto(`${origin}/admin/busy-slots/42/edit`);
  await title.fill("  Lớp Bé Gấu  ");
  await save.click();
  await page.getByText("Đã cập nhật lịch.").waitFor();
  assert(updateBodies[0].title === "  Lớp Bé Gấu  ", "Edit should submit the manual title");
  assert(await title.inputValue() === "Lớp Bé Gấu", "Trimmed response title should render immediately");

  await title.fill("");
  await save.click();
  assert(updateBodies[1].title === "", "Edit should explicitly submit an empty title for regeneration");
  assert(await title.inputValue() === recurringSlot.title, "Regenerated edit title should render immediately");
  await page.reload();
  assert(await title.inputValue() === recurringSlot.title, "Reload should show the persisted generated title");

  await assertNoHorizontalScroll(page, { width: 1366, height: 768 });
  const formWidth = await page.getByTestId("busy-slot-form").evaluate((element) => element.getBoundingClientRect().width);
  assert(formWidth < 1366, "Desktop form should preserve its bounded layout");
  console.log("Busy-slot optional-title UI checks passed");
} finally {
  await browser?.close();
  web?.kill();
}
