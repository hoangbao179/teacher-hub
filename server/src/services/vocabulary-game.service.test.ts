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
