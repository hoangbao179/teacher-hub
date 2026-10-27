/* global process, console, document, localStorage, sessionStorage, URL, fetch */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

// Browser regression for the current entry flow; no database or real credentials.
const root = path.resolve(import.meta.dirname, "../..");
const origin = "http://127.0.0.1:5196";
const policy = createArtifactPolicy(root, "teacher-tools");
const user = { id: 1, username: "tools-fixture", displayName: "Cô Vy", role: "TEACHER" };
const token = "teacher-tools-browser-fixture";
const legacyRoutes = ["/admin", "/admin/classes", "/admin/students", "/admin/tuition", "/admin/account", "/admin/not-found"];
let browser;
let passed = false;
const web = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5196", "--strictPort"], {
  cwd: path.join(root, "client"),
  env: { ...process.env, VITE_API_BASE_URL: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
web.stdout.on("data", (chunk) => process.stdout.write(chunk));
web.stderr.on("data", (chunk) => process.stderr.write(chunk));

async function checkLayout(page, width) {
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    controls: [...document.querySelectorAll("header a, [data-testid=teacher-tools-page] a, [data-testid=teacher-tools-page] button, [data-testid=public-tools-page] a")]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent, height: rect.height, width: rect.width, left: rect.left, right: rect.right, clipped: element.scrollWidth > element.clientWidth + 1 };
      }),
  }));
  assert(layout.overflow <= 1, `${page.url()} overflows at ${width}px`);
  for (const control of layout.controls) {
    assert(control.height >= 44 && control.width >= 44, `Small touch target ${control.text} at ${width}px`);
    assert(control.left >= 0 && control.right <= width && !control.clipped, `Clipped control ${control.text} at ${width}px`);
  }
}

