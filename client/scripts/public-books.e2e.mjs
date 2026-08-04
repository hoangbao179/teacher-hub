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

async function assertCompactLibraryFooter(page, label) {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="book-shell"]');
    const main = shell?.querySelector(":scope > main");
    const footer = shell?.querySelector(":scope > footer");
    if (!shell || !main || !footer) return null;
    const shellStyle = window.getComputedStyle(shell);
    const mainStyle = window.getComputedStyle(main);
    const footerStyle = window.getComputedStyle(footer);
    return {
      shellDisplay: shellStyle.display,
      shellDirection: shellStyle.flexDirection,
      shellMinHeight: shellStyle.minHeight,
      mainFlexGrow: mainStyle.flexGrow,
      footerFlexGrow: footerStyle.flexGrow,
      footerFlexShrink: footerStyle.flexShrink,
      footerHeight: footer.getBoundingClientRect().height,
    };
  });
  assert(layout, `${label} shell layout is missing`);
  assert(layout.shellDisplay === "flex" && layout.shellDirection === "column", `${label} shell is not a flex column: ${JSON.stringify(layout)}`);
  assert(layout.mainFlexGrow === "1", `${label} main does not own remaining space: ${JSON.stringify(layout)}`);
  assert(layout.footerFlexGrow === "0" && layout.footerFlexShrink === "0" && layout.footerHeight < 80, `${label} footer stretches: ${JSON.stringify(layout)}`);
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
  await context.addInitScript(() => {
    window.__pageTurnSoundStarts = 0;
    class FakeAudioNode {
      connect(node) { return node; }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = 8000;
      currentTime = 0;
      destination = new FakeAudioNode();
      createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() {
        const node = new FakeAudioNode();
        node.start = () => {
          window.__pageTurnSoundStarts += 1;
          window.setTimeout(() => node.onended?.(), 0);
        };
        return node;
      }
      createBiquadFilter() {
        const node = new FakeAudioNode();
        node.frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
        node.Q = { value: 0 };
        return node;
      }
      createGain() {
        const node = new FakeAudioNode();
        node.gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
        return node;
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
  });
  let officialImageRequestCount = 0;
  let officialManifestRequestCount = 0;
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/book-pages/")) officialManifestRequestCount += 1;
  });
  await context.route("https://cdn3.olm.vn/**", async (route) => {
    officialImageRequestCount += 1;
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#eaf9ff"/><rect x="40" y="40" width="520" height="820" rx="24" fill="#fff" stroke="#159f98" stroke-width="8"/><text x="300" y="440" text-anchor="middle" font-size="42" fill="#152337">NXBGD</text><text x="300" y="500" text-anchor="middle" font-size="28" fill="#087a72">Trang sách kiểm thử</text></svg>' });
  });
  await context.route("https://online.flipbuilder.com/**", async (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#263445;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh}.spread{display:flex;gap:12px;width:88%;height:80%}.page{flex:1;background:#fff;color:#172238;display:grid;place-items:center;border-radius:4px}button{position:fixed;bottom:24px;min-height:44px}</style><main class="spread"><section class="page">Trang giữa bên trái</section><section class="page">Trang giữa bên phải</section></main><button aria-label="Phát bài nghe">▶ Bài nghe</button>' }));
  const page = await context.newPage();
  const pageErrors = [];
  const hydrationWarnings = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text())) hydrationWarnings.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("header-books").getAttribute("aria-current") === "page", "Books header section is not active");
  assert(await page.getByTestId("header-learning").getAttribute("href") === "/hoc", "Books header cannot switch to learning");
  assert(await page.getByTestId("header-admin").getAttribute("href") === "/admin/login", "Books header has no Admin route");
  assert(await page.getByRole("heading", { name: "Sách học sinh và tài liệu giáo viên", level: 1 }).isVisible(), "New library hero is missing");
  assert(await page.getByRole("button", { name: "Sách học sinh", exact: true }).getAttribute("aria-pressed") === "true", "Student books must be selected by default");
  assert(await page.locator('[data-testid^="book-card-"]').count() === 13, "Default library must show 13 student books");
  assert(await page.locator("iframe").count() === 0, "Library must not create an iframe");
  assert(await page.getByText(/tất cả sách.*(?:audio|bài nghe)/i).count() === 0, "Library still claims all books have audio");
  assert(await page.getByRole("heading", { name: "Chọn sách" }).count() === 0, "Redundant library heading is still visible");
  assert(await page.getByText("Chọn loại tài liệu và lớp để tìm nhanh hơn.", { exact: true }).count() === 0, "Redundant library instructions are still visible");
  assert(await page.getByRole("link", { name: "Mở sách", exact: true }).count() === 13, "Student cards do not expose one consistent main CTA");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Library still links the compatibility audio route");
  await assertNoOverflow(page, "Student library 1440");
  await screenshot(page, "library-student-1440.png");

  await page.goto(`${origin}/sach?grade=1`, { waitUntil: "networkidle" });
  assert(await page.locator('[data-testid^="book-card-"]').count() === 1, "Grade 1 student filter does not show one card");
  await assertCompactLibraryFooter(page, "Student grade 1 desktop");
  await screenshot(page, "library-grade-1-1440.png");
  await page.goto(`${origin}/sach?grade=1&type=student`, { waitUntil: "networkidle" });
  await assertCompactLibraryFooter(page, "Explicit student grade 1 desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach?grade=1`, { waitUntil: "networkidle" });
  await assertCompactLibraryFooter(page, "Student grade 1 mobile");
  await screenshot(page, "library-grade-1-390.png");
  await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
  await assertNoOverflow(page, "Student library 390");
  const mobileHeroBox = await page.getByTestId("book-library-hero").boundingBox();
  assert(mobileHeroBox && mobileHeroBox.height < 210, `Mobile library hero is still too tall: ${mobileHeroBox?.height}`);
  const mobileTypeFilterBox = await page.getByTestId("book-type-filter").boundingBox();
  assert(mobileTypeFilterBox && mobileTypeFilterBox.width >= 350, `Mobile book type filter does not use the available width: ${mobileTypeFilterBox?.width}`);
  assert(await page.getByTestId("grade-scroll-hint").getByText("Vuốt để xem thêm →", { exact: true }).isVisible(), "Mobile grade scroller has no discoverability hint");
  const gradeFilterDimensions = await page.getByTestId("book-grade-filter").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: window.getComputedStyle(element).overflowX }));
  assert(gradeFilterDimensions.scrollWidth > gradeFilterDimensions.clientWidth && gradeFilterDimensions.overflowX === "auto", `Mobile grade filter is not a single horizontal scroller: ${JSON.stringify(gradeFilterDimensions)}`);
  const firstMobileCard = page.locator('[data-testid^="book-card-"]').first();
  const firstMobileCardBox = await firstMobileCard.boundingBox();
  const firstMobileCtaBox = await firstMobileCard.getByRole("link", { name: "Mở sách", exact: true }).boundingBox();
  assert(firstMobileCardBox && firstMobileCtaBox && firstMobileCtaBox.width >= firstMobileCardBox.width - 24, `Mobile card CTA does not span the card content width: ${JSON.stringify({ card: firstMobileCardBox?.width, cta: firstMobileCtaBox?.width })}`);
  assert(!(await firstMobileCard.getByTestId("book-description").isVisible()), "Redundant card description is still visible on mobile");
  await screenshot(page, "library-student-390.png");

  await page.getByRole("button", { name: "Lớp 3" }).click();
  assert(await page.getByTestId("book-group-3").locator("article").count() === 2, "Grade 3 students must show two volumes");
  assert(await page.getByTestId("book-group-3").getByRole("link", { name: "Mở sách", exact: true }).count() === 2, "Student cards do not use the main reading route");
  assert(await page.getByTestId("book-group-3").getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Student cards still expose audio CTAs");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach?type=teacher`, { waitUntil: "networkidle" });
  assert(await page.getByRole("button", { name: "Tài liệu giáo viên", exact: true }).getAttribute("aria-pressed") === "true", "Teacher filter is not active from query");
  assert(await page.locator('[data-testid^="book-card-"]').count() === 8, "Teacher library must show eight verified books");
  assert(await page.getByRole("link", { name: "Mở tài liệu", exact: true }).count() === 8, "Teacher cards do not expose one consistent main CTA");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Teacher cards expose audio CTA");
  await assertNoOverflow(page, "Teacher library 1440");
  await screenshot(page, "library-teacher-1440.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach?type=teacher&grade=3`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("book-group-3").locator("article").count() === 1, "Grade 3 teacher book is duplicated");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Grade 3 teacher view exposes audio CTA");
  await assertNoOverflow(page, "Teacher grade 3 library 390");
  await screenshot(page, "library-teacher-grade-3-390.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach?grade=1&type=teacher`, { waitUntil: "networkidle" });
  await assertCompactLibraryFooter(page, "Teacher grade 1 desktop");

  if (artifactPolicy.mode === "review")
    await context.tracing.start({ screenshots: true, snapshots: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  const officialViewer = page.getByTestId("official-page-image-viewer");
  const pageScroll = page.getByTestId("official-page-scroll");
  const pageFlip = page.getByTestId("responsive-page-flip");
  await pageFlip.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "single");
  assert(await page.locator("header").count() === 0, "Reader route still mounts the public header");
  assert(await page.getByRole("button", { name: "Tắt âm thanh lật trang" }).count() === 1, "NXBGD reader sound toggle is missing");
  assert(await page.evaluate(() => window.__pageTurnSoundStarts) === 0, "Page-turn sound played during reader mount");
  assert(officialImageRequestCount < 30, `Reader eagerly loaded too many page images on open: ${officialImageRequestCount}`);
  assert(await officialViewer.locator("iframe").count() === 0, "Official reader still uses an iframe");
  assert(await pageFlip.locator('[data-manifest-page]').count() === 82, "Flipbook page nodes are missing");
  assert(await pageFlip.locator("img").count() > 0 && await pageFlip.locator('img:not([draggable="false"])').count() === 0, "Loaded flipbook images remain draggable");
  assert(await pageFlip.getAttribute("data-reader-mode") === "single", "390px reader is not in single-page mode");
  assert(await pageFlip.getAttribute("data-flip-gestures") === "enabled", "Mobile flip gestures are disabled at 100%");
  assert(await page.getByText(/bài nghe|nhấn biểu tượng loa/i).count() === 0, "Official reader shows audio copy");
  assert(await page.locator('img[alt^="Bìa minh họa"]').count() === 0, "Reader still shows the large cover block");
  assert(await page.locator("footer").count() === 0, "Reader mode still renders the public footer");
  const mobileReaderHeader = await page.getByTestId("book-reader-header").boundingBox();
  const mobileOfficialBox = await officialViewer.boundingBox();
  assert(mobileReaderHeader && mobileOfficialBox && mobileOfficialBox.y - (mobileReaderHeader.y + mobileReaderHeader.height) < 12, "Mobile reader is separated from its compact header");
  assert(mobileOfficialBox.width >= 380, `Mobile reader is too narrow: ${mobileOfficialBox.width}`);
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
  await page.waitForFunction(() => window.__pageTurnSoundStarts === 1);
  await page.getByRole("button", { name: "Tắt âm thanh lật trang" }).click();
  assert(await page.evaluate(() => window.localStorage.getItem("teacher-hub.book-page-sound.enabled")) === "false", "Muted page-turn preference was not stored");
  await page.getByRole("button", { name: "Trang sau" }).click();
  await waitForReaderPage(page, 3);
  assert(await page.evaluate(() => window.__pageTurnSoundStarts) === 1, "Muted page flip played a sound");
  await page.getByRole("button", { name: "Bật âm thanh lật trang" }).click();
  assert(await page.evaluate(() => window.localStorage.getItem("teacher-hub.book-page-sound.enabled")) === "true", "Enabled page-turn preference was not stored");
  await page.waitForTimeout(220);
  await page.getByRole("button", { name: "Trang sau" }).click();
  await waitForReaderPage(page, 4);
  await page.waitForFunction(() => window.__pageTurnSoundStarts === 2);
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
  assert(await page.getByRole("spinbutton", { name: "Số trang" }).inputValue() === "4", "Swipe changed page while zoom was active");

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
  await waitForReaderPage(page, 5);
  assert(new URL(page.url()).searchParams.get("page") === "5", "Next page did not update the route query");
  assert(await page.getByTestId("official-page-zoom").getByText("100%", { exact: true }).isVisible(), "Page change did not reset zoom");
  const resetPosition = await pageScroll.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  assert(resetPosition.left === 0 && resetPosition.top === 0, "Page change did not reset scroll position");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1?page=10&series=global-success`, { waitUntil: "networkidle" });
  await waitForReaderPage(page, 10);
  assert(await pageFlip.getAttribute("data-reader-mode") === "single", "Mobile URL page reader changed mode");
  assert(await page.getByText("10 / 82", { exact: true }).isVisible(), "Mobile URL page 10 label is wrong");
  const backUrl = new URL(await page.getByRole("link", { name: "Quay lại Tủ sách" }).getAttribute("href"), origin);
  assert(backUrl.pathname === "/sach" && backUrl.searchParams.get("grade") === "3" && backUrl.searchParams.get("type") === "student" && backUrl.searchParams.get("series") === "global-success" && !backUrl.searchParams.has("page"), "Reader back link did not preserve the library filters");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForFunction(() => document.querySelector('[data-testid="responsive-page-flip"]')?.getAttribute("data-reader-mode") === "single");
  await waitForReaderPage(page, 10);
  assert(new URL(page.url()).searchParams.get("page") === "10", "Official reader resize lost the current page");
  await assertNoOverflow(page, "Reader 768");
  await screenshot(page, "reader-student-tablet-768.png");

  const requestsBeforeInteractive = officialImageRequestCount;
  const manifestsBeforeInteractive = officialManifestRequestCount;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1`, { waitUntil: "networkidle" });
  const interactiveViewer = page.getByTestId("interactive-audio-viewer");
  const interactiveFrame = interactiveViewer.locator("iframe");
  await interactiveFrame.waitFor();
  assert(await page.locator("header").count() === 0, "Desktop reader still mounts the public header");
  assert(await page.getByRole("button", { name: /âm thanh lật trang/i }).count() === 0, "FlipBuilder renders the NXBGD page-turn sound control");
  assert(await page.getByTestId("official-page-image-viewer").count() === 0, "Desktop mounted the official viewer beside FlipBuilder");
  assert(officialImageRequestCount === requestsBeforeInteractive, "Desktop fetched the NXBGD manifest or page images before FlipBuilder");
  assert(officialManifestRequestCount === manifestsBeforeInteractive, "Desktop fetched the NXBGD manifest before FlipBuilder");
  assert(await interactiveFrame.getAttribute("allow") === "autoplay; fullscreen", "Desktop FlipBuilder permissions are missing");
  assert(!((await interactiveFrame.getAttribute("sandbox")) ?? "").includes("allow-top-navigation"), "Desktop FlipBuilder can navigate the parent tab");
  assert(await interactiveFrame.contentFrame().getByRole("button", { name: "Phát bài nghe" }).isVisible(), "Interactive audio control is unavailable");
  const desktopViewerBox = await interactiveViewer.boundingBox();
  assert(desktopViewerBox && desktopViewerBox.width >= 1380, `Desktop reader is too narrow: ${desktopViewerBox?.width}`);
  assert(desktopViewerBox && desktopViewerBox.y < 70, `Desktop reader starts too low: ${desktopViewerBox?.y}`);
  assert(await page.locator("footer").count() === 0, "Desktop reader mode still renders the public footer");
  const desktopPageHeight = await page.evaluate(() => ({ viewport: window.innerHeight, document: document.documentElement.scrollHeight }));
  assert(desktopPageHeight.document <= desktopPageHeight.viewport + 1, `Desktop reader adds unnecessary page scroll: ${JSON.stringify(desktopPageHeight)}`);
  await assertNoOverflow(page, "Student reader 1440");
  await page.setViewportSize({ width: 1439, height: 900 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);
  await screenshot(page, "reader-student-desktop-1440.png");

  await page.setViewportSize({ width: 1280, height: 720 });
  await interactiveFrame.waitFor();
  const laptopFrameBox = await interactiveFrame.boundingBox();
  assert(laptopFrameBox && laptopFrameBox.height >= 630, `Laptop iframe does not use the height freed by removing the public header: ${laptopFrameBox?.height}`);
  await assertNoOverflow(page, "Student reader 1280x720");
  await screenshot(page, "reader-student-laptop-1280.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("official-page-image-viewer").waitFor();
  assert(await page.locator("iframe").count() === 0, "Resize kept the desktop iframe mounted on mobile");
  await screenshot(page, "reader-student-mobile-390-after-resize.png");
  if (artifactPolicy.mode === "review")
    await context.tracing.stop({ path: path.join(screenshotDir, "reader-flip-trace.zip") });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-sach-giao-vien`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("official-page-image-viewer").isVisible(), "Teacher reader does not use the official page image viewer");
  assert(await page.locator("iframe").count() === 0, "Teacher official reader still uses an iframe");
  assert(await page.locator("header").count() === 0, "Teacher reader still mounts the public header");
  assert(await page.getByRole("button", { name: "Tắt âm thanh lật trang" }).count() === 1, "Teacher NXBGD reader lacks the page-turn UI sound control");
  assert(await page.getByRole("link", { name: "Nghe bài tương tác" }).count() === 0, "Teacher reader exposes audio CTA");
  assert(await page.getByText(/bài nghe|nhấn biểu tượng loa/i).count() === 0, "Teacher reader shows audio copy");
  const soundsBeforeTeacherFlip = await page.evaluate(() => window.__pageTurnSoundStarts);
  await page.getByRole("button", { name: "Trang sau" }).click();
  await waitForReaderPage(page, 2);
  await page.waitForFunction((expected) => window.__pageTurnSoundStarts === expected, soundsBeforeTeacherFlip + 1);
  assert(await page.getByText("2–3 / 314", { exact: true }).isVisible(), "Teacher desktop reader does not show a two-page spread");
  await assertNoOverflow(page, "Teacher reader 1440");
  await screenshot(page, "reader-teacher-desktop-1440.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/sach/global-success/tieng-anh-3-sach-giao-vien`, { waitUntil: "networkidle" });
  assert(await page.getByTestId("official-page-image-viewer").isVisible(), "Teacher mobile reader does not use NXBGD");
  assert(await page.locator("iframe").count() === 0, "Teacher mobile reader mounted FlipBuilder");
  assert(await page.getByRole("button", { name: /âm thanh lật trang/i }).count() === 1, "Teacher mobile reader lacks the page-turn sound control");
  await assertNoOverflow(page, "Teacher reader 390");
  await screenshot(page, "reader-teacher-mobile-390.png");

  await context.route(`**/book-pages/global-success/tieng-anh-9-sach-giao-vien.json`, async (route) => route.fulfill({ status: 500, body: "manifest unavailable" }));
  await page.goto(`${origin}/sach/global-success/tieng-anh-9-sach-giao-vien`, { waitUntil: "networkidle" });
  assert(await page.getByText("Dữ liệu trang sách chưa tải được.", { exact: false }).isVisible(), "Invalid manifest lacks friendly fallback");
  assert(await page.getByRole("link", { name: "Mở trên trang NXBGD", exact: true }).getAttribute("target") === "_blank", "Official fallback link is unsafe or missing");
  assert(await page.locator("iframe").count() === 0, "Manifest failure renders an iframe");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-tap-1/nghe`, { waitUntil: "networkidle" });
  const iframe = page.locator("iframe");
  assert(await page.locator("header").count() === 0, "Compatibility audio route still mounts the public header");
  assert(await page.getByTestId("book-reader-header").isVisible(), "Compatibility audio route lacks the compact reader header");
  assert(await iframe.getAttribute("src") === "https://online.flipbuilder.com/sdtta/jreh/", "Audio route does not use FlipBuilder source");
  assert(await iframe.getAttribute("allow") === "autoplay; fullscreen", "Audio viewer permissions are missing");
  const sandbox = (await iframe.getAttribute("sandbox"))?.split(" ") ?? [];
  assert(!sandbox.some((permission) => permission.startsWith("allow-top-navigation")), "Audio sandbox permits top navigation");
  assert(await page.getByText("Đây là bản nghe tương tác được mở từ viewer bên ngoài.", { exact: false }).count() === 0, "Compatibility route still renders the large audio introduction");
  assert(await page.getByRole("button", { name: "Mở chế độ đọc", exact: true }).count() === 0, "Removed fullscreen/orientation workaround remains");
  await screenshot(page, "interactive-audio-1440.png");

  await page.goto(`${origin}/sach/global-success/tieng-anh-3-sach-giao-vien/nghe`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Chưa tìm thấy cuốn sách này", level: 1 }).isVisible(), "Invalid teacher audio route lacks friendly state");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/sach`, { waitUntil: "networkidle" });
    await assertNoOverflow(page, `Library ${viewport.width}`);
  }

  assert(pageErrors.length === 0, `Reader emitted page errors: ${JSON.stringify(pageErrors)}`);
  assert(hydrationWarnings.length === 0, `Reader emitted hydration warnings: ${JSON.stringify(hydrationWarnings)}`);
  console.log(`Public books E2E passed; temporary screenshots: ${screenshotDir}`);
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
