import type { PageResult } from "./common.js";

export const learningAgeBands = [
  "PRESCHOOL_G1",
  "G2_G3",
  "G4_G5",
  "G6_G9",
] as const;
export type LearningAgeBand = (typeof learningAgeBands)[number];

export const vocabularyTiers = ["CORE", "EXTENDED", "CUSTOM"] as const;
export type VocabularyTier = (typeof vocabularyTiers)[number];

export const vocabularySetSourceTypes = [
  "TOPIC_CATALOG",
  "PUBLIC_UNIT",
  "COPIED",
  "MANUAL",
] as const;
export type VocabularySetSourceType = (typeof vocabularySetSourceTypes)[number];

export const vocabularyIllustrationKinds = [
  "NONE",
  "EMOJI",
  "PUBLIC_ASSET",
  "STORED_MEDIA",
] as const;
export type VocabularyIllustrationKind =
  (typeof vocabularyIllustrationKinds)[number];

export const vocabularySetStatuses = ["ACTIVE", "ARCHIVED"] as const;
export type VocabularySetStatus = (typeof vocabularySetStatuses)[number];

export interface VocabularyPageQuery {
  search?: string;
  ageBand?: LearningAgeBand;
  page?: number;
  pageSize?: number;
}

export interface VocabularyTopicListItem {
  id: number;
  slug: string;
  titleVi: string;
  descriptionVi: string | null;
  iconKey: string;
  ageBands: LearningAgeBand[];
  coreWordCount: number;
  extendedWordCount: number;
}

export interface VocabularyTopicWord {
  id: number;
  word: string;
  normalizedWord: string;
  meaningVi: string;
  normalizedMeaning: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  exampleEn: string | null;
  speechText: string;
  tier: Exclude<VocabularyTier, "CUSTOM">;
  priority: number;
  ageBands: LearningAgeBand[];
  supportsImageGame: boolean;
  imageSearchTerms: string[];
}

export interface VocabularyTopicDetail extends VocabularyTopicListItem {
  words: VocabularyTopicWord[];
}

export interface VocabularyTopicSuggestionRequest {
  topicSlug: string;
  ageBand: LearningAgeBand;
  targetCount: number;
}

export interface VocabularyTopicSuggestionItem extends VocabularyTopicWord {
  selected: boolean;
}

export interface VocabularyTopicSuggestion {
  topic: VocabularyTopicListItem;
  ageBand: LearningAgeBand;
  targetCount: number;
  items: VocabularyTopicSuggestionItem[];
  selectedCount: number;
}

export interface VocabularyIllustrationInput {
  kind: VocabularyIllustrationKind;
  value?: string;
  mediaId?: number;
}

export interface VocabularySetItemInput {
  id?: number;
  sourceTopicWordId?: number;
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
}

export interface VocabularySetItem extends VocabularySetItemInput {
  id: number;
  normalizedWord: string;
  normalizedMeaning: string;
}

export interface TopicCatalogSourceReference {
  topicSlug: string;
}

export interface PublicUnitSourceReference {
  unitId: string;
  levelSlug: string;
  contentVersion: number;
}

export interface CopiedSetSourceReference {
  copiedSetId: number;
}

export type VocabularySourceReference =
  | TopicCatalogSourceReference
  | PublicUnitSourceReference
  | CopiedSetSourceReference;

export interface CreateVocabularySetRequest {
  title: string;
  description?: string;
  sourceType: VocabularySetSourceType;
  sourceReference?: VocabularySourceReference;
  ageBand: LearningAgeBand;
  items: VocabularySetItemInput[];
}

export interface UpdateVocabularySetRequest {
  title: string;
  description?: string;
  ageBand: LearningAgeBand;
  items: VocabularySetItemInput[];
}

export interface DuplicateVocabularySetRequest {
  title?: string;
}

export interface ImportPublicUnitVocabularyItem {
  id: string;
  word: string;
  meaningVi: string;
  phonetic?: string;
  speechText?: string;
  exampleEn?: string;
  illustration: VocabularyIllustrationInput;
}

export interface ImportPublicUnitSnapshotRequest {
  unitId: string;
  levelSlug: string;
  contentVersion: number;
  title: string;
  description?: string;
  ageBand: LearningAgeBand;
  items: ImportPublicUnitVocabularyItem[];
}

export interface VocabularySetListItem {
  id: number;
  title: string;
  description: string | null;
  sourceType: VocabularySetSourceType;
  sourceReference: VocabularySourceReference | null;
  ageBand: LearningAgeBand;
  status: VocabularySetStatus;
  itemCount: number;
  updatedAt: string;
}

export interface VocabularySetDetail extends VocabularySetListItem {
  items: VocabularySetItem[];
}

export type VocabularyTopicPage = PageResult<VocabularyTopicListItem>;
export type VocabularySetPage = PageResult<VocabularySetListItem>;

export type VocabularyErrorCode =
  | "TOPIC_NOT_FOUND"
  | "VOCABULARY_SET_NOT_FOUND"
  | "VOCABULARY_SET_ARCHIVED"
  | "DUPLICATE_VOCABULARY_ITEM"
  | "VOCABULARY_LIMIT_EXCEEDED"
  | "INVALID_AGE_BAND"
  | "VALIDATION_ERROR";

export interface VocabularyPastePreviewRow {
  sourceLine: number;
  word: string;
  meaningVi: string;
  valid: boolean;
  error?: string;
}

export interface VocabularyPastePreview {
  rows: VocabularyPastePreviewRow[];
  validCount: number;
  invalidCount: number;
}
