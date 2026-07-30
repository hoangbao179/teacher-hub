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

export const vocabularyImageMediaTypes = [
  "ALL",
  "PHOTO",
  "ILLUSTRATION",
  "VECTOR",
] as const;
export type VocabularyImageMediaType =
  (typeof vocabularyImageMediaTypes)[number];

export const vocabularyImageOrientations = [
  "ALL",
  "HORIZONTAL",
  "VERTICAL",
] as const;
export type VocabularyImageOrientation =
  (typeof vocabularyImageOrientations)[number];

export const vocabularyImageProviders = [
  "ARASAAC",
  "PIXABAY",
  "LOCAL_ASSET",
  "USER_UPLOAD",
] as const;
export type VocabularyImageProvider =
  (typeof vocabularyImageProviders)[number];

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
  imageSearchTerms?: string[];
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

export interface VocabularyMediaSearchQuery {
  query: string;
  page?: number;
  pageSize?: number;
  mediaType?: VocabularyImageMediaType;
  orientation?: VocabularyImageOrientation;
}

export interface VocabularyMediaSearchItem {
  provider: VocabularyImageProvider;
  providerAssetId: string;
  previewUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mediaType: Exclude<VocabularyImageMediaType, "ALL">;
  contributorName: string;
  attributionText: string;
  sourcePageUrl: string;
}

export interface VocabularyMediaSearchResponse {
  provider: VocabularyImageProvider;
  safeSearch: true;
  cacheExpiresAt: string;
  page: number;
  pageSize: number;
  total: number;
  items: VocabularyMediaSearchItem[];
  cooldownUntil?: string;
}

export interface ImportVocabularyMediaRequest {
  provider: VocabularyImageProvider;
  providerAssetId: string;
  altText: string;
}

export interface VocabularyStoredMedia {
  id: number;
  provider: VocabularyImageProvider;
  providerAssetId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  byteSize: number;
  altText: string;
  contributorName: string;
  attributionText: string;
  sourcePageUrl: string;
  licenseLabel: string;
}

export interface VocabularyMediaMetrics {
  mediaCount: number;
  referencedCount: number;
  orphanCount: number;
  totalBytes: number;
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
  | "IMAGE_PROVIDER_DISABLED"
  | "IMAGE_PROVIDER_UNAVAILABLE"
  | "IMAGE_CACHE_MISS"
  | "IMAGE_IMPORT_REJECTED"
  | "IMAGE_IMPORT_SOURCE_RATE_LIMITED"
  | "IMAGE_IMPORT_SOURCE_UNAVAILABLE"
  | "IMAGE_IMPORT_TIMEOUT"
  | "IMAGE_IMPORT_INVALID_CONTENT_TYPE"
  | "IMAGE_IMPORT_TOO_LARGE"
  | "IMAGE_IMPORT_INVALID_DIMENSIONS"
  | "IMAGE_IMPORT_CONTENT_MISMATCH"
  | "IMAGE_IMPORT_UNSAFE_REDIRECT"
  | "VOCABULARY_MEDIA_NOT_FOUND"
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
