import assert from "node:assert/strict";
import test from "node:test";
import { vocabularyMastery } from "./vocabulary-mastery";

test("mastery is deterministic and only classifies graded evidence", () => {
  assert.equal(vocabularyMastery({
    gradedExposures: 0, correctFirstTry: 0, finalCorrect: 0, abandonedExposures: 0,
  }).status, "NOT_SEEN");
  assert.equal(vocabularyMastery({
    gradedExposures: 5, correctFirstTry: 4, finalCorrect: 5, abandonedExposures: 0,
  }).status, "MASTERED");
  assert.equal(vocabularyMastery({
    gradedExposures: 5, correctFirstTry: 3, finalCorrect: 5, abandonedExposures: 0,
  }).status, "LEARNING");
  assert.equal(vocabularyMastery({
    gradedExposures: 5, correctFirstTry: 4, finalCorrect: 4, abandonedExposures: 0,
  }).status, "NEEDS_REVIEW");
  assert.equal(vocabularyMastery({
    gradedExposures: 5, correctFirstTry: 5, finalCorrect: 5, abandonedExposures: 1,
  }).status, "NEEDS_REVIEW");
});
