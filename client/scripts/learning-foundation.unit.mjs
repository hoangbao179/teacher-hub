import assert from "node:assert/strict";
import test from "node:test";
import { learningLevels, learningUnits, unitBySlugs } from "../src/features/learning/content/vocabularyCatalog.ts";
import { validateLearningCatalog } from "../src/features/learning/content/validateCatalog.ts";
import { LEARNING_PROGRESS_STORAGE_KEY, MAX_RECENT_QUIZ_ATTEMPTS, completeQuiz, markReviewedAsRemembered, markVocabularyItem, readLearningProgress, recordQuizAnswer, rememberLearningLocation, resetLearningProgress, resetUnitProgress, startOrResumeQuiz, unitProgressFor, writeLearningProgress } from "../src/features/learning/storage/learningProgressStorage.ts";
import { audioStrategy, playPronunciation, stopPronunciation } from "../src/features/learning/audio/pronunciation.ts";
import { LEARNING_SETTINGS_STORAGE_KEY, getPronunciationRate, readLearningSettings, writeLearningSettings } from "../src/features/learning/storage/learningSettingsStorage.ts";
import { createListenQuestion, seededRandom } from "../src/features/learning/listen/listenQuestions.ts";
import { createQuizQuestions, quizItemOrder, scoreQuiz, seededQuizRandom } from "../src/features/learning/quiz/quizQuestions.ts";
import { learningRouteMetadata } from "../src/features/learning/seo/learningMetadata.ts";
import { generateProductionSitemapXml, productionSitemapPathnames } from "../src/features/learning/seo/learningSitemap.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("catalog seed is valid and covers preschool plus grades 1-9", () => {
  assert.deepEqual(validateLearningCatalog(learningLevels, learningUnits), []);
  assert.equal(learningLevels.length, 10);
  assert.deepEqual(learningLevels.filter((level) => level.available).map((level) => level.slug), ["mam-non", "lop-1", "lop-2", "lop-3", "lop-4", "lop-5", "lop-6", "lop-7", "lop-8", "lop-9"]);
  assert.deepEqual(Object.fromEntries(learningLevels.map((level) => [level.slug, learningUnits.filter((unit) => unit.levelSlug === level.slug).length])), {
    "mam-non": 2, "lop-1": 16, "lop-2": 16, "lop-3": 20, "lop-4": 20,
    "lop-5": 20, "lop-6": 12, "lop-7": 12, "lop-8": 12, "lop-9": 12,
  });
  assert.deepEqual(learningUnits.filter((unit) => unit.levelSlug === "mam-non").map((unit) => unit.slug), ["con-vat-dang-yeu", "khu-vuon-sac-mau"]);
  const globalSuccessUnits = learningUnits.filter((unit) => unit.id.startsWith("global-success-"));
  assert.equal(globalSuccessUnits.length, 140);
  assert.equal(globalSuccessUnits.reduce((total, unit) => total + unit.vocabulary.length, 0), 840);
  assert.equal(learningUnits.reduce((total, unit) => total + unit.vocabulary.length, 0), 860);
  assert.ok(globalSuccessUnits.every((unit) => unit.vocabulary.length >= 6));
});

test("content mapping only resolves a Unit inside its published level", () => {
  assert.equal(unitBySlugs("mam-non", "con-vat-dang-yeu")?.id, "preschool-happy-animals");
  assert.equal(unitBySlugs("lop-3", "con-vat-dang-yeu"), undefined);
  assert.equal(unitBySlugs("mam-non", "khong-ton-tai"), undefined);
  assert.equal(unitBySlugs("lop-3", "lop-3-unit-01-hello")?.id, "global-success-grade-3-unit-01");
  assert.equal(unitBySlugs("lop-4", "lop-3-unit-01-hello"), undefined);
});

test("Global Success identifiers are stable and old grade 3 demos are absent", () => {
  const unit = unitBySlugs("lop-3", "lop-3-unit-01-hello");
  assert.equal(unit?.id, "global-success-grade-3-unit-01");
  assert.equal(unit?.vocabulary[0]?.id, "gs-g3-u01-hello");
  assert.equal(unitBySlugs("lop-3", "ngay-o-truong"), undefined);
  assert.equal(unitBySlugs("lop-3", "gia-dinh-cua-em"), undefined);
});

