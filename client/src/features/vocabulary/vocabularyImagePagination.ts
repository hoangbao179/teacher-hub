import type { VocabularyMediaSearchItem } from "@teacher/shared";

export const VOCABULARY_IMAGE_PAGE_SIZE = 8;
export const VOCABULARY_IMAGE_LIMIT = 24;

export function appendUniqueVocabularyImages(
  current: VocabularyMediaSearchItem[],
  incoming: VocabularyMediaSearchItem[],
): VocabularyMediaSearchItem[] {
  const byAssetId = new Map(current.map((item) => [item.providerAssetId, item]));
  incoming.forEach((item) => {
    if (!byAssetId.has(item.providerAssetId)) byAssetId.set(item.providerAssetId, item);
  });
  return [...byAssetId.values()].slice(0, VOCABULARY_IMAGE_LIMIT);
}
