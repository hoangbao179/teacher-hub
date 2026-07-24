import { learningLevelSlugs, type LearningProgress, type LearningLevelSlug, type UnitLearningProgress } from "../types.ts";

export const LEARNING_PROGRESS_STORAGE_KEY = "covy-learning-progress:v1";

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const emptyProgress = (): LearningProgress => ({ schemaVersion: 1, units: {} });
const isLevelSlug = (value: unknown): value is LearningLevelSlug =>
  typeof value === "string" && (learningLevelSlugs as readonly string[]).includes(value);

function validUnitProgress(value: unknown): value is UnitLearningProgress {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<UnitLearningProgress>;
  return Array.isArray(item.learnedItemIds)
    && item.learnedItemIds.every((id) => typeof id === "string")
    && Number.isInteger(item.totalItems)
    && Number(item.totalItems) >= 0
    && typeof item.completed === "boolean";
}

function resolveStorage(storage?: StorageAdapter | null): StorageAdapter | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLearningProgress(storage?: StorageAdapter | null): LearningProgress {
  const target = resolveStorage(storage);
  if (!target) return emptyProgress();
  try {
    const raw = target.getItem(LEARNING_PROGRESS_STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (parsed.schemaVersion !== 1 || !parsed.units || typeof parsed.units !== "object" || Array.isArray(parsed.units)) return emptyProgress();
    const units = Object.fromEntries(Object.entries(parsed.units).filter(([, value]) => validUnitProgress(value))) as Record<string, UnitLearningProgress>;
    return {
      schemaVersion: 1,
      units,
      ...(isLevelSlug(parsed.lastLevelSlug) ? { lastLevelSlug: parsed.lastLevelSlug } : {}),
      ...(typeof parsed.lastUnitSlug === "string" && parsed.lastUnitSlug.trim() ? { lastUnitSlug: parsed.lastUnitSlug } : {}),
    };
  } catch {
    return emptyProgress();
  }
}

export function writeLearningProgress(progress: LearningProgress, storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function rememberLearningLocation(levelSlug: LearningLevelSlug, unitSlug?: string, storage?: StorageAdapter | null): LearningProgress {
  const next = { ...readLearningProgress(storage), lastLevelSlug: levelSlug, ...(unitSlug ? { lastUnitSlug: unitSlug } : {}) };
  writeLearningProgress(next, storage);
  return next;
}

export function resetLearningProgress(storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(LEARNING_PROGRESS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
