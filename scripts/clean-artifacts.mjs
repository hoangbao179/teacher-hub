import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const artifactRoots = [
  ".agent-reports",
  ".artifacts",
  "playwright-report",
  "test-results",
  "screenshots",
];
const legacyDocumentationRoots = [
  "docs/implementation/tasks",
  "docs/implementation/acceptance",
];

const requested = process.argv.includes("--legacy-docs")
  ? [...artifactRoots, ...legacyDocumentationRoots]
  : artifactRoots;

function measure(target) {
  if (!fs.existsSync(target)) return { files: 0, bytes: 0 };
  const pending = [target];
  let files = 0;
  let bytes = 0;
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(absolute).size;
      }
    }
  }
  return { files, bytes };
}

let totalFiles = 0;
let totalBytes = 0;
for (const relative of requested) {
  const absolute = path.resolve(root, relative);
  const resolvedRelative = path.relative(root, absolute).replaceAll("\\", "/");
  if (resolvedRelative !== relative || resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative))
    throw new Error(`Refusing unsafe cleanup target: ${relative}`);
  const measured = measure(absolute);
  if (!measured.files && !fs.existsSync(absolute)) continue;
  fs.rmSync(absolute, { recursive: true, force: true });
  totalFiles += measured.files;
  totalBytes += measured.bytes;
  console.log(`Removed ${relative}: ${measured.files} files, ${measured.bytes} bytes`);
}

console.log(`Artifact cleanup complete: ${totalFiles} files, ${totalBytes} bytes removed`);
