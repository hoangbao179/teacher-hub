/* global process, fetch, setTimeout, console, URL, document, window */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5178;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = process.env.HOMEPAGE_SCREENSHOT_DIR;
const screenshotWidths = new Set([360, 400, 430, 1440]);
const expectedTitle = "Lớp tiếng Anh cô Vy tại Huế | Mầm non đến THCS";
const expectedDescription = "Lớp tiếng Anh cô Vy tại Huế dành cho học sinh mầm non, tiểu học và THCS. Có lớp 1–1, lớp nhóm, luyện thi và nhận dạy tại nhà học sinh.";
const expectedTestimonials = [
  {
    guardianLabel: "Mẹ bé M.",
    studentLevel: "Học sinh lớp 2",
    quote: "Trước đây bé khá ngại học tiếng Anh, nhất là phần đọc và nhớ từ. Học với cô một thời gian, bé chủ động xem lại bài hơn, về nhà còn tự đọc lại những từ đã học.",
  },
  {
    guardianLabel: "Mẹ bé N.",
    studentLevel: "Học sinh lớp 6",
    quote: "Con bị hổng ngữ pháp nên lúc làm bài thường khá rối và dễ nản. Sau một thời gian được hướng dẫn lại từng phần, con hiểu bài hơn và làm bài cũng chắc hơn trước.",
  },
  {
    guardianLabel: "Phụ huynh bé H.",
    studentLevel: "Học sinh lớp 9",
    quote: "Giai đoạn ôn thi gia đình khá lo vì con chưa biết nên tập trung vào phần nào. Nhờ được sửa kỹ từng lỗi và hướng dẫn cách làm bài, con bình tĩnh và tự tin hơn nhiều.",
  },
];
let child;
let browser;

