import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { archiveNames, assertRuleSelfTests, normalizeArchivePath, prohibitedArchiveReason, rawPasswordPersistenceReason, sensitiveTextReason } from "./package-rules.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const names = archiveNames(packageJson);
const archivePath = path.join(root, "release", names.archive);
const checksumPath = path.join(root, "release", names.checksum);
const failures = [];

assertRuleSelfTests();
if (!fs.existsSync(archivePath)) failures.push("Source archive is missing");
if (!fs.existsSync(checksumPath)) failures.push("SHA-256 checksum is missing");
if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const checksumLine = fs.readFileSync(checksumPath, "utf8").trim();
const expected = checksumLine.match(/^([a-f0-9]{64})\s+([^\s]+)$/i);
const actual = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
if (!expected || expected[1].toLowerCase() !== actual || expected[2] !== names.archive) failures.push("Checksum does not match the source archive");

const listed = execFileSync("tar", ["-tzf", archivePath], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/).map(normalizeArchivePath).filter(Boolean);
const prefix = `${names.base}/`;
for (const entry of listed) {
  if (entry === names.base || entry === `${names.base}/`) continue;
  if (!entry.startsWith(prefix)) { failures.push("Archive contains an unexpected top-level path"); continue; }
  const relative = entry.slice(prefix.length).replace(/\/$/, "");
  const reason = prohibitedArchiveReason(relative);
  if (reason) failures.push(`Archive contains prohibited content (${reason}): ${relative}`);
}
for (const required of ["package.json", "scripts/package-source.mjs", "scripts/check-package.mjs", "SOURCE-PACKAGE-MANIFEST.txt"])
  if (!listed.includes(`${prefix}${required}`)) failures.push(`Archive is missing required source content: ${required}`);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "teacher-hub-package-check-"));
try {
  execFileSync("tar", ["-xzf", archivePath, "-C", temporaryRoot], { cwd: root, stdio: "ignore" });
  const packageRoot = path.join(temporaryRoot, names.base);
  const pending = [packageRoot];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) { pending.push(absolute); continue; }
      const relative = path.relative(packageRoot, absolute).replaceAll("\\", "/");
      if (!entry.isFile() || entry.name === "package-lock.json" || relative === "scripts/package-rules.mjs" || fs.statSync(absolute).size > 2_000_000) continue;
      const buffer = fs.readFileSync(absolute);
      if (buffer.includes(0)) continue;
      const reason = sensitiveTextReason(buffer.toString("utf8"));
      if (reason) failures.push(`Likely sensitive content (${reason}) in ${relative}`);
      const passwordReason = rawPasswordPersistenceReason(relative, buffer.toString("utf8"));
      if (passwordReason) failures.push(`${passwordReason} in ${relative}`);
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error([...new Set(failures)].map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Source package passed: ${listed.length} entries; checksum ${actual}`);