test("catalog validator rejects duplicate and broken references/content", () => {
  const duplicateLevel = { ...learningLevels[0] };
  const brokenUnit = {
    ...learningUnits[0], id: learningUnits[1].id, slug: learningUnits[1].slug, levelSlug: "lop-99", title: "", description: "",
    vocabulary: [
      { ...learningUnits[0].vocabulary[0], id: learningUnits[1].vocabulary[0].id, word: "Cat", phonetic: "", vietnameseMeaning: "con mèo", speechText: undefined, image: "../bad.png" },
      { ...learningUnits[0].vocabulary[1], word: "cat", vietnameseMeaning: "CON MÈO" },
    ],
  };
  const errors = validateLearningCatalog([...learningLevels, duplicateLevel], [...learningUnits, brokenUnit]);
  for (const marker of ["Level slug trùng", "Unit id trùng", "Unit slug trùng", "level không tồn tại", "thiếu title", "thiếu description", "thiếu phonetic", "thiếu audio hoặc speechText", "word trùng trong Unit", "nghĩa tiếng Việt trùng trong Unit", "asset path không hợp lệ"])
    assert.ok(errors.some((error) => error.includes(marker)), marker);
  assert.ok(errors.filter((error) => error.includes("Vocabulary") || error.includes("từ ")).every((error) => error.includes(`Unit ${brokenUnit.id}`)));
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

test("pronunciation settings default, persist and fail safely without touching progress", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEARNING_PROGRESS_STORAGE_KEY, "keep-progress");
  assert.deepEqual(readLearningSettings(storage), { schemaVersion: 1, pronunciationRateMode: "NORMAL" });
  assert.equal(getPronunciationRate(storage), 0.88);
  assert.equal(writeLearningSettings({ schemaVersion: 1, pronunciationRateMode: "SLOW" }, storage), true);
  assert.deepEqual(readLearningSettings(storage), { schemaVersion: 1, pronunciationRateMode: "SLOW" });
  assert.equal(getPronunciationRate(storage), 0.6);
  assert.equal(storage.getItem(LEARNING_PROGRESS_STORAGE_KEY), "keep-progress");
  storage.setItem(LEARNING_SETTINGS_STORAGE_KEY, "{broken");
  assert.deepEqual(readLearningSettings(storage), { schemaVersion: 1, pronunciationRateMode: "NORMAL" });
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(readLearningSettings(blocked), { schemaVersion: 1, pronunciationRateMode: "NORMAL" });
  assert.equal(writeLearningSettings({ schemaVersion: 1, pronunciationRateMode: "SLOW" }, blocked), false);
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

test("audio applies normal and slow rates without overlap and preserves unavailable strategy", async () => {
  const item = learningUnits[0].vocabulary[0];
  const events = [];
  const utterances = [];
  const audios = [];
  class FakeUtterance { rate = 1; constructor(text) { this.text = text; } }
  class FakeAudio {
    currentTime = 4;
    playbackRate = 1;
    preservesPitch = false;
    constructor(source) { this.source = source; audios.push(this); }
    play() { events.push(`play:${this.playbackRate}`); }
    pause() { events.push("pause"); }
  }
  const speech = { cancel: () => events.push("cancel"), speak: (utterance) => { utterances.push(utterance); events.push(`speak:${utterance.text}`); } };
  assert.equal(audioStrategy({ ...item, audio: "/audio/cat.mp3" }, { Audio: FakeAudio, speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), "ASSET");
  assert.equal(audioStrategy(item, { speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), "SPEECH");
  assert.equal(await playPronunciation(item, "NORMAL", { speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), true);
  assert.equal(utterances.at(-1).rate, 0.88);
  assert.equal(await playPronunciation(item, "SLOW", { speechSynthesis: speech, SpeechSynthesisUtterance: FakeUtterance }), true);
  assert.equal(utterances.at(-1).rate, 0.6);
  const assetItem = { ...item, audio: "/audio/cat.mp3" };
  assert.equal(await playPronunciation(assetItem, "SLOW", { Audio: FakeAudio }), true);
  assert.equal(audios[0].playbackRate, 0.6);
  assert.equal(audios[0].preservesPitch, true);
  assert.equal(await playPronunciation(assetItem, "NORMAL", { Audio: FakeAudio }), true);
  assert.equal(audios[0].currentTime, 0);
  assert.ok(events.indexOf("pause") < events.lastIndexOf("play:0.88"));
  assert.equal(audioStrategy({ ...item, speechText: undefined }, {}), "UNAVAILABLE");
  stopPronunciation();
});

test("quiz generator is deterministic with one unique correct option", () => {
  const vocabulary = learningUnits[0].vocabulary;
  const ids = quizItemOrder(vocabulary, seededQuizRandom(7));
  const first = createQuizQuestions(vocabulary, ids, seededQuizRandom(9));
  const second = createQuizQuestions(vocabulary, ids, seededQuizRandom(9));
  assert.deepEqual(first, second);
  assert.equal(first.length, 10);
  assert.deepEqual(first.map((question) => question.direction).slice(0, 2), ["WORD_TO_MEANING", "MEANING_TO_WORD"]);
  for (const question of first) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.equal(question.options.filter((option) => option === question.correctValue).length, 1);
  }
});

test("quiz generator uses three choices for a tiny Unit and skips a single-choice question", () => {
  const vocabulary = learningUnits[0].vocabulary;
  const tiny = createQuizQuestions(vocabulary.slice(0, 3), vocabulary.slice(0, 3).map((item) => item.id), seededQuizRandom(3));
  assert.equal(tiny.length, 3);
  assert.ok(tiny.every((question) => question.options.length === 3));
  assert.deepEqual(createQuizQuestions(vocabulary.slice(0, 1), [vocabulary[0].id]), []);
});

test("representative Global Success Units generate six-question quizzes", () => {
  const representativeUnits = [
    unitBySlugs("lop-1", "lop-1-unit-01-in-the-school-playground"),
    unitBySlugs("lop-3", "lop-3-unit-01-hello"),
    unitBySlugs("lop-6", "lop-6-unit-01-my-new-school"),
    unitBySlugs("lop-9", "lop-9-unit-12-career-choices"),
  ];
  for (const unit of representativeUnits) {
    assert.ok(unit);
    assert.equal(unit.vocabulary.length, 6);
    assert.equal(createQuizQuestions(unit.vocabulary, quizItemOrder(unit.vocabulary)).length, 6);
  }
});

test("quiz scoring calculates correct, wrong and rounded percentage", () => {
  assert.deepEqual(scoreQuiz([
    { itemId: "a", selectedValue: "A", correct: true },
    { itemId: "b", selectedValue: "B", correct: false },
    { itemId: "c", selectedValue: "C", correct: true },
  ]), { totalQuestions: 3, correctCount: 2, wrongCount: 1, scorePercent: 67, wrongItemIds: ["b"] });
});

test("V18B progress migrates with safe V18C defaults and validates attempts", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, units: { "con-vat-dang-yeu": {
    contentVersion: 1, viewedItemIds: ["pa-1"], rememberedItemIds: [], reviewItemIds: ["pa-2"], lastItemIndex: 1,
    listenCorrect: 1, listenTotal: 2, quizAttempts: [{ id: "bad" }, { id: "ok", completedAt: "2026-07-24T00:00:00.000Z", totalQuestions: 2, correctCount: 9, scorePercent: 999, wrongItemIds: ["pa-2"] }], updatedAt: "2026-07-24T00:00:00.000Z",
  } } }));
  const migrated = readLearningProgress(storage).units["con-vat-dang-yeu"];
  assert.equal(migrated.quizAttempts.length, 1);
  assert.equal(migrated.quizAttempts[0].correctCount, 2);
  assert.equal(migrated.quizAttempts[0].scorePercent, 100);
  assert.equal(migrated.bestScore, 100);
  assert.deepEqual(migrated.wrongItemIds, ["pa-2"]);
});

