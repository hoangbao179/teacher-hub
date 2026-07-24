import assert from "node:assert/strict";
import test from "node:test";
import { learningLevels, learningUnits } from "../src/features/learning/content/vocabularyCatalog.ts";
import { validateLearningCatalog } from "../src/features/learning/content/validateCatalog.ts";
import { LEARNING_PROGRESS_STORAGE_KEY, readLearningProgress, rememberLearningLocation, resetLearningProgress, writeLearningProgress } from "../src/features/learning/storage/learningProgressStorage.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("catalog seed is valid and covers two available levels", () => {
  assert.deepEqual(validateLearningCatalog(learningLevels, learningUnits), []);
  assert.equal(learningLevels.length, 10);
  assert.deepEqual(learningLevels.filter((level) => level.available).map((level) => level.slug), ["mam-non", "lop-3"]);
  for (const slug of ["mam-non", "lop-3"]) {
    const units = learningUnits.filter((unit) => unit.levelSlug === slug);
    assert.ok(units.length >= 2);
    assert.ok(units.every((unit) => unit.vocabulary.length >= 10));
  }
});

test("catalog validator rejects duplicate and broken references/content", () => {
  const duplicateLevel = { ...learningLevels[0] };
  const brokenUnit = {
    ...learningUnits[0], id: learningUnits[1].id, slug: learningUnits[1].slug, levelSlug: "lop-99",
    vocabulary: [{ ...learningUnits[0].vocabulary[0], id: learningUnits[1].vocabulary[0].id, word: "", vietnameseMeaning: "", speechText: undefined, image: "../bad.png" }],
  };
  const errors = validateLearningCatalog([...learningLevels, duplicateLevel], [...learningUnits, brokenUnit]);
  for (const marker of ["Level slug trùng", "Unit id trùng", "Unit slug trùng", "level không tồn tại", "thiếu từ hoặc nghĩa", "asset path không hợp lệ"])
    assert.ok(errors.some((error) => error.includes(marker)), marker);
});

test("progress storage reads, writes and resets only its versioned key", () => {
  const storage = new MemoryStorage();
  storage.setItem("website:other", "keep");
  assert.equal(rememberLearningLocation("lop-3", "ngay-o-truong", storage).lastUnitSlug, "ngay-o-truong");
  assert.equal(readLearningProgress(storage).lastLevelSlug, "lop-3");
  assert.equal(resetLearningProgress(storage), true);
  assert.equal(storage.getItem(LEARNING_PROGRESS_STORAGE_KEY), null);
  assert.equal(storage.getItem("website:other"), "keep");
});

test("progress storage safely handles corrupt schema and blocked writes", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEARNING_PROGRESS_STORAGE_KEY, "{broken");
  assert.deepEqual(readLearningProgress(storage), { schemaVersion: 1, units: {} });
  storage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, units: {} }));
  assert.deepEqual(readLearningProgress(storage), { schemaVersion: 1, units: {} });
  const blocked = { getItem: () => null, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.equal(writeLearningProgress({ schemaVersion: 1, units: {} }, blocked), false);
  assert.equal(resetLearningProgress(blocked), false);
});
