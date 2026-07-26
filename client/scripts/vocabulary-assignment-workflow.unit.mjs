import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("src/App.tsx");
const api = read("src/api/assignments.ts");
const wizard = read("src/features/assignments/pages/AssignmentWizardPage.tsx");
const detail = read("src/features/assignments/pages/AssignmentDetailPage.tsx");
const layout = read("src/layout/AdminLayout.tsx");

test("assignment workflow exposes list, create, edit and detail routes", () => {
  assert.match(app, /\/admin\/assignments/);
  assert.match(app, /\/admin\/assignments\/new/);
  assert.match(app, /\/admin\/assignments\/:id\/edit/);
  assert.match(layout, /Bài tập từ vựng/);
});

test("assignment client calls only authenticated V20C teacher routes", () => {
  assert.match(api, /\/api\/vocabulary\/assignments/);
  assert.match(api, /\/publish/);
  assert.match(api, /\/preview/);
  assert.match(api, /regenerate-access/);
  assert.match(api, /revoke-access/);
  assert.doesNotMatch(api, /\/api\/learning-assignments/);
});

test("wizard saves drafts before preview and confirms immutable publish", () => {
  assert.match(wizard, /const steps = \[/);
  assert.match(wizard, /await save\(\)/);
  assert.match(wizard, /previewAssignment/);
  assert.match(wizard, /Bản chụp từ vựng và danh sách người nhận sẽ được cố định/);
  assert.match(wizard, /disabled=\{saving\}/);
});

test("detail renders QR without raw HTML and supports post-publish controls", () => {
  assert.match(detail, /data:image\/svg\+xml/);
  assert.doesNotMatch(detail, /dangerouslySetInnerHTML/);
  assert.match(detail, /regenerateAssignmentAccess/);
  assert.match(detail, /revokeAssignmentAccess/);
  assert.match(detail, /closeAssignment/);
  assert.match(detail, /milestone tiếp theo/);
});