if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });

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
    "101 Kiệt 245 Bùi Thị Xuân, Huế",
    "Nhận dạy trong khu vực Huế",
    "Mẹ bé M.",
    "Mẹ bé N.",
    "Phụ huynh bé H.",
    "Những thay đổi phụ huynh nhận thấy",
    "application/ld+json",
    "LocalBusiness",
  ]) assert(sourceHtml.includes(sourceCopy), `Prerendered HTML is missing: ${sourceCopy}`);
  assert((sourceHtml.match(/<h1\b/g) ?? []).length === 1, "Prerendered Homepage must contain exactly one H1");
  assert(sourceHtml.includes("Cô Vy đồng hành cùng học sinh theo năng lực, tập trung xây nền tảng chắc, củng cố phần còn yếu và giúp các em tự tin hơn khi sử dụng tiếng Anh."), "Condensed teacher introduction is missing");
  for (const testimonial of expectedTestimonials) {
    for (const copy of Object.values(testimonial)) assert(sourceHtml.includes(copy), `Prerendered testimonial copy is missing: ${copy}`);
  }
  assert(!sourceHtml.includes("Xin chào, cô là Uyên Vy."), "Old teacher greeting remains");
  for (const forbiddenSource of ['href="tel:', '"telephone"', 'name="keywords"', "Điện thoại và Zalo", "0971 697 759", "Lê Bá Thân", "hai khu vực ở Huế", "101/245 Bùi Thị Xuân", "GIẢI ĐÁP NHANH", "Câu hỏi thường gặp", "Vuốt để xem thêm"]) {
    assert(!sourceHtml.includes(forbiddenSource), `Prerendered HTML contains forbidden content: ${forbiddenSource}`);
  }
  const notFoundSource = await (await fetch(`${origin}/404.html`)).text();
  assert(notFoundSource.includes("Ôi, trang này đi lạc rồi!"), "Static 404 content is missing");
  assert(notFoundSource.includes('name="robots" content="noindex,follow"'), "Static 404 must be noindex,follow");
  assert(!notFoundSource.includes("public-home-structured-data"), "Static 404 must not contain Homepage structured data");

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
    "Đồng hành cùng học sinh",
    "Ba nhóm chương trình",
    "Rõ ràng, vừa sức, đúng mục tiêu",
    "Hình thức và địa điểm học",
    "Xem thử cách tiếp cận bài học",
    "Trao đổi về lớp học",
  ]) await page.getByRole("heading", { level: 2, name: heading, exact: true }).waitFor();
  const textWrapStyles = await page.evaluate(() => ({
    heading: window.getComputedStyle(document.querySelector("#about-heading")).textWrap,
    paragraph: window.getComputedStyle(document.querySelector("#about-heading + p")).textWrap,
  }));
  assert(textWrapStyles.heading === "balance", "Homepage headings must use balanced wrapping");
  assert(textWrapStyles.paragraph === "pretty", "Homepage paragraphs must use pretty wrapping");
  await page.getByText("Video tham khảo để luyện nghe và ghi nhớ từ vựng qua ngữ cảnh.", { exact: true }).waitFor();

  for (const program of [
    "Tiếng Anh nền tảng",
    "Tiếng Anh THCS",
    "Luyện thi theo mục tiêu",
  ]) await page.getByRole("heading", { level: 3, name: program, exact: true }).waitFor();
  assert(await page.locator('[data-testid="program-list"] article').count() === 3, "Homepage must contain exactly three program cards");

  await page.locator("address").getByText("Học tại địa chỉ lớp", { exact: true }).waitFor();
  await page.locator("address").getByText("101 Kiệt 245 Bùi Thị Xuân, Huế", { exact: true }).waitFor();
  await page.locator("address").getByText("Học tại nhà học sinh", { exact: true }).waitFor();
  await page.locator("address").getByText("Nhận dạy trong khu vực Huế", { exact: true }).waitFor();
  await page.getByText("Phụ huynh vui lòng liên hệ trước để trao đổi lịch học phù hợp.", { exact: true }).waitFor();
  assert(await page.getByText("GIẢI ĐÁP NHANH", { exact: true }).count() === 0, "FAQ eyebrow remains");
  assert(await page.getByText(/Câu hỏi thường gặp/i).count() === 0, "FAQ heading remains");
  const testimonialHeading = page.locator("#feedback h2").filter({ hasText: "Những thay đổi phụ huynh nhận thấy" });
  assert(await testimonialHeading.count() === 1, "Desktop testimonial heading is missing");
  assert(await testimonialHeading.isHidden(), "Desktop testimonial heading must remain hidden on mobile");
  assert(await page.getByText("Vuốt để xem thêm", { exact: false }).count() === 0, "Testimonial swipe hint remains");
  const header = page.locator("header");
  await header.getByText("Lớp tiếng Anh cô Vy", { exact: true }).waitFor();
  assert(await header.locator('img[src="/favicon.svg"]').count() === 1, "Header must contain one small brand mark");
  assert(await header.locator('img[src="/logo-covy.svg"]').count() === 0, "Stacked wordmark must not appear in the Header");
  assert(await header.getByRole("link").count() === 2, "Header must contain only Contact and Admin links");
  await header.getByRole("link", { name: "Liên hệ", exact: true }).waitFor();
  await header.getByRole("link", { name: "Quản trị", exact: true }).waitFor();
  assert(await page.getByRole("link", { name: "Quản trị", exact: true }).count() === 1, "Admin link must exist only once in the Header");
  assert(await page.getByRole("heading", { level: 2, name: "Video học tiếng Anh tham khảo", exact: true }).count() === 0, "Old video heading remains");

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
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute("content"),
    body: document.body.innerText,
  }));
  assert(metadata.title === expectedTitle, `Unexpected title: ${metadata.title}`);
  assert(metadata.description === expectedDescription, `Unexpected description: ${metadata.description}`);
  assert(metadata.ogTitle === expectedTitle && metadata.twitterTitle === expectedTitle, "Social titles are not synchronized");
  assert(metadata.ogDescription === expectedDescription && metadata.twitterDescription === expectedDescription, "Social descriptions are not synchronized");
  assert(metadata.canonical === "https://tienganhcovy.com/", `Unexpected canonical: ${metadata.canonical}`);
  assert(metadata.favicon === "/favicon.svg", "SVG favicon is missing");
  const graph = JSON.parse(metadata.structured ?? "{}")["@graph"];
  assert(Array.isArray(graph), "Structured data does not use @graph");
  for (const type of ["WebSite", "LocalBusiness", "Person"]) assert(graph.some((item) => item["@type"] === type), `${type} structured data is missing`);
  assert(!graph.some((item) => item.review || item.aggregateRating), "Review or rating structured data must not be present");
  assert(!JSON.stringify(graph).includes('"telephone"'), "Structured data still contains telephone semantics");
  const website = graph.find((item) => item["@type"] === "WebSite");
  const business = graph.find((item) => item["@type"] === "LocalBusiness");
  assert(website.name === "Lớp tiếng Anh cô Vy", "WebSite name is incorrect");
  assert(business.name === "Lớp tiếng Anh cô Vy", "LocalBusiness name is incorrect");
  assert(business.address.streetAddress === "101 Kiệt 245 Bùi Thị Xuân", "LocalBusiness address is incorrect");
  const testimonialCards = page.locator('[data-testid="testimonial-list"] figure');
  assert(await testimonialCards.count() === 3, "Homepage must contain exactly three testimonials");
  for (const testimonial of expectedTestimonials) {
    const card = testimonialCards.filter({ hasText: testimonial.guardianLabel });
    assert(await card.count() === 1, `Testimonial guardian must appear exactly once: ${testimonial.guardianLabel}`);
    await card.getByText(testimonial.studentLevel, { exact: true }).waitFor();
    await card.getByText(testimonial.quote, { exact: true }).waitFor();
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  const firstTestimonial = testimonialCards.filter({ hasText: expectedTestimonials[0].guardianLabel });
  const secondTestimonial = testimonialCards.filter({ hasText: expectedTestimonials[1].guardianLabel });
  assert(await firstTestimonial.getAttribute("aria-hidden") === "false", "The first testimonial must be initially visible");
  await page.waitForTimeout(3200);
  assert(await secondTestimonial.getAttribute("aria-hidden") === "false", "Testimonials must advance automatically after three seconds");
  const sectionOrder = await page.locator("main section").evaluateAll((sections) => sections.map((section) => section.id).filter(Boolean));
  for (const [before, after] of [["about", "programs"], ["programs", "method"], ["method", "locations"], ["locations", "videos"], ["videos", "feedback"], ["feedback", "contact"]]) {
    assert(sectionOrder.indexOf(before) < sectionOrder.indexOf(after), `Homepage section order is incorrect: ${before} must precede ${after}`);
  }
  assert(!/Điện thoại và Zalo|Gọi 0971|0971 697 759/i.test(metadata.body), "Phone copy remains public");
  const footer = page.locator("footer");
  assert((await footer.innerText()).trim() === "2026 — từ người hâm mộ cô Vy, with love ❤️", "Footer must contain only the required copy");
  assert(await footer.getByText("Quản trị", { exact: true }).count() === 0, "Admin text remains in the Footer");
  assert(await page.locator('a[href^="tel:"]').count() === 0, "Homepage still contains a tel link");

  await page.goto(`${origin}/trang-khong-ton-tai`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Ôi, trang này đi lạc rồi!", exact: true }).waitFor();
  await page.getByRole("link", { name: "Về trang chủ", exact: true }).waitFor();
  const notFoundZalo = page.getByRole("link", { name: "Nhắn Zalo", exact: true });
  assert(await notFoundZalo.getAttribute("href") === "https://zalo.me/0971697759", "Public 404 Zalo URL is incorrect");
  assert(await notFoundZalo.getAttribute("target") === "_blank" && (await notFoundZalo.getAttribute("rel"))?.includes("noopener"), "Public 404 Zalo link is unsafe");
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,follow", "Client-side public 404 must be noindex,follow");
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    assert(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `Public 404 horizontal overflow at ${viewport.width}px`);
  }
  await page.goto(origin, { waitUntil: "networkidle" });

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
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 400, height: 930 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    const metrics = await page.evaluate(() => {
      const header = document.querySelector("header");
      const logo = document.querySelector('[data-testid="header-logo"]');
      const brand = document.querySelector('[data-testid="header-brand"]');
      const links = [
        document.querySelector('[data-testid="header-contact"]'),
        document.querySelector('[data-testid="header-admin"]'),
      ].filter(Boolean);
      const items = [logo, brand, ...links].filter(Boolean).map((item) => item.getBoundingClientRect());
      const brandOccurrences = (header?.textContent?.match(/Lớp tiếng Anh cô Vy/g) ?? []).length;
      const brandStyle = brand ? window.getComputedStyle(brand) : null;
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerHeight: header?.getBoundingClientRect().height ?? 0,
        headerOverflow: header ? header.scrollWidth - header.clientWidth : Number.POSITIVE_INFINITY,
        itemCenters: items.map((box) => box.top + box.height / 2),
        brandOccurrences,
        logoWidth: logo?.getBoundingClientRect().width ?? 0,
        brandScrollWidth: brand?.scrollWidth ?? Number.POSITIVE_INFINITY,
        brandClientWidth: brand?.clientWidth ?? 0,
        brandTextOverflow: brandStyle?.textOverflow ?? "",
        linkMetrics: links.map((link) => {
          const style = window.getComputedStyle(link);
          return {
            height: link.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(style.lineHeight),
            whiteSpace: style.whiteSpace,
          };
        }),
      };
    });
    assert(metrics.overflow <= 1, `Homepage horizontal overflow at ${viewport.width}px: ${metrics.overflow}px`);
    assert(metrics.headerHeight <= (viewport.width <= 430 ? 60 : 64), `Header is too tall at ${viewport.width}px: ${metrics.headerHeight}px`);
    assert(metrics.headerOverflow <= 1, `Header wraps or overflows at ${viewport.width}px`);
    assert(Math.max(...metrics.itemCenters) - Math.min(...metrics.itemCenters) <= 2, `Header items are not on one line at ${viewport.width}px`);
    assert(metrics.brandOccurrences === 1, `Header repeats the brand name at ${viewport.width}px`);
    assert(metrics.brandScrollWidth <= metrics.brandClientWidth, `Header brand is truncated at ${viewport.width}px`);
    assert(metrics.brandTextOverflow !== "ellipsis", `Header brand uses ellipsis at ${viewport.width}px`);
    assert(metrics.linkMetrics.every((link) => link.whiteSpace === "nowrap"), `Header link wraps at ${viewport.width}px`);
    if (viewport.width <= 430) {
      assert(Math.abs(metrics.logoWidth - 28) <= 1, `Mobile header logo must be 28px at ${viewport.width}px`);
      assert(metrics.linkMetrics.every((link) => link.height <= link.lineHeight * 1.25), `Mobile header link is taller than one line at ${viewport.width}px`);
    } else {
      assert(Math.abs(metrics.logoWidth - 32) <= 1, `Header logo must remain 32px at ${viewport.width}px`);
    }
    assert(await page.locator('[data-testid="contact-actions"] a').count() === 2, `Contact action count changed at ${viewport.width}px`);
    assert(await page.locator('a[href^="tel:"]').count() === 0, `tel link exists at ${viewport.width}px`);
    assert(await page.locator('[data-testid="program-list"] article').count() === 3, `Program count changed at ${viewport.width}px`);
    assert(await page.locator('[data-testid="testimonial-list"] figure').count() === 3, `Testimonial count changed at ${viewport.width}px`);
    const sliderMetrics = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="testimonial-list"]');
      const section = document.querySelector("#feedback");
      const cardElements = [...document.querySelectorAll('[data-testid="testimonial-list"] figure')];
      const cards = cardElements.map((card) => card.getBoundingClientRect());
      const contents = [...document.querySelectorAll('[data-testid="testimonial-list"] .MuiCardContent-root')];
      const quotes = [...document.querySelectorAll('[data-testid="testimonial-list"] blockquote')];
      const dots = document.querySelector('[data-testid="testimonial-dots"]');
      const contact = document.querySelector('[data-testid="contact-section"] > div');
      const actions = [...document.querySelectorAll('[data-testid="contact-actions"] a')];
      const heading = document.querySelector("#feedback h2");
      const listRect = list?.getBoundingClientRect();
      const sectionRect = section?.getBoundingClientRect();
      const dotsRect = dots?.getBoundingClientRect();
      const contactRect = contact?.getBoundingClientRect();
      const actionRects = actions.map((action) => action.getBoundingClientRect());
      return listRect && sectionRect && dotsRect && contactRect ? {
        listWidth: listRect.width,
        cards: cards.map((card) => ({ width: card.width, height: card.height, top: card.top, left: card.left, right: card.right })),
        visibleCardCount: cards.filter((card) => Math.min(card.right, listRect.right) - Math.max(card.left, listRect.left) >= card.width - 1).length,
        cardAriaHidden: cardElements.map((card) => card.getAttribute("aria-hidden")),
        listOverflow: list.scrollWidth - list.clientWidth,
        sectionWidth: sectionRect.width,
        centerOffset: Math.abs((listRect.left + listRect.right) / 2 - (sectionRect.left + sectionRect.right) / 2),
        contentWidths: contents.map((content) => content.getBoundingClientRect().width),
        contentPaddingLeft: contents.map((content) => Number.parseFloat(window.getComputedStyle(content).paddingLeft)),
        contentMinHeights: contents.map((content) => window.getComputedStyle(content).minHeight),
        quoteFontSizes: quotes.map((quote) => Number.parseFloat(window.getComputedStyle(quote).fontSize)),
        dotsWidth: dotsRect.width,
        dotsGap: dotsRect.top - listRect.bottom,
        dotsCenterOffset: Math.abs((dotsRect.left + dotsRect.right) / 2 - (listRect.left + listRect.right) / 2),
        dotsDisplay: window.getComputedStyle(dots).display,
        headingDisplay: heading ? window.getComputedStyle(heading).display : "",
        contactWidth: contactRect.width,
        contactCenterOffset: Math.abs((contactRect.left + contactRect.right) / 2 - (sectionRect.left + sectionRect.right) / 2),
        actionRects: actionRects.map((action) => ({ top: action.top, height: action.height })),
        actionWhiteSpace: actions.map((action) => window.getComputedStyle(action).whiteSpace),
      } : null;
    });
    assert(sliderMetrics !== null, `Testimonial slider is missing at ${viewport.width}px`);
    if (viewport.width < 768) {
      assert(sliderMetrics.cards.every((card) => Math.abs(card.width - sliderMetrics.listWidth) <= 1), `Each mobile testimonial slide must fill the slider at ${viewport.width}px`);
      assert(sliderMetrics.listOverflow > sliderMetrics.listWidth, `Mobile testimonial track is not wider than one slide at ${viewport.width}px`);
      assert(sliderMetrics.visibleCardCount === 1, `Mobile must show exactly one testimonial at ${viewport.width}px`);
      assert(sliderMetrics.dotsDisplay !== "none", `Mobile testimonial dots are hidden at ${viewport.width}px`);
      assert(sliderMetrics.headingDisplay === "none", `Desktop testimonial heading is visible below md at ${viewport.width}px`);
      assert(sliderMetrics.dotsGap >= 10 && sliderMetrics.dotsGap <= 14, `Testimonial dots must sit directly below the card at ${viewport.width}px`);
      assert(sliderMetrics.dotsCenterOffset <= 1, `Testimonial dots are not centered below the card at ${viewport.width}px`);
    } else {
      const expectedCardWidth = (sliderMetrics.listWidth - 40) / 3;
      assert(sliderMetrics.cards.every((card) => Math.abs(card.width - expectedCardWidth) <= 1), `Desktop testimonial cards do not use three equal columns at ${viewport.width}px`);
      assert(sliderMetrics.visibleCardCount === 3, `Desktop must show all three testimonials at ${viewport.width}px`);
      assert(Math.max(...sliderMetrics.cards.map((card) => card.top)) - Math.min(...sliderMetrics.cards.map((card) => card.top)) <= 1, `Desktop testimonials are not on one row at ${viewport.width}px`);
      assert(Math.max(...sliderMetrics.cards.map((card) => card.height)) - Math.min(...sliderMetrics.cards.map((card) => card.height)) <= 1, `Desktop testimonial heights are not equal at ${viewport.width}px`);
      assert(sliderMetrics.listOverflow <= 1, `Desktop testimonial grid overflows at ${viewport.width}px`);
      assert(sliderMetrics.dotsDisplay === "none", `Desktop testimonial dots remain visible at ${viewport.width}px`);
      assert(sliderMetrics.headingDisplay !== "none", `Desktop testimonial heading is hidden at ${viewport.width}px`);
      assert(sliderMetrics.cardAriaHidden.every((value) => value === null), `Desktop testimonials remain hidden from accessibility at ${viewport.width}px`);
    }
    if (viewport.width <= 430) {
      assert(Math.abs(sliderMetrics.listWidth - sliderMetrics.sectionWidth) <= 1, `Mobile testimonial must fill its section at ${viewport.width}px`);
      assert(Math.abs(sliderMetrics.contactWidth - sliderMetrics.sectionWidth) <= 1, `Mobile contact must fill its section at ${viewport.width}px`);
      assert(sliderMetrics.contentPaddingLeft.every((padding) => padding >= 20 && padding <= 22), `Mobile testimonial padding is incorrect at ${viewport.width}px`);
      assert(sliderMetrics.quoteFontSizes.every((fontSize) => fontSize >= 15.5), `Mobile testimonial quote is too small at ${viewport.width}px`);
      assert(sliderMetrics.contentMinHeights.every((height) => height === "0px"), `Mobile testimonial must size to its content at ${viewport.width}px`);
      assert(sliderMetrics.actionRects.length === 2, `Mobile contact must have two actions at ${viewport.width}px`);
      assert(Math.abs(sliderMetrics.actionRects[0].top - sliderMetrics.actionRects[1].top) <= 1, `Mobile contact actions are not on one row at ${viewport.width}px`);
      assert(sliderMetrics.actionRects.every((action) => action.height >= 44), `Mobile contact actions are shorter than 44px at ${viewport.width}px`);
      assert(sliderMetrics.actionWhiteSpace.every((whiteSpace) => whiteSpace === "nowrap"), `Mobile contact action label wraps at ${viewport.width}px`);
    }
    if (viewport.width === 1440) {
      assert(Math.abs(sliderMetrics.listWidth - sliderMetrics.sectionWidth) <= 1, `Desktop testimonial must fill the 1152px container: ${sliderMetrics.listWidth}px`);
      assert(sliderMetrics.listWidth >= 1147 && sliderMetrics.listWidth <= 1152, `Desktop testimonial width is not approximately 1152px: ${sliderMetrics.listWidth}px`);
      assert(sliderMetrics.centerOffset <= 1, `Desktop testimonial is not centered: ${sliderMetrics.centerOffset}px`);
      assert(sliderMetrics.contentWidths.every((width, index) => sliderMetrics.cards[index].width - width >= 1 && sliderMetrics.cards[index].width - width <= 2), "Desktop testimonial content must fill each card content box");
      assert(sliderMetrics.contentPaddingLeft.every((padding) => padding >= 28 && padding <= 32), "Desktop testimonial padding must remain within 28–32px");
      assert(sliderMetrics.contentMinHeights.every((height) => height === "0px"), "Desktop testimonial content must not use a minimum height");
      assert(Math.abs(sliderMetrics.contactWidth - sliderMetrics.sectionWidth) <= 1, `Desktop contact must fill the 1152px container: ${sliderMetrics.contactWidth}px`);
      assert(sliderMetrics.contactWidth >= 1147 && sliderMetrics.contactWidth <= 1152, `Desktop contact width is not approximately 1152px: ${sliderMetrics.contactWidth}px`);
      assert(sliderMetrics.contactCenterOffset <= 1, `Desktop contact is not centered: ${sliderMetrics.contactCenterOffset}px`);
    }
    if (screenshotDir && screenshotWidths.has(viewport.width)) {
      await page.screenshot({ path: path.join(screenshotDir, `homepage-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
  }

  await context.close();
  if (screenshotDir) console.log(`Homepage screenshots saved to ${screenshotDir}`);
  console.log("Public Homepage local SEO E2E passed");
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
