import type {
  VocabularyMasteryEvidence,
  VocabularyMasteryStatus,
} from "@teacher/shared";

export const VOCABULARY_MASTERY_POLICY = Object.freeze({
  version: "V20E_1",
  masteredFirstTryPercent: 80,
  minimumGradedExposures: 1,
});

export function vocabularyMastery(
  evidence: Omit<VocabularyMasteryEvidence, "firstTryPercent" | "finalCorrectPercent" | "reason">,
): { status: VocabularyMasteryStatus; evidence: VocabularyMasteryEvidence } {
  const firstTryPercent = evidence.gradedExposures
    ? Math.round(evidence.correctFirstTry * 100 / evidence.gradedExposures)
    : null;
  const finalCorrectPercent = evidence.gradedExposures
    ? Math.round(evidence.finalCorrect * 100 / evidence.gradedExposures)
    : null;
  let status: VocabularyMasteryStatus;
  let reason: string;
  if (evidence.gradedExposures < VOCABULARY_MASTERY_POLICY.minimumGradedExposures) {
    status = "NOT_SEEN";
    reason = "Chưa có lượt làm được chấm điểm.";
  } else if (
    evidence.abandonedExposures > 0
    || evidence.finalCorrect < evidence.gradedExposures
  ) {
    status = "NEEDS_REVIEW";
    reason = "Có câu còn sai sau hỗ trợ hoặc lượt làm bỏ dở.";
  } else if ((firstTryPercent ?? 0) >= VOCABULARY_MASTERY_POLICY.masteredFirstTryPercent) {
    status = "MASTERED";
    reason = `Đúng lần đầu đạt ${firstTryPercent}% (ngưỡng ${VOCABULARY_MASTERY_POLICY.masteredFirstTryPercent}%).`;
  } else {
    status = "LEARNING";
    reason = "Đã hoàn thành sau hỗ trợ nhưng tỷ lệ đúng lần đầu chưa đạt ngưỡng.";
  }
  return {
    status,
    evidence: { ...evidence, firstTryPercent, finalCorrectPercent, reason },
  };
}
