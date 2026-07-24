import assert from "node:assert/strict";
import test from "node:test";
import { learningLevels, learningUnits, unitBySlugs } from "../src/features/learning/content/vocabularyCatalog.ts";
import { validateLearningCatalog } from "../src/features/learning/content/validateCatalog.ts";
import { LEARNING_PROGRESS_STORAGE_KEY, markVocabularyItem, readLearningProgress, rememberLearningLocation, resetLearningProgress, resetUnitProgress, unitProgressFor, writeLearningProgress } from "../src/features/learning/storage/learningProgressStorage.ts";
import { audioStrategy, playPronunciation, stopPronunciation } from "../src/features/learning/audio/pronunciation.ts";
import { createListenQuestion, seededRandom } from "../src/features/learning/listen/listenQuestions.ts";

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

test("content mapping only resolves a Unit inside its published level", () => {
  assert.equal(unitBySlugs("mam-non", "con-vat-dang-yeu")?.id, "preschool-happy-animals");
  assert.equal(unitBySlugs("lop-3", "con-vat-dang-yeu"), undefined);
  assert.equal(unitBySlugs("mam-non", "khong-ton-tai"), undefined);
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

test("V18A Unit progress migrates without losing learned items", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, lastLevelSlug: "mam-non", units: { "con-vat-dang-yeu": { learnedItemIds: ["pa-1", "pa-2"], totalItems: 10, completed: false } } }));
  const progress = readLearningProgress(storage);
  assert.deepEqual(progress.units["con-vat-dang-yeu"].rememberedItemIds, ["pa-1", "pa-2"]);
  assert.deepEqual(progress.units["con-vat-dang-yeu"].viewedItemIds, ["pa-1", "pa-2"]);
  assert.equal(progress.units["con-vat-dang-yeu"].contentVersion, 1);
});

test("remembered and review states are mutually exclusive and Unit reset is scoped", () => {
  const storage = new MemoryStorage();
  const unit = learningUnits[0];
  markVocabularyItem(unit, "pa-1", "REMEMBERED", storage);
  markVocabularyItem(unit, "pa-1", "REVIEW", storage);
  const unitProgress = unitProgressFor(readLearningProgress(storage), unit);
  assert.deepEqual(unitProgress.rememberedItemIds, []);
  assert.deepEqual(unitProgress.reviewItemIds, ["pa-1"]);
  storage.setItem("website:other", "keep");
  resetUnitProgress(unit.slug, storage);
  assert.equal(readLearningProgress(storage).units[unit.slug], undefined);
  assert.equal(storage.getItem("website:other"), "keep");
});

test("listen distractors are unique, deterministic and exclude duplicate answers", () => {
  const vocabulary = learningUnits[0].vocabulary;
  const first = createListenQuestion(vocabulary, 2, seededRandom(42));
  const second = createListenQuestion(vocabulary, 2, seededRandom(42));
  assert.deepEqual(first.options, second.options);
  assert.equal(first.options.length, 4);
  assert.equal(new Set(first.options).size, 4);
  assert.ok(first.options.includes(first.correctMeaning));
});

test("audio selects asset, speech fallback and unavailable strategy without overlap", async () => {
  const item = learningUnits[0].vocabulary[0];
  const events = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  class FakeAudio { play() {} pause() {} }
  const speech = { cancel: () => events.push("cancel"), speak: (utterance) => events.push(`speak:${utterance.text}`) };
  assert.equal(audioStrategy({ ...item, audio: "/audio/cat.mp3" }, { Audio: FakeAudio, speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), "ASSET");
  assert.equal(audioStrategy(item, { speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), "SPEECH");
  assert.equal(await playPronunciation(item, { speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), true);
  assert.deepEqual(events, ["cancel", "speak:cat"]);
  assert.equal(audioStrategy({ ...item, speechText: undefined }, {}), "UNAVAILABLE");
  stopPronunciation();
  assert.deepEqual(events, ["cancel", "speak:cat", "cancel"]);
});
