/* global process, fetch, setTimeout, console, URL, document, getComputedStyle, window */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5178;
const origin = `http://127.0.0.1:${port}`;
const artifactDir = path.join(root, ".agent-reports", "v1-2-homepage");
fs.mkdirSync(artifactDir, { recursive: true });
let child;
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: clientRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="#ded7f8"/></svg>',
  }));
  await page.goto(origin, { waitUntil: "networkidle" });

  await page.getByRole("heading", { level: 1, name: "Lớp học cô Vy" }).waitFor();
  assert(await page.locator("h1").count() === 1, "Homepage must contain exactly one H1");
  assert(await page.getByTestId("hero-carousel").count() === 0, "Homepage still renders the removed slideshow");

  for (const heading of ["Xin chào, cô là Uyên Vy.", "Tiếng Anh lớp 1–9", "Rõ ràng, vừa sức", "Xem thử cách", "Những phản hồi dành cho cô Vy", "Cùng cô Vy tìm cách học phù hợp cho con"]) {
    await page.getByRole("heading", { name: new RegExp(heading) }).first().waitFor();
  }
  await page.getByText("Ba mẹ có thể nhắn cô Vy để chia sẻ tình hình học hiện tại, thời gian phù hợp và phần con đang cần hỗ trợ. Cô sẽ trao đổi thêm về lớp học và cách học phù hợp.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Nhắn Zalo", exact: true }).waitFor();
  await page.getByText("Trao đổi về tình hình học và lịch học của con", { exact: true }).waitFor();
  for (const label of ["Lớp 1–9", "1–1 hoặc nhóm nhỏ", "Tại Huế"])
    await page.getByText(label, { exact: true }).waitFor();
  await page.getByText("2026 — từ người hâm mộ cô Vy, with love ❤️", { exact: true }).waitFor();
  for (const program of ["Tiếng Anh tiểu học – lớp 1–5", "Tiếng Anh THCS – lớp 6–9", "Luyện thi theo mục tiêu"])
    await page.getByRole("heading", { level: 3, name: program, exact: true }).waitFor();
  for (const programDetail of ["Củng cố kiến thức trên trường", "Luyện thi Nguyễn Tri Phương", "Luyện thi 9 lên 10"])
    await page.getByText(programDetail, { exact: true }).first().waitFor();
  const teacherPhoto = page.locator('#about img[src="/images/covy-image.png"]');
  await teacherPhoto.waitFor();
  assert(await teacherPhoto.evaluate((image) => getComputedStyle(image).objectFit) === "cover", "Teacher photo does not use object-fit: cover");
  await page.getByTestId("testimonial-list").waitFor();
  assert(await page.getByText("Phụ huynh thường quan tâm", { exact: true }).count() === 0, "Removed parent FAQ heading is still rendered");
  assert(await page.getByText("PHỤ HUYNH VÀ CÔ VY", { exact: true }).count() === 0, "Removed parent FAQ eyebrow is still rendered");
  assert(await page.getByTestId("testimonial-list").locator("figure").count() === 3, "Homepage must render exactly three testimonials");
  for (const testimonial of [
    ["Mẹ bé M.", "Học sinh lớp 2", "Trước đây bé khá ngại học tiếng Anh, nhất là phần đọc và nhớ từ. Học với cô một thời gian, bé chủ động xem lại bài hơn, về nhà còn tự đọc lại những từ cô đã hướng dẫn."],
    ["Mẹ bé N.", "Học sinh lớp 6", "Con bị hổng ngữ pháp nên lúc làm bài thường khá rối và dễ nản. Cô chỉ lại từng phần, giao bài vừa sức nên dần dần con hiểu bài hơn và làm bài cũng chắc hơn trước."],
    ["Phụ huynh bé H.", "Học sinh lớp 9", "Giai đoạn ôn thi gia đình khá lo vì con chưa biết nên tập trung vào phần nào. Cô theo sát, sửa kỹ từng lỗi và hướng dẫn cách làm bài nên con bình tĩnh và tự tin hơn nhiều."],
  ]) for (const copy of testimonial) await page.getByText(copy, { exact: true }).waitFor();
  const testimonialBackgrounds = await page.getByTestId("testimonial-list").locator("figure").evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundImage));
  assert(new Set(testimonialBackgrounds).size === 3, "Testimonial cards do not use three distinct pastel backgrounds");

  const contactTargets = await page.locator('a[href^="https://zalo.me/"],a[href^="tel:"],a[href^="https://www.facebook.com/"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), target: link.getAttribute("target"), rel: link.getAttribute("rel") })));
  assert(contactTargets.length >= 2, `Expected configured contact links, found ${contactTargets.length}`);
  assert(!contactTargets.some((item) => item.href?.startsWith("tel:")), "Homepage still renders a phone CTA");
  assert(contactTargets.some((item) => item.href === "https://www.facebook.com/uyenvy.le.12"), "Facebook CTA does not use the approved URL");
  for (const item of contactTargets.filter((link) => link.href?.startsWith("http"))) {
    new URL(item.href);
    assert(item.target === "_blank" && item.rel?.includes("noopener") && item.rel?.includes("noreferrer"), `Unsafe external link: ${item.href}`);
  }
  assert(await page.locator('a[href="#"]').count() === 0, "Homepage contains a placeholder href");
  assert(await page.getByText("Cô Vy sẽ tư vấn lộ trình phù hợp", { exact: false }).count() === 0, "Repeated contact copy is still visible");
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === "smooth", "Homepage does not enable smooth anchor scrolling");
  await page.getByRole("link", { name: "Liên hệ", exact: true }).click();
  await page.waitForFunction(() => window.location.hash === "#contact");
  await page.waitForTimeout(1_000);
  const contactOffset = await page.locator("#contact").evaluate((element) => element.getBoundingClientRect().top);
  assert(contactOffset >= 60 && contactOffset < 844, `Contact section is hidden or overlapped after anchor navigation: ${contactOffset}px`);

  if (await page.locator('iframe[src*="youtube"]').count()) throw new Error("YouTube iframe loaded before interaction");
  assert(await page.getByTestId("learning-video-list").locator("article").count() === 2, "Homepage must render exactly two learning videos");
  const videoThumbnails = await page.getByTestId("learning-video-list").locator('img[src*="i.ytimg.com"]').evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  assert(new Set(videoThumbnails).size === 2 && videoThumbnails.every((src) => src?.endsWith("/maxresdefault.jpg")) && videoThumbnails.some((src) => src?.includes("qD1pnquN_DM")), `Learning videos are missing, duplicated or not 16:9 thumbnails: ${videoThumbnails.join(", ")}`);
  const mediaBeforePlay = await page.getByTestId("learning-video-media").first().boundingBox();
  await page.getByRole("button", { name: /Phát video:/ }).first().click();
  const iframe = page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first();
  await iframe.waitFor();
  assert(Boolean(await iframe.getAttribute("title")), "Learning video iframe has no accessible title");
  const mediaAfterPlay = await page.getByTestId("learning-video-media").first().boundingBox();
  assert(mediaBeforePlay && mediaAfterPlay && Math.abs(mediaBeforePlay.width - mediaAfterPlay.width) <= 1 && Math.abs(mediaBeforePlay.height - mediaAfterPlay.height) <= 1, `Video media frame shifts after play: ${JSON.stringify({ mediaBeforePlay, mediaAfterPlay })}`);

  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    structured: document.querySelector('script[type="application/ld+json"]')?.textContent,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.innerText,
  }));
  assert(metadata.title === "Lớp học tiếng Anh cô Vy | Tiếng Anh lớp 1–9 tại Huế", `Unexpected Homepage title: ${metadata.title}`);
  assert(metadata.description === "Kèm cặp tiếng Anh 1–1 và lớp nhóm nhỏ cho học sinh lớp 1–9 tại Huế.", `Unexpected Homepage description: ${metadata.description}`);
  assert(metadata.robots === "index,follow,max-image-preview:large", `Unexpected public robots metadata: ${metadata.robots}`);
  assert(metadata.canonical === "https://tienganhcovy.com/", `Unexpected canonical URL: ${metadata.canonical}`);
  assert(metadata.structured && JSON.parse(metadata.structured)["@type"] === "Person", "Person structured data is missing");
  assert(metadata.overflow <= 1, `Homepage horizontal overflow: ${metadata.overflow}px`);
  assert(!/Nội dung minh họa cho môi trường phát triển|Ảnh tạm|Video tạm|Chưa cấu hình|from người hâm mộ/i.test(metadata.body), "Visitor-facing development warning remains");
  assert(!/Cô giáo An|Học Toán|Xây nền Toán/i.test(metadata.body), "Old teacher or mathematics branding remains");
  assert(!/\b\d{1,3}(?:[. ]\d{3})+\s*(?:đ|VND)\b/i.test(metadata.body), "Homepage exposes a public tuition price");
  for (const teacherCopy of [
    "Đồng hành cùng học sinh lớp 1–9 tại Huế. Kèm cặp 1–1, lớp nhóm nhỏ, củng cố phần còn yếu và luyện thi theo mục tiêu.",
    "Kèm cặp 1–1 và nhóm nhỏ",
    "Theo sát năng lực từng học sinh",
    "Luyện thi Nguyễn Tri Phương",
    "Luyện thi 9 lên 10",
  ]) assert(metadata.body.includes(teacherCopy), `Teacher introduction is missing: ${teacherCopy}`);
  assert(metadata.body.includes("2026 — từ người hâm mộ cô Vy, with love ❤️"), "Personalized footer copy is missing");

  const viewports = [
    { width: 360, height: 800 }, { width: 375, height: 812 }, { width: 390, height: 844 },
    { width: 393, height: 852 }, { width: 400, height: 930 }, { width: 412, height: 915 },
    { width: 430, height: 932 }, { width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator("#about").waitFor();
    const metrics = await page.evaluate(() => {
      const about = document.querySelector("#about");
      return {
        aboutTop: about?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        labels: [...document.querySelectorAll("button,a")].filter((item) => getComputedStyle(item).display !== "none").map((item) => item.textContent?.trim()),
      };
    });
    assert(metrics.overflow <= 1, `Homepage overflow at ${viewport.width}px: ${metrics.overflow}px`);
    if (viewport.width <= 430) assert(metrics.aboutTop < viewport.height, `Introduction is not discoverable at ${viewport.width}px`);
    assert(metrics.labels.includes("Nhắn Zalo"), `Contact Zalo CTA is not visible at ${viewport.width}px`);
    const videoLayout = await page.getByTestId("learning-video-list").evaluate((element) => {
      const cards = [...element.children].map((child) => child.getBoundingClientRect());
      return { display: getComputedStyle(element).display, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, cards };
    });
    if (viewport.width < 768) {
      assert(videoLayout.display === "flex" && videoLayout.cards[0].width >= viewport.width * 0.88 && videoLayout.cards[0].width <= viewport.width * 0.92, `Mobile video card width is not 88–92vw at ${viewport.width}px`);
      assert(videoLayout.scrollWidth > videoLayout.clientWidth, `Mobile videos are not horizontally scrollable at ${viewport.width}px`);
    } else {
      assert(videoLayout.display === "grid" && videoLayout.cards.length === 2 && Math.abs(videoLayout.cards[0].y - videoLayout.cards[1].y) <= 1 && Math.abs(videoLayout.cards[0].width - videoLayout.cards[1].width) <= 1, "Desktop videos are not two equal cards on one row");
    }
    const testimonialLayout = await page.getByTestId("testimonial-list").evaluate((element) => {
      const cards = [...element.children].map((child) => child.getBoundingClientRect());
      return { display: getComputedStyle(element).display, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, cards };
    });
    if (viewport.width < 900) {
      assert(testimonialLayout.display === "flex" && testimonialLayout.cards.every((card) => card.width >= viewport.width * 0.83 && card.width <= viewport.width * 0.92), `Mobile testimonial card width is not one card per viewport at ${viewport.width}px`);
      assert(testimonialLayout.scrollWidth > testimonialLayout.clientWidth, `Mobile testimonials are not horizontally scrollable at ${viewport.width}px`);
    } else {
      assert(testimonialLayout.display === "grid" && testimonialLayout.cards.length === 3 && testimonialLayout.cards.every((card) => Math.abs(card.y - testimonialLayout.cards[0].y) <= 1 && Math.abs(card.height - testimonialLayout.cards[0].height) <= 1), "Desktop testimonials are not three equal-height cards on one row");
    }
    const contactButtons = await page.getByTestId("contact-actions").getByRole("link").evaluateAll((links) => links.map((link) => {
      const box = link.getBoundingClientRect();
      return { width: box.width, top: box.top, whiteSpace: getComputedStyle(link).whiteSpace };
    }));
    assert(contactButtons.length === 2, `Expected two contact buttons at ${viewport.width}px`);
    assert(Math.abs(contactButtons[0].width - contactButtons[1].width) <= 1 && Math.abs(contactButtons[0].top - contactButtons[1].top) <= 1, `Contact buttons are not equal-width on one row at ${viewport.width}px`);
    assert(contactButtons.every((button) => button.whiteSpace === "nowrap"), `Contact button wraps at ${viewport.width}px`);
    await page.screenshot({ path: path.join(artifactDir, `homepage-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(origin, { waitUntil: "domcontentloaded" });
  assert(await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === "auto", "Reduced motion does not restore normal scrolling");
  await reducedContext.close();

  await page.goto(`${origin}/admin/login`);
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,nofollow,noarchive", "Admin login is not noindex");
  console.log(`V12A Homepage E2E passed; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
