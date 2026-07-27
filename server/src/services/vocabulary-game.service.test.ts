import assert from "node:assert/strict";
import test from "node:test";
import type { AssignmentDetail } from "@teacher/shared";
import {
  canonicalAnswer,
  generateQuestionQueue,
  isCorrectAnswer,
} from "./game-question-generator";
import { gameToken, gameTokenHash, VocabularyGameService } from "./vocabulary-game.service";
import { AppError } from "../errors/app-error";
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

test("start with the same session returns the existing attempt without creating another", async () => {
  let started = false;
  let startCalls = 0;
  const attemptState = {
    attempt: {
      id: 55, status: "IN_PROGRESS", age_band: "G4_G5", answer_feedback_mode: "IMMEDIATE",
      session_expires_at: new Date(Date.now() + 60_000), student_name_snapshot: null,
      guest_name: null, total_questions: 1, generation_warnings_json: [],
    },
    completedQuestions: 0,
    question: null,
  };
  const games = {
    sessionAssignmentCode: async () => "ABCDEFGH",
    state: async () => {
      if (!started) throw new AppError(404, "ATTEMPT_NOT_FOUND", "not started");
      return attemptState;
    },
    startAttempt: async () => { startCalls += 1; started = true; },
  };
  const service = new VocabularyGameService(
    games as never,
    { publicDetail: async () => assignment } as never,
  );
  const session = "s".repeat(48);
  await service.start("ABCDEFGH", session);
  await service.start("ABCDEFGH", session);
  assert.equal(startCalls, 1);
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

test("shuffleQuestions false preserves display order while true is seed deterministic", () => {
  const ordered = generateQuestionQueue({
    ...assignment,
    shuffleQuestions: false,
    activities: [{
      id: 8, displayOrder: 1, mechanic: "EXPLORE_CARD",
      presentation: "FLASHCARD", required: true,
    }],
  }, "ignored-for-order").questions.filter((question) => question.questionKind === "EXPOSURE");
  assert.deepEqual(ordered.map((question) => question.assignmentItemId), [1, 2, 3, 4]);

  const shuffledA = generateQuestionQueue({ ...assignment, shuffleQuestions: true }, "shuffle-a");
  const shuffledAReplay = generateQuestionQueue({ ...assignment, shuffleQuestions: true }, "shuffle-a");
  const shuffledOrders = ["shuffle-b", "shuffle-c", "shuffle-d", "shuffle-e"].map((seed) =>
    generateQuestionQueue({ ...assignment, shuffleQuestions: true }, seed)
      .questions.filter((item) => item.questionKind === "PRIMARY")
      .map((item) => item.assignmentItemId).join(","));
  assert.deepEqual(shuffledA, shuffledAReplay);
  assert.ok(shuffledOrders.some((order) => order !== shuffledOrders[0]));
});

test("unsupported mechanic and presentation produce no playable questions", () => {
  const queue = generateQuestionQueue({
    ...assignment,
    activities: [{
      id: 20, displayOrder: 1, mechanic: "ORDER_TOKENS",
      presentation: "FLASHCARD", required: true,
    }],
  }, "unsupported");
  assert.equal(queue.questions.length, 0);
  assert.ok(queue.warnings.some((warning) => warning.includes("chưa được hỗ trợ")));
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
  const reviews = queue.questions.filter((item) => item.questionKind === "REVIEW");
  assert.deepEqual(new Set(reviews.map((item) => item.assignmentItemId)), new Set([1, 2, 3, 4]));
  assert.ok(reviews.every((item) => item.scoreWeight === 0 && item.status === "CONDITIONAL"));
});

test("build word and flashcard create item-level zero-weight adaptive review", () => {
  for (const activity of [
    { id: 30, displayOrder: 1, mechanic: "BUILD_WORD" as const, presentation: "BUILD_SPELLED_WORD" as const, required: true },
    { id: 31, displayOrder: 1, mechanic: "EXPLORE_CARD" as const, presentation: "FLASHCARD" as const, required: true },
  ]) {
    const queue = generateQuestionQueue({ ...assignment, activities: [activity] }, `adaptive-${activity.id}`);
    const reviews = queue.questions.filter((item) => item.questionKind === "REVIEW");
    assert.ok(reviews.length > 0);
    assert.ok(reviews.every((item) => item.scoreWeight === 0 && item.assignmentItemIds.length === 1));
  }
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
  for (const question of first.questions.filter((value) => value.questionKind === "PRIMARY")) {
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

test("a rejected multi-item question does not consume cap needed by a later single item", () => {
  const constrainedItems = assignment.items.map((item, index) => ({
    ...item,
    word: index === 0 ? "cat" : String.fromCharCode(97 + index),
    normalizedWord: index === 0 ? "cat" : String.fromCharCode(97 + index),
  }));
  const activities = [
    ...[1, 2, 3].map((id) => ({
      id: 200 + id, displayOrder: id, mechanic: "SELECT_ONE" as const,
      presentation: "WORD_PICK_MEANING" as const, required: true,
    })),
    { id: 204, displayOrder: 4, mechanic: "BUILD_WORD" as const, presentation: "BUILD_SPELLED_WORD" as const, required: true },
    { id: 205, displayOrder: 5, mechanic: "MATCH_PAIRS" as const, presentation: "MATCH_WORD_MEANING" as const, required: true },
    { id: 206, displayOrder: 6, mechanic: "BUILD_WORD" as const, presentation: "BUILD_SPELLED_WORD" as const, required: true },
  ];
  const queue = generateQuestionQueue({
    ...assignment,
    ageBand: "G2_G3",
    shuffleQuestions: false,
    items: constrainedItems,
    activities,
  }, "partial-cap");
  const primaries = queue.questions.filter((question) => question.questionKind === "PRIMARY");
  assert.equal(primaries.some((question) => question.activityId === 205), false);
  assert.equal(primaries.some((question) => question.activityId === 206), true);
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
