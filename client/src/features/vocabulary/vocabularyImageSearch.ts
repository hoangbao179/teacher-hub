import type { VocabularyMediaSearchResponse } from "@teacher/shared";
import { searchVocabularyMedia } from "../../api/vocabularyMedia";
import type { VocabularyImageFilter, VocabularyImageStrategy } from "./vocabularyImageStrategy";
import { executeVocabularyImageSearch } from "./vocabularyImageSearchPolicy";

export async function searchVocabularyImageSuggestions(input: {
  strategy: VocabularyImageStrategy;
  query: string;
  mediaType: VocabularyImageFilter;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
  allowFallback?: boolean;
  search?: typeof searchVocabularyMedia;
}): Promise<VocabularyMediaSearchResponse> {
  const customQuery = input.query.trim();
  const search = input.search ?? searchVocabularyMedia;
  const fallback = input.strategy.queries.find((query) => query !== customQuery);
  return executeVocabularyImageSearch({
    query: customQuery,
    fallbackQuery: fallback,
    allowFallback: input.page === 1 && input.allowFallback !== false &&
      customQuery === input.strategy.query,
    search: (query) => search({
      query, mediaType: input.mediaType, page: input.page, pageSize: input.pageSize,
    }, input.signal),
  });
}
