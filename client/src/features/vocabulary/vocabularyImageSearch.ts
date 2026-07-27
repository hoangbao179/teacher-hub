import type { VocabularyMediaSearchResponse } from "@teacher/shared";
import { searchVocabularyMedia } from "../../api/vocabularyMedia";
import { appendUniqueVocabularyImages } from "./vocabularyImagePagination";
import type { VocabularyImageFilter, VocabularyImageStrategy } from "./vocabularyImageStrategy";

export async function searchVocabularyImageSuggestions(input: {
  strategy: VocabularyImageStrategy;
  query: string;
  mediaType: VocabularyImageFilter;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}): Promise<VocabularyMediaSearchResponse> {
  const customQuery = input.query.trim();
  const fallbacks = input.page === 1 && customQuery === input.strategy.query
    ? input.strategy.queries
    : [customQuery];
  let combined: VocabularyMediaSearchResponse | undefined;
  for (const query of fallbacks) {
    const result = await searchVocabularyMedia({
      query, mediaType: input.mediaType, page: input.page, pageSize: input.pageSize,
    }, input.signal);
    combined = combined ? {
      ...combined,
      total: Math.max(combined.total, combined.items.length + result.total),
      items: appendUniqueVocabularyImages(combined.items, result.items).slice(0, input.pageSize),
    } : result;
    if (combined.items.length >= input.pageSize) break;
  }
  return combined!;
}
