import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { suggestOfflineIllustration, updateOfflineIllustrationAfterTextEdit } from "../src/features/vocabulary/offlineIllustrations.ts";
import { parseVocabularyPaste, suggestionItems } from "../src/features/vocabulary/vocabularyEditor.ts";

test("curated offline image needs the correct Vietnamese sense; never guesses abstract words", () => {
  const image = (word, meaning) => suggestOfflineIllustration(word, meaning);
  assert.deepEqual(image(" APPLE ", "  QUẢ  TÁO "), { kind: "EMOJI", value: "🍎" });
  assert.deepEqual(image("orange", "quả cam"), { kind: "EMOJI", value: "🍊" });
  assert.deepEqual(image("orange", "màu cam"), { kind: "EMOJI", value: "🟠" });
  assert.deepEqual(image("bat", "con dơi"), { kind: "EMOJI", value: "🦇" });
  for (const [word, meaning] of [
    ["bat", "gậy bóng chày"],
    ["table", "cái bàn"],
    ["hungry", "đói"],
    ["delicious", "ngon"],
    ["apple", "con mèo"],
  ])
    assert.deepEqual(image(word, meaning), { kind: "NONE" });
});

test("editing text updates an auto emoji but preserves teacher-picked stored media", () => {
  const original = {
    displayOrder: 1, word: "cat", meaningVi: "con mèo", tier: "CUSTOM",
    supportsImageGame: true, illustration: suggestOfflineIllustration("cat", "con mèo"),
  };
  const changed = updateOfflineIllustrationAfterTextEdit(original, "meaningVi", "con hổ");
  assert.deepEqual(changed.illustration, { kind: "NONE" });
  assert.equal(changed.supportsImageGame, false);
  const uploaded = { ...original, illustration: { kind: "STORED_MEDIA", mediaId: 99 } };
  assert.deepEqual(updateOfflineIllustrationAfterTextEdit(uploaded, "meaningVi", "con hổ").illustration, uploaded.illustration);
  const manual = { ...original, illustration: { kind: "NONE" }, supportsImageGame: false };
  assert.deepEqual(updateOfflineIllustrationAfterTextEdit(manual, "meaningVi", "con mèo").illustration, { kind: "EMOJI", value: "🐱" });
});

test("external vocabulary paste retains every valid row even without a matching illustration", () => {
  const pasted = parseVocabularyPaste("apple, quả táo\nhungry; đói\ndelicious\tngon");
  assert.equal(pasted.validCount, 3);
  assert.equal(pasted.invalidCount, 0);
  assert.deepEqual(pasted.rows.map(({ word }) => word), ["apple", "hungry", "delicious"]);
  const editor = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/vocabulary/pages/VocabularyEditorPage.tsx"), "utf8");
  assert.match(editor, /setItems\(preview\.rows\.map\(/);
  assert.match(editor, /suggestOfflineIllustration\(row\.word, row\.meaningVi\)/);
  assert.match(editor, /updateOfflineIllustrationAfterTextEdit\(item, "meaningVi"/);
});

test("topic suggestions derive playable images from actual local emoji, not search flags", () => {
  const base = {
    normalizedWord: "", normalizedMeaning: "", phonetic: null, partOfSpeech: null,
    exampleEn: null, speechText: "", tier: "CORE", priority: 1, ageBands: ["G2_G3"],
    imageSearchTerms: [], selected: true,
  };
  const result = suggestionItems({
    topic: { id: 1, slug: "food", titleVi: "Thức ăn", descriptionVi: null, iconKey: "food", ageBands: ["G2_G3"], coreWordCount: 2, extendedWordCount: 0 },
    ageBand: "G2_G3", targetCount: 2, selectedCount: 2,
    items: [
      { ...base, id: 1, word: "apple", meaningVi: "quả táo", supportsImageGame: false },
      { ...base, id: 2, word: "delicious", meaningVi: "ngon", supportsImageGame: true },
    ],
  });
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].illustration, { kind: "EMOJI", value: "🍎" });
  assert.equal(result[0].supportsImageGame, true);
  assert.deepEqual(result[1].illustration, { kind: "NONE" });
  assert.equal(result[1].supportsImageGame, false);
});

test("offline suggestion does not call remote image providers", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/vocabulary/offlineIllustrations.ts"), "utf8");
  assert.doesNotMatch(source, /\b(fetch|axios|XMLHttpRequest|searchVocabularyMedia|searchVocabularyImageSuggestions)\s*\(/);
});
