/* global process, fetch, setTimeout, console, URL, document */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5178;
const origin = `http://127.0.0.1:${port}`;
const artifactDir = path.join(os.tmpdir(), "teacher-hub-m6c-ui-audit");
fs.mkdirSync(artifactDir, { recursive: true });
const env = {
  ...process.env,
  VITE_PUBLIC_SITE_URL: "https://teacher.example.test",
  VITE_PUBLIC_ZALO_URL: "https://zalo.me/84900000000",
  VITE_PUBLIC_PHONE_DISPLAY: "0900 000 000",
  VITE_PUBLIC_PHONE_E164: "+84900000000",
  VITE_PUBLIC_FACEBOOK_URL: "https://www.facebook.com/teacher.example.test",
};
let child;
let browser;

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port)], {
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
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="#ded7f8"/></svg>',
  }));
  await page.goto(origin, { waitUntil: "networkidle" });

  await page.getByRole("heading", { level: 1, name: /Học chắc nền tảng/ }).waitFor();
  await page.getByRole("status").filter({ hasText: "Nội dung minh họa" }).waitFor();
  if (await page.locator("h1").count() !== 1) throw new Error("Homepage must contain exactly one H1");
  for (const heading of ["Học đúng cách", "Nhẹ nhàng, rõ ràng", "Phù hợp từng giai đoạn", "Xem thử cách", "Tiến bộ nhìn thấy", "Trao đổi về mục tiêu"]) {
    await page.getByRole("heading", { name: new RegExp(heading) }).waitFor();
  }

  const contactTargets = await page.locator('a[href^="https://zalo.me/"],a[href^="tel:"],a[href^="https://www.facebook.com/"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), target: link.getAttribute("target"), rel: link.getAttribute("rel") })));
  if (contactTargets.length < 5) throw new Error(`Expected configured contact links, found ${contactTargets.length}`);
  if (!contactTargets.some((item) => item.href === "tel:+84900000000")) throw new Error("Phone CTA is not a canonical tel link");
  for (const item of contactTargets.filter((link) => link.href?.startsWith("http"))) {
    new URL(item.href);
    if (item.target !== "_blank" || !item.rel?.includes("noopener")) throw new Error(`Unsafe external link: ${item.href}`);
  }
  if (await page.locator('a[href="#"],button:enabled').filter({ hasText: /Chưa cấu hình/ }).count()) throw new Error("Homepage exposes a placeholder contact action");

  if (await page.locator('iframe[src*="youtube"]').count()) throw new Error("YouTube iframe loaded before interaction");
  await page.getByRole("button", { name: /Phát video:/ }).first().click();
  const iframe = page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first();
  await iframe.waitFor();
  if (!(await iframe.getAttribute("title"))) throw new Error("Learning video iframe has no accessible title");

  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    structured: document.querySelector('script[type="application/ld+json"]')?.textContent,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    animations: document.getAnimations().length,
    body: document.body.innerText,
  }));
  if (!metadata.title.includes("Cô giáo An") || !metadata.description || !metadata.ogTitle) throw new Error("Homepage metadata is incomplete");
  if (metadata.robots !== "index,follow,max-image-preview:large") throw new Error(`Unexpected public robots metadata: ${metadata.robots}`);
  if (metadata.canonical !== "https://teacher.example.test/") throw new Error(`Unexpected canonical URL: ${metadata.canonical}`);
  if (!metadata.structured || JSON.parse(metadata.structured)["@type"] !== "Person") throw new Error("Person structured data is missing");
  if (metadata.overflow > 1) throw new Error(`Homepage horizontal overflow: ${metadata.overflow}px`);
  if (metadata.animations !== 0) throw new Error("Reduced-motion viewport still created nonessential animations");
  if (/chu kỳ cần thu|phụ huynh mẫu|teacher-token/i.test(metadata.body)) throw new Error("Private admin content leaked onto Homepage");

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Homepage overflow at ${viewport.width}px: ${overflow}px`);
  }

  await page.goto(`${origin}/khong-ton-tai`);
  await page.getByRole("heading", { name: "Không tìm thấy trang" }).waitFor();
  if (await page.getByText("Học phí", { exact: true }).count()) throw new Error("Public 404 leaked the admin shell");

  await page.goto(`${origin}/admin/login`);
  await page.getByRole("heading", { name: "Đăng nhập cô giáo" }).waitFor();
  const adminRobots = await page.locator('meta[name="robots"]').getAttribute("content");
  if (adminRobots !== "noindex,nofollow,noarchive") throw new Error(`Admin login is not noindex: ${adminRobots}`);

  const screenshot = path.join(artifactDir, "public-home-390.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole("heading", { level: 1, name: /Học chắc nền tảng/ }).waitFor();
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(`M6A Homepage E2E passed at 360px with reduced motion; screenshot: ${screenshot}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
