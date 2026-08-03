import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const markdownFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.md"],
  { cwd: root, encoding: "utf8" },
).split(/\r?\n/).filter(Boolean).filter((file) => fs.existsSync(path.join(root, file)));

const failures = [];
for (const file of markdownFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const withoutFences = source.replace(/```[\s\S]*?```/g, "");
  for (const match of withoutFences.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const rawTarget = match[1].replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|tel:|#)/i.test(rawTarget)) continue;
    const fileTarget = rawTarget.split(/[?#]/, 1)[0];
    if (!fileTarget) continue;
    let decoded;
    try { decoded = decodeURIComponent(fileTarget); }
    catch { failures.push(`Invalid encoded Markdown link in ${file}: ${rawTarget}`); continue; }
    const absolute = path.resolve(path.dirname(path.join(root, file)), decoded);
    const relative = path.relative(root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      failures.push(`Markdown link escapes repository in ${file}: ${rawTarget}`);
      continue;
    }
    if (!fs.existsSync(absolute)) failures.push(`Broken Markdown link in ${file}: ${rawTarget}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Markdown links passed (${markdownFiles.length} files checked).`);
