import type { LearningLevel, LearningUnit } from "../types.ts";

const validMedia = (value: string) => !value.includes("/") || value.startsWith("/") || /^https:\/\//.test(value);

export function validateLearningCatalog(levels: readonly LearningLevel[], units: readonly LearningUnit[]): string[] {
  const errors: string[] = [];
  const seenLevelSlugs = new Set<string>();
  const seenUnitIds = new Set<string>();
  const seenUnitSlugs = new Set<string>();
  const seenVocabularyIds = new Set<string>();

  for (const level of levels) {
    if (seenLevelSlugs.has(level.slug)) errors.push(`Level slug trùng: ${level.slug}`);
    seenLevelSlugs.add(level.slug);
  }
  for (const unit of units) {
    if (seenUnitIds.has(unit.id)) errors.push(`Unit id trùng: ${unit.id}`);
    if (seenUnitSlugs.has(unit.slug)) errors.push(`Unit slug trùng: ${unit.slug}`);
    if (!seenLevelSlugs.has(unit.levelSlug)) errors.push(`Unit ${unit.id} tham chiếu level không tồn tại: ${unit.levelSlug}`);
    if (!unit.title.trim()) errors.push(`Unit ${unit.id} thiếu title`);
    if (!unit.description.trim()) errors.push(`Unit ${unit.id} thiếu description`);
    if (!Number.isInteger(unit.contentVersion) || unit.contentVersion < 1) errors.push(`Unit ${unit.id} có contentVersion không hợp lệ`);
    if (unit.status === "PUBLISHED" && unit.vocabulary.length < 6) errors.push(`Unit ${unit.id} phải có ít nhất 6 từ`);
    seenUnitIds.add(unit.id);
    seenUnitSlugs.add(unit.slug);
    const seenWords = new Set<string>();
    const seenMeanings = new Set<string>();
    for (const item of unit.vocabulary) {
      const normalizedWord = item.word.trim().toLocaleLowerCase("en-US");
      const normalizedMeaning = item.vietnameseMeaning.trim().toLocaleLowerCase("vi-VN");
      const itemLabel = `${item.id || "thiếu-id"} (${item.word || "thiếu-word"})`;
      if (!item.id.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu id`);
      if (seenVocabularyIds.has(item.id)) errors.push(`Unit ${unit.id}, từ ${itemLabel}: Vocabulary id trùng: ${item.id}`);
      if (!item.word.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu word`);
      if (!item.phonetic.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu phonetic`);
      if (!item.vietnameseMeaning.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu vietnameseMeaning`);
      if (!item.image.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu image`);
      if (!item.audio?.trim() && !item.speechText?.trim()) errors.push(`Unit ${unit.id}, từ ${itemLabel}: thiếu audio hoặc speechText`);
      if (normalizedWord && seenWords.has(normalizedWord)) errors.push(`Unit ${unit.id}, từ ${itemLabel}: word trùng trong Unit: ${item.word}`);
      if (normalizedMeaning && seenMeanings.has(normalizedMeaning)) errors.push(`Unit ${unit.id}, từ ${itemLabel}: nghĩa tiếng Việt trùng trong Unit: ${item.vietnameseMeaning}`);
      if (!validMedia(item.image) || (item.audio && !validMedia(item.audio))) errors.push(`Unit ${unit.id}, từ ${itemLabel}: asset path không hợp lệ`);
      seenVocabularyIds.add(item.id);
      if (normalizedWord) seenWords.add(normalizedWord);
      if (normalizedMeaning) seenMeanings.add(normalizedMeaning);
    }
  }
  return errors;
}

export function assertValidLearningCatalog(levels: readonly LearningLevel[], units: readonly LearningUnit[]): void {
  const errors = validateLearningCatalog(levels, units);
  if (errors.length) throw new Error(`Learning catalog không hợp lệ:\n${errors.join("\n")}`);
}
