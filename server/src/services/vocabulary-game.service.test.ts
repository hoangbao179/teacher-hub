import assert from "node:assert/strict";
import test from "node:test";
import type { AssignmentDetail } from "@teacher/shared";
import {
  canonicalAnswer,
  generateQuestionQueue,
  isCorrectAnswer,
} from "./game-question-generator";
import { gameToken, gameTokenHash } from "./vocabulary-game.service";
import { safeRequestPath } from "../middleware/request-context";

const assignment: AssignmentDetail = {
  id: 9,
  teacherUserId: 1,
  title: "Animals",
  instruction: "Play",
  status: "PUBLISHED",
  audienceType: "OPEN_LINK",
  ageBand: "G4_G5",
  dueAt: null,
  recipientCount: 0,
  itemCount: 4,
  version: 1,
  updatedAt: "2026-07-26T00:00:00.000Z",
  vocabularySetId: null,
  classId: null,
  selectedStudentIds: [],
  publicCode: "ABCDEFGH",
  templateCode: "CUSTOM",
  availableFrom: null,
  maxAttempts: null,
  passScore: null,
  answerFeedbackMode: "IMMEDIATE",
  shuffleQuestions: true,
  publishedAt: "2026-07-26T00:00:00.000Z",
  closedAt: null,
  items: [
    ["cat", "con mèo", "🐱"],
    ["dog", "con chó", "🐶"],
    ["bird", "con chim", "🐦"],
    ["fish", "con cá", "🐟"],
  ].map(([word, meaningVi, value], index) => ({
    id: index + 1,
    displayOrder: index + 1,
    word,
    normalizedWord: word,
    meaningVi,
    speechText: word,
    tier: "CORE",
    illustration: { kind: "EMOJI", value },
    illustrationSnapshot: { kind: "EMOJI", value },
    supportsImageGame: true,
  })),
  activities: [
    {
      id: 1,
      displayOrder: 1,
      mechanic: "SELECT_ONE",
      presentation: "LISTEN_PICK_IMAGE",
      required: true,
      config: {},
    },
    {
      id: 2,
      displayOrder: 2,
      mechanic: "EXPLORE_CARD",
      presentation: "FLASHCARD",
      required: true,
      config: {},
    },
  ],
};

test("game sessions use at least 32 random bytes and persist a one-way hash", () => {
  const token = gameToken();
  assert.ok(Buffer.from(token, "base64url").byteLength >= 32);
  assert.match(gameTokenHash(token), /^[a-f0-9]{64}$/);
  assert.notEqual(gameTokenHash(token), token);
});

test("request logging redacts raw public session tokens", () => {
  const token = gameToken();
  assert.equal(
    safeRequestPath(`/api/public/learning-attempts/${token}/answers`),
    "/api/public/learning-attempts/:sessionToken/answers",
  );
  assert.equal(safeRequestPath("/api/vocabulary/topics"), "/api/vocabulary/topics");
});

test("seeded queue is deterministic, snapshot-safe and keeps listening answers hidden", () => {
  const first = generateQuestionQueue(assignment, "stable-seed");
  const second = generateQuestionQueue(assignment, "stable-seed");
  assert.deepEqual(first, second);
  assert.ok(first.questions.length > assignment.items.length);
  const listening = first.questions.filter((question) => question.presentation === "LISTEN_PICK_IMAGE");
  assert.ok(listening.length > 0);
  for (const question of listening) {
    assert.equal(question.prompt.word, undefined);
    assert.equal(question.prompt.meaningVi, undefined);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
  }
  assert.ok(first.questions.some((question) => question.status === "CONDITIONAL"));
  assert.ok(first.questions.some((question) => !question.graded && question.mechanic === "EXPLORE_CARD"));
  assert.ok(first.questions
    .filter((question) => question.status === "CONDITIONAL")
    .every((question) => question.questionKind === "REVIEW" && question.scoreWeight === 0));
});