test("quiz session resumes, prevents duplicate answers and caps recent attempts", () => {
  const storage = new MemoryStorage();
  const unit = learningUnits[0];
  const ids = unit.vocabulary.slice(0, 3).map((item) => item.id);
  for (let attemptIndex = 0; attemptIndex < 12; attemptIndex += 1) {
    startOrResumeQuiz(unit, ids, storage);
    recordQuizAnswer(unit, { itemId: ids[0], selectedValue: "x", correct: false }, storage);
    recordQuizAnswer(unit, { itemId: ids[0], selectedValue: "x", correct: false }, storage);
    assert.equal(unitProgressFor(readLearningProgress(storage), unit).activeQuiz.answers.length, 1);
    recordQuizAnswer(unit, { itemId: ids[1], selectedValue: "y", correct: true }, storage);
    recordQuizAnswer(unit, { itemId: ids[2], selectedValue: "z", correct: true }, storage);
    completeQuiz(unit, storage);
  }
  const progress = unitProgressFor(readLearningProgress(storage), unit);
  assert.equal(progress.quizAttempts.length, MAX_RECENT_QUIZ_ATTEMPTS);
  assert.equal(progress.latestScore, 67);
  assert.equal(progress.bestScore, 67);
  assert.deepEqual(progress.wrongItemIds, [ids[0]]);
});

