import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const picker = fs.readFileSync(path.join(
  root,
  "src/features/vocabulary/components/VocabularyImagePicker.tsx",
), "utf8");
const bulk = fs.readFileSync(path.join(
  root,
  "src/features/vocabulary/components/VocabularyBulkImageSuggestions.tsx",
), "utf8");
const api = fs.readFileSync(path.join(root, "src/api/vocabularyMedia.ts"), "utf8");

test("picker has keyboard search, provider-disabled, retry and responsive states", () => {
  assert.match(picker, /component="form"/);
  assert.match(picker, /type="submit"/);
  assert.match(picker, /getVocabularyMediaStatus/);
  assert.match(picker, /Thử lại/);
  assert.match(picker, /fullScreen=\{fullScreen\}/);
  assert.match(picker, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("bulk suggestions are review-first, cancellable and capped at concurrency three", () => {
  assert.match(bulk, /Math\.min\(3, candidates\.length\)/);
  assert.match(bulk, /slice\(0, 3\)/);
  assert.match(bulk, /Bỏ qua/);
  assert.match(bulk, /cancelled\.current = true/);
  assert.doesNotMatch(bulk, /onSelect\(index, result\)/);
});

test("client imports only provider, asset id and approved alt text", () => {
  assert.match(api, /ImportVocabularyMediaRequest/);
  assert.match(api, /\/api\/vocabulary\/media\/import/);
  assert.doesNotMatch(api, /downloadUrl|PIXABAY_API_KEY/);
});
