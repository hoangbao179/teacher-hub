import type { PageResult } from "./common.js";
import type {
  LearningAgeBand,
  VocabularyIllustrationInput,
  VocabularyTier,
} from "./vocabulary.js";

export const assignmentStatuses = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];

export const assignmentAudienceTypes = [
  "CLASS",
  "SELECTED_STUDENTS",
  "OPEN_LINK",
] as const;
export type AssignmentAudienceType = (typeof assignmentAudienceTypes)[number];

export const answerFeedbackModes = ["IMMEDIATE", "AFTER_COMPLETION"] as const;
export type AnswerFeedbackMode = (typeof answerFeedbackModes)[number];

export const assignmentTemplateCodes = [
  "YOUNG_BEGINNER",
  "WORD_RECOGNITION",
  "SPELLING_REVIEW",
  "PRE_TEST_REVIEW",
  "CUSTOM",
] as const;
export type AssignmentTemplateCode = (typeof assignmentTemplateCodes)[number];

export const gameMechanics = [
  "EXPLORE_CARD",
  "SELECT_ONE",
  "MATCH_PAIRS",
  "MEMORY_PAIRS",
  "ORDER_TOKENS",
  "BUILD_WORD",
  "SORT_ITEMS",
  "REPEAT_AUDIO",
] as const;
export type GameMechanic = (typeof gameMechanics)[number];

export const gamePresentations = [
  "FLASHCARD",
  "LISTEN_PICK_IMAGE",
  "IMAGE_PICK_WORD",
  "LISTEN_PICK_WORD",
  "WORD_PICK_MEANING",
  "MEANING_PICK_WORD",
  "MATCH_WORD_IMAGE",
  "MATCH_WORD_MEANING",
  "MEMORY_WORD_IMAGE",
  "MEMORY_WORD_MEANING",
  "MISSING_LETTER",
  "BUILD_SPELLED_WORD",
  "FEED_MONSTER",
  "POP_BALLOON",
  "OPEN_TREASURE",
  "CHOOSE_TRAIN_CARRIAGE",
] as const;
export type GamePresentation = (typeof gamePresentations)[number];

export interface AssignmentActivityInput {
  displayOrder: number;
  mechanic: GameMechanic;
  presentation: GamePresentation;
  required: boolean;
  config?: Record<string, unknown>;
}

export interface AssignmentVocabularyItemInput {
  sourceVocabularyItemId?: number;
  displayOrder: number;
  word: string;
  meaningVi: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleEn?: string;
  speechText?: string;
  tier: VocabularyTier;
  illustration: VocabularyIllustrationInput;
  supportsImageGame: boolean;
  imageSearchTerms?: string[];
}

export interface AssignmentDraftInput {
  title: string;
  instruction?: string;
  vocabularySetId?: number;
  ageBand: LearningAgeBand;
  audienceType?: AssignmentAudienceType;
  classId?: number;
  selectedStudentIds?: number[];
  templateCode: AssignmentTemplateCode;
  availableFrom?: string;
  dueAt?: string;
  maxAttempts?: number;
  passScore?: number;
  answerFeedbackMode: AnswerFeedbackMode;
  shuffleQuestions: boolean;
  items: AssignmentVocabularyItemInput[];
  activities: AssignmentActivityInput[];
}

export type CreateAssignmentDraftRequest = AssignmentDraftInput;
export interface UpdateAssignmentDraftRequest extends AssignmentDraftInput {
  version: number;
}

export interface AssignmentListQuery {
  search?: string;
  status?: AssignmentStatus;
  audienceType?: AssignmentAudienceType;
  ageBand?: LearningAgeBand;
  page?: number;
  pageSize?: number;
}

export interface AssignmentListItem {
  id: number;
  title: string;
  status: AssignmentStatus;
  audienceType: AssignmentAudienceType | null;
  ageBand: LearningAgeBand;
  dueAt: string | null;
  recipientCount: number;
  itemCount: number;
  version: number;
  updatedAt: string;
}

export interface AssignmentSnapshotItem extends AssignmentVocabularyItemInput {
  id: number;
  normalizedWord: string;
  illustrationSnapshot: VocabularyIllustrationInput & {
    mediaUrl?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    altText?: string;
    attributionText?: string;
    sourcePageUrl?: string;
  };
}

export interface AssignmentActivity extends AssignmentActivityInput {
  id: number;
}

export interface AssignmentDetail extends AssignmentListItem {
  instruction: string | null;
  teacherUserId: number;
  vocabularySetId: number | null;
  classId: number | null;
  selectedStudentIds: number[];
  publicCode: string | null;
  templateCode: AssignmentTemplateCode;
  availableFrom: string | null;
  maxAttempts: number | null;
  passScore: number | null;
  answerFeedbackMode: AnswerFeedbackMode;
  shuffleQuestions: boolean;
  publishedAt: string | null;
  closedAt: string | null;
  items: AssignmentSnapshotItem[];
  activities: AssignmentActivity[];
}

export interface PublishAssignmentRequest {
  version: number;
}

export interface ExtendAssignmentDueDateRequest {
  dueAt: string | null;
}

export interface DuplicateAssignmentRequest {
  title?: string;
}

export interface AssignmentRecipient {
  id: number;
  studentId: number;
  studentName: string;
  assignedAt: string;
  tokenRevokedAt: string | null;
  completedAt: string | null;
}

export interface AssignmentShare {
  recipientId?: number;
  studentId?: number;
  studentName?: string;
  shareUrl: string;
  accessToken: string;
  qrSvg: string;
}

export interface PublishAssignmentResult {
  assignment: AssignmentDetail;
  shares: AssignmentShare[];
}

export interface RegenerateAssignmentAccessRequest {
  recipientId?: number;
}

export interface AssignmentPreviewPayload {
  banner: "XEM_TRUOC";
  assignment: AssignmentDetail;
  estimatedMinutes: number;
  warnings: string[];
}

export type AssignmentPage = PageResult<AssignmentListItem>;

export type AssignmentErrorCode =
  | "ASSIGNMENT_NOT_FOUND"
  | "ASSIGNMENT_NOT_EDITABLE"
  | "ASSIGNMENT_ALREADY_PUBLISHED"
  | "ASSIGNMENT_CLOSED"
  | "ASSIGNMENT_VERSION_CONFLICT"
  | "INVALID_ASSIGNMENT_AUDIENCE"
  | "ASSIGNMENT_HAS_NO_RECIPIENTS"
  | "ASSIGNMENT_HAS_NO_ITEMS"
  | "ASSIGNMENT_HAS_NO_ACTIVITIES"
  | "ACTIVITY_REQUIRES_IMAGES"
  | "INVALID_DUE_DATE"
  | "VOCABULARY_SET_NOT_FOUND"
  | "VOCABULARY_ITEM_NOT_FOUND"
  | "VOCABULARY_MEDIA_NOT_FOUND"
  | "CLASS_NOT_FOUND"
  | "STUDENT_NOT_FOUND";
