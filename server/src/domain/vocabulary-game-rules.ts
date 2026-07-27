export type SelfAssessment = "REMEMBERED" | "REVIEW" | null;

export function shouldScheduleAdaptiveReview(input: {
  graded: boolean;
  firstAttemptCorrect: boolean;
  selfAssessment: SelfAssessment;
}): boolean {
  return input.selfAssessment === "REVIEW"
    || (input.graded && !input.firstAttemptCorrect);
}

export function itemAnswerCorrect(
  expectedPair: { leftId?: unknown; rightId?: unknown } | undefined,
  submittedPairs: Array<{ leftId?: unknown; rightId?: unknown }>,
  questionCorrect: boolean,
): boolean {
  return expectedPair
    ? submittedPairs.some((pair) =>
      pair.leftId === expectedPair.leftId && pair.rightId === expectedPair.rightId)
    : questionCorrect;
}

export function calculateItemScore(input: {
  gradedExposureCount: number;
  firstTryCorrectCount: number;
  finalCorrectCount: number;
  passScore: number | null;
}) {
  const scorePercent = input.gradedExposureCount
    ? Math.round((input.finalCorrectCount / input.gradedExposureCount) * 100)
    : null;
  return {
    scorePercent,
    passed: scorePercent == null || input.passScore == null
      ? null : scorePercent >= input.passScore,
  };
}
