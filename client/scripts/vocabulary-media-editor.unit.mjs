import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startSingleWorkerBatch } from "../src/features/vocabulary/bulkImageSuggestionScheduler.ts";
import { buildVocabularyImageStrategy } from "../src/features/vocabulary/vocabularyImageStrategy.ts";
import { executeVocabularyImageSearch } from "../src/features/vocabulary/vocabularyImageSearchPolicy.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const bulk = read("src/features/vocabulary/components/VocabularyBulkImageSuggestions.tsx");
const picker = read("src/features/vocabulary/components/VocabularyImagePicker.tsx");
const api = read("src/api/vocabularyMedia.ts");
const routes = read("../server/src/routes/index.ts");
const nginx = read("../deploy/nginx.conf");

test("bulk modal keeps draft/apply states, batches five and reports found, selected, applied and errors separately", () => {
  for (const status of ["SEARCH_PENDING", "SEARCHING", "FOUND", "SELECTED", "APPLYING", "APPLIED", "EMPTY", "ERROR", "SKIPPED"])
    assert.match(bulk, new RegExp(`"${status}"`));
  assert.match(bulk, /const BATCH_SIZE = 5/);
  assert.match(bulk, /remote\.slice\(cursor\.current, cursor\.current \+ BATCH_SIZE\)/);
  assert.match(bulk, /Tìm thấy: \{found\}\/\{candidates\.length\}.*Đã chọn: \{selected\}.*Đã áp dụng: \{applied\}.*Lỗi: \{errors\}/s);
  assert.match(bulk, /state\.status === "EMPTY"/);
  assert.match(bulk, /state\.status === "SEARCH_PENDING"/);
  assert.match(bulk, /Áp dụng \$\{selectedCandidates\.length\} ảnh/);
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

test("provider outage stops the batch immediately without consuming later work", async () => {
  const calls = []; const errors = [];
  const run = startSingleWorkerBatch({
    items: ["cat", "dog", "bird"], delayMs: 0, sleep: async () => undefined,
    runItem: async (item) => { calls.push(item); throw { unavailable: true }; },
    rateLimitSeconds: () => undefined,
    stopOnError: (error) => error?.unavailable === true,
    onCooldown: () => undefined, onError: (error, item) => errors.push([error, item]),
  });
  await run.done;
  assert.deepEqual(calls, ["cat"]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][1], "cat");
});

test("closing pickers aborts active requests and stale generations cannot overwrite state", () => {
  assert.match(bulk, /activeBatch\.current\?\.cancel\(\)/);
  assert.match(picker, /activeRequest\.current\?\.abort\(\)/);
  assert.match(picker, /generation !== searchGeneration\.current/);
});

test("one word invokes at most one fallback and does not amplify non-empty results", async () => {
  const plane = buildVocabularyImageStrategy("plane", ["plane transport"]);
  assert.deepEqual(plane.queries.slice(0, 3), ["plane", "plane illustration", "plane cartoon"]);
  assert.doesNotMatch(plane.queries.join(" "), /isolated|transport/);
  assert.equal(buildVocabularyImageStrategy("happy").category, "EMOTION");
  assert.equal(buildVocabularyImageStrategy("apple").category, "FOOD");
  const calls = [];
  const response = (items) => ({ provider: "PIXABAY", safeSearch: true, cacheExpiresAt: new Date().toISOString(), page: 1, pageSize: 12, total: items.length, items });
  await executeVocabularyImageSearch({ query: plane.query, fallbackQuery: plane.queries[1], allowFallback: true,
    search: async (query) => { calls.push(query); return response([{ providerAssetId: "1" }]); } });
  assert.deepEqual(calls, ["plane"]);
  calls.length = 0;
  await executeVocabularyImageSearch({ query: plane.query, fallbackQuery: plane.queries[1], allowFallback: true,
    search: async (query) => { calls.push(query); return response([]); } });
  assert.deepEqual(calls, ["plane", "plane illustration"]);
  calls.length = 0;
  await executeVocabularyImageSearch({ query: "airliner", fallbackQuery: plane.queries[1], allowFallback: false,
    search: async (query) => { calls.push(query); return response([]); } });
  assert.deepEqual(calls, ["airliner"]);
});

test("media type reset clears all remote results and waits for an explicit new batch", () => {
  assert.match(bulk, /setStates\(initialStates\(\)\)/);
  assert.match(bulk, /setAwaitingStart\(true\)/);
  const handler = bulk.slice(bulk.indexOf("const changeMediaType"), bulk.indexOf("const retryCandidate"));
  assert.doesNotMatch(handler, /startNextBatch\(/);
  assert.match(bulk, /Bắt đầu tìm ảnh thật/);
});

test("Tìm lại owns one candidate controller and disables fallback", () => {
  const retry = bulk.slice(bulk.indexOf("const retryCandidate"), bulk.indexOf("const selectFile"));
  assert.match(retry, /candidateLocks\.current\.has\(candidate\.index\)/);
  assert.match(retry, /new AbortController\(\)/);
  assert.match(retry, /allowFallback: false/);
  assert.doesNotMatch(retry, /startNextBatch|cursor\.current/);
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
  assert.match(bulk, /importedByAsset\.get\(dedupeKey\)/);
  assert.match(picker, /importLock\.current/);
  assert.match(api, /FormData/);
  assert.match(api, /\/api\/vocabulary\/media\/upload/);
});

test("rate-limit and provider-unavailable codes have distinct client messages and no automatic retry", () => {
  const errors = read("src/features/vocabulary/vocabularyMediaErrors.ts");
  for (const code of ["VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED", "IMAGE_IMPORT_SOURCE_RATE_LIMITED", "VOCABULARY_IMPORT_RATE_LIMITED", "IMAGE_PROVIDER_UNAVAILABLE"])
    assert.match(errors, new RegExp(code));
  assert.match(bulk, /stopOnError: providerUnavailable/);
  assert.doesNotMatch(bulk, /setTimeout\([^)]*startNextBatch/);
});

test("bulk cancel discards its draft while apply commits callbacks only after successful import", () => {
  assert.doesNotMatch(bulk.slice(bulk.indexOf("const selectFile"), bulk.indexOf("const applySelections")), /onSelect(Local)?\(/);
  const apply = bulk.slice(bulk.indexOf("const applySelections"), bulk.indexOf("const close"));
  assert.match(apply, /onSelectLocal\(candidate\.index/);
  assert.match(apply, /onSelect\(candidate\.index, await request\)/);
  assert.match(apply, /status: "APPLIED"/);
  assert.match(apply, /if \(failures === 0\) onClose\(\)/);
  const close = bulk.slice(bulk.indexOf("const close"), bulk.indexOf("const searched"));
  assert.doesNotMatch(close, /onSelect(Local)?\(/);
  assert.match(bulk, />Hủy<\/Button>/);
});

test("public immutable media is not protected by the 60-per-minute business limiter", () => {
  const publicRoute = routes.slice(routes.indexOf('"/api/public/vocabulary-media/:mediaId"'), routes.indexOf('"/api/public/learning-assignments'));
  assert.doesNotMatch(publicRoute, /RateLimit|60/);
});

test("admin CSP permits only the required upload blob and configured preview hosts", () => {
  const adminPolicies = nginx.match(/img-src[^;]+/g)?.filter((value) => value.includes("blob:")) ?? [];
  assert.equal(adminPolicies.length, 2);
  adminPolicies.forEach((policy) => {
    assert.match(policy, /blob:/);
    assert.match(policy, /https:\/\/static\.arasaac\.org/);
    assert.match(policy, /https:\/\/cdn\.pixabay\.com/);
    assert.doesNotMatch(policy, /https:\/\/\*/);
  });
});

test("ARASAAC is the illustration source while unavailable filters and stale requests are controlled", () => {
  assert.match(api, /provider: VocabularyImageProvider \| null/);
  assert.match(api, /providers: Array/);
  assert.match(picker, /provider\.provider === "PIXABAY" && provider\.enabled/);
  assert.match(picker, /\{photoEnabled && <MenuItem value="PHOTO"/);
  assert.match(picker, /item\.provider === "ARASAAC" \? "contain" : "cover"/);
  assert.match(picker, /Sergio Palao \/ ARASAAC/);
  assert.match(bulk, /searchCache\.current\.get\(key\)/);
  assert.match(bulk, /candidateControllers\.current\.forEach\(\(controller\) => controller\.abort\(\)\)/);
  assert.match(bulk, /status: candidate\.strategy\.publicAsset \? "SELECTED" : "SEARCH_PENDING"/);
  assert.doesNotMatch(bulk, /Pixabay đang tắt/);
  assert.doesNotMatch(picker, /không gửi yêu cầu tới Pixabay/);
});