test("pair questions map every item and expose only opaque match keys", () => {
  const queue = generateQuestionQueue({
    ...assignment,
    activities: [{
      id: 3,
      displayOrder: 1,
      mechanic: "MEMORY_PAIRS",
      presentation: "MEMORY_WORD_MEANING",
      required: true,
    }],
  }, "pair-seed");
  const question = queue.questions[0];
  assert.equal(question.assignmentItemIds.length, 4);
  assert.equal(new Set(question.assignmentItemIds).size, 4);
  const left = question.prompt.pairs ?? [];
  assert.ok(left.every((item) => item.matchKey?.startsWith("match-")));
  assert.ok(question.options.every((item) => item.matchKey?.startsWith("match-")));
  assert.ok(left.every((item) => !assignment.items.some(
    (word) => item.matchKey === String(word.id) || item.matchKey === word.word,
  )));
});

test("missing letter snapshots one blank and opaque deterministic options", () => {
  const spelling = {
    ...assignment,
    activities: [{
      id: 4,
      displayOrder: 1,
      mechanic: "BUILD_WORD" as const,
      presentation: "MISSING_LETTER" as const,
      required: true,
    }],
  };
  const first = generateQuestionQueue(spelling, "missing-seed");
  const second = generateQuestionQueue(spelling, "missing-seed");
  assert.deepEqual(first, second);
  assert.ok(first.questions.length > 0);
  for (const question of first.questions) {
    assert.equal(question.presentation, "MISSING_LETTER");
    assert.equal(question.prompt.maskedWord?.split("_").length, 2);
    assert.ok(question.options.length >= 2 && question.options.length <= 4);
    assert.ok(question.options.every((option) => option.id.startsWith("letter-option-")));
  }
});

test("queue caps primary scoring before reviews and keeps no orphan review", () => {
  const manyActivities = Array.from({ length: 8 }, (_, index) => ({
    id: 100 + index,
    displayOrder: index + 1,
    mechanic: "SELECT_ONE" as const,
    presentation: index % 2 === 0
      ? "WORD_PICK_MEANING" as const
      : "MEANING_PICK_WORD" as const,
    required: true,
  }));
  const queue = generateQuestionQueue({
    ...assignment,
    ageBand: "G2_G3",
    activities: manyActivities,
  }, "capped-review-seed");
  const primaries = queue.questions.filter((question) => question.scoreWeight === 1);
  const primaryKeys = new Set(primaries.map((question) => question.key));
  const reviews = queue.questions.filter((question) => question.questionKind === "REVIEW");
  assert.ok(primaries.length <= 16);
  assert.ok(reviews.length > 0);
  assert.ok(reviews.every((question) =>
    question.adaptiveSourceKey && primaryKeys.has(question.adaptiveSourceKey)));
  for (const item of assignment.items)
    assert.ok(primaries.some((question) => question.assignmentItemIds.includes(item.id)));
});

test("server grading canonicalizes object keys and pair order", () => {
  assert.equal(
    canonicalAnswer({ b: 2, a: 1 }),
    canonicalAnswer({ a: 1, b: 2 }),
  );
  assert.equal(isCorrectAnswer(
    { pairs: [{ leftId: "b", rightId: "2" }, { leftId: "a", rightId: "1" }] },
    { pairs: [{ leftId: "a", rightId: "1" }, { leftId: "b", rightId: "2" }] },
  ), true);
  assert.equal(isCorrectAnswer({ optionId: "wrong" }, { optionId: "right" }), false);
});

test("missing-letter grading accepts only its opaque option id", () => {
  assert.equal(isCorrectAnswer(
    { optionId: "letter-option-correct" },
    { optionId: "letter-option-correct", missingIndex: 2 },
  ), true);
  assert.equal(isCorrectAnswer(
    { optionId: "letter-option-wrong" },
    { optionId: "letter-option-correct", missingIndex: 2 },
  ), false);
});
