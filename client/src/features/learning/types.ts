export const learningLevelSlugs = [
  "mam-non",
  "lop-1",
  "lop-2",
  "lop-3",
  "lop-4",
  "lop-5",
  "lop-6",
  "lop-7",
  "lop-8",
  "lop-9",
] as const;

export type LearningLevelSlug = (typeof learningLevelSlugs)[number];
export type LearningLevelGroup = "EARLY" | "PRIMARY" | "SECONDARY";

export interface LearningLevel {
  id: string;
  slug: LearningLevelSlug;
  name: string;
  group: LearningLevelGroup;
  accent: string;
  mascot: string;
  available: boolean;
  grade?: number;
}

export interface VocabularyItem {
  id: string;
  word: string;
  phonetic: string;
  vietnameseMeaning: string;
  image: string;
  audio?: string;
  speechText?: string;
  example?: string;
}

export interface LearningUnit {
  id: string;
  slug: string;
  levelSlug: LearningLevelSlug;
  title: string;
  description: string;
  icon: string;
  status: "PUBLISHED" | "COMING_SOON";
  contentVersion: number;
  vocabulary: readonly VocabularyItem[];
}

export interface UnitLearningProgress {
  contentVersion: number;
  viewedItemIds: string[];
  rememberedItemIds: string[];
  reviewItemIds: string[];
  lastItemIndex: number;
  flashcardCompletedAt?: string;
  listenCorrect: number;
  listenTotal: number;
  updatedAt: string;
}

export interface LearningProgress {
  schemaVersion: 1;
  lastLevelSlug?: LearningLevelSlug;
  lastUnitSlug?: string;
  units: Record<string, UnitLearningProgress>;
}
