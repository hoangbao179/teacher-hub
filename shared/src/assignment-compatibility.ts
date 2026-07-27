import type {
  AssignmentActivityInput,
  AssignmentVocabularyItemInput,
  GameMechanic,
  GamePresentation,
} from "./contracts/assignments.js";

export const MAX_ASSIGNMENT_ACTIVITIES = 8;

export const activityCompatibility = {
  EXPLORE_CARD: ["FLASHCARD"],
  SELECT_ONE: [
    "LISTEN_PICK_IMAGE", "IMAGE_PICK_WORD", "LISTEN_PICK_WORD",
    "WORD_PICK_MEANING", "MEANING_PICK_WORD", "FEED_MONSTER",
    "POP_BALLOON", "OPEN_TREASURE", "CHOOSE_TRAIN_CARRIAGE",
  ],
  MATCH_PAIRS: ["MATCH_WORD_IMAGE", "MATCH_WORD_MEANING"],
  MEMORY_PAIRS: ["MEMORY_WORD_IMAGE", "MEMORY_WORD_MEANING"],
  BUILD_WORD: ["MISSING_LETTER", "BUILD_SPELLED_WORD"],
} as const satisfies Partial<Record<GameMechanic, readonly GamePresentation[]>>;

export const imageGamePresentations = new Set<GamePresentation>([
  "LISTEN_PICK_IMAGE", "IMAGE_PICK_WORD", "MATCH_WORD_IMAGE", "MEMORY_WORD_IMAGE",
]);

export function isSupportedActivity(
  mechanic: GameMechanic,
  presentation: GamePresentation,
): boolean {
  const presentations = activityCompatibility[
    mechanic as keyof typeof activityCompatibility
  ] as readonly GamePresentation[] | undefined;
  return presentations?.includes(presentation) ?? false;
}

export function activityCompatibilityMessage(activity: Pick<AssignmentActivityInput, "mechanic" | "presentation">): string {
  if (!(activity.mechanic in activityCompatibility))
    return `Hoạt động ${activity.mechanic} chưa được hỗ trợ.`;
  return `${activity.presentation} không tương thích với ${activity.mechanic}.`;
}

export function activityHasEligibleItems(
  activity: Pick<AssignmentActivityInput, "mechanic" | "presentation">,
  items: readonly Pick<AssignmentVocabularyItemInput, "word" | "illustration">[],
): boolean {
  if (!items.length) return false;
  if (imageGamePresentations.has(activity.presentation))
    return items.filter((item) => item.illustration.kind !== "NONE").length >= 2;
  if (activity.mechanic === "BUILD_WORD")
    return items.some((item) => {
      const letters = [...item.word.toLocaleUpperCase("en")].filter((value) => /[A-Z]/.test(value));
      return letters.length >= 3 && letters.length <= 14;
    });
  if (activity.mechanic === "MATCH_PAIRS" || activity.mechanic === "MEMORY_PAIRS")
    return items.length >= 2;
  return true;
}
