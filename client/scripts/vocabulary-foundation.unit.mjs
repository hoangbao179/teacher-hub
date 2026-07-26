import assert from "node:assert/strict";
import test from "node:test";
import { publishedUnits } from "../src/features/learning/content/vocabularyCatalog.ts";
import {
  ageBandForLevelSlug,
  ageBandLabel,
  levelSlugsByAgeBand,
  parseVocabularyPaste,
  publicUnitSnapshot,
  suggestionItems,
} from "../src/features/vocabulary/vocabularyEditor.ts";

test("paste preview accepts comma, semicolon and tab while reporting incomplete rows", () => {
  const result = parseVocabularyPaste("apple, quả táo\nbanana\tquả chuối\norange; quả cam\nmissing");
  assert.equal(result.validCount, 3);
  assert.equal(result.invalidCount, 1);
  assert.deepEqual(result.rows.slice(0, 3).map(({ word, meaningVi }) => ({ word, meaningVi })), [
    { word: "apple", meaningVi: "quả táo" },
    { word: "banana", meaningVi: "quả chuối" },
    { word: "orange", meaningVi: "quả cam" },
  ]);
});

test("topic suggestions keep only selected words and stable display order", () => {
  const items = suggestionItems({
    topic: { id: 1, slug: "family", titleVi: "Gia đình", descriptionVi: null, iconKey: "👨‍👩‍👧", ageBands: ["PRESCHOOL_G1"], coreWordCount: 2, extendedWordCount: 1 },
    ageBand: "PRESCHOOL_G1",
    targetCount: 2,
    selectedCount: 2,
    items: [
      { id: 1, word: "mother", normalizedWord: "mother", meaningVi: "mẹ", normalizedMeaning: "mẹ", phonetic: null, partOfSpeech: null, exampleEn: null, speechText: "mother", tier: "CORE", priority: 1, ageBands: ["PRESCHOOL_G1"], supportsImageGame: true, imageSearchTerms: [], selected: true },
      { id: 2, word: "father", normalizedWord: "father", meaningVi: "bố", normalizedMeaning: "bố", phonetic: null, partOfSpeech: null, exampleEn: null, speechText: "father", tier: "CORE", priority: 2, ageBands: ["PRESCHOOL_G1"], supportsImageGame: true, imageSearchTerms: [], selected: false },
    ],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceTopicWordId, 1);
  assert.equal(items[0].displayOrder, 1);
});

test("public Unit import creates a versioned snapshot with only local assets or emoji", () => {
  const unit = publishedUnits.find((value) => value.levelSlug === "mam-non");
  assert.ok(unit);
  const snapshot = publicUnitSnapshot(unit);
  assert.equal(snapshot.unitId, unit.id);
  assert.equal(snapshot.contentVersion, unit.contentVersion);
  assert.equal(snapshot.ageBand, ageBandForLevelSlug(unit.levelSlug));
  assert.match(snapshot.title, /^Mầm non · |^Lớp [1-9] · /);
  assert.equal(snapshot.items.length, unit.vocabulary.length);
  assert.ok(snapshot.items.every((item) =>
    item.illustration.kind === "NONE" ||
    item.illustration.kind === "EMOJI" ||
    (item.illustration.kind === "PUBLIC_ASSET" && item.illustration.value?.startsWith("/learning/"))));
  assert.equal(ageBandLabel("G6_G9"), "Lớp 6–9");
});

test("public Units are mapped to exactly the compatible age-band levels", () => {
  assert.deepEqual(levelSlugsByAgeBand.G4_G5, ["lop-4", "lop-5"]);
  assert.deepEqual(levelSlugsByAgeBand.G6_G9, ["lop-6", "lop-7", "lop-8", "lop-9"]);
  for (const unit of publishedUnits)
    assert.ok(levelSlugsByAgeBand[ageBandForLevelSlug(unit.levelSlug)].includes(unit.levelSlug));
});
