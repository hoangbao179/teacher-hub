/* global process, fetch, setTimeout, console */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const clientRoot = path.join(root, "client");
const origin = "http://127.0.0.1:5203";
const artifactPolicy = createArtifactPolicy(root, "vocabulary-games-disabled", {});
let artifactRunPassed = false;
let web;
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitUrl(url, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  web = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5203", "--strictPort"], {
    cwd: clientRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  web.stdout.on("data", (chunk) => process.stdout.write(chunk));
  web.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitUrl(origin);

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  installPlaywrightArtifactPolicy(browser, artifactPolicy);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const gameRequests = [];
  page.on("request", (request) => {
    if (/\/api\/public\/learning-(assignments|attempts)/.test(request.url())
      || /\/pages\/Play(Start|Game|Result)Page\.tsx/.test(request.url())
      || /\/GameQuestion\.tsx/.test(request.url())) gameRequests.push(request.url());
  });

  for (const pathname of [
    "/play/ABCDEFGH?access=old-link",
    "/play/session/old-session-token",
    "/play/session/old-session-token/result",
  ]) {
    await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Trò chơi đang được hoàn thiện" }).waitFor();
    await page.getByText("Con có thể tiếp tục học ở Góc học.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Về Góc học", exact: true }).waitFor();
    assert(await page.locator('meta[name="robots"]').getAttribute("content") === "noindex,nofollow,noarchive", `${pathname} is not noindex`);
    assert(await page.getByTestId("game-question").count() === 0, `${pathname} entered the game engine`);
    assert(await page.getByRole("button", { name: /Bắt đầu chơi|Chơi lại/ }).count() === 0, `${pathname} exposes a production game CTA`);
  }
  assert(gameRequests.length === 0, `Disabled routes loaded game/API resources: ${JSON.stringify(gameRequests)}`);

  await page.getByRole("link", { name: "Về Góc học", exact: true }).click();
  await page.waitForURL(`${origin}/hoc`);
  await page.getByRole("heading", { level: 1, name: "Góc học tiếng Anh miễn phí cùng cô Vy" }).waitFor();
  assert(await page.getByTestId("level-group-primary").count() === 1, "Vocabulary learning content is unavailable");

  console.log("TEMP_DISABLED vocabulary game availability E2E PASS");
  artifactRunPassed = true;
} finally {
  await finalizePlaywrightArtifacts(browser, artifactPolicy, artifactRunPassed);
  if (browser) await browser.close();
  web?.kill();
}
