import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const clientRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(clientRoot, "dist", "index.html");
const serverEntryPath = path.join(clientRoot, ".prerender", "entry-server.js");
const { renderHomePage } = await import(pathToFileURL(serverEntryPath).href);

const document = await fs.readFile(outputPath, "utf8");
const marker = '<div id="root"></div>';
if (!document.includes(marker)) throw new Error("Prerender root marker was not found in dist/index.html");

const rendered = document.replace(marker, `<div id="root" data-prerendered="true">${renderHomePage()}</div>`);
await fs.writeFile(outputPath, rendered, "utf8");
await fs.rm(path.join(clientRoot, ".prerender"), { recursive: true, force: true });
