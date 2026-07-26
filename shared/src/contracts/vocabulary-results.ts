import type { AssignmentStatus } from "./assignments.js";
import type { PageResult } from "./common.js";

export const vocabularyMasteryStatuses = [
  "MASTERED",
  "LEARNING",
  "NEEDS_REVIEW",
  "NOT_SEEN",
] as const;
export type VocabularyMasteryStatus = (typeof vocabularyMasteryStatuses)[number];

export interface VocabularyMasteryEvidence {
  gradedExposures: number;
  correctFirstTry: number;
  finalCorrect: number;
  abandonedExposures: number;
  firstTryPercent: number | null;
  finalCorrectPercent: number | null;
  reason: string;
}

export interface AssignmentResultSummary {
  assignmentId: number;
  assignmentStatus: AssignmentStatus;
  audienceType: "CLASS" | "SELECTED_STUDENTS" | "OPEN_LINK";
  assigned: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  completionPercent: number;
  masteredWords: number;
  needsReviewWords: number;
  totalAttempts: number;
  averageScore: number | null;
  passedCount: number | null;
  guest: {
    attempts: number;
    completed: number;
    gradedExposures: number;
  };
}

export interface AssignmentRecipientResult {
  recipientId: number;
  studentId: number;
  studentName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  attemptCount: number;
  startedAt: string | null;
  completedAt: string | null;
  latestScore: number | null;
  bestScore: number | null;
  correctFirstTry: number;
  finalCorrect: number;
  gradedExposures: number;
  firstTryPercent: number | null;
  finalCorrectPercent: number | null;
  needsReviewWords: number;
  lastActivityAt: string | null;
}

export interface AssignmentVocabularyResult {
  assignmentItemId: number;
  word: string;
  meaningVi: string;
  studentsSeen: number;
  exposureCount: number;
  retryCount: number;
  firstTryErrorPercent: number | null;
  finalErrorPercent: number | null;
  mastery: VocabularyMasteryStatus;
  evidence: VocabularyMasteryEvidence;
  guestEvidence: Omit<VocabularyMasteryEvidence, "reason">;
}

export interface AssignmentRecipientResultDetail extends AssignmentRecipientResult {
  attempts: Array<{
    attemptId: number;
    attemptNumber: number;
    status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
    startedAt: string;
    completedAt: string | null;
    scorePercent: number | null;
    gradedExposures: number;
    correctFirstTry: number;
    finalCorrect: number;
  }>;
  activities: Array<{
    mechanic: string;
    gradedExposures: number;
    correctFirstTry: number;
    finalCorrect: number;
    retryCount: number;
  }>;
  words: Array<AssignmentVocabularyResult & {
    mastery: VocabularyMasteryStatus;
  }>;
}

export interface AssignmentResultListQuery {
  search?: string;
  mastery?: VocabularyMasteryStatus;
  status?: AssignmentRecipientResult["status"];
  sort?: "NAME" | "LAST_ACTIVITY" | "COMPLETED_AT" | "LATEST_SCORE" | "FIRST_TRY" | "MASTERY";
  direction?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}

export interface CreateVocabularyReviewDraftRequest {
  assignmentItemIds: number[];
  recipientIds: number[];
  title?: string;
}

export interface VocabularyReviewDraftResult {
  id: number;
  status: "DRAFT";
  sourceAssignmentId: number;
  itemCount: number;
  recipientCount: number;
}

export type AssignmentRecipientResultPage = PageResult<AssignmentRecipientResult>;
export type AssignmentVocabularyResultPage = PageResult<AssignmentVocabularyResult>;
