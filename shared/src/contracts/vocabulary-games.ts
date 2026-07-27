import type {
  AnswerFeedbackMode,
  AssignmentAudienceType,
  GameMechanic,
  GamePresentation,
} from "./assignments.js";
import type {
  LearningAgeBand,
  VocabularyIllustrationInput,
} from "./vocabulary.js";

export const learningAttemptStatuses = [
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
] as const;
export type LearningAttemptStatus = (typeof learningAttemptStatuses)[number];

export type LearningQuestionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "ANSWERED"
  | "SKIPPED"
  | "CONDITIONAL";

export interface PublicAssignmentSummary {
  publicCode: string;
  title: string;
  instruction: string | null;
  ageBand: LearningAgeBand;
  audienceType: AssignmentAudienceType;
  itemCount: number;
  estimatedMinutes: number;
  availableFrom: string | null;
  dueAt: string | null;
}

export interface PublicAssignmentAccessRequest {
  accessToken: string;
  guestName?: string;
}

export interface PublicAssignmentAccess {
  sessionToken: string;
  expiresAt: string;
  audienceType: AssignmentAudienceType;
  displayName?: string;
  attemptsUsed: number | null;
  maxAttempts: number | null;
}

export interface StartLearningAttemptRequest {
  sessionToken: string;
}

export interface PublicGameOption {
  id: string;
  label?: string;
  matchKey?: string;
  illustration?: VocabularyIllustrationInput & {
    mediaUrl?: string;
    thumbnailUrl?: string;
    altText?: string;
  };
}

export interface PublicGamePrompt {
  instruction: string;
  word?: string;
  meaningVi?: string;
  phonetic?: string;
  exampleEn?: string;
  speechText?: string;
  maskedWord?: string;
  illustration?: PublicGameOption["illustration"];
  pairs?: Array<{
    id: string;
    label?: string;
    matchKey?: string;
    illustration?: PublicGameOption["illustration"];
  }>;
}

export interface PublicLearningQuestion {
  id: number;
  sequenceNumber: number;
  mechanic: GameMechanic;
  presentation: GamePresentation;
  prompt: PublicGamePrompt;
  options: PublicGameOption[];
  graded: boolean;
  questionKind: "PRIMARY" | "REVIEW" | "EXPOSURE";
  scoreWeight: 0 | 1;
  answerSequence: number;
  status: "PENDING" | "IN_PROGRESS";
}

export interface LearningAttemptProgress {
  completedQuestions: number;
  totalQuestions: number;
  label: string;
}

export interface PublicLearningAttempt {
  attemptId: number;
  sessionToken: string;
  sessionExpiresAt: string;
  status: LearningAttemptStatus;
  ageBand: LearningAgeBand;
  answerFeedbackMode: AnswerFeedbackMode;
  displayName?: string;
  progress: LearningAttemptProgress;
  currentQuestion: PublicLearningQuestion | null;
  generationWarnings: string[];
}

export interface SubmitLearningAnswerRequest {
  questionId: number;
  clientAnswerId: string;
  answerSequence: number;
  submittedAnswer: Record<string, unknown>;
}

export interface SubmitLearningAnswerResult {
  clientAnswerId: string;
  questionId: number;
  isCorrect: boolean | null;
  firstAttemptCorrect: boolean | null;
  finalCorrect: boolean | null;
  retryCount: number;
  idempotent: boolean;
  shouldRetry: boolean;
  feedback: {
    tone: "POSITIVE" | "TRY_AGAIN" | "CONTINUE";
    message: string;
    revealCorrectAnswer?: string;
  };
  attempt: PublicLearningAttempt;
}

export interface CompleteLearningAttemptResult {
  attemptId: number;
  status: "COMPLETED";
  stars: number;
  sticker: string;
  message: string;
  ageBand: LearningAgeBand;
  resultMode: "CHILD_REWARD" | "SCORE";
  gradedExposureCount: number;
  firstTryCorrectCount: number;
  finalCorrectCount: number;
  scorePercent: number | null;
  passScore: number | null;
  passed: boolean | null;
  rememberedCount: number;
  reviewRequestedCount: number;
  canPlayAgain: boolean;
  reviewWords: Array<{
    word: string;
    meaningVi: string;
  }>;
}

export type VocabularyGameErrorCode =
  | "PUBLIC_ASSIGNMENT_UNAVAILABLE"
  | "PUBLIC_ACCESS_DENIED"
  | "PUBLIC_SESSION_EXPIRED"
  | "ATTEMPT_LIMIT_REACHED"
  | "ATTEMPT_NOT_FOUND"
  | "ATTEMPT_NOT_PLAYABLE"
  | "QUESTION_NOT_CURRENT"
  | "ANSWER_SEQUENCE_CONFLICT"
  | "ANSWER_IDEMPOTENCY_CONFLICT"
  | "ATTEMPT_INCOMPLETE"
  | "CONTENT_NOT_PLAYABLE"
  | "PUBLIC_GAME_RATE_LIMITED";
