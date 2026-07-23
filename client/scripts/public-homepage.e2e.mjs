/* global process, fetch, setTimeout, console, URL, document, window */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5178;
const origin = `http://127.0.0.1:${port}`;
const expectedTitle = "Cô Vy dạy tiếng Anh tại Huế | Lớp 1–9 và luyện thi";
const expectedDescription = "Lớp tiếng Anh cô Vy tại Huế dành cho mầm non, tiểu học và THCS; học 1–1 hoặc nhóm nhỏ, luyện thi Nguyễn Tri Phương và lớp 9 lên 10.";
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
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: clientRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  const sourceResponse = await fetch(`${origin}/`);
  const sourceHtml = await sourceResponse.text();
  for (const sourceCopy of [
    "<h1",
    "Cô Vy dạy tiếng Anh tại Huế",
    "Khu vực Lê Bá Thân, Huế",
    "101/245 Bùi Thị Xuân, Huế",
    "application/ld+json",
    "LocalBusiness",
  ]) assert(sourceHtml.includes(sourceCopy), `Prerendered HTML is missing: ${sourceCopy}`);
  for (const forbiddenSource of ['href="tel:', '"telephone"', "Điện thoại và Zalo", "0971 697 759"]) {
    assert(!sourceHtml.includes(forbiddenSource), `Prerendered HTML still contains phone semantics: ${forbiddenSource}`);
  }

  const adminResponse = await fetch(`${origin}/admin/login`);
  assert(adminResponse.headers.get("x-robots-tag") === "noindex, nofollow, noarchive", "Admin response is missing X-Robots-Tag");

  for (const asset of ["/logo-covy.svg", "/favicon.svg", "/favicon-48.png", "/favicon-96.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/logo-covy-512.png"]) {
    const response = await fetch(`${origin}${asset}`);
    assert(response.status === 200, `SEO asset does not return HTTP 200: ${asset}`);
  }
  for (const crawlable of ["/", "/robots.txt", "/sitemap.xml"]) {
    const response = await fetch(`${origin}${crawlable}`);
    assert(response.status === 200, `Public SEO URL does not return HTTP 200: ${crawlable}`);
  }

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#ded7f8"/></svg>',
  }));
  await page.goto(origin, { waitUntil: "networkidle" });

  assert(await page.locator("h1").count() === 1, "Homepage must contain exactly one H1");
  await page.getByRole("heading", { level: 1, name: "Cô Vy dạy tiếng Anh tại Huế", exact: true }).waitFor();
  for (const heading of [
    "Giới thiệu giáo viên Uyên Vy",
    "Các lớp tiếng Anh và luyện thi tại Huế",
    "Địa điểm học tiếng Anh tại Huế",
    "Video học tiếng Anh tham khảo",
    "Liên hệ lớp tiếng Anh cô Vy",
  ]) await page.getByRole("heading", { level: 2, name: heading, exact: true }).waitFor();

  for (const program of [
    "Tiếng Anh mầm non",
    "Tiếng Anh tiểu học",
    "Tiếng Anh THCS",
    "Luyện thi Nguyễn Tri Phương",
    "Luyện thi lớp 9 lên 10 môn Anh",
    "Tiếng Anh giao tiếp cơ bản",
  ]) await page.getByRole("heading", { level: 3, name: program, exact: true }).waitFor();

  for (const address of ["Khu vực Lê Bá Thân, Huế", "101/245 Bùi Thị Xuân, Huế"]) {
    await page.locator("address").getByText(address, { exact: true }).waitFor();
  }
  const header = page.locator("header");
  await header.getByText("Lớp học cô Vy", { exact: true }).waitFor();
  assert(await header.locator('img[src="/favicon.svg"]').count() === 1, "Header must contain one small brand mark");
  assert(await header.locator('img[src="/logo-covy.svg"]').count() === 0, "Stacked wordmark must not appear in the Header");
  assert(await header.getByRole("link").count() === 2, "Header must contain only Contact and Admin links");
  await header.getByRole("link", { name: "Liên hệ", exact: true }).waitFor();
  await header.getByRole("link", { name: "Quản trị", exact: true }).waitFor();

  const hero = page.locator("section").filter({ has: page.locator("#hero-heading") }).first();
  assert(await hero.getByRole("link").count() === 0 && await hero.getByRole("button").count() === 0, "Hero must not contain contact CTAs");

  const links = await page.locator('[data-testid="contact-actions"] a').evaluateAll((items) => items.map((item) => ({
    href: item.getAttribute("href"),
    target: item.getAttribute("target"),
    rel: item.getAttribute("rel"),
    text: item.textContent?.trim(),
  })));
  assert(links.length === 2, `Contact section must contain exactly two actions, found ${links.length}`);
  assert(links.some((item) => item.href === "https://zalo.me/0971697759"), "Approved Zalo URL is missing");
  assert(links.some((item) => item.href === "https://www.facebook.com/uyenvy.le.12"), "Approved Facebook URL is missing");
  assert(links.some((item) => item.text === "Nhắn Zalo") && links.some((item) => item.text === "Facebook"), "Contact button labels are incorrect");
  assert(!links.some((item) => item.href === "https://zalo.me/" || item.href === "#"), "Placeholder Zalo URL remains");
  for (const item of links.filter((item) => item.href?.startsWith("http"))) {
    new URL(item.href);
    assert(item.target === "_blank" && item.rel?.includes("noopener") && item.rel?.includes("noreferrer"), `Unsafe external link: ${item.href}`);
  }

  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    favicon: document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute("href"),
    structured: document.querySelector('#public-home-structured-data')?.textContent,
    body: document.body.innerText,
  }));
  assert(metadata.title === expectedTitle, `Unexpected title: ${metadata.title}`);
  assert(metadata.description === expectedDescription, `Unexpected description: ${metadata.description}`);
  assert(metadata.canonical === "https://tienganhcovy.com/", `Unexpected canonical: ${metadata.canonical}`);
  assert(metadata.favicon === "/favicon.svg", "SVG favicon is missing");
  const graph = JSON.parse(metadata.structured ?? "{}")["@graph"];
  assert(Array.isArray(graph), "Structured data does not use @graph");
  for (const type of ["WebSite", "LocalBusiness", "Person"]) assert(graph.some((item) => item["@type"] === type), `${type} structured data is missing`);
  assert(!graph.some((item) => item.review || item.aggregateRating), "Review or rating structured data must not be present");
  assert(!JSON.stringify(graph).includes('"telephone"'), "Structured data still contains telephone semantics");
  assert(!/PHỤ HUYNH CHIA SẺ|Những phản hồi dành cho cô Vy|Mẹ bé M\.|Mẹ bé N\.|Phụ huynh bé H\./i.test(metadata.body), "Sample testimonial content remains public");
  assert(!/Điện thoại và Zalo|Gọi 0971|0971 697 759/i.test(metadata.body), "Phone copy remains public");
  assert(metadata.body.includes("2026 — từ người hâm mộ cô Vy, with love ❤️"), "Required footer copy is missing");
  assert(await page.locator('a[href^="tel:"]').count() === 0, "Homepage still contains a tel link");

  await header.getByRole("link", { name: "Liên hệ", exact: true }).click();
  await page.waitForFunction(() => window.location.hash === "#contact");
  await page.waitForTimeout(700);
  const contactOffset = await page.locator("#contact").evaluate((element) => element.getBoundingClientRect().top);
  assert(contactOffset >= 50 && contactOffset < 844, `Contact anchor did not scroll into view safely: ${contactOffset}px`);

  const teacherImage = page.locator('img[alt="Cô Uyên Vy, giáo viên tiếng Anh tại Huế"]');
  await teacherImage.waitFor();
  assert(await teacherImage.getAttribute("fetchpriority") === "high", "Hero teacher image is not high priority");
  assert(await teacherImage.getAttribute("loading") !== "lazy", "Hero teacher image must not be lazy loaded");
  assert(await teacherImage.getAttribute("width") === "1448" && await teacherImage.getAttribute("height") === "1086", "Hero image dimensions are missing");
  assert(await page.locator('picture source[type="image/webp"]').count() === 1, "Responsive WebP source is missing");

  assert(await page.locator('iframe[src*="youtube"]').count() === 0, "YouTube iframe loaded before interaction");
  await page.getByRole("button", { name: /Phát video:/ }).first().click();
  await page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first().waitFor();

  const viewports = [
    { width: 390, height: 844 },
    { width: 400, height: 930 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    const metrics = await page.evaluate(() => {
      const header = document.querySelector("header");
      const items = header ? [...header.querySelectorAll("img, span, a")].map((item) => item.getBoundingClientRect()) : [];
      const brandOccurrences = (header?.textContent?.match(/Lớp học cô Vy/g) ?? []).length;
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerHeight: header?.getBoundingClientRect().height ?? 0,
        headerOverflow: header ? header.scrollWidth - header.clientWidth : Number.POSITIVE_INFINITY,
        itemCenters: items.map((box) => box.top + box.height / 2),
        brandOccurrences,
      };
    });
    assert(metrics.overflow <= 1, `Homepage horizontal overflow at ${viewport.width}px: ${metrics.overflow}px`);
    assert(metrics.headerHeight <= 64, `Header is too tall at ${viewport.width}px: ${metrics.headerHeight}px`);
    assert(metrics.headerOverflow <= 1, `Header wraps or overflows at ${viewport.width}px`);
    assert(Math.max(...metrics.itemCenters) - Math.min(...metrics.itemCenters) <= 2, `Header items are not on one line at ${viewport.width}px`);
    assert(metrics.brandOccurrences === 1, `Header repeats the brand name at ${viewport.width}px`);
    assert(await page.locator('[data-testid="contact-actions"] a').count() === 2, `Contact action count changed at ${viewport.width}px`);
    assert(await page.locator('a[href^="tel:"]').count() === 0, `tel link exists at ${viewport.width}px`);
  }

  await context.close();
  console.log("Public Homepage local SEO E2E passed");
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
