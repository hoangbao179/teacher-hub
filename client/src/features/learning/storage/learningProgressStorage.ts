import { learningLevelSlugs, type LearningProgress, type LearningLevelSlug, type LearningUnit, type UnitLearningProgress } from "../types.ts";

export const LEARNING_PROGRESS_STORAGE_KEY = "covy-learning-progress:v1";
const MIGRATED_AT = "1970-01-01T00:00:00.000Z";

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type LegacyUnitProgress = { learnedItemIds?: unknown; totalItems?: unknown; completed?: unknown };

const emptyProgress = (): LearningProgress => ({ schemaVersion: 1, units: {} });
const uniqueStrings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
  : [];
const safeCount = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const isLevelSlug = (value: unknown): value is LearningLevelSlug =>
  typeof value === "string" && (learningLevelSlugs as readonly string[]).includes(value);

export const emptyUnitProgress = (contentVersion: number, updatedAt = new Date().toISOString()): UnitLearningProgress => ({
  contentVersion,
  viewedItemIds: [],
  rememberedItemIds: [],
  reviewItemIds: [],
  lastItemIndex: 0,
  listenCorrect: 0,
  listenTotal: 0,
  updatedAt,
});

function migrateUnitProgress(value: unknown): UnitLearningProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<UnitLearningProgress> & LegacyUnitProgress;
  const rememberedItemIds = uniqueStrings(item.rememberedItemIds ?? item.learnedItemIds);
  const reviewItemIds = uniqueStrings(item.reviewItemIds).filter((id) => !rememberedItemIds.includes(id));
  const viewedItemIds = uniqueStrings(item.viewedItemIds ?? item.learnedItemIds);
  const lastItemIndex = safeCount(item.lastItemIndex);
  const contentVersion = Math.max(1, safeCount(item.contentVersion) || 1);
  const updatedAt = typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : MIGRATED_AT;
  return {
    contentVersion,
    viewedItemIds,
    rememberedItemIds,
    reviewItemIds,
    lastItemIndex,
    ...(typeof item.flashcardCompletedAt === "string" && item.flashcardCompletedAt ? { flashcardCompletedAt: item.flashcardCompletedAt } : {}),
    listenCorrect: Math.min(safeCount(item.listenCorrect), safeCount(item.listenTotal)),
    listenTotal: safeCount(item.listenTotal),
    updatedAt,
  };
}

function resolveStorage(storage?: StorageAdapter | null): StorageAdapter | null {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function readLearningProgress(storage?: StorageAdapter | null): LearningProgress {
  const target = resolveStorage(storage);
  if (!target) return emptyProgress();
  try {
    const raw = target.getItem(LEARNING_PROGRESS_STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (parsed.schemaVersion !== 1 || !parsed.units || typeof parsed.units !== "object" || Array.isArray(parsed.units)) return emptyProgress();
    const units = Object.fromEntries(Object.entries(parsed.units).flatMap(([slug, value]) => {
      const migrated = migrateUnitProgress(value);
      return migrated ? [[slug, migrated]] : [];
    }));
    return {
      schemaVersion: 1,
      units,
      ...(isLevelSlug(parsed.lastLevelSlug) ? { lastLevelSlug: parsed.lastLevelSlug } : {}),
      ...(typeof parsed.lastUnitSlug === "string" && parsed.lastUnitSlug.trim() ? { lastUnitSlug: parsed.lastUnitSlug } : {}),
    };
  } catch { return emptyProgress(); }
}

export function writeLearningProgress(progress: LearningProgress, storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try { target.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}

export function unitProgressFor(progress: LearningProgress, unit: LearningUnit): UnitLearningProgress {
  const stored = progress.units[unit.slug];
  return stored?.contentVersion === unit.contentVersion ? stored : emptyUnitProgress(unit.contentVersion);
}

export function updateUnitProgress(
  unit: LearningUnit,
  update: (current: UnitLearningProgress) => UnitLearningProgress,
  storage?: StorageAdapter | null,
): LearningProgress {
  const progress = readLearningProgress(storage);
  const nextUnit = update(unitProgressFor(progress, unit));
  const next = { ...progress, lastLevelSlug: unit.levelSlug, lastUnitSlug: unit.slug, units: { ...progress.units, [unit.slug]: nextUnit } };
  writeLearningProgress(next, storage);
  return next;
}

export function rememberLearningLocation(levelSlug: LearningLevelSlug, unitSlug?: string, storage?: StorageAdapter | null): LearningProgress {
  const next = { ...readLearningProgress(storage), lastLevelSlug: levelSlug, ...(unitSlug ? { lastUnitSlug: unitSlug } : {}) };
  writeLearningProgress(next, storage);
  return next;
}

export function recordViewedItem(unit: LearningUnit, itemId: string, itemIndex: number, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    const viewedItemIds = uniqueStrings([...current.viewedItemIds, itemId]);
    const completed = viewedItemIds.length >= unit.vocabulary.length;
    return { ...current, viewedItemIds, lastItemIndex: Math.max(0, Math.min(itemIndex, unit.vocabulary.length - 1)), ...(completed && !current.flashcardCompletedAt ? { flashcardCompletedAt: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() };
  }, storage);
}

export function markVocabularyItem(unit: LearningUnit, itemId: string, state: "REMEMBERED" | "REVIEW", storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => ({
    ...current,
    viewedItemIds: uniqueStrings([...current.viewedItemIds, itemId]),
    rememberedItemIds: state === "REMEMBERED" ? uniqueStrings([...current.rememberedItemIds, itemId]) : current.rememberedItemIds.filter((id) => id !== itemId),
    reviewItemIds: state === "REVIEW" ? uniqueStrings([...current.reviewItemIds, itemId]) : current.reviewItemIds.filter((id) => id !== itemId),
    updatedAt: new Date().toISOString(),
  }), storage);
}

export function recordListenAnswer(unit: LearningUnit, correct: boolean, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => ({ ...current, listenCorrect: current.listenCorrect + (correct ? 1 : 0), listenTotal: current.listenTotal + 1, updatedAt: new Date().toISOString() }), storage);
}

export function resetUnitProgress(unitSlug: string, storage?: StorageAdapter | null): LearningProgress {
  const progress = readLearningProgress(storage);
  const units = { ...progress.units };
  delete units[unitSlug];
  const next = { ...progress, units, ...(progress.lastUnitSlug === unitSlug ? { lastUnitSlug: undefined } : {}) };
  writeLearningProgress(next, storage);
  return next;
}

export function resetLearningProgress(storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try { target.removeItem(LEARNING_PROGRESS_STORAGE_KEY); return true; } catch { return false; }
}
