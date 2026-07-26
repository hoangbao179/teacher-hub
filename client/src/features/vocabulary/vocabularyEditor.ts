import type {
  ImportPublicUnitSnapshotRequest,
  LearningAgeBand,
  VocabularyIllustrationInput,
  VocabularyPastePreview,
  VocabularySetItemInput,
  VocabularyTopicSuggestion,
} from "@teacher/shared";
import type { LearningUnit } from "../learning/types";

export const levelSlugsByAgeBand = {
  PRESCHOOL_G1: ["mam-non", "lop-1"],
  G2_G3: ["lop-2", "lop-3"],
  G4_G5: ["lop-4", "lop-5"],
  G6_G9: ["lop-6", "lop-7", "lop-8", "lop-9"],
} as const satisfies Record<LearningAgeBand, readonly LearningUnit["levelSlug"][]>;

export function ageBandForLevelSlug(
  levelSlug: LearningUnit["levelSlug"],
): LearningAgeBand {
  const entry = Object.entries(levelSlugsByAgeBand).find(([, slugs]) =>
    (slugs as readonly string[]).includes(levelSlug));
  if (!entry) throw new Error("Mã lớp public không hợp lệ.");
  return entry[0] as LearningAgeBand;
}

export const ageBandOptions: readonly {
  value: LearningAgeBand;
  label: string;
}[] = [
  { value: "PRESCHOOL_G1", label: "Mầm non – Lớp 1" },
  { value: "G2_G3", label: "Lớp 2–3" },
  { value: "G4_G5", label: "Lớp 4–5" },
  { value: "G6_G9", label: "Lớp 6–9" },
];

export const ageBandLabel = (value: LearningAgeBand) =>
  ageBandOptions.find((option) => option.value === value)?.label ?? value;

export const vocabularyTopicIcons = {
  palette: "🎨", numbers: "🔢", family: "👨‍👩‍👧", body: "🖐️",
  school: "🏫", toys: "🧸", pets: "🐶", farm: "🚜", wildlife: "🦁",
  fruit: "🍎", food: "🍽️", clothes: "👕", home: "🏠", weather: "🌤️",
  feelings: "😊", routine: "🕒", actions: "🏃", transport: "🚌",
  nature: "🌿", places: "📍",
} as const;

export function vocabularyTopicIcon(iconKey: string): string {
  return vocabularyTopicIcons[iconKey as keyof typeof vocabularyTopicIcons] ?? "📚";
}

export function parseVocabularyPaste(value: string): VocabularyPastePreview {
  const rows = value.split(/\r?\n/u).map((line, index) => {
    const parts = line.split(/\t|;|,/u).map((part) => part.trim());
    const word = parts[0] ?? "";
    const meaningVi = parts.slice(1).join(", ").trim();
    const valid = Boolean(word && meaningVi);
    return {
      sourceLine: index + 1,
      word,
      meaningVi,
      valid,
      ...(valid ? {} : { error: "Cần đủ từ tiếng Anh và nghĩa tiếng Việt." }),
    };
  }).filter((row) => row.word || row.meaningVi);
  return {
    rows,
    validCount: rows.filter((row) => row.valid).length,
    invalidCount: rows.filter((row) => !row.valid).length,
  };
}

export function suggestionItems(
  suggestion: VocabularyTopicSuggestion,
): VocabularySetItemInput[] {
  return suggestion.items.filter((item) => item.selected).map((item, index) => ({
    sourceTopicWordId: item.id,
    displayOrder: index + 1,
    word: item.word,
    meaningVi: item.meaningVi,
    phonetic: item.phonetic ?? undefined,
    partOfSpeech: item.partOfSpeech ?? undefined,
    exampleEn: item.exampleEn ?? undefined,
    speechText: item.speechText,
    tier: item.tier,
    illustration: { kind: "NONE" },
    supportsImageGame: item.supportsImageGame,
    imageSearchTerms: item.imageSearchTerms,
  }));
}

function publicIllustration(image: string): VocabularyIllustrationInput {
  if (image.startsWith("/learning/")) return { kind: "PUBLIC_ASSET", value: image };
  if (/\p{Extended_Pictographic}/u.test(image)) return { kind: "EMOJI", value: image };
  return { kind: "NONE" };
}

export function publicUnitSnapshot(
  unit: LearningUnit,
): ImportPublicUnitSnapshotRequest {
  return {
    unitId: unit.id,
    levelSlug: unit.levelSlug,
    contentVersion: unit.contentVersion,
    title: unit.levelSlug === "mam-non"
      ? `Mầm non · ${unit.title}`
      : `Lớp ${unit.levelSlug.slice(4)} · ${unit.title}`,
    description: unit.description,
    ageBand: ageBandForLevelSlug(unit.levelSlug),
    items: unit.vocabulary.map((item) => ({
      id: item.id,
      word: item.word,
      meaningVi: item.vietnameseMeaning,
      phonetic: item.phonetic,
      speechText: item.speechText,
      exampleEn: item.example,
      illustration: publicIllustration(item.image),
    })),
  };
}
