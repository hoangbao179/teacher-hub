import assert from "node:assert/strict";
import test from "node:test";
import type {
  CreateVocabularySetRequest,
  VocabularyTopicDetail,
} from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { VocabularyRepository } from "../repositories/vocabulary.repository";
import {
  VocabularyService,
  normalizeVocabularyText,
} from "./vocabulary.service";

const topic: VocabularyTopicDetail = {
  id: 1,
  slug: "colors",
  titleVi: "Màu sắc",
  descriptionVi: null,
  iconKey: "palette",
  ageBands: ["PRESCHOOL_G1"],
  coreWordCount: 2,
  extendedWordCount: 1,
  words: [
    {
      id: 1, word: "red", normalizedWord: "red", meaningVi: "màu đỏ",
      normalizedMeaning: "màu đỏ", phonetic: null, partOfSpeech: null,
      exampleEn: null, speechText: "red", tier: "CORE", priority: 1,
      ageBands: ["PRESCHOOL_G1"], supportsImageGame: true,
      imageSearchTerms: ["red color"],
    },
    {
      id: 2, word: "blue", normalizedWord: "blue", meaningVi: "màu xanh",
      normalizedMeaning: "màu xanh", phonetic: null, partOfSpeech: null,
      exampleEn: null, speechText: "blue", tier: "CORE", priority: 2,
      ageBands: ["PRESCHOOL_G1"], supportsImageGame: true,
      imageSearchTerms: ["blue color"],
    },
    {
      id: 3, word: "gray", normalizedWord: "gray", meaningVi: "màu xám",
      normalizedMeaning: "màu xám", phonetic: null, partOfSpeech: null,
      exampleEn: null, speechText: "gray", tier: "EXTENDED", priority: 1,
      ageBands: ["PRESCHOOL_G1"], supportsImageGame: true,
      imageSearchTerms: ["gray color"],
    },
  ],
};

const manual: CreateVocabularySetRequest = {
  title: "  Bộ màu sắc  ",
  sourceType: "MANUAL",
  ageBand: "PRESCHOOL_G1",
  items: [
    {
      displayOrder: 1,
      word: " Red ",
      meaningVi: " Màu đỏ ",
      tier: "CUSTOM",
      illustration: { kind: "NONE" },
      supportsImageGame: false,
    },
  ],
};

test("normalization is stable for spacing, width and case", () => {
  assert.equal(normalizeVocabularyText("  ＲＥＤ   Apple "), "red apple");
  assert.equal(normalizeVocabularyText("  Màu   ĐỎ "), "màu đỏ");
});

test("suggestion keeps CORE before EXTENDED and always selects every CORE word", async () => {
  const repository = {
    findTopic: async () => ({
      ...topic,
      coreWordCount: 3,
      words: [
        ...topic.words.slice(0, 2),
        { ...topic.words[1], id: 4, word: "green", normalizedWord: "green", priority: 3 },
        topic.words[2],
      ],
    }),
  } as unknown as VocabularyRepository;
  const result = await new VocabularyService(repository).suggest({
    topicSlug: "colors",
    ageBand: "PRESCHOOL_G1",
    targetCount: 2,
  });
  assert.deepEqual(result.items.map((item) => item.tier), ["CORE", "CORE", "CORE", "EXTENDED"]);
  assert.deepEqual(result.items.map((item) => item.selected), [true, true, true, false]);
  assert.equal(result.selectedCount, 3);
});

test("create normalizes original fields and forwards authenticated actor", async () => {
  const calls: unknown[][] = [];
  const repository = {
    create: async (...args: unknown[]) => { calls.push(args); return 9; },
  } as unknown as VocabularyRepository;
  assert.equal(await new VocabularyService(repository).create(manual, 77), 9);
  const prepared = calls[0][0] as {
    title: string;
    items: Array<{ word: string; normalizedWord: string; normalizedMeaning: string }>;
  };
  assert.equal(prepared.title, "Bộ màu sắc");
  assert.equal(prepared.items[0].word, "Red");
  assert.equal(prepared.items[0].normalizedWord, "red");
  assert.equal(prepared.items[0].normalizedMeaning, "màu đỏ");
  assert.equal(calls[0][1], 77);
});

