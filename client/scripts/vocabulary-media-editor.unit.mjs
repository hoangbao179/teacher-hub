import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startSingleWorkerBatch } from "../src/features/vocabulary/bulkImageSuggestionScheduler.ts";
import { buildVocabularyImageStrategy } from "../src/features/vocabulary/vocabularyImageStrategy.ts";
import {
  appendUniqueVocabularyImages,
  VOCABULARY_IMAGE_LIMIT,
  VOCABULARY_IMAGE_PAGE_SIZE,
} from "../src/features/vocabulary/vocabularyImagePagination.ts";

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
const schedulerSource = fs.readFileSync(path.join(
  root,
  "src/features/vocabulary/bulkImageSuggestionScheduler.ts",
), "utf8");

test("picker has keyboard search, provider-disabled, retry and responsive states", () => {
  assert.match(picker, /component="form"/);
  assert.match(picker, /type="submit"/);
  assert.match(picker, /getVocabularyMediaStatus/);
  assert.match(picker, /Thử lại/);
  assert.match(picker, /fullScreen=\{fullScreen\}/);
  assert.match(picker, /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("bulk suggestions use generation batches, abort signals and one worker", () => {
  assert.match(bulk, /getVocabularyMediaStatus/);
  assert.match(bulk, /startSingleWorkerBatch/);
  assert.match(schedulerSource, /AbortController/);
  assert.match(schedulerSource, /runId/);
  assert.match(bulk, /delayMs: 800/);
  assert.match(bulk, /VOCABULARY_IMAGE_PAGE_SIZE/);
  assert.match(searchStrategy, /page: input\.page/);
  assert.match(bulk, /Xem thêm 8 ảnh/);
  assert.match(picker, /Xem thêm 8 ảnh/);
  assert.match(bulk, /"Chọn ảnh"/);
  assert.match(picker, />Chọn ảnh</);
  assert.doesNotMatch(bulk, /onClick=\{\(\) => void select\(index, result\)\}/);
  assert.doesNotMatch(picker, /onClick=\{\(\) => void choose\(item\)\}/);
  assert.match(bulk, /Tìm lại/);
  assert.match(bulk, /ILLUSTRATION/);
  assert.match(bulk, /PHOTO/);
  assert.match(bulk, /overflowX: "hidden"/);
  assert.match(bulk, /Bỏ qua/);
  assert.doesNotMatch(bulk, /cancelled\.current/);
  assert.doesNotMatch(bulk, /onSelect\(index, result\)/);
});

test("image strategy keeps local colors and numbers off Pixabay and builds focused queries", () => {
  assert.deepEqual(buildVocabularyImageStrategy("red", ["red color"]), {
    category: "LOCAL", query: "red", publicAsset: "/learning/colors/red.svg",
  });
  assert.deepEqual(buildVocabularyImageStrategy("seven", ["seven number"]), {
    category: "LOCAL", query: "seven", publicAsset: "/learning/numbers/7.svg",
  });
  assert.equal(buildVocabularyImageStrategy("apple").query, "apple cartoon isolated");
  assert.equal(buildVocabularyImageStrategy("run", ["run actions"]).query, "child run cartoon illustration");
  assert.deepEqual(buildVocabularyImageStrategy("bird", ["bird pets"]), { category: "ANIMAL", query: "bird cartoon isolated" });
  assert.doesNotMatch(searchStrategy, /mediaType: "PHOTO"/);
});

test("StrictMode cleanup prevents duplicate initial batch requests", async () => {
  const calls = [];
  const options = {
    items: Array.from({ length: 10 }, (_, index) => index),
    runItem: async (item) => { calls.push(item); },
    rateLimitSeconds: () => undefined,
    onCooldown: () => undefined,
    onError: (error) => { throw error; },
    delayMs: 0,
    sleep: async () => undefined,
  };
  const strictModeFirstRun = startSingleWorkerBatch(options);
  strictModeFirstRun.cancel();
  const activeRun = startSingleWorkerBatch(options);
  await activeRun.done;
  assert.deepEqual(calls, Array.from({ length: 10 }, (_, index) => index));
});

test("provider 429 starts cooldown without retrying and preserves completed results", async () => {
  const calls = [];
  const completed = new Set();
  const cooldown = [];
  const errors = [];
  const run = startSingleWorkerBatch({
    items: ["cat", "dog", "bird"],
    runItem: async (item) => {
      calls.push(item);
      if (item === "dog") throw { rateLimited: true };
      completed.add(item);
    },
    rateLimitSeconds: (error) => error?.rateLimited ? 2 : undefined,
    onCooldown: (seconds) => cooldown.push(seconds),
    onError: (error) => { errors.push(error); },
    delayMs: 0,
    sleep: async () => undefined,
  });
  await run.done;
  assert.deepEqual(calls, ["cat", "dog"]);
  assert.deepEqual([...completed], ["cat"]);
  assert.deepEqual(cooldown, [2]);
  assert.equal(errors.length, 1);
});

test("image pages use eight results and deduplicate up to 24 provider assets", () => {
  const image = (providerAssetId) => ({ providerAssetId });
  const first = Array.from({ length: 8 }, (_, index) => image(String(index + 1)));
  const second = [image("8"), ...Array.from({ length: 8 }, (_, index) => image(String(index + 9)))];
  const third = Array.from({ length: 10 }, (_, index) => image(String(index + 17)));
  assert.equal(VOCABULARY_IMAGE_PAGE_SIZE, 8);
  assert.equal(VOCABULARY_IMAGE_LIMIT, 24);
  const combined = appendUniqueVocabularyImages(appendUniqueVocabularyImages(first, second), third);
  assert.equal(combined.length, 24);
  assert.equal(new Set(combined.map((item) => item.providerAssetId)).size, 24);
});

test("client imports only provider, asset id and approved alt text", () => {
  assert.match(api, /ImportVocabularyMediaRequest/);
  assert.match(api, /\/api\/vocabulary\/media\/import/);
  assert.doesNotMatch(api, /downloadUrl|PIXABAY_API_KEY/);
});
