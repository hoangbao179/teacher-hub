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
    if (!Number.isInteger(unit.contentVersion) || unit.contentVersion < 1) errors.push(`Unit ${unit.id} có contentVersion không hợp lệ`);
    if (unit.status === "PUBLISHED" && unit.vocabulary.length < 6) errors.push(`Unit ${unit.id} phải có ít nhất 6 từ`);
    seenUnitIds.add(unit.id);
    seenUnitSlugs.add(unit.slug);
    for (const item of unit.vocabulary) {
      if (seenVocabularyIds.has(item.id)) errors.push(`Vocabulary id trùng: ${item.id}`);
      if (!item.word.trim() || !item.vietnameseMeaning.trim()) errors.push(`Vocabulary ${item.id} thiếu từ hoặc nghĩa`);
      if (!item.audio && !item.speechText) errors.push(`Vocabulary ${item.id} thiếu audio hoặc speechText`);
      if (!validMedia(item.image) || (item.audio && !validMedia(item.audio))) errors.push(`Vocabulary ${item.id} có asset path không hợp lệ`);
      seenVocabularyIds.add(item.id);
    }
  }
  return errors;
}

export function assertValidLearningCatalog(levels: readonly LearningLevel[], units: readonly LearningUnit[]): void {
  const errors = validateLearningCatalog(levels, units);
  if (errors.length) throw new Error(`Learning catalog không hợp lệ:\n${errors.join("\n")}`);
}
