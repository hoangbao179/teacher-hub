/* global process, console, document, fetch */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const origin = "http://127.0.0.1:5217";
const app = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5217", "--strictPort"], {
  cwd: path.join(root, "client"), env: { ...process.env, VITE_API_BASE_URL: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", (chunk) => process.stdout.write(chunk));
app.stderr.on("data", (chunk) => process.stderr.write(chunk));

let browser;
try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Vite startup */ }
    assert(Date.now() < deadline, "Vite did not start");
    await setTimeout(200);
  }

  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const token = "game-builder-e2e-token";
  const user = { id: 1, username: "covy-fixture", displayName: "Cô Vy", role: "TEACHER" };
  const calls = [];
  let draft = null;

  await context.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(url.pathname);
    if (url.pathname === "/api/auth/me") {
      if (request.headers().authorization === `Bearer ${token}`) return route.fulfill({ json: { data: user } });
      return route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "Not logged in" } } });
    }
    if (url.pathname === "/api/auth/login") {
      assert.equal(request.method(), "POST");
      return route.fulfill({ json: { data: { token, user } } });
    }
    if (url.pathname === "/api/auth/logout") return route.fulfill({ status: 204 });
    if (url.pathname === "/api/vocabulary/sets" && request.method() === "GET") {
      return route.fulfill({ json: { data: [], page: 1, pageSize: 50, total: 0 } });
    }
    if (url.pathname === "/api/vocabulary/assignments" && request.method() === "GET") {
      return route.fulfill({ json: { data: draft ? [{
        id: draft.id, title: draft.title, status: draft.status, ageBand: draft.ageBand,
        audienceType: draft.audienceType, itemCount: draft.items.length,
        recipientCount: 0, updatedAt: draft.updatedAt, dueAt: null, version: draft.version,
      }] : [], page: 1, pageSize: 50, total: draft ? 1 : 0 } });
    }
    if (url.pathname === "/api/vocabulary/assignments" && request.method() === "POST") {
      const body = request.postDataJSON();
      assert.equal(body.items.length, 3);
      assert.equal(body.items[0].illustration.kind, "EMOJI");
      assert.equal(body.items[2].illustration.kind, "NONE");
      assert.equal(body.audienceType, "OPEN_LINK");
      draft = {
        ...body, id: 123, status: "DRAFT", version: 1, teacherUserId: 1, classId: null,
        publicCode: null, publishedAt: null, closedAt: null,
        vocabularySetId: null, instruction: body.instruction ?? null,
        dueAt: null, availableFrom: null, maxAttempts: null, passScore: null,
        recipientCount: 0, itemCount: body.items.length, selectedStudentIds: [],
        updatedAt: new Date().toISOString(),
        items: body.items.map((item, index) => ({
          ...item, id: index + 1, normalizedWord: item.word.toLowerCase(),
          illustrationSnapshot: item.illustration,
        })),
        activities: body.activities.map((item, index) => ({ ...item, id: index + 1 })),
      };
      return route.fulfill({ status: 201, json: { data: draft } });
    }
    if (url.pathname === "/api/vocabulary/assignments/123/preview" && draft)
      return route.fulfill({ json: { data: { banner: "XEM_TRUOC", assignment: draft, estimatedMinutes: 3, warnings: [] } } });
    if (url.pathname === "/api/vocabulary/assignments/123" && draft) {
      if (request.method() === "GET") return route.fulfill({ json: { data: draft } });
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        draft = { ...draft, ...body, version: draft.version + 1 };
        return route.fulfill({ json: { data: draft } });
      }
    }
    return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: url.pathname } } });
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/admin/games/new`);
  await page.waitForURL(`${origin}/admin/login`);
  await page.getByLabel("Tên đăng nhập").fill("covy");
  await page.getByLabel("Mật khẩu").fill("fixture-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin/games/new`);
  await page.getByTestId("teacher-game-builder-page").waitFor();

  await page.getByTestId("teacher-game-title").locator("input").fill("Family and Friends – Unit 4");
  await page.getByTestId("teacher-game-words").locator("textarea").fill("apple - quả táo\nbanana - quả chuối\nhungry - đói");
  await page.getByText("3 từ hợp lệ").waitFor();
  assert.equal(await page.getByText("2 từ có hình/emoji").count(), 1);

  await page.getByRole("button", { name: "Xem thử thẻ học" }).click();
  const preview = page.getByTestId("teacher-game-preview");
  await preview.waitFor();
  await preview.getByRole("button", { name: "Lật thẻ xem từ hoặc nghĩa" }).click();
  await preview.getByText("quả táo", { exact: true }).waitFor();

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 820 });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `Teacher builder overflows at ${width}px`);
  }

  await page.getByTestId("teacher-game-save").click();
  await page.waitForURL(`${origin}/admin/games/123/edit`);
  await page.getByText(/Đã lưu bản nháp/).waitFor();
  await page.getByRole("link", { name: "Quay lại" }).click();
  await page.waitForURL(`${origin}/admin/games`);
  await page.getByTestId("teacher-games-page").waitFor();
  await page.getByText("Family and Friends – Unit 4").waitFor();
  await page.getByRole("link", { name: "Tiếp tục soạn" }).click();
  await page.waitForURL(`${origin}/admin/games/123/edit`);
  await page.getByTestId("teacher-game-words").locator("textarea").waitFor();
  assert.match(await page.getByTestId("teacher-game-words").locator("textarea").inputValue(), /hungry/);

  assert(!calls.some((value) => value.includes("media/search") || value.includes("image-search")), "Teacher flow must not search remote images");
  assert.deepEqual(errors, []);
  console.log("PASS teacher game UI: auth, paste, emoji, no-image fallback, preview, draft, reopen, 360/390/430px");
} finally {
  await browser?.close();
  app.kill("SIGTERM");
}
