import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { archiveNames, assertRuleSelfTests, isAllowlistedSourcePath, normalizeArchivePath, prohibitedArchiveReason } from "./package-rules.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const names = archiveNames(packageJson);
const releaseDir = path.join(root, "release");
const archivePath = path.join(releaseDir, names.archive);
const checksumPath = path.join(releaseDir, names.checksum);

assertRuleSelfTests();
const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root });
const candidates = output.toString("utf8").split("\0").filter(Boolean).map(normalizeArchivePath);
const files = [];
for (const file of [...new Set(candidates)].sort()) {
  if (!isAllowlistedSourcePath(file)) continue;
  const reason = prohibitedArchiveReason(file);
  if (reason) throw new Error(`Refusing prohibited allowlisted source path (${reason}): ${file}`);
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) continue;
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link in source package: ${file}`);
  if (stat.isFile()) files.push(file);
}
if (!files.includes("package.json") || !files.includes("scripts/package-source.mjs"))
  throw new Error("Controlled source allowlist is missing required package files");

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "teacher-hub-source-"));
const stage = path.join(temporaryRoot, names.base);
try {
  for (const file of files) {
    const destination = path.join(stage, ...file.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, ...file.split("/")), destination);
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const changed = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
  fs.writeFileSync(path.join(stage, "SOURCE-PACKAGE-MANIFEST.txt"), [
    "Teacher Class Hub controlled source snapshot",
    `Base commit: ${commit}`,
    `Includes working-tree changes: ${changed ? "yes" : "no"}`,
    `Allowlisted files: ${files.length}`,
    "Excluded: Git metadata, reports/screenshots, dependencies, builds, env files, dumps/backups and workbooks",
    "",
  ].join("\n"), "utf8");
  fs.mkdirSync(releaseDir, { recursive: true });
  for (const target of [archivePath, checksumPath]) if (fs.existsSync(target)) fs.rmSync(target);
  execFileSync("tar", ["-czf", archivePath, "-C", temporaryRoot, names.base], { cwd: root, stdio: "inherit" });
  const digest = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
  fs.writeFileSync(checksumPath, `${digest}  ${names.archive}\n`, "utf8");
  console.log(`Created ${path.relative(root, archivePath)} (${files.length} allowlisted files)`);
  console.log(`SHA-256 ${digest}`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
