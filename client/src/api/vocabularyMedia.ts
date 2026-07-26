import type {
  ImportVocabularyMediaRequest,
  VocabularyImageMediaType,
  VocabularyImageOrientation,
  VocabularyMediaSearchResponse,
  VocabularyStoredMedia,
} from "@teacher/shared";
import { api, apiUrl } from "./client";

export interface VocabularyMediaProviderStatus {
  enabled: boolean;
  provider: "PIXABAY";
}

export const getVocabularyMediaStatus = (signal?: AbortSignal) =>
  api<VocabularyMediaProviderStatus>("/api/vocabulary/media/status", { signal });

export function searchVocabularyMedia(values: {
  query: string;
  page?: number;
  pageSize?: number;
  mediaType?: VocabularyImageMediaType;
  orientation?: VocabularyImageOrientation;
}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return api<VocabularyMediaSearchResponse>(
    `/api/vocabulary/media/search?${params.toString()}`,
    { signal },
  );
}

export const importVocabularyMedia = (values: ImportVocabularyMediaRequest) =>
  api<VocabularyStoredMedia>("/api/vocabulary/media/import", {
    method: "POST",
    body: JSON.stringify(values),
  });

export const vocabularyMediaUrl = (mediaId: number, variant: "GAME" | "THUMBNAIL") =>
  apiUrl(`/api/public/vocabulary-media/${mediaId}?variant=${variant}`);
