import path from "node:path";

export const sourceRoots = new Set(["client", "deploy", "docs", "scripts", "server", "shared", ".github", ".cursor"]);
export const rootFiles = new Set([
  ".dockerignore", ".editorconfig", ".gitignore", ".node-version", ".npmrc", ".nvmrc",
  "AGENTS.md", "AI_CONTEXT.md", "BASE_STATUS.md", "README.md", "UPGRADE_REPORT.md", "VERIFICATION.md",
  "Dockerfile.api", "Dockerfile.web", "docker-compose.yml", "docker-compose.prod.yml", "package.json", "package-lock.json",
]);

export function normalizeArchivePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isAllowlistedSourcePath(value) {
  const file = normalizeArchivePath(value);
  if (rootFiles.has(file)) return true;
  const [root] = file.split("/");
  return sourceRoots.has(root);
}

export function prohibitedArchiveReason(value) {
  const file = normalizeArchivePath(value);
  const lower = file.toLowerCase();
  if (!file || file.startsWith("/") || /^[a-z]:\//i.test(file) || file.split("/").includes("..")) return "unsafe or absolute path";
  if (/(^|\/)\.git(?:\/|$)/i.test(file)) return "Git metadata";
  if (/(^|\/)node_modules(?:\/|$)/i.test(file)) return "dependency directory";
  if (/(^|\/)(dist|coverage|\.vite|\.cache|playwright-report|test-results)(?:\/|$)/i.test(file)) return "generated build/test output";
  if (/(^|\/)(\.agent-reports|\.private-data|private-data|release|backups|database-dumps)(?:\/|$)/i.test(file)) return "private or generated artifact directory";
  if (/(^|\/)\.env(?:\.|$)/i.test(file) && !/(^|\/)\.env(?:\.[^/]+)?\.example$/i.test(file) && !/(^|\/)\.env\.example$/i.test(file)) return "real environment file";
  if (/\.(xlsx?|xlsm|xlsb)$/i.test(lower)) return "private workbook";
  if (/\.(dump|bak|sql\.gz)$/i.test(lower) || /(^|\/)[^/]*(?:backup|dump)[^/]*\.sql$/i.test(lower)) return "database dump or backup";
  if (/\.(log|tmp)$/i.test(lower)) return "local log or temporary file";
  if (/(^|\/)[^/]*#u[0-9a-f]{4}[^/]*$/i.test(file)) return "malformed encoded filename";
  return null;
}

export function sensitiveTextReason(text) {
  const privateKeyMarker = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  if (text.includes(privateKeyMarker)) return "private key material";
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(text)) return "JWT-like token";
  if (/[A-Za-z]:\\Users\\[^\s"']+|\/(?:Users|home)\/[^/\s"']+/i.test(text)) return "absolute local user path";
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\b(JWT_SECRET|BOOTSTRAP_ADMIN_PASSWORD|DB_PASSWORD)\b\s*[:=]\s*["']?([^\s,"'}]+)/i);
    if (!match) continue;
    const value = match[2];
    if (/\$\{|process\.env|replace|change|example|sample|test|smoke|e2e|capture|ci-only|development|required|^$/i.test(value)) continue;
    if (value.length >= 12) return `likely literal ${match[1]}`;
  }
  return null;
}

export function rawPasswordPersistenceReason(file, text) {
  const normalized = normalizeArchivePath(file);
  if (!normalized.startsWith("client/src/")) return null;
  const patterns = [
    ["Web Storage", /\b(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\([\s\S]{0,300}?\bpassword\b/i],
    ["client-readable cookie", /\bdocument\s*\.\s*cookie\s*=[^\n]{0,300}\bpassword\b/i],
    ["IndexedDB", /\bindexedDB\b[\s\S]{0,500}\bpassword\b/i],
    ["client configuration", /\bimport\.meta\.env\.[A-Z0-9_]*PASSWORD\b/i],
    ["client log", /\bconsole\.(?:log|info|warn|error|debug)\s*\([^\n]{0,300}\bpassword\b/i],
  ];
  const match = patterns.find(([, pattern]) => pattern.test(text));
  return match ? `raw password may be persisted through ${match[0]}` : null;
}

export function assertRuleSelfTests() {
  const prohibited = [
    ".git/config", "server/.env", "client/node_modules/x", "client/dist/app.js",
    "docs/private.xlsx", "backups/live.sql", "database.dump", "C:/Users/person/file.txt",
    "docs/name#U1EA1.txt",
  ];
  for (const file of prohibited) if (!prohibitedArchiveReason(file)) throw new Error(`Package-rule self-test did not reject ${file}`);
  const sensitive = [
    "JWT_SECRET=an-actual-production-value-123", "BOOTSTRAP_ADMIN_PASSWORD: actual-password-value",
    "C:\\Users\\person\\secret.txt",
  ];
  for (const value of sensitive) if (!sensitiveTextReason(value)) throw new Error("Package-rule sensitive-content self-test failed");
  if (prohibitedArchiveReason("server/.env.example")) throw new Error("Package-rule self-test rejected an approved env example");
  if (sensitiveTextReason("JWT_SECRET=replace-with-random-secret")) throw new Error("Package-rule self-test rejected a safe placeholder");
  for (const source of [
    'localStorage.setItem("credential", password)',
    'sessionStorage.setItem("password", input.password)',
    'document.cookie = `password=${password}`',
    'indexedDB.open("saved-password")',
    'const configured = import.meta.env.VITE_LOGIN_PASSWORD',
    'console.log("password", password)',
  ]) if (!rawPasswordPersistenceReason("client/src/probe.ts", source)) throw new Error("Raw-password persistence self-test failed");
  if (rawPasswordPersistenceReason("client/src/probe.ts", 'fetch("/login", { body: JSON.stringify({ password }) })'))
    throw new Error("Raw-password persistence self-test rejected an in-flight login request");
}

export function archiveNames(packageJson) {
  const base = `teacher-class-hub-source-${packageJson.version}`;
  return { base, archive: `${base}.tar.gz`, checksum: `${base}.tar.gz.sha256` };
}

export const portableRelative = (root, file) => normalizeArchivePath(path.relative(root, file));
