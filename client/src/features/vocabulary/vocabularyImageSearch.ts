import type { VocabularyMediaSearchItem, VocabularyMediaSearchResponse } from "@teacher/shared";
import { searchVocabularyMedia } from "../../api/vocabularyMedia";
import type { VocabularyImageFilter, VocabularyImageStrategy } from "./vocabularyImageStrategy";

function deduplicate(items: VocabularyMediaSearchItem[]): VocabularyMediaSearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.provider}:${item.providerAssetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchVocabularyImageSuggestions(input: {
  strategy: VocabularyImageStrategy;
  query: string;
  mediaType: VocabularyImageFilter;
  pageSize: number;
}): Promise<VocabularyMediaSearchResponse> {
  const primary = await searchVocabularyMedia({ query: input.query, mediaType: input.mediaType, pageSize: input.pageSize });
  if (input.strategy.category !== "NOUN" || input.mediaType !== "ILLUSTRATION" || primary.items.length >= 3)
    return primary;
  const fallback = await searchVocabularyMedia({ query: input.query, mediaType: "PHOTO", pageSize: input.pageSize });
  return { ...primary, total: primary.total + fallback.total, items: deduplicate([...primary.items, ...fallback.items]).slice(0, input.pageSize) };
}
