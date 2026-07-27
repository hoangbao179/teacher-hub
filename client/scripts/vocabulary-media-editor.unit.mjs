import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startSingleWorkerBatch } from "../src/features/vocabulary/bulkImageSuggestionScheduler.ts";
import { buildVocabularyImageStrategy } from "../src/features/vocabulary/vocabularyImageStrategy.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const bulk = read("src/features/vocabulary/components/VocabularyBulkImageSuggestions.tsx");
const picker = read("src/features/vocabulary/components/VocabularyImagePicker.tsx");
const api = read("src/api/vocabularyMedia.ts");
const search = read("src/features/vocabulary/vocabularyImageSearch.ts");
const routes = read("../server/src/routes/index.ts");

test("bulk modal keeps explicit item states, batches eight and does not count pending as completed", () => {
  assert.match(bulk, /"PENDING" \| "SEARCHING" \| "FOUND" \| "EMPTY" \| "RATE_LIMITED" \| "ERROR" \| "SKIPPED"/);
  assert.match(bulk, /const BATCH_SIZE = 8/);
  assert.match(bulk, /remote\.slice\(cursor\.current, cursor\.current \+ BATCH_SIZE\)/);
  assert.match(bulk, /\["FOUND", "EMPTY", "ERROR", "SKIPPED"\]\.includes/);
  assert.match(bulk, /state\.status === "EMPTY"/);
  assert.match(bulk, /state\.status === "PENDING"/);
  assert.match(bulk, /Tiếp tục tìm các từ còn lại/);
});

test("429 stops at the current cursor and leaves later work pending", async () => {
  const calls = []; const completed = []; const cooldown = [];
  const run = startSingleWorkerBatch({
    items: ["cat", "dog", "bird"], delayMs: 0, sleep: async () => undefined,
    runItem: async (item) => { calls.push(item); if (item === "dog") throw { limited: true }; completed.push(item); },
    rateLimitSeconds: (error) => error?.limited ? 2 : undefined,
    onCooldown: (seconds) => cooldown.push(seconds), onError: () => undefined,
  });
  await run.done;
  assert.deepEqual(calls, ["cat", "dog"]);
  assert.deepEqual(completed, ["cat"]);
  assert.deepEqual(cooldown, [2]);
});

test("closing pickers aborts active requests and stale generations cannot overwrite state", () => {
  assert.match(bulk, /activeBatch\.current\?\.cancel\(\)/);
  assert.match(picker, /activeRequest\.current\?\.abort\(\)/);
  assert.match(picker, /generation !== searchGeneration\.current/);
});

test("query fallbacks are clean and executed sequentially", () => {
  const plane = buildVocabularyImageStrategy("plane", ["plane transport"]);
  assert.deepEqual(plane.queries.slice(0, 3), ["plane", "plane illustration", "plane cartoon"]);
  assert.doesNotMatch(plane.queries.join(" "), /isolated|transport/);
  assert.equal(buildVocabularyImageStrategy("happy").category, "EMOTION");
  assert.equal(buildVocabularyImageStrategy("apple").category, "FOOD");
  assert.match(search, /for \(const query of fallbacks\)/);
  assert.match(search, /await searchVocabularyMedia/);
  assert.match(search, /if \(combined\.items\.length >= input\.pageSize\) break/);
});

test("local manifest is preferred and upload uses preview, exact MIME accept and a synchronous lock", () => {
  assert.equal(buildVocabularyImageStrategy("red").publicAsset, "/learning/colors/red.svg");
  assert.equal(buildVocabularyImageStrategy("seven").publicAsset, "/learning/numbers/7.svg");
  for (const source of [picker, bulk]) {
    assert.match(source, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.match(source, /URL\.createObjectURL/);
  }
  assert.match(picker, /uploadLock\.current/);
  assert.match(bulk, /uploadLocks\.current/);
  assert.match(api, /FormData/);
  assert.match(api, /\/api\/vocabulary\/media\/upload/);
});

test("public immutable media is not protected by the 60-per-minute business limiter", () => {
  const publicRoute = routes.slice(routes.indexOf('"/api/public/vocabulary-media/:mediaId"'), routes.indexOf('"/api/public/learning-assignments'));
  assert.doesNotMatch(publicRoute, /RateLimit|60/);
});
