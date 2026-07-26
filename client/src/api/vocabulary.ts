import type {
  CreateVocabularySetRequest,
  DuplicateVocabularySetRequest,
  ImportPublicUnitSnapshotRequest,
  LearningAgeBand,
  UpdateVocabularySetRequest,
  VocabularySetDetail,
  VocabularySetListItem,
  VocabularyTopicListItem,
  VocabularyTopicSuggestion,
} from "@teacher/shared";
import { api, apiEnvelope } from "./client";

const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : "";
};

export async function listVocabularyTopics(values: {
  search?: string;
  ageBand?: LearningAgeBand;
  page?: number;
  pageSize?: number;
}) {
  return apiEnvelope<VocabularyTopicListItem[]>(
    `/api/vocabulary/topics${query(values)}`,
  );
}

export async function suggestVocabularyTopic(values: {
  topicSlug: string;
  ageBand: LearningAgeBand;
  targetCount: number;
}) {
  return api<VocabularyTopicSuggestion>("/api/vocabulary/topic-suggestions", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export async function listVocabularySets(values: {
  search?: string;
  ageBand?: LearningAgeBand;
  page?: number;
  pageSize?: number;
}) {
  return apiEnvelope<VocabularySetListItem[]>(
    `/api/vocabulary/sets${query(values)}`,
  );
}

export const getVocabularySet = (id: number) =>
  api<VocabularySetDetail>(`/api/vocabulary/sets/${id}`);

export const createVocabularySet = (values: CreateVocabularySetRequest) =>
  api<VocabularySetDetail>("/api/vocabulary/sets", {
    method: "POST",
    body: JSON.stringify(values),
  });

export const updateVocabularySet = (
  id: number,
  values: UpdateVocabularySetRequest,
) =>
  api<VocabularySetDetail>(`/api/vocabulary/sets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });

export const duplicateVocabularySet = (
  id: number,
  values: DuplicateVocabularySetRequest = {},
) =>
  api<VocabularySetDetail>(`/api/vocabulary/sets/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(values),
  });

export const archiveVocabularySet = (id: number) =>
  api<void>(`/api/vocabulary/sets/${id}/archive`, { method: "POST" });

export const importPublicUnitSnapshot = (
  values: ImportPublicUnitSnapshotRequest,
) =>
  api<VocabularySetDetail>("/api/vocabulary/sets/import-public-unit", {
    method: "POST",
    body: JSON.stringify(values),
  });