try {
  const deadline = Date.now() + 30_000;
  while (true) {
    try { if ((await fetch(origin)).ok) break; } catch { /* wait for Vite */ }
    assert(Date.now() < deadline, "Vite did not start within 30s");
    await setTimeout(200);
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  installPlaywrightArtifactPolicy(browser, policy);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const calls = [];
  let pdfEnabled = false;
  let guestSubmitted = false;
  const guestBatchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const guestJobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const guestCreatedAt = new Date().toISOString();
  const guestExpiresAt = new Date(Date.now()+3600000).toISOString();
  const guestJob = { id:guestJobId,batchId:guestBatchId,fileId:"owned_fixture_12345",status:"COMPLETED",createdAt:guestCreatedAt,updatedAt:guestCreatedAt,enqueuedAt:guestCreatedAt,completedAt:guestCreatedAt,expiresAt:guestExpiresAt,errorCode:null,cloudErrorCode:null,bytes:9,pages:1,retryOf:null,retryAttempts:0,enqueueAttempts:1 };
  const guestBatch = { id:guestBatchId,createdAt:guestCreatedAt,rightsConfirmedAt:guestCreatedAt,jobs:[guestJob] };
  await context.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    calls.push(pathname);
    if (pathname === "/api/auth/login") {
      assert.equal(request.method(), "POST");
      return route.fulfill({ json: { data: { token, user } } });
    }
    if (pathname === "/api/auth/me") {
      if (request.headers().authorization === `Bearer ${token}`) return route.fulfill({ json: { data: user } });
      return route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED", message: "Expired fixture" } } });
    }
    if (pathname === "/api/auth/logout") return route.fulfill({ status: 204 });
    if (pathname === "/api/public/pdf/capabilities") return route.fulfill({ json: { data: { submitEnabled: pdfEnabled, downloadEnabled: pdfEnabled, unavailableReason: "PDF_SERVICE_UNAVAILABLE", maxLinksPerBatch: 5, maxActiveJobs: 10, maxBatchesPerHour: 10, maxRetries: 2, maxBytes: 20971520, maxPages: 40, ticketTtlSeconds: 120 } } });
    if (pathname === "/api/public/pdf/session" && request.method() === "POST") return route.fulfill({ json:{data:{available:true}} });
    if (pathname === "/api/public/pdf/batches" && request.method() === "POST") {
      const body=request.postDataJSON();
      assert.deepEqual(Object.keys(body),["links"]);
      assert.equal(body.links.length,1);
      assert.match(request.headers()["idempotency-key"], /^[0-9a-f-]{36}$/);
      guestSubmitted=true;
      return route.fulfill({ status:201,json:{data:guestBatch} });
    }
    if (pathname === "/api/public/pdf/batches" && request.method() === "GET")
      return route.fulfill({json:{data:{items:guestSubmitted?[{id:guestBatchId,createdAt:guestCreatedAt,rightsConfirmedAt:guestCreatedAt}]:[],page:1,pageSize:20,total:guestSubmitted?1:0}}});
    if (pathname === "/api/public/pdf/batches/"+guestBatchId)
      return route.fulfill({json:{data:guestBatch}});
    if (pathname === "/api/public/pdf/jobs/"+guestJobId+"/download-ticket")
      return route.fulfill({json:{data:{ticket:"A".repeat(43),expiresAt:guestExpiresAt,downloadPath:"/api/public/pdf/jobs/"+guestJobId+"/download"}}});
    if (pathname === "/api/public/pdf/jobs/"+guestJobId+"/download")
      return route.fulfill({status:200,contentType:"application/pdf",body:"%PDF-demo"});
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByTestId("header-tools").click();
  await page.waitForURL(`${origin}/tools`);
  await page.getByTestId("public-tools-page").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("public-tools-page").waitFor();
  assert.equal(await page.getByRole("button", { name: "Đăng xuất" }).count(), 0);
  assert.equal(await page.locator('input[type="file"]').count(), 0);
  assert.equal(await page.getByTestId("image-pdf-tool").count(), 0);
  assert.equal(await page.getByTestId("pdf-submit").count(), 1);
  assert.equal(await page.getByTestId("pdf-submit").isDisabled(), true);
  assert.match(await page.title(), /Góc công cụ của cô Vy/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://tienganhcovy.com/tools");
  assert.equal(await page.locator("#public-home-structured-data").count(), 0);
  assert(calls.every(path => path.startsWith("/api/public/pdf/")), "Public Tools requested teacher auth data");
  for (const width of [360, 375, 390, 393, 400, 412, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await checkLayout(page, width);
    if (width === 360 || width === 1440) await page.screenshot({ path: path.join(policy.runDir, `public-tools-${width}.png`), fullPage: true });
  }
  for (const [name, route] of [["Góc học miễn phí", "/hoc"], ["Tủ sách tiếng Anh", "/sach"]]) {
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.waitForURL(`${origin}${route}`);
    await page.getByTestId("header-tools").click();
    await page.waitForURL(`${origin}/tools`);
    await page.getByTestId("public-tools-page").waitFor();
  }
  for (const route of [...legacyRoutes, "/admin/tools"]) {
    await page.goto(`${origin}${route}`);
    await page.waitForURL(`${origin}/admin/login`);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).waitFor();
    assert.equal(await page.getByTestId("teacher-tools-page").count(), 0);
  }
  assert(calls.every(path => path.startsWith("/api/public/pdf/")), "Guest navigation requested admin data");
  await page.getByLabel("Tên đăng nhập").fill(user.username);
  await page.locator('input[name="password"]').fill("browser-fixture-password");
  await page.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }).check();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin/tools`);
  await page.getByTestId("teacher-tools-page").waitFor();
  await page.reload();
  await page.getByTestId("teacher-tools-page").waitFor();
  assert(calls.includes("/api/auth/me"), "Refresh did not validate the session");
  await page.getByText("Tính năng này đang được chuẩn bị.", { exact: false }).waitFor();
  assert.equal(await page.getByTestId("pdf-submit").count(), 0);
  assert.equal(await page.getByTestId("pdf-download").count(), 0);
  for (const route of [...legacyRoutes, "/admin/tools/", "/admin/login"]) {
    await page.goto(`${origin}${route}`);
    await page.waitForURL(`${origin}/admin/tools`);
    await page.getByTestId("teacher-tools-page").waitFor();
    assert.equal(await page.locator("aside, nav, [role=menu], .MuiDrawer-root, .MuiBottomNavigation-root").count(), 0, `Legacy navigation visible from ${route}`);
  }
  for (const width of [360, 375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    for (const pathname of ["/", "/hoc", "/sach"]) {
      await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
      await page.getByTestId("header-tools").waitFor();
      await checkLayout(page, width);
      if (width === 360 || width === 1440) await page.screenshot({ path: path.join(policy.runDir, `public-${pathname === "/" ? "home" : pathname.slice(1)}-${width}.png`), fullPage: true });
      await page.getByTestId("header-tools").click();
      await page.waitForURL(`${origin}/tools`);
      await page.getByTestId("public-tools-page").waitFor();
      await checkLayout(page, width);
      await page.getByText("Công cụ PDF đang được chuẩn bị.", { exact: false }).first().waitFor();
      assert.equal(await page.getByTestId("public-pdf-tool").count(), 1, "Public Tools PDF workspace missing");
      assert.equal(await page.getByTestId("pdf-submit").isDisabled(), true, "Unavailable PDF submit must be disabled");
      if (pathname === "/" && (width === 360 || width === 1440)) await page.screenshot({ path: path.join(policy.runDir, `tools-${width}.png`), fullPage: true });
    }
    await page.goto(`${origin}/admin/tools`);
    await page.getByTestId("teacher-tools-page").waitFor();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.waitForURL(`${origin}/admin/login`);
    await checkLayout(page, width);
    await page.getByLabel("Tên đăng nhập").fill(user.username);
    await page.locator('input[name="password"]').fill("browser-fixture-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(`${origin}/admin/tools`);
    await page.getByTestId("teacher-tools-page").waitFor();
  }
  await page.getByRole("link", { name: "Trang chủ", exact: true }).click();
  await page.waitForURL(`${origin}/`);
  await page.getByTestId("header-tools").click();
  await page.waitForURL(`${origin}/tools`);
  await page.getByTestId("public-tools-page").waitFor();
  await page.goto(`${origin}/admin/tools`);
  await page.getByTestId("teacher-tools-page").waitFor();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(`${origin}/admin/login`);
  assert(await page.evaluate(() => !localStorage.getItem("teacher-token") && !sessionStorage.getItem("teacher-token")), "Logout retained a token");
  await page.goto(`${origin}/admin/tools`);
  await page.waitForURL(`${origin}/admin/login`);
  await page.evaluate(() => localStorage.setItem("teacher-token", "expired-fixture"));
  await page.goto(`${origin}/admin/tools`);
  await page.waitForURL(`${origin}/admin/login`);
  await page.getByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", { exact: true }).waitFor();
  await page.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }).uncheck();
  await page.getByLabel("Tên đăng nhập").fill(user.username);
  await page.locator('input[name="password"]').fill("browser-fixture-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(`${origin}/admin/tools`);
  await page.getByTestId("teacher-tools-page").waitFor();
  await page.reload();
  await page.getByTestId("teacher-tools-page").waitFor();
  assert(await page.evaluate(() => !localStorage.getItem("teacher-token") && Boolean(sessionStorage.getItem("teacher-token"))), "Session-only login did not survive refresh in sessionStorage");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(`${origin}/admin/login`);
  assert(calls.every((pathname) => pathname.startsWith("/api/auth/") || pathname.startsWith("/api/public/pdf/")), "Unexpected business API request");
  // Enabled guest fixture: no teacher login, preserved history after reload, one-use download POST.
  pdfEnabled=true;
  await page.goto(origin+"/tools");
  await page.getByTestId("pdf-links").locator("textarea").first().fill("https://drive.google.com/file/d/owned_fixture_12345/view");
  assert.equal(await page.getByRole("checkbox",{name:/có quyền tải xuống/}).count(),0);
  await page.getByTestId("pdf-submit").click();
  await page.getByTestId("pdf-download").waitFor();
  assert.equal(guestSubmitted,true);
  await page.reload();
  await page.getByTestId("pdf-download").waitFor();
  const downloadEvent=page.waitForEvent("download");
  await page.getByTestId("pdf-download").click();
  const downloaded=await downloadEvent;
  assert.match(downloaded.suggestedFilename(),/\.pdf$/);
  assert(calls.includes("/api/public/pdf/session"));
  assert(calls.includes("/api/public/pdf/jobs/"+guestJobId+"/download"));
  assert.deepEqual(errors, []);
  passed = true;
  console.log("Teacher Tools browser smoke passed: public tools/reload/navigation, protected admin/login/refresh/redirects/logout; mobile/tablet/desktop. Auth API mocked; no backend verification.");
} finally {
  await finalizePlaywrightArtifacts(browser, policy, passed);
  if (browser) await browser.close();
  web.kill();
}
