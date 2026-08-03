/* global process, fetch, setTimeout, document, window, console, URL, Touch, TouchEvent */
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";
import { stableBookPathnames } from "../src/features/books/seo/bookMetadata.ts";

const root = path.resolve(import.meta.dirname, "../..");
const artifactPolicy = createArtifactPolicy(root, "public-books", {});
let artifactRunPassed = false;
const clientRoot = path.join(root, "client");
const port = 5191;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = artifactPolicy.runDir;
let child;
let browser;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function waitForReaderPage(page, expected) {
  await page.waitForFunction((pageNumber) => document.querySelector('input[aria-label="Số trang"]')?.value === String(pageNumber), expected);
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", testId: element.getAttribute("data-testid"), right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width }))
      .filter((item) => item.right > document.documentElement.clientWidth + 1)
      .slice(0, 5),
  }));
  assert(overflow.scrollWidth <= overflow.clientWidth, `${label} overflows horizontally: ${JSON.stringify(overflow)}`);
}

try {
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: clientRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  for (const pathname of stableBookPathnames) {
    const html = await (await fetch(`${origin}${pathname}/index.html`)).text();
    assert(html.includes('id="root" data-prerendered="true"'), `Prerender missing: ${pathname}`);
    assert((html.match(/<h1\b/g) ?? []).length === 1, `Prerender must contain one H1: ${pathname}`);
    assert(html.includes(`rel="canonical" href="https://tienganhcovy.com${pathname}"`), `Canonical missing: ${pathname}`);
  }

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const context = await browser.newContext();
  let officialImageRequestCount = 0;
  await context.route("https://cdn3.olm.vn/**", async (route) => {
    officialImageRequestCount += 1;
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#eaf9ff"/><rect x="40" y="40" width="520" height="820" rx="24" fill="#fff" stroke="#159f98" stroke-width="8"/><text x="300" y="440" text-anchor="middle" font-size="42" fill="#152337">NXBGD</text><text x="300" y="500" text-anchor="middle" font-size="28" fill="#087a72">Trang sách kiểm thử</text></svg>' });
  });
  await context.route("https://online.flipbuilder.com/**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Interactive audio test viewer</title><main>Interactive audio viewer</main>" }));
  const page = await context.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Sách học sinh và tài liệu giáo viên", level: 1 }).isVisible(), "New library hero is missing");
  assert(await page.getByRole("button", { name: "Sách học sinh", exact: true }).getAttribute("aria-pressed") === "true", "Student books must be selected by default");
  assert(await page.locator('[data-testid^="book-card-"]').count() === 13, "Default library must show 13 student books");
  assert(await page.locator("iframe").count() === 0, "Library must not create an iframe");
  assert(await page.getByText(/tất cả sách.*(?:audio|bài nghe)/i).count() === 0, "Library still claims all books have audio");
  await assertNoOverflow(page, "Student library 1440");
  await screenshot(page, "library-student-1440.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
  await assertNoOverflow(page, "Student library 390");
  await screenshot(page, "library-student-390.png");

  await page.getByRole("button", { name: "Lớp 3" }).click();
  assert(await page.getByTestId("book-group-3").locator("article").count() === 2, "Grade 3 students must show two volumes");
  assert(await page.getByTestId("book-group-3").getByRole("link", { name: "Nghe bài tương tác" }).count() === 2, "Verified student audio CTAs are missing");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach?type=teacher`, { waitUntil: "networkidle" });
  assert(await page.getByRole("button", { name: "Tài liệu giáo viên", exact: true }).getAttribute("aria-pressed") === "true", "Teacher filter is not active from query");
  assert(await page.locator('[data-testid^="book-card-"]').count() === 8, "Teacher library must show eight verified books");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Teacher cards expose audio CTA");
  await assertNoOverflow(page, "Teacher library 1440");
  await screenshot(page, "library-teacher-1440.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach?type=teacher&grade=3`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("book-group-3").locator("article").count() === 1, "Grade 3 teacher book is duplicated");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Grade 3 teacher view exposes audio CTA");
  await assertNoOverflow(page, "Teacher grade 3 library 390");
  await screenshot(page, "library-teacher-grade-3-390.png");

  if (artifactPolicy.mode === "review")
    await context.tracing.start({ screenshots: true, snapshots: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  const officialViewer = page.getByTestId("official-page-image-viewer");
  const pageScroll = page.getByTestId("official-page-scroll");
  const pageFlip = page.getByTestId("responsive-page-flip");
  await pageFlip.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "single");
  assert(officialImageRequestCount < 30, `Reader eagerly loaded too many page images on open: ${officialImageRequestCount}`);
  assert(await officialViewer.locator("iframe").count() === 0, "Official reader still uses an iframe");
  assert(await pageFlip.locator('[data-manifest-page]').count() === 82, "Flipbook page nodes are missing");
  assert(await pageFlip.locator("img").count() > 0 && await pageFlip.locator('img:not([draggable="false"])').count() === 0, "Loaded flipbook images remain draggable");
  assert(await pageFlip.getAttribute("data-reader-mode") === "single", "390px reader is not in single-page mode");
  assert(await pageFlip.getAttribute("data-flip-gestures") === "enabled", "Mobile flip gestures are disabled at 100%");
  assert(await page.getByText("Nguồn chính thức NXBGD", { exact: true }).isVisible(), "Official source badge is missing");
  assert(await page.getByText(/bài nghe|nhấn biểu tượng loa/i).count() === 0, "Official reader shows audio copy");
  let dimensions = await pageScroll.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft }));
  assert(dimensions.scrollWidth === dimensions.clientWidth && dimensions.scrollLeft === 0, "Mobile fit-width is horizontally scrollable at 100%");
  await assertNoOverflow(page, "Reader 390 at 100%");
  await screenshot(page, "reader-mobile-cover.png");

  const flipBox = await pageFlip.locator(".stf__parent").boundingBox();
  assert(flipBox, "Mobile page-flip engine has no layout box");
  await pageFlip.locator(".stf__block").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const makeTouch = (x) => new Touch({ identifier: 1, target: element, clientX: x, clientY: rect.top + rect.height / 2, pageX: x, pageY: rect.top + rect.height / 2, radiusX: 2, radiusY: 2, force: 1 });
    const start = makeTouch(rect.right - 8);
    element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }));
    for (let step = 1; step <= 8; step += 1) {
      const move = makeTouch(rect.right - 8 - ((rect.width - 32) * step) / 8);
      window.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [move], changedTouches: [move] }));
    }
    const end = makeTouch(rect.left + 24);
    window.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }));
  });
  await waitForReaderPage(page, 2);
  assert(new URL(page.url()).searchParams.get("page") === "2", "Mobile swipe did not update query to page 2");
  await screenshot(page, "reader-mobile-after-swipe.png");

  await page.getByRole("button", { name: "Phóng to" }).click();
  await page.getByRole("button", { name: "Phóng to" }).click();
  assert(await page.getByTestId("official-page-zoom").getByText("150%", { exact: true }).isVisible(), "Mobile zoom did not reach 150%");
  assert(await pageFlip.getAttribute("data-flip-gestures") === "disabled", "Zoom 150% did not lock flip gestures");
  dimensions = await pageScroll.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  assert(dimensions.scrollWidth > dimensions.clientWidth, "Mobile zoom 150% has no native horizontal scroll range");
  await screenshot(page, "reader-mobile-150.png");

  const zoomBox = await page.getByTestId("official-page-zoom-layer").boundingBox();
  assert(zoomBox, "Zoom layer has no layout box");
  await page.mouse.move(zoomBox.x + zoomBox.width - 20, zoomBox.y + Math.min(200, zoomBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(zoomBox.x + 30, zoomBox.y + Math.min(200, zoomBox.height / 2), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(750);
  assert(await page.getByRole("spinbutton", { name: "Số trang" }).inputValue() === "2", "Swipe changed page while zoom was active");

  await page.getByRole("button", { name: "Vừa trang", exact: true }).click();
  await page.waitForTimeout(150);
  dimensions = await pageScroll.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft }));
  assert(await page.getByTestId("official-page-zoom").getByText("100%", { exact: true }).isVisible(), "Fit-width did not restore 100%");
  assert(await pageFlip.getAttribute("data-flip-gestures") === "enabled", "Fit-width did not re-enable gestures");
  assert(dimensions.scrollWidth === dimensions.clientWidth && dimensions.scrollLeft === 0, "Fit-width did not clear horizontal overflow");
  await screenshot(page, "reader-mobile-reset.png");

  await page.getByRole("button", { name: "Phóng to" }).click();
  await pageScroll.evaluate((element) => { element.scrollLeft = 60; element.scrollTop = 60; });
  await page.getByRole("button", { name: "Trang sau" }).click();
  await waitForReaderPage(page, 3);
  assert(new URL(page.url()).searchParams.get("page") === "3", "Next page did not update the route query");
  assert(await page.getByTestId("official-page-zoom").getByText("100%", { exact: true }).isVisible(), "Page change did not reset zoom");
  const resetPosition = await pageScroll.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  assert(resetPosition.left === 0 && resetPosition.top === 0, "Page change did not reset scroll position");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1?page=10`, { waitUntil: "networkidle" });
  await waitForReaderPage(page, 10);
  assert(await pageFlip.getAttribute("data-reader-mode") === "single", "Mobile URL page reader changed mode");
  assert(await page.getByText("10 / 82", { exact: true }).isVisible(), "Mobile URL page 10 label is wrong");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "double");
  await waitForReaderPage(page, 10);
  assert(new URL(page.url()).searchParams.get("page") === "10", "Resize lost the current query page");
  assert(await page.getByText("10–11 / 82", { exact: true }).isVisible(), "Desktop spread label after resize is wrong");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "double");
  const visibleCoverPages = pageFlip.locator('.stf__item[data-manifest-page]:visible');
  assert(await visibleCoverPages.count() === 1, "Desktop cover is not shown alone");
  assert(await visibleCoverPages.first().getAttribute("data-manifest-page") === "1", "Desktop starts on the wrong cover page");
  const desktopFlipBox = await pageFlip.locator(".stf__parent").boundingBox();
  const desktopReaderBox = await pageFlip.boundingBox();
  assert(desktopFlipBox && desktopReaderBox && desktopFlipBox.width < desktopReaderBox.width, "Desktop book is stretched across the whole viewer");
  await screenshot(page, "reader-desktop-cover.png");

  await page.getByRole("button", { name: "Trang sau" }).click();
  await page.waitForTimeout(160);
  const animationShadow = pageFlip.locator(".stf__hardShadow");
  assert((await animationShadow.getAttribute("style"))?.includes("display: block"), "Page-flip animation shadow did not appear");
  await screenshot(page, "reader-desktop-mid-flip.png");
  await waitForReaderPage(page, 2);
  const visibleSpreadPages = pageFlip.locator('.stf__item[data-manifest-page]:visible');
  assert(await visibleSpreadPages.count() === 2, "Desktop does not show a two-page spread after the cover");
  assert((await visibleSpreadPages.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-manifest-page")).sort())).join(",") === "2,3", "Desktop spread duplicated or skipped a page");
  assert(await page.getByText("2–3 / 82", { exact: true }).isVisible(), "Desktop spread label is wrong");
  await screenshot(page, "reader-desktop-spread.png");

  await page.getByRole("button", { name: "Trang sau" }).click();
  await waitForReaderPage(page, 4);
  await page.keyboard.press("ArrowLeft");
  await waitForReaderPage(page, 2);
  await page.keyboard.press("ArrowRight");
  await waitForReaderPage(page, 4);
  await screenshot(page, "reader-desktop-after-flip.png");

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "single");
  await waitForReaderPage(page, 4);
  assert(new URL(page.url()).searchParams.get("page") === "4", "Tablet resize lost the current page");
  await assertNoOverflow(page, "Reader 768");
  if (artifactPolicy.mode === "review")
    await context.tracing.stop({ path: path.join(screenshotDir, "reader-flip-trace.zip") });

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-sach-giao-vien`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("official-page-image-viewer").isVisible(), "Teacher reader does not use the official page image viewer");
  assert(await page.locator("iframe").count() === 0, "Teacher official reader still uses an iframe");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Teacher reader exposes audio CTA");
  assert(await page.getByText(/bài nghe|nhấn biểu tượng loa/i).count() === 0, "Teacher reader shows audio copy");

  await context.route(`**/book-pages/global-success/tieng-anh-9-sach-giao-vien.json`, async (route) => route.fulfill({ status: 500, body: "manifest unavailable" }));
  await page.goto(`${origin}/sach/global-success/tieng-anh-9-sach-giao-vien`, { waitUntil: "networkidle" });
  assert(await page.getByText("Dữ liệu trang sách chưa tải được.", { exact: false }).isVisible(), "Invalid manifest lacks friendly fallback");
  assert(await page.getByRole("link", { name: "Mở trên trang NXBGD", exact: true }).getAttribute("target") === "_blank", "Official fallback link is unsafe or missing");
  assert(await page.locator("iframe").count() === 0, "Manifest failure renders an iframe");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1/nghe`, { waitUntil: "networkidle" });
  const iframe = page.locator("iframe");
  assert(await iframe.getAttribute("src") === "https://online.flipbuilder.com/sdtta/jreh/", "Audio route does not use FlipBuilder source");
  assert(await iframe.getAttribute("allow") === "autoplay; fullscreen", "Audio viewer permissions are missing");
  const sandbox = (await iframe.getAttribute("sandbox"))?.split(" ") ?? [];
  assert(!sandbox.some((permission) => permission.startsWith("allow-top-navigation")), "Audio sandbox permits top navigation");
  assert(await page.getByText("Đây là bản nghe tương tác được mở từ viewer bên ngoài.", { exact: false }).isVisible(), "Audio source explanation is missing");
  assert(await page.getByRole("button", { name: "Mở chế độ đọc", exact: true }).count() === 0, "Removed fullscreen/orientation workaround remains");
  await screenshot(page, "interactive-audio-1440.png");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-sach-giao-vien/nghe`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Chưa tìm thấy cuốn sách này", level: 1 }).isVisible(), "Invalid teacher audio route lacks friendly state");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
    await assertNoOverflow(page, `Library ${viewport.width}`);
  }

  console.log(`Public books E2E passed; temporary screenshots: ${screenshotDir}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
