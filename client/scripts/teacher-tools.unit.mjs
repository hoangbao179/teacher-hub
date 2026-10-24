/* global process */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("disabled legacy schedule suites exit before starting browsers or database setup", () => {
  for (const script of ["calendar-midnight.e2e.mjs", "calendar-mobile-ui.e2e.mjs", "schedule-operations.e2e.mjs"]) {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", script)], {
      cwd: root,
      env: { ...process.env, CHROME_PATH: "missing-browser-for-disabled-legacy-test", DB_HOST: "disabled-legacy.invalid" },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    assert.match(result.stdout, /^SKIP legacy /);
    assert.doesNotMatch(result.stdout, /VITE|Migration|migrat|bootstrap/i);
  }
});

test("tools screen replaces the legacy management entry points", () => {
  const app = read("src/App.tsx");
  const flags = read("src/config/featureAvailability.ts");
  const header = read("src/components/PublicHeader.tsx");
  const login = read("src/pages/LoginPage.tsx");

  assert.match(flags, /LEGACY_ADMIN_ENABLED: boolean = false/);
  assert.match(app, /path="\/admin\/tools" element=\{<TeacherToolsPage \/>\}/);
  assert.match(app, /location\.pathname !== "\/admin\/tools"/);
  assert.match(header, /to="\/tools" data-testid="header-tools"/);
  assert.match(app, /path="\/tools" element=\{<PublicToolsPage \/>\}/);
  assert(app.indexOf('path="/tools"') < app.indexOf('<Route element={<AdminAuthBoundary />}'), "Public Tools must be outside auth boundaries");
  assert.doesNotMatch(header, /data-testid="header-admin"/);
  assert.match(login, /: "\/admin\/tools"/);
});

test("public tools embeds guest PDF workspace without teacher login", () => {
  const page=read("src/pages/PublicToolsPage.tsx");
  const pdf=read("src/components/PublicPdfTool.tsx");
  assert.match(page,/PublicPdfTool/);
  assert.match(page,/component="main"/);
  assert.doesNotMatch(page,/useAuth|AuthProvider|\/admin\/login/);
  assert.match(pdf,/pdfApi\.session/);
  assert.match(pdf,/pdfApi\.create/);
  assert.match(pdf,/pdfApi\.download/);
  assert.match(pdf,/RESULT_UNCONFIRMED/);
  assert.doesNotMatch(pdf,/fetch\(/);
  assert.match(read("scripts/prerender-home.mjs"),/"tools", "index.html"/);
});

test("tools page is mobile-first, accessible and does not advertise a fake download action", () => {
  const page = read("src/pages/TeacherToolsPage.tsx");
  assert.match(page, /data-testid="teacher-tools-page"/);
  assert.match(page, /minHeight: "100svh"/);
  assert.match(page, /safe-area-inset-bottom/);
  assert.match(page, /component="h1"/);
  assert.match(page, /Tải tài liệu từ liên kết/);
  assert.match(page, /Tính năng này đang được chuẩn bị/);
  assert.match(page, /void logout\(\)/);
  assert.doesNotMatch(page, /<Button[^>]*>Tải (file|ngay)/);
});


test("PDF interface uses shared contracts and keeps actions behind capabilities", () => {
  const page = read("src/components/PublicPdfTool.tsx");
  const client = read("src/api/pdf.ts");
  assert.match(page, /caps\?\.submitEnabled===true/);
  assert.match(page, /RESULT_UNCONFIRMED/);
  assert.match(page, /pdfApi\.download/);
  assert.match(client, /@teacher\/shared/);
  assert.match(client, /Idempotency-Key/);
  assert.doesNotMatch(page, /fetch\(/);
});
