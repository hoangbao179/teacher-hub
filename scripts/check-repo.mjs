import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const required = [
  "docs/implementation/roadmap.md", "docs/implementation/status.md",
  "docs/implementation/tasks/M1.1-architecture-stabilization.md",
  "docs/implementation/acceptance/M1.1.md",
];
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

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/);
for (const file of tracked) if (/(^|\/)(dist|coverage|\.vite)\//.test(file)) failures.push(`Generated artifact is tracked: ${file}`);

const clientFiles = execFileSync("rg", ["--files", "client/src"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const emptyAction = /onClick\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}|href\s*=\s*["']#["']/;
for (const file of clientFiles) if (emptyAction.test(read(file))) failures.push(`Empty visible action in ${file}`);

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
