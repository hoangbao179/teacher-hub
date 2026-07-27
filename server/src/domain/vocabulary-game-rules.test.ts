import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateItemScore,
  itemAnswerCorrect,
  shouldScheduleAdaptiveReview,
} from "./vocabulary-game-rules";

test("first answer wrong still schedules review after a correct retry", () => {
  assert.equal(shouldScheduleAdaptiveReview({
    graded: true, firstAttemptCorrect: false, selfAssessment: null,
  }), true);
});

test("flashcard REVIEW schedules review but REMEMBERED does not", () => {
  assert.equal(shouldScheduleAdaptiveReview({
    graded: false, firstAttemptCorrect: true, selfAssessment: "REVIEW",
  }), true);
  assert.equal(shouldScheduleAdaptiveReview({
    graded: false, firstAttemptCorrect: true, selfAssessment: "REMEMBERED",
  }), false);
});

test("match and memory grade every vocabulary pair independently", () => {
  const submitted = [{ leftId: "left-1", rightId: "right-1" }];
  assert.equal(itemAnswerCorrect({ leftId: "left-1", rightId: "right-1" }, submitted, false), true);
  assert.equal(itemAnswerCorrect({ leftId: "left-2", rightId: "right-2" }, submitted, false), false);
});

test("item score uses the same numerator and denominator and assignment passScore", () => {
  assert.deepEqual(calculateItemScore({
    gradedExposureCount: 4, firstTryCorrectCount: 2, finalCorrectCount: 3, passScore: 80,
  }), { scorePercent: 75, passed: false });
  assert.deepEqual(calculateItemScore({
    gradedExposureCount: 4, firstTryCorrectCount: 1, finalCorrectCount: 4, passScore: 80,
  }), { scorePercent: 100, passed: true });
});
