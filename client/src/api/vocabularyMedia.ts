import type {
  ImportVocabularyMediaRequest,
  VocabularyImageMediaType,
  VocabularyImageOrientation,
  VocabularyImageProvider,
  VocabularyMediaSearchResponse,
  VocabularyStoredMedia,
} from "@teacher/shared";
import { api, apiUrl } from "./client";

export interface VocabularyMediaProviderStatus {
  enabled: boolean;
  provider: VocabularyImageProvider | null;
  cooldownUntil?: string;
  providers: Array<{
    provider: VocabularyImageProvider;
    enabled: boolean;
    cooldownUntil?: string;
  }>;
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

export function uploadVocabularyMedia(file: File, altText: string) {
  const body = new FormData();
  body.append("image", file);
  body.append("altText", altText);
  return api<VocabularyStoredMedia>("/api/vocabulary/media/upload", { method: "POST", body });
}

export const vocabularyMediaUrl = (mediaId: number, variant: "GAME" | "THUMBNAIL") =>
  apiUrl(`/api/public/vocabulary-media/${mediaId}?variant=${variant}`);
