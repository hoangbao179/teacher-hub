import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { hasPlayableImage } from "@teacher/shared";

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

test("vocabulary source tabs keep scoped errors, empty state and searchable grouped Units", () => {
  assert.match(wizard, /suggestionError/);
  assert.match(wizard, /unitError/);
  assert.match(wizard, /assignmentSaveError/);
  assert.match(wizard, /Chủ đề này chưa có từ phù hợp/);
  assert.match(wizard, /<Autocomplete/);
  assert.match(wizard, /groupBy=/);
  assert.match(wizard, /maxHeight: 340/);
  assert.match(wizard, /levelSlugsByAgeBand\[ageBand\]/);
  assert.match(wizard, /Có thể gợi ý ảnh/);
});

test("playable image means an attached illustration, not only searchable image support", () => {
  assert.equal(hasPlayableImage({ illustration: { kind: "NONE" }, supportsImageGame: true }), false);
  assert.equal(hasPlayableImage({ illustration: { kind: "EMOJI", value: "🐱" }, supportsImageGame: false }), true);
  assert.equal(hasPlayableImage({ illustration: { kind: "PUBLIC_ASSET", value: "/learning/cat.svg" } }), true);
  assert.equal(hasPlayableImage({ illustration: { kind: "STORED_MEDIA", mediaId: 1 } }), true);
});

test("detail renders QR without raw HTML and supports post-publish controls", () => {
  assert.match(detail, /data:image\/svg\+xml/);
  assert.doesNotMatch(detail, /dangerouslySetInnerHTML/);
  assert.match(detail, /regenerateAssignmentAccess/);
  assert.match(detail, /revokeAssignmentAccess/);
  assert.match(detail, /closeAssignment/);
  assert.match(detail, /milestone tiếp theo/);
});
