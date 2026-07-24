import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const clientRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(clientRoot, "dist", "index.html");
const serverEntryPath = path.join(clientRoot, ".prerender", "entry-server.js");
const { renderHomePage, renderLearningHubPage, renderNotFoundPage } = await import(pathToFileURL(serverEntryPath).href);

const document = await fs.readFile(outputPath, "utf8");
const marker = '<div id="root"></div>';
if (!document.includes(marker)) throw new Error("Prerender root marker was not found in dist/index.html");

const rendered = document.replace(marker, `<div id="root" data-prerendered="true">${renderHomePage()}</div>`);
await fs.writeFile(outputPath, rendered, "utf8");

const learningDocument = document
  .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Chọn cấp độ từ mầm non đến lớp 9 và học từ vựng tiếng Anh miễn phí cùng cô Vy." />')
  .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://tienganhcovy.com/hoc" />')
  .replace(/<script id="public-home-structured-data"[\s\S]*?<\/script>\s*/, "")
  .replace(/<title>[\s\S]*?<\/title>/, "<title>Góc học tiếng Anh miễn phí cùng cô Vy</title>")
  .replace(marker, `<div id="root" data-prerendered="true">${renderLearningHubPage()}</div>`);
await fs.mkdir(path.join(clientRoot, "dist", "hoc"), { recursive: true });
await fs.writeFile(path.join(clientRoot, "dist", "hoc", "index.html"), learningDocument, "utf8");

const notFoundDocument = document
  .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Trang bạn tìm không tồn tại. Quay về trang chủ lớp tiếng Anh cô Vy tại Huế." />')
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,follow" />')
  .replace(/<link rel="canonical"[^>]*>\s*/, "")
  .replace(/<script id="public-home-structured-data"[\s\S]*?<\/script>\s*/, "")
  .replace(/<title>[\s\S]*?<\/title>/, "<title>Không tìm thấy trang | Lớp tiếng Anh cô Vy</title>")
  .replace(marker, `<div id="root" data-prerendered="true">${renderNotFoundPage()}</div>`);
await fs.writeFile(path.join(clientRoot, "dist", "404.html"), notFoundDocument, "utf8");
await fs.rm(path.join(clientRoot, ".prerender"), { recursive: true, force: true });
