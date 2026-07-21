import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertRuleSelfTests } from "./package-rules.mjs";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const required = [
  "docs/implementation/roadmap.md", "docs/implementation/status.md",
  "docs/implementation/tasks/M1.1-architecture-stabilization.md",
  "docs/implementation/acceptance/M1.1.md",
];
assertRuleSelfTests();
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
if (fs.existsSync(path.join(root, "FILE_MANIFEST.txt"))) failures.push("FILE_MANIFEST.txt is a forbidden manual manifest");

const routeSource = read("server/src/routes/index.ts");
const routePattern = /router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/gs;
const sourceRoutes = new Set([...routeSource.matchAll(routePattern)].map((match) => `${match[1].toUpperCase()} ${match[2].replace(/:([A-Za-z]+)/g, "{$1}")}`));
const openapi = read("docs/api/openapi.yaml");
const documented = new Set();
let currentPath = null;
for (const line of openapi.split(/\r?\n/)) {
  const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
  if (pathMatch) { currentPath = pathMatch[1]; continue; }
  const methodMatch = line.match(/^    (get|post|put|patch|delete):/);
  if (currentPath && methodMatch) documented.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
}
for (const route of sourceRoutes) if (!documented.has(route)) failures.push(`OpenAPI missing source route: ${route}`);
for (const route of documented) if (!sourceRoutes.has(route)) failures.push(`OpenAPI route does not exist in source: ${route}`);

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
for (const file of tracked) {
  const normalized = file.replaceAll("\\", "/");
  if (/(^|\/)(dist|coverage|\.vite)\//.test(normalized)) failures.push(`Generated artifact is tracked: ${normalized}`);
  const basename = path.posix.basename(normalized);
  if (/^\.env(?:\.|$)/i.test(basename) && !/^\.env(?:\.[^.]+)?\.example$/i.test(basename) && basename !== ".env.example")
    failures.push(`Real environment file is tracked: ${normalized}`);
  if (/\.(xlsx?|xlsm|xlsb)$/i.test(normalized) && !/^server\/src\/.*\/fixtures\//i.test(normalized))
    failures.push(`Private workbook is tracked outside approved fixtures: ${normalized}`);
  if (/#U[0-9A-F]{4}/i.test(normalized)) failures.push(`Malformed encoded filename is tracked: ${normalized}`);
  if (/\.(png|jpe?g)$/i.test(normalized) && !/^(docs\/wireframes|client\/public)\//i.test(normalized))
    failures.push(`Generated screenshot/image is tracked outside approved source assets: ${normalized}`);
}

const clientFiles = execFileSync("rg", ["--files", "client/src"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const fakeActionPatterns = [
  { label: "empty click handler", pattern: /onClick\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/ },
  { label: "placeholder href", pattern: /href\s*=\s*["']#["']/ },
  { label: "TODO-only click handler", pattern: /onClick\s*=\s*\{\s*\(\)\s*=>\s*\{\s*(?:\/\*\s*TODO\b[^*]*\*\/|\/\/\s*TODO[^\n}]*)\s*\}\s*\}/i },
];
for (const { label, pattern } of fakeActionPatterns) {
  const probe = label === "placeholder href" ? '<a href="#">x</a>'
    : label === "empty click handler" ? "<button onClick={() => {}}>x</button>"
      : "<button onClick={() => { /* TODO */ }}>x</button>";
  if (!pattern.test(probe)) failures.push(`Repository checker self-test failed for ${label}`);
}
for (const file of clientFiles) {
  const source = read(file);
  for (const { label, pattern } of fakeActionPatterns)
    if (pattern.test(source)) failures.push(`${label} in ${file}`);
}

const obsoleteFiles = ["client/src/pages/LessonCompletePlaceholderPage.tsx"];
for (const file of obsoleteFiles) if (fs.existsSync(path.join(root, file))) failures.push(`Obsolete completed-feature placeholder exists: ${file}`);
const serverFiles = execFileSync("rg", ["--files", "server/src"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
for (const file of serverFiles)
  if (/\baddBillableAttendance\s*\(/.test(read(file))) failures.push(`Obsolete incremental tuition path exists in ${file}`);

for (const [file, requiredMarkers] of [
  ["scripts/package-source.mjs", ["--exclude-standard", "isAllowlistedSourcePath", "prohibitedArchiveReason"]],
  ["scripts/check-package.mjs", ["prohibitedArchiveReason", "sensitiveTextReason", "sha256"]],
]) {
  if (!fs.existsSync(path.join(root, file))) { failures.push(`Missing source-artifact control: ${file}`); continue; }
  const source = read(file);
  for (const marker of requiredMarkers) if (!source.includes(marker)) failures.push(`${file} is missing package safety marker: ${marker}`);
}

const nginx = read("deploy/nginx.conf");
for (const header of ["Content-Security-Policy", "frame-ancestors 'none'", "Referrer-Policy", "Permissions-Policy", "X-Content-Type-Options"])
  if (!nginx.includes(header)) failures.push(`Nginx security header/config is missing: ${header}`);
const clientPackage = JSON.parse(read("client/package.json"));
if (!clientPackage.scripts?.["build:production"]?.includes("validate:public")) failures.push("Production client build does not validate public marketing configuration");
if (!read("Dockerfile.web").includes("build:production")) failures.push("Web image bypasses production marketing validation");

const status = fs.existsSync(path.join(root, "docs/implementation/status.md")) ? read("docs/implementation/status.md") : "";
if (/Final verdict:\s*PASS|## Status\s+PASS/i.test(status)) {
  const report = path.join(root, ".agent-reports/M1.1-verification.md");
  if (!fs.existsSync(report) || !/^PASS$/m.test(fs.readFileSync(report, "utf8"))) failures.push("Status claims PASS without a PASS verification report");
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Repository consistency passed (${sourceRoutes.size} Express routes matched OpenAPI).`);
