/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import type { PublicLearningQuestion } from "@teacher/shared";
import { beginAnswerSubmission, createAnswerSubmissionState, finishAnswerSubmission } from "./answerSubmission";

const question = { id: 7, answerSequence: 1 } as PublicLearningQuestion;

test("double submit acquires one synchronous lock", () => {
  const state = createAnswerSubmissionState();
  const first = beginAnswerSubmission(state, question, { optionId: "one" }, () => "answer-id");
  const second = beginAnswerSubmission(state, question, { optionId: "two" }, () => "other-id");
  assert.equal(first?.clientAnswerId, "answer-id");
  assert.equal(second, null);
});

test("network retry reuses the identical payload and clientAnswerId", () => {
  const state = createAnswerSubmissionState();
  const first = beginAnswerSubmission(state, question, { optionId: "one" }, () => "stable-id");
  finishAnswerSubmission(state, false);
  const retry = beginAnswerSubmission(state, question, undefined, () => "new-id");
  assert.deepEqual(retry, first);
  assert.equal(retry?.clientAnswerId, "stable-id");
});