test("duplicate normalized pair and set hard limit are rejected", async () => {
  const service = new VocabularyService({} as VocabularyRepository);
  await assert.rejects(
    () => service.create({
      ...manual,
      items: [
        manual.items[0],
        { ...manual.items[0], displayOrder: 2, word: "ＲＥＤ", meaningVi: "màu   ĐỎ" },
      ],
    }, 1),
    (error: unknown) => error instanceof AppError &&
      error.code === "DUPLICATE_VOCABULARY_ITEM",
  );
  await assert.rejects(
    () => service.create({
      ...manual,
      items: Array.from({ length: 101 }, (_, index) => ({
        ...manual.items[0],
        displayOrder: index + 1,
        word: `word ${index}`,
      })),
    }, 1),
    (error: unknown) => error instanceof AppError &&
      error.code === "VOCABULARY_LIMIT_EXCEEDED",
  );
});

test("age band and illustration validation use specific errors", async () => {
  const service = new VocabularyService({} as VocabularyRepository);
  await assert.rejects(
    () => service.create({ ...manual, ageBand: "BAD" as never }, 1),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_AGE_BAND",
  );
  await assert.rejects(
    () => service.create({
      ...manual,
      items: [{
        ...manual.items[0],
        illustration: { kind: "PUBLIC_ASSET", value: "https://example.com/a.png" },
      }],
    }, 1),
    (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
});

test("archived set cannot update but remains duplicable", async () => {
  const calls: unknown[][] = [];
  const repository = {
    findSet: async () => ({
      id: 5, title: "Cũ", description: null, sourceType: "MANUAL",
      sourceReference: null, ageBand: "G2_G3", status: "ARCHIVED",
      itemCount: 1, updatedAt: "2026-07-26", items: [],
    }),
    duplicate: async (...args: unknown[]) => { calls.push(args); return 6; },
  } as unknown as VocabularyRepository;
  const service = new VocabularyService(repository);
  await assert.rejects(
    () => service.update(5, {
      title: "Sửa", ageBand: "G2_G3", items: manual.items,
    }, 1),
    (error: unknown) => error instanceof AppError &&
      error.code === "VOCABULARY_SET_ARCHIVED",
  );
  assert.equal(await service.duplicate(5, {}, 1), 6);
  assert.deepEqual(calls[0], [5, 1, "Bản sao — Cũ"]);
});

test("Public Unit import validates full snapshot and rejects arbitrary URL", async () => {
  const calls: unknown[][] = [];
  const repository = {
    create: async (...args: unknown[]) => { calls.push(args); return 10; },
  } as unknown as VocabularyRepository;
  const service = new VocabularyService(repository);
  await service.importPublicUnit({
    unitId: "unit-1",
    levelSlug: "lop-2",
    contentVersion: 1,
    title: "Unit 1",
    ageBand: "G2_G3",
    items: [{
      id: "word-1",
      word: "cat",
      meaningVi: "con mèo",
      illustration: { kind: "EMOJI", value: "🐱" },
    }],
  }, 22);
  assert.equal(calls[0][1], 22);
  assert.equal(calls[0][2], "VOCABULARY_PUBLIC_UNIT_IMPORTED");
  await assert.rejects(
    () => service.importPublicUnit({
      unitId: "unit-1",
      levelSlug: "lop-2",
      contentVersion: 1,
      title: "Unit 1",
      ageBand: "G4_G5",
      items: [{
        id: "word-1",
        word: "cat",
        meaningVi: "con mèo",
        illustration: { kind: "NONE" },
      }],
    }, 22),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_AGE_BAND",
  );
  await assert.rejects(
    () => service.importPublicUnit({
      unitId: "unit-1",
      levelSlug: "lop-2",
      contentVersion: 1,
      title: "Unit 1",
      ageBand: "G2_G3",
      items: [{
        id: "word-1",
        word: "cat",
        meaningVi: "con mèo",
        illustration: {
          kind: "PUBLIC_ASSET",
          value: "https://invalid.example/cat.png",
        },
      }],
    }, 22),
    (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
});
