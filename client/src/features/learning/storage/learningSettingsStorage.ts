import { PRONUNCIATION_RATES, type PronunciationRateMode } from "../audio/pronunciation.ts";

export const LEARNING_SETTINGS_STORAGE_KEY = "covy-learning-settings:v1";

export interface LearningSettings {
  schemaVersion: 1;
  pronunciationRateMode: PronunciationRateMode;
}

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultSettings = (): LearningSettings => ({ schemaVersion: 1, pronunciationRateMode: "NORMAL" });

function resolveStorage(storage?: StorageAdapter | null): StorageAdapter | null {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function readLearningSettings(storage?: StorageAdapter | null): LearningSettings {
  const target = resolveStorage(storage);
  if (!target) return defaultSettings();
  try {
    const raw = target.getItem(LEARNING_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<LearningSettings>;
    if (parsed.schemaVersion !== 1 || (parsed.pronunciationRateMode !== "NORMAL" && parsed.pronunciationRateMode !== "SLOW")) return defaultSettings();
    return { schemaVersion: 1, pronunciationRateMode: parsed.pronunciationRateMode };
  } catch { return defaultSettings(); }
}

export function writeLearningSettings(settings: LearningSettings, storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try { target.setItem(LEARNING_SETTINGS_STORAGE_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}

export function getPronunciationRate(storage?: StorageAdapter | null): number {
  return PRONUNCIATION_RATES[readLearningSettings(storage).pronunciationRateMode];
}