test("review completion removes current review state but preserves quiz history", () => {
  const storage = new MemoryStorage();
  const unit = learningUnits[0];
  const ids = unit.vocabulary.slice(0, 2).map((item) => item.id);
  startOrResumeQuiz(unit, ids, storage);
  recordQuizAnswer(unit, { itemId: ids[0], selectedValue: "x", correct: false }, storage);
  recordQuizAnswer(unit, { itemId: ids[1], selectedValue: "y", correct: true }, storage);
  completeQuiz(unit, storage);
  markVocabularyItem(unit, ids[0], "REVIEW", storage);
  markReviewedAsRemembered(unit, ids[0], storage);
  const progress = unitProgressFor(readLearningProgress(storage), unit);
  assert.deepEqual(progress.wrongItemIds, []);
  assert.deepEqual(progress.reviewItemIds, []);
  assert.ok(progress.rememberedItemIds.includes(ids[0]));
  assert.equal(progress.quizAttempts.length, 1);
  assert.ok(progress.reviewCompletedAt);
});

test("learning metadata indexes stable pages and noindexes temporary quiz state", () => {
  const unit = learningRouteMetadata("/hoc/mam-non/con-vat-dang-yeu");
  assert.equal(unit.valid, true);
  assert.equal(unit.robots, "index,follow,max-image-preview:large");
  assert.equal(unit.canonical, "https://tienganhcovy.com/hoc/mam-non/con-vat-dang-yeu");
  for (const action of ["flashcards", "listen", "quiz", "result", "review"])
    assert.equal(learningRouteMetadata(`/hoc/mam-non/con-vat-dang-yeu/${action}`).robots, "noindex,follow");
  assert.equal(learningRouteMetadata("/hoc/lop-3/con-vat-dang-yeu/quiz").valid, false);
});

test("production sitemap is catalog-derived, unique and excludes action or retired routes", () => {
  assert.equal(productionSitemapPathnames.length, 154);
  assert.equal(new Set(productionSitemapPathnames).size, productionSitemapPathnames.length);
  const sitemap = generateProductionSitemapXml();
  assert.ok(sitemap.includes("https://tienganhcovy.com/hoc/lop-1/lop-1-unit-01-in-the-school-playground"));
  assert.ok(sitemap.includes("https://tienganhcovy.com/hoc/lop-9/lop-9-unit-12-career-choices"));
  for (const excluded of ["ngay-o-truong", "gia-dinh-cua-em", "/quiz", "/result", "/review", "/admin"])
    assert.equal(sitemap.includes(excluded), false, excluded);
  assert.ok(generateProductionSitemapXml(["/hoc/a&b"]).includes("/hoc/a&amp;b"));
});
