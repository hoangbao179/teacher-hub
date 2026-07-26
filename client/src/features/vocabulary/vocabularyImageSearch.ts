import type { VocabularyMediaSearchResponse } from "@teacher/shared";
import { searchVocabularyMedia } from "../../api/vocabularyMedia";
import type { VocabularyImageFilter, VocabularyImageStrategy } from "./vocabularyImageStrategy";

export async function searchVocabularyImageSuggestions(input: {
  strategy: VocabularyImageStrategy;
  query: string;
  mediaType: VocabularyImageFilter;
  pageSize: number;
  signal?: AbortSignal;
}): Promise<VocabularyMediaSearchResponse> {
  return searchVocabularyMedia({
    query: input.query,
    mediaType: input.mediaType,
    pageSize: input.pageSize,
  }, input.signal);
}
