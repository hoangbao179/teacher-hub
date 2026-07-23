/* global process, Image, document, Buffer */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const clientRoot = path.resolve(import.meta.dirname, "..");
const publicRoot = path.join(clientRoot, "public");
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function toDataUrl(filePath, type) {
  const buffer = await fs.readFile(filePath);
  return `data:${type};base64,${buffer.toString("base64")}`;
}

async function renderImage(page, source, width, height, type, quality = 0.86) {
  const dataUrl = await page.evaluate(async ({ source, width, height, type, quality }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(type, quality);
  }, { source, width, height, type, quality });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

const browser = await chromium.launch({ headless: true, executablePath: chrome });
try {
  const page = await browser.newPage();
  const teacherSource = await toDataUrl(path.join(publicRoot, "images", "covy-image.png"), "image/png");
  for (const width of [480, 768, 1200]) {
    const height = Math.round(width * 1086 / 1448);
    const output = await renderImage(page, teacherSource, width, height, "image/webp", 0.84);
    await fs.writeFile(path.join(publicRoot, "images", `covy-image-${width}.webp`), output);
  }
  await fs.writeFile(
    path.join(publicRoot, "images", "covy-image-1200.jpg"),
    await renderImage(page, teacherSource, 1200, 900, "image/jpeg", 0.86),
  );

  const faviconSource = await toDataUrl(path.join(publicRoot, "favicon.svg"), "image/svg+xml");
  for (const [name, size] of [["favicon-48.png", 48], ["favicon-96.png", 96], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    await fs.writeFile(path.join(publicRoot, name), await renderImage(page, faviconSource, size, size, "image/png"));
  }

  const logoSource = await toDataUrl(path.join(publicRoot, "logo-covy.svg"), "image/svg+xml");
  await fs.writeFile(path.join(publicRoot, "logo-covy-512.png"), await renderImage(page, logoSource, 512, 154, "image/png"));
} finally {
  await browser.close();
}
