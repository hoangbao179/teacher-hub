import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildVocabularyImageStrategy } from "../src/features/vocabulary/vocabularyImageStrategy.ts";

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
const searchStrategy = fs.readFileSync(path.join(
  root,
  "src/features/vocabulary/vocabularyImageSearch.ts",
), "utf8");

test("picker has keyboard search, provider-disabled, retry and responsive states", () => {
  assert.match(picker, /component="form"/);
  assert.match(picker, /type="submit"/);
  assert.match(picker, /getVocabularyMediaStatus/);
  assert.match(picker, /Thử lại/);
  assert.match(picker, /fullScreen=\{fullScreen\}/);
  assert.match(picker, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("bulk suggestions check provider status, are cancellable and capped at concurrency two", () => {
  assert.match(bulk, /getVocabularyMediaStatus/);
  assert.match(bulk, /Math\.min\(2, remoteCandidates\.length\)/);
  assert.match(bulk, /slice\(0, 6\)/);
  assert.match(bulk, /Tìm lại/);
  assert.match(bulk, /ILLUSTRATION/);
  assert.match(bulk, /PHOTO/);
  assert.match(bulk, /overflowX: "hidden"/);
  assert.match(bulk, /Bỏ qua/);
  assert.match(bulk, /cancelled\.current = true/);
  assert.doesNotMatch(bulk, /onSelect\(index, result\)/);
});

test("image strategy keeps local colors and numbers off Pixabay and builds focused queries", () => {
  assert.deepEqual(buildVocabularyImageStrategy("red", ["red color"]), {
    category: "LOCAL", query: "red", publicAsset: "/learning/colors/red.svg",
  });
  assert.deepEqual(buildVocabularyImageStrategy("seven", ["seven number"]), {
    category: "LOCAL", query: "seven", publicAsset: "/learning/numbers/7.svg",
  });
  assert.equal(buildVocabularyImageStrategy("apple").query, "apple isolated cartoon illustration white background");
  assert.equal(buildVocabularyImageStrategy("run", ["run actions"]).query, "child run cartoon illustration");
  assert.equal(buildVocabularyImageStrategy("bat", ["bat animal"]).query, "bat animal isolated cartoon illustration white background");
  assert.match(searchStrategy, /category !== "NOUN"/);
  assert.match(searchStrategy, /primary\.items\.length >= 3/);
  assert.match(searchStrategy, /mediaType: "PHOTO"/);
});

test("client imports only provider, asset id and approved alt text", () => {
  assert.match(api, /ImportVocabularyMediaRequest/);
  assert.match(api, /\/api\/vocabulary\/media\/import/);
  assert.doesNotMatch(api, /downloadUrl|PIXABAY_API_KEY/);
});
