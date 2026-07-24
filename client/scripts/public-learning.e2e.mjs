/* global process, fetch, setTimeout, document, localStorage, sessionStorage, window, URL, console, getComputedStyle */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { learningUnits } from "../src/features/learning/content/vocabularyCatalog.ts";
import { createQuizQuestions, quizItemOrder } from "../src/features/learning/quiz/quizQuestions.ts";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const port = 5186;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), "covy-learning-v18cd-"));
const viewports = [
  { width: 360, height: 800 }, { width: 375, height: 812 }, { width: 390, height: 844 },
  { width: 400, height: 930 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 900 },
];
const quizUnit = learningUnits.find((unit) => unit.slug === "con-vat-dang-yeu");
const quizQuestions = createQuizQuestions(quizUnit.vocabulary, quizItemOrder(quizUnit.vocabulary));
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

try {
  child = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: clientRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  const prerendered = await (await fetch(`${origin}/hoc/index.html`)).text();
  assert(prerendered.includes("Góc học tiếng Anh miễn phí cùng cô Vy"), "Production /hoc is not prerendered");
  assert((prerendered.match(/<h1\b/g) ?? []).length === 1, "Prerendered /hoc must contain one H1");
  const prerenderedUnit = await (await fetch(`${origin}/hoc/mam-non/con-vat-dang-yeu/index.html`)).text();
  assert(prerenderedUnit.includes("Con vật đáng yêu"), "Stable Unit route is not prerendered");
  assert(prerenderedUnit.includes('rel="canonical" href="https://tienganhcovy.com/hoc/mam-non/con-vat-dang-yeu"'), "Prerendered Unit canonical is missing");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem("teacher-token", "public-route-must-not-use-admin-token");
    if (!sessionStorage.getItem("learning-corrupt-seeded")) {
      localStorage.setItem("covy-learning-progress:v1", "{broken");
      sessionStorage.setItem("learning-corrupt-seeded", "true");
    }
  });
  const page = await context.newPage();
  const apiRequests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.getByTestId("homepage-learning-cta").getByRole("link", { name: "Bắt đầu học" }).click();
  await page.waitForURL(`${origin}/hoc`);
  const hubHeading = page.getByRole("heading", { name: "Góc học tiếng Anh miễn phí cùng cô Vy", level: 1 });
  await hubHeading.waitFor();
  assert(await hubHeading.isVisible(), "Homepage CTA did not open /hoc");
  assert(apiRequests.length === 0, `Learning flow called Admin API: ${apiRequests.join(", ")}`);

  const levelGroups = page.locator('[data-testid^="level-group-"]');
  assert(await levelGroups.locator("article").count() === 10, "Hub must show preschool and grades 1–9 exactly");
  assert(await page.getByRole("link", { name: "Mở bài học Mầm non" }).isVisible(), "Preschool content must open");
  assert(await page.getByRole("link", { name: "Mở bài học Lớp 3" }).isVisible(), "Grade 3 content must open");
  assert(await page.getByText("Sắp có", { exact: true }).count() === 8, "Eight unpublished levels must show Sắp có");
  assert(await page.getByRole("link", { name: "Mở bài học Lớp 1" }).count() === 0, "Unpublished level must not navigate");

  await page.getByRole("link", { name: "Mở bài học Mầm non" }).click();
  await page.waitForURL(`${origin}/hoc/mam-non`);
  const levelHeading = page.getByRole("heading", { name: "Chọn bài học", level: 1 });
  await levelHeading.waitFor();
  assert(await levelHeading.isVisible(), "Available level page did not open");
  assert(await page.locator("main article").count() === 2, "Preschool must have two Unit cards");
  assert(await page.getByRole("link", { name: "Mở Unit Con vật đáng yêu" }).isVisible(), "Published Unit must open");

  await page.getByRole("link", { name: "Mở Unit Con vật đáng yêu" }).click();
  await page.waitForURL(`${origin}/hoc/mam-non/con-vat-dang-yeu`);
  const unitHeading = page.getByRole("heading", { name: "Con vật đáng yêu", level: 1 });
  await unitHeading.waitFor();
  assert(await unitHeading.isVisible(), "Unit overview did not open");
  assert(await page.getByRole("link", { name: "Học bằng Flashcard" }).isVisible(), "Flashcard CTA is missing");
  assert(await page.getByRole("link", { name: "Nghe và chọn nghĩa" }).isVisible(), "Listen CTA is missing");
  assert(await page.getByRole("link", { name: "Luyện tập chọn nghĩa" }).isVisible(), "Quiz CTA is missing");

  await page.getByRole("link", { name: "Học bằng Flashcard" }).click();
  await page.waitForURL(`${origin}/hoc/mam-non/con-vat-dang-yeu/flashcards`);
  await page.getByRole("group", { name: "Flashcard từ cat" }).waitFor();
  assert(await page.getByRole("group", { name: "Flashcard từ cat" }).isVisible(), "First flashcard is missing");
  assert(await page.getByRole("button", { name: "Nghe phát âm từ cat" }).isVisible(), "Accessible audio control is missing");
  await page.getByRole("button", { name: "Thẻ tiếp theo" }).click();
  assert(await page.getByRole("group", { name: "Flashcard từ dog" }).isVisible(), "Next flashcard failed");
  await page.keyboard.press("ArrowLeft");
  assert(await page.getByRole("group", { name: "Flashcard từ cat" }).isVisible(), "ArrowLeft keyboard navigation failed");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Cần ôn" }).click();
  await page.getByRole("button", { name: "Thẻ tiếp theo" }).click();
  await page.getByRole("button", { name: "Đã nhớ" }).click();
  const progressBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")));
  assert(progressBeforeReload.units["con-vat-dang-yeu"].lastItemIndex === 2, `Expected lastItemIndex 2, received ${progressBeforeReload.units["con-vat-dang-yeu"].lastItemIndex}`);
  assert(progressBeforeReload.units["con-vat-dang-yeu"].contentVersion === 1, `Expected contentVersion 1, received ${progressBeforeReload.units["con-vat-dang-yeu"].contentVersion}`);
  await page.reload({ waitUntil: "networkidle" });
  const currentCard = page.locator('main [role="group"]').first();
  await currentCard.waitFor();
  assert(await currentCard.getAttribute("aria-label") === "Flashcard từ bird", `Flashcard position did not survive reload: ${await currentCard.getAttribute("aria-label")}`);
  assert(await page.locator(".MuiChip-root").getByText("Đã nhớ", { exact: true }).isVisible(), "Remembered state did not survive reload");
  const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")));
  assert(savedProgress.units["con-vat-dang-yeu"].reviewItemIds.includes("pa-2"), "Review state was not persisted");
  assert(savedProgress.units["con-vat-dang-yeu"].rememberedItemIds.includes("pa-3"), "Remembered state was not persisted");

  await page.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/listen`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Con nghe thấy từ nào?", level: 1 }).isVisible(), "Listen practice did not open");
  await page.getByRole("button", { name: "Phát từ cần nghe" }).click();
  await page.getByRole("button", { name: /con mèo/ }).click();
  assert(await page.getByText("Chính xác!", { exact: false }).isVisible(), "Correct listen feedback is missing");
  assert(await page.getByText(/Từ vừa nghe là/).isVisible(), "Listen answer must only reveal the word after answering");
  const listenProgress = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")).units["con-vat-dang-yeu"]);
  assert(listenProgress.listenCorrect === 1 && listenProgress.listenTotal === 1, "Listen score was not persisted");
  await page.getByRole("button", { name: "Tiếp theo" }).click();

  await page.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/quiz`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: quizQuestions[0].prompt, level: 1 }).isVisible(), "Quiz did not open with deterministic first question");
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,follow", "Quiz must be noindex");
  const wrongChoice = quizQuestions[0].options.find((option) => option !== quizQuestions[0].correctValue);
  await page.getByRole("radio", { name: `Lựa chọn: ${wrongChoice}`, exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  assert(await page.getByText(/Chưa đúng lần này/).isVisible(), "Wrong quiz feedback is missing");
  const answerCount = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")).units["con-vat-dang-yeu"].activeQuiz.answers.length);
  await page.getByRole("button", { name: "Kiểm tra" }).count().then((count) => assert(count === 0, "Graded question must prevent double submit"));
  assert(answerCount === 1, "First quiz answer was not persisted exactly once");
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByText("Câu 2 / 10", { exact: true }).isVisible(), "Quiz did not resume after reload");

  for (let index = 1; index < quizQuestions.length; index += 1) {
    const question = quizQuestions[index];
    const choice = page.getByRole("radio", { name: `Lựa chọn: ${question.correctValue}`, exact: true });
    if (index === 1) { await choice.focus(); await page.keyboard.press("Enter"); } else await choice.click();
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    assert(await page.getByText("Chính xác — tuyệt lắm!", { exact: true }).isVisible(), `Correct feedback missing at question ${index + 1}`);
    await page.getByRole("button", { name: index === quizQuestions.length - 1 ? "Xem kết quả" : "Câu tiếp theo" }).click();
  }
  await page.waitForURL(`${origin}/hoc/mam-non/con-vat-dang-yeu/result`);
  const resultScore = await page.getByTestId("result-score").textContent();
  assert(resultScore === "90%", `Quiz result score is incorrect: ${resultScore}`);
  assert(await page.getByText("9 đúng", { exact: true }).isVisible(), "Correct count is missing from result");
  assert(await page.getByText("1 cần luyện thêm", { exact: true }).isVisible(), "Wrong count is missing from result");
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,follow", "Result must be noindex");
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByTestId("result-score").isVisible(), "Result did not survive reload");
  await page.getByRole("link", { name: "Ôn lại từ sai" }).click();
  await page.waitForURL(`${origin}/hoc/mam-non/con-vat-dang-yeu/review`);
  const reviewCard = page.getByRole("group", { name: /Thẻ ôn tập từ/ });
  await reviewCard.waitFor();
  assert(await reviewCard.isVisible(), `Review page did not open: ${await page.locator("body").innerText()}`);
  await page.getByRole("button", { name: "Đã nhớ từ này" }).click();
  const reviewProgress = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")).units["con-vat-dang-yeu"]);
  assert(reviewProgress.quizAttempts.length === 1, "Review must preserve quiz history");
  assert(reviewProgress.wrongItemIds.length === 0, "Reviewed wrong item must leave current wrong list");

  await page.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xóa tiến độ Unit này" }).click();
  assert(await page.getByRole("dialog", { name: /Xóa tiến độ/ }).isVisible(), "Unit reset confirmation dialog is missing");
  await page.getByRole("button", { name: "Giữ lại" }).click();

  await page.goto(`${origin}/hoc/lop-3/con-vat-dang-yeu`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Bài học này chưa có trong cặp sách", level: 1 }).isVisible(), "Unit from another level must show public 404");

  await page.goto(`${origin}/hoc/mam-non`, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await levelHeading.waitFor();
  assert(await levelHeading.isVisible(), "Direct level refresh failed");
  await page.goto(`${origin}/hoc/lop-khong-ton-tai`, { waitUntil: "networkidle" });
  const notFoundHeading = page.getByRole("heading", { name: "Bài học này chưa có trong cặp sách", level: 1 });
  await notFoundHeading.waitFor();
  assert(await notFoundHeading.isVisible(), "Invalid learning level must show public learning 404");
  assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,follow", "Invalid learning route must be noindex");
  await page.goto(`${origin}/hoc/lop-3/con-vat-dang-yeu/quiz`, { waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "Bài học này chưa có trong cặp sách", level: 1 }).isVisible(), "Quiz Unit from another level must show public 404");

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const screens = [
      ["hub", "/hoc"], ["level", "/hoc/lop-3"], ["flashcard", "/hoc/mam-non/con-vat-dang-yeu/flashcards"],
      ["quiz", "/hoc/mam-non/con-vat-dang-yeu/quiz"], ["result", "/hoc/mam-non/con-vat-dang-yeu/result"], ["review", "/hoc/mam-non/con-vat-dang-yeu/review"],
    ];
    for (const [name, route] of screens) {
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(overflow <= 1, `${name} horizontal overflow at ${viewport.width}px: ${overflow}px`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(50);
      await page.screenshot({ path: path.join(screenshotDir, `${name}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      const mainCard = page.locator("main .MuiCard-root").first();
      if (["flashcard", "quiz", "result", "review"].includes(name) && await mainCard.count()) {
        const cardWidth = await mainCard.evaluate((element) => element.getBoundingClientRect().width);
        assert(cardWidth <= 900, `${name} primary card is wider than 900px at ${viewport.width}px: ${cardWidth}px`);
      }
    }
    await page.goto(`${origin}/hoc`, { waitUntil: "networkidle" });
    const targets = await page.getByRole("link").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0));
    assert(targets.every((rect) => rect.height >= 44), `Learning link touch target below 44px at ${viewport.width}px`);
    await page.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/flashcards`, { waitUntil: "networkidle" });
    const flashcardWidth = await page.getByRole("group", { name: /Flashcard từ/ }).evaluate((element) => element.getBoundingClientRect().width);
    assert(flashcardWidth <= 820, `Desktop flashcard is wider than 820px at ${viewport.width}px`);
  }

  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("covy-learning-progress:v1"));
    store.units["khu-vuon-sac-mau"] = { contentVersion: 1, viewedItemIds: ["pc-1"], rememberedItemIds: [], reviewItemIds: [], lastItemIndex: 0, listenCorrect: 0, listenTotal: 0, quizAttempts: [], wrongItemIds: [], updatedAt: "2026-07-24T00:00:00.000Z" };
    localStorage.setItem("covy-learning-progress:v1", JSON.stringify(store));
  });
  await page.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xóa tiến độ Unit này" }).click();
  await page.getByRole("button", { name: "Xóa tiến độ", exact: true }).click();
  const resetStore = await page.evaluate(() => JSON.parse(localStorage.getItem("covy-learning-progress:v1")));
  assert(!resetStore.units["con-vat-dang-yeu"], "Confirmed Unit reset did not remove its progress");
  assert(resetStore.units["khu-vuon-sac-mau"].viewedItemIds.includes("pc-1"), "Unit reset removed another Unit's progress");

  const noAudioContext = await browser.newContext();
  await noAudioContext.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
  });
  const noAudioPage = await noAudioContext.newPage();
  await noAudioPage.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/listen`, { waitUntil: "networkidle" });
  assert(await noAudioPage.getByText("Trình duyệt này chưa phát được từ. Câu này không tính điểm.").isVisible(), "No-audio fallback message is missing");
  assert(await noAudioPage.getByRole("button", { name: /Lựa chọn/ }).first().isDisabled(), "No-audio question must not count an answer");
  await noAudioContext.close();

  const directResultContext = await browser.newContext();
  const directResultPage = await directResultContext.newPage();
  await directResultPage.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/result`, { waitUntil: "networkidle" });
  assert(await directResultPage.getByText(/Chưa có kết quả nào/).isVisible(), "Direct result without an attempt needs a safe empty state");
  await directResultContext.close();

  const blockedStorageContext = await browser.newContext();
  await blockedStorageContext.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  });
  const blockedStoragePage = await blockedStorageContext.newPage();
  await blockedStoragePage.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/quiz`, { waitUntil: "networkidle" });
  assert(await blockedStoragePage.getByText("Câu 1 / 10", { exact: true }).isVisible(), "Blocked storage must not crash quiz");
  await blockedStorageContext.close();

  const imageFailureContext = await browser.newContext();
  await imageFailureContext.route("**/learning/animals/cat.svg", (route) => route.abort());
  const imageFailurePage = await imageFailureContext.newPage();
  await imageFailurePage.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/flashcards`, { waitUntil: "networkidle" });
  await imageFailurePage.getByTestId("image-fallback").waitFor();
  assert(await imageFailurePage.getByTestId("image-fallback").isVisible(), "Broken illustration needs a friendly fallback");
  await imageFailureContext.close();

  const reducedMotionContext = await browser.newContext({ reducedMotion: "reduce" });
  await reducedMotionContext.addInitScript(() => localStorage.setItem("covy-learning-progress:v1", JSON.stringify({ schemaVersion: 1, units: { "con-vat-dang-yeu": { contentVersion: 1, viewedItemIds: [], rememberedItemIds: [], reviewItemIds: [], lastItemIndex: 0, listenCorrect: 0, listenTotal: 0, wrongItemIds: [], quizAttempts: [{ id: "reduced", completedAt: "2026-07-24T00:00:00.000Z", totalQuestions: 10, correctCount: 10, scorePercent: 100, wrongItemIds: [] }], bestScore: 100, latestScore: 100, completedAt: "2026-07-24T00:00:00.000Z", updatedAt: "2026-07-24T00:00:00.000Z" } } })));
  const reducedMotionPage = await reducedMotionContext.newPage();
  await reducedMotionPage.goto(`${origin}/hoc/mam-non/con-vat-dang-yeu/result`, { waitUntil: "networkidle" });
  const animationName = await reducedMotionPage.locator(".learning-celebration").evaluate((element) => getComputedStyle(element).animationName);
  assert(animationName === "none", `Reduced motion must disable celebration animation, received ${animationName}`);
  await reducedMotionContext.close();

  assert(apiRequests.length === 0, `Public learning made API requests: ${apiRequests.join(", ")}`);
  console.log(`Public learning E2E passed; temporary screenshots: ${screenshotDir}`);
} finally {
  if (browser) await browser.close();
  if (child) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}
