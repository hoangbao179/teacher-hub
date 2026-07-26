import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("src/App.tsx");
const api = read("src/api/assignments.ts");
const page = read("src/features/assignments/pages/AssignmentResultsPage.tsx");

test("teacher result route is protected and API lists do not request raw answers", () => {
  const resultRoute = app.indexOf('path="/admin/assignments/:id/results"');
  const protectedBoundary = app.indexOf("<Route element={<Protected />}>");
  assert.ok(resultRoute > protectedBoundary);
  assert.match(api, /results\/summary/);
  assert.match(api, /results\/recipients/);
  assert.match(api, /results\/vocabulary/);
  assert.doesNotMatch(api, /submittedAnswer|sessionToken/);
});

test("responsive result UI names mastery, guest separation and draft-only review", () => {
  assert.match(page, /🟢 Đã nhớ/);
  assert.match(page, /🟡 Đang học/);
  assert.match(page, /🔴 Cần ôn/);
  assert.match(page, /không phải kết quả học sinh/);
  assert.match(page, /không tự giao/);
  assert.match(page, /minHeight: 44/);
  assert.match(page, /xs: "column"/);
  assert.match(page, /aria-label="Chọn cách xem kết quả"/);
});
