/* global process, fetch, setTimeout, console, URL, document, getComputedStyle, HTMLElement */
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
const env = {
  ...process.env,
  VITE_PUBLIC_CONTENT_MODE: "demo",
  VITE_PUBLIC_SITE_URL: "https://teacher.example.test",
  VITE_PUBLIC_ZALO_URL: "https://zalo.me/84912345678",
  VITE_PUBLIC_PHONE_DISPLAY: "0912 345 678",
  VITE_PUBLIC_PHONE_E164: "+84912345678",
  VITE_PUBLIC_FACEBOOK_URL: "https://www.facebook.com/lophocanhngucovy",
};
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
    env,
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

  const carousel = page.getByTestId("hero-carousel");
  await page.getByRole("heading", { level: 1, name: "Tiếng Anh vững nền tảng" }).waitFor();
  assert(await page.locator("h1").count() === 1, "Homepage must contain exactly one H1");
  assert(await carousel.getAttribute("aria-roledescription") === "carousel", "Carousel semantics are missing");
  assert(await carousel.locator('img[fetchpriority="high"]').count() === 1, "The first hero image is not the sole high-priority image");
  assert(await carousel.locator('img[loading="lazy"]').count() === 2, "Later hero images are not lazy loaded");
  const heroSources = await carousel.locator("picture img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  assert(new Set(heroSources).size === 3, `Hero slides do not use three distinct images: ${heroSources.join(", ")}`);

  await page.getByRole("button", { name: "Slide tiếp theo" }).click();
  assert(await carousel.getAttribute("data-active-slide") === "primary", "Next control did not advance the carousel");
  await page.getByRole("button", { name: "Slide trước" }).click();
  assert(await carousel.getAttribute("data-active-slide") === "foundation", "Previous control did not return the carousel");
  await page.getByRole("button", { name: /Chuyển đến slide 3:/ }).click();
  assert(await carousel.getAttribute("data-active-slide") === "secondary", "Pagination indicator did not select slide 3");
  await carousel.focus();
  await carousel.press("ArrowLeft");
  assert(await carousel.getAttribute("data-active-slide") === "primary", "Keyboard navigation did not select the previous slide");

  await page.getByRole("button", { name: /Chuyển đến slide 1:/ }).click();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
  await page.mouse.move(4, 4);
  await page.waitForTimeout(5_800);
  assert(await carousel.getAttribute("data-active-slide") === "primary", "Carousel did not auto-transition after 5–6 seconds");

  await page.getByRole("button", { name: /Chuyển đến slide 1:/ }).click();
  const box = await carousel.boundingBox();
  assert(Boolean(box), "Carousel has no layout box");
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.45, { steps: 5 });
  await page.mouse.up();
  assert(await carousel.getAttribute("data-active-slide") === "primary", "Horizontal swipe did not advance the carousel");

  for (const heading of ["Xin chào, cô là Uyên Vy.", "Tiếng Anh lớp 1–9", "Rõ ràng, vừa sức", "Xem thử cách", "Phản hồi từ phụ huynh", "Cùng cô Vy tìm cách học phù hợp cho con"]) {
    await page.getByRole("heading", { name: new RegExp(heading) }).first().waitFor();
  }
  await page.getByText("Ba mẹ có thể nhắn cô Vy để chia sẻ tình hình học hiện tại, thời gian phù hợp và phần con đang cần hỗ trợ. Cô sẽ trao đổi thêm về lớp học và cách học phù hợp.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Nhắn cô Vy qua Zalo", exact: true }).waitFor();
  await page.getByText("Trao đổi về tình hình học và lịch học của con", { exact: true }).waitFor();
  for (const label of ["Lớp 1–9", "1–1 hoặc nhóm nhỏ", "Tại Huế"])
    await page.getByText(label, { exact: true }).waitFor();
  await page.getByText("2026 — từ người hâm mộ cô Vy, with love ❤️", { exact: true }).waitFor();
  for (const program of ["Tiếng Anh lớp 1–5", "Tiếng Anh lớp 6–9", "Kèm cặp và ôn thi"])
    await page.getByRole("heading", { level: 3, name: program, exact: true }).waitFor();
  await page.getByTestId("testimonial-list").waitFor();
  assert(await page.getByTestId("testimonial-fallback").count() === 0, "FAQ fallback rendered with development testimonials");
  assert(await page.getByText("Nội dung mẫu", { exact: true }).count() === 0, "Development testimonial exposes a sample badge");

  const contactTargets = await page.locator('a[href^="https://zalo.me/"],a[href^="tel:"],a[href^="https://www.facebook.com/"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), target: link.getAttribute("target"), rel: link.getAttribute("rel") })));
  assert(contactTargets.length >= 4, `Expected configured contact links, found ${contactTargets.length}`);
  assert(contactTargets.some((item) => item.href === "tel:+84912345678"), "Phone CTA is not a canonical tel link");
  for (const item of contactTargets.filter((link) => link.href?.startsWith("http"))) {
    new URL(item.href);
    assert(item.target === "_blank" && item.rel?.includes("noopener") && item.rel?.includes("noreferrer"), `Unsafe external link: ${item.href}`);
  }
  assert(await page.locator('a[href="#"]').count() === 0, "Homepage contains a placeholder href");

  if (await page.locator('iframe[src*="youtube"]').count()) throw new Error("YouTube iframe loaded before interaction");
  await page.getByRole("button", { name: /Phát video:/ }).first().click();
  const iframe = page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first();
  await iframe.waitFor();
  assert(Boolean(await iframe.getAttribute("title")), "Learning video iframe has no accessible title");

  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    structured: document.querySelector('script[type="application/ld+json"]')?.textContent,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.innerText,
  }));
  assert(metadata.title.includes("Lớp học tiếng Anh cô Vy") && metadata.description?.includes("Nguyễn Tri Phương"), "Homepage metadata is incomplete");
  assert(metadata.robots === "index,follow,max-image-preview:large", `Unexpected public robots metadata: ${metadata.robots}`);
  assert(metadata.canonical === "https://teacher.example.test/", `Unexpected canonical URL: ${metadata.canonical}`);
  assert(metadata.structured && JSON.parse(metadata.structured)["@type"] === "Person", "Person structured data is missing");
  assert(metadata.overflow <= 1, `Homepage horizontal overflow: ${metadata.overflow}px`);
  assert(!/Nội dung minh họa cho môi trường phát triển|Ảnh tạm|Video tạm|Chưa cấu hình|from người hâm mộ/i.test(metadata.body), "Visitor-facing development warning remains");
  assert(!/Cô giáo An|Học Toán|Xây nền Toán/i.test(metadata.body), "Old teacher or mathematics branding remains");
  assert(!/\b\d{1,3}(?:[. ]\d{3})+\s*(?:đ|VND)\b/i.test(metadata.body), "Homepage exposes a public tuition price");
  for (const teacherCopy of [
    "Đồng hành cùng học sinh lớp 1–9 tại Huế.",
    "Tập trung xây nền, củng cố phần còn yếu và giúp học sinh tự tin hơn.",
    "Kèm cặp 1–1 và nhóm nhỏ",
    "Theo sát năng lực từng học sinh",
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
    await page.getByTestId("hero-carousel").waitFor();
    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('[data-testid="hero-carousel"]');
      const about = document.querySelector("#about");
      return {
        heroHeight: hero?.getBoundingClientRect().height ?? 0,
        aboutTop: about?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        labels: [...document.querySelectorAll("button,a")].filter((item) => getComputedStyle(item).display !== "none").map((item) => item.textContent?.trim()),
      };
    });
    assert(metrics.overflow <= 1, `Homepage overflow at ${viewport.width}px: ${metrics.overflow}px`);
    if (viewport.width === 360) assert(metrics.heroHeight >= 390 && metrics.heroHeight <= 410, `Hero height ${metrics.heroHeight}px is outside 390–410 at 360px`);
    else if (viewport.width < 390) assert(metrics.heroHeight >= 390 && metrics.heroHeight <= 420, `Hero height ${metrics.heroHeight}px is outside 390–420 at ${viewport.width}px`);
    else if (viewport.width <= 393) assert(metrics.heroHeight >= 410 && metrics.heroHeight <= 430, `Hero height ${metrics.heroHeight}px is outside 410–430 at ${viewport.width}px`);
    else if (viewport.width <= 412) assert(metrics.heroHeight >= 420 && metrics.heroHeight <= 442, `Hero height ${metrics.heroHeight}px is outside 420–442 at ${viewport.width}px`);
    else if (viewport.width <= 430) assert(metrics.heroHeight <= 450, `Hero height ${metrics.heroHeight}px exceeds 450 at ${viewport.width}px`);
    else assert(metrics.heroHeight >= 500 && metrics.heroHeight <= 520, `Desktop hero height ${metrics.heroHeight}px is outside 500–520`);
    if (viewport.width <= 430) assert(metrics.aboutTop < viewport.height, `Next section is not discoverable at ${viewport.width}px`);
    assert(metrics.labels.includes("Nhắn cô Vy qua Zalo"), `Primary Zalo CTA is not visible at ${viewport.width}px`);
    await page.screenshot({ path: path.join(artifactDir, `homepage-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(origin, { waitUntil: "domcontentloaded" });
  const reducedCarousel = reducedPage.getByTestId("hero-carousel");
  const reducedBefore = await reducedCarousel.getAttribute("data-active-slide");
  await reducedPage.waitForTimeout(5_800);
  assert(await reducedCarousel.getAttribute("data-active-slide") === reducedBefore, "Reduced motion did not disable autoplay");
  assert(await reducedCarousel.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length) === 0, "Reduced-motion carousel still has a running animation");
  await reducedPage.getByRole("button", { name: "Slide tiếp theo" }).click();
  assert(await reducedCarousel.getAttribute("data-active-slide") !== reducedBefore, "Reduced motion disabled manual navigation");
  await reducedContext.close();

  await page.goto(`${origin}/admin/login`);
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,nofollow,noarchive", "Admin login is not noindex");
  console.log(`V12A Homepage E2E passed; screenshots: ${artifactDir}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
