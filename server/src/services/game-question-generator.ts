import type {
  AssignmentActivity,
  AssignmentDetail,
  AssignmentSnapshotItem,
  GameMechanic,
  GamePresentation,
  LearningQuestionStatus,
  PublicGameOption,
  PublicGamePrompt,
} from "@teacher/shared";
import { activityCompatibilityMessage, isSupportedActivity } from "@teacher/shared";
import { createHash } from "node:crypto";

export interface GeneratedQuestion {
  key: string;
  adaptiveSourceKey?: string;
  assignmentItemId: number;
  assignmentItemIds: number[];
  activityId: number;
  mechanic: GameMechanic;
  presentation: GamePresentation;
  prompt: PublicGamePrompt;
  options: PublicGameOption[];
  correctAnswer: Record<string, unknown>;
  graded: boolean;
  questionKind: "PRIMARY" | "REVIEW" | "EXPOSURE";
  scoreWeight: 0 | 1;
  status: Extract<LearningQuestionStatus, "PENDING" | "CONDITIONAL">;
}

export interface GeneratedQueue {
  questions: GeneratedQuestion[];
  warnings: string[];
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
}

function randomFromSeed(seed: string) {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function opaqueId(prefix: string, random: () => number): string {
  return `${prefix}-${Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36)}`;
}

function illustration(item: AssignmentSnapshotItem): PublicGameOption["illustration"] {
  return item.illustrationSnapshot;
}

function hasImage(item: AssignmentSnapshotItem): boolean {
  const value = item.illustrationSnapshot;
  return value.kind === "EMOJI"
    || (value.kind === "STORED_MEDIA" && Boolean(value.mediaId));
}

const optionCounts = {
  PRESCHOOL_G1: 2,
  G2_G3: 3,
  G4_G5: 4,
  G6_G9: 4,
} as const;

const itemCaps = {
  PRESCHOOL_G1: 6,
  G2_G3: 8,
  G4_G5: 10,
  G6_G9: 15,
} as const;

const primaryInteractionCaps = {
  PRESCHOOL_G1: 12,
  G2_G3: 16,
  G4_G5: 20,
  G6_G9: 24,
} as const;

function uniqueItems(
  items: AssignmentSnapshotItem[],
  field: "word" | "meaningVi",
): AssignmentSnapshotItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = normalize(item[field]);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function selectQuestion(
  item: AssignmentSnapshotItem,
  activity: AssignmentActivity,
  allItems: AssignmentSnapshotItem[],
  count: number,
  random: () => number,
  warnings: string[],
  key: string,
): GeneratedQuestion | null {
  let presentation = activity.presentation;
  const imagePresentation = ["LISTEN_PICK_IMAGE", "IMAGE_PICK_WORD"].includes(presentation);
  if (imagePresentation && uniqueItems(allItems.filter(hasImage), "word").length < count) {
    presentation = presentation === "LISTEN_PICK_IMAGE"
      ? "LISTEN_PICK_WORD"
      : "WORD_PICK_MEANING";
    warnings.push(`${activity.presentation}: không đủ hình phân biệt, đã dùng ${presentation}.`);
  }

  const usesMeaningOptions = [
    "WORD_PICK_MEANING",
    "FEED_MONSTER",
    "POP_BALLOON",
    "OPEN_TREASURE",
    "CHOOSE_TRAIN_CARRIAGE",
  ].includes(presentation);
  const candidateField = usesMeaningOptions ? "meaningVi" : "word";
  const pool = uniqueItems(
    presentation === "LISTEN_PICK_IMAGE"
      ? allItems.filter(hasImage)
      : allItems,
    candidateField,
  );
  if (pool.length < count || !pool.some((value) => value.id === item.id)) {
    warnings.push(`${presentation}: bỏ từ "${item.word}" vì không đủ ${count} lựa chọn phân biệt.`);
    return null;
  }
  const distractors = shuffle(
    pool.filter((value) => value.id !== item.id),
    random,
  ).slice(0, count - 1);
  const chosen = shuffle([item, ...distractors], random);
  let correctOptionId = "";
  const options: PublicGameOption[] = chosen.map((value) => {
    const id = opaqueId("option", random);
    if (value.id === item.id) correctOptionId = id;
    return {
    id,
    ...(presentation === "LISTEN_PICK_IMAGE"
      ? { illustration: illustration(value) }
      : presentation === "IMAGE_PICK_WORD"
        || presentation === "LISTEN_PICK_WORD"
        || presentation === "MEANING_PICK_WORD"
        ? { label: value.word }
        : { label: value.meaningVi }),
    };
  });
  const prompt: PublicGamePrompt = {
    instruction: presentation === "LISTEN_PICK_IMAGE"
      ? "Con nghe rồi chọn hình nhé!"
      : presentation === "IMAGE_PICK_WORD"
        ? "Hình này là từ gì?"
        : presentation === "LISTEN_PICK_WORD"
          ? "Con nghe rồi chọn từ nhé!"
          : presentation === "MEANING_PICK_WORD"
            ? "Chọn từ tiếng Anh đúng nhé!"
            : presentation === "FEED_MONSTER"
              ? "Cho quái vật ăn đáp án đúng!"
              : presentation === "POP_BALLOON"
                ? "Chạm bong bóng đúng!"
              : presentation === "OPEN_TREASURE"
                  ? "Mở rương có đáp án đúng!"
                  : presentation === "CHOOSE_TRAIN_CARRIAGE"
                    ? "Nối toa có đáp án đúng vào đầu tàu!"
                  : "Chọn nghĩa đúng nhé!",
    ...(presentation.startsWith("LISTEN_") ? { speechText: item.speechText ?? item.word } : {}),
    ...(presentation === "IMAGE_PICK_WORD" ? { illustration: illustration(item) } : {}),
    ...(presentation === "MEANING_PICK_WORD" ? { meaningVi: item.meaningVi } : {}),
    ...(!presentation.startsWith("LISTEN_")
      && presentation !== "IMAGE_PICK_WORD"
      && presentation !== "MEANING_PICK_WORD"
      ? { word: item.word } : {}),
  };
  return {
    key,
    assignmentItemId: item.id,
    assignmentItemIds: [item.id],
    activityId: activity.id,
    mechanic: "SELECT_ONE",
    presentation,
    prompt,
    options,
    correctAnswer: { optionId: correctOptionId },
    graded: true,
    questionKind: "PRIMARY",
    scoreWeight: 1,
    status: "PENDING",
  };
}

function pairQuestion(
  activity: AssignmentActivity,
  items: AssignmentSnapshotItem[],
  random: () => number,
  key: string,
): GeneratedQuestion | null {
  const wantsImage = activity.presentation.includes("IMAGE");
  const pool = uniqueItems(wantsImage ? items.filter(hasImage) : items, "word");
  const count = Math.min(
    activity.mechanic === "MEMORY_PAIRS" ? 6 : 5,
    pool.length,
  );
  if (count < 2) return null;
  const chosen = shuffle(pool, random).slice(0, count);
  const pairIds = new Map(chosen.map((item) => [item.id, {
    leftId: opaqueId("left", random),
    rightId: opaqueId("right", random),
    matchKey: opaqueId("match", random),
  }]));
  const left = chosen.map((item) => ({
    id: pairIds.get(item.id)!.leftId,
    label: item.word,
    matchKey: pairIds.get(item.id)!.matchKey,
  }));
  const right = shuffle(chosen, random).map((item) => ({
    id: pairIds.get(item.id)!.rightId,
    matchKey: pairIds.get(item.id)!.matchKey,
    ...(wantsImage
      ? { illustration: illustration(item) }
      : { label: item.meaningVi }),
  }));
  return {
    key,
    assignmentItemId: chosen[0].id,
    assignmentItemIds: chosen.map((item) => item.id),
    activityId: activity.id,
    mechanic: activity.mechanic,
    presentation: activity.presentation,
    prompt: {
      instruction: activity.mechanic === "MEMORY_PAIRS"
        ? "Lật hai thẻ để tìm một cặp nhé!"
        : "Chạm một từ rồi chạm hình hoặc nghĩa phù hợp.",
      pairs: left,
    },
    options: right,
    correctAnswer: {
      pairs: chosen.map((item) => ({
        assignmentItemId: item.id,
        leftId: pairIds.get(item.id)!.leftId,
        rightId: pairIds.get(item.id)!.rightId,
      })),
    },
    graded: true,
    questionKind: "PRIMARY",
    scoreWeight: 1,
    status: "PENDING",
  };
}

function buildWordQuestion(
  item: AssignmentSnapshotItem,
  activity: AssignmentActivity,
  ageBand: AssignmentDetail["ageBand"],
  random: () => number,
  key: string,
): GeneratedQuestion | null {
  const characters = [...item.word.toLocaleUpperCase("en")];
  const letters = characters.filter((value) => /[A-Z]/.test(value));
  if (letters.length < 3 || letters.length > 14) return null;
  if (activity.presentation === "MISSING_LETTER") {
    const eligible = characters
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => /[A-Z]/.test(value));
    const missing = eligible[Math.floor(random() * eligible.length)];
    const distractors = shuffle(
      [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((value) => value !== missing.value),
      random,
    ).slice(0, optionCounts[ageBand] - 1);
    const choices = shuffle([missing.value, ...distractors], random);
    let correctOptionId = "";
    const options = choices.map((label) => {
      const id = opaqueId("letter-option", random);
      if (label === missing.value) correctOptionId = id;
      return { id, label };
    });
    return {
      key,
      assignmentItemId: item.id,
      assignmentItemIds: [item.id],
      activityId: activity.id,
      mechanic: "BUILD_WORD",
      presentation: "MISSING_LETTER",
      prompt: {
        instruction: "Chọn chữ còn thiếu nhé!",
        meaningVi: item.meaningVi,
        speechText: item.speechText ?? item.word,
        maskedWord: characters
          .map((value, index) => index === missing.index ? "_" : value)
          .join(" "),
        ...(hasImage(item) ? { illustration: illustration(item) } : {}),
      },
      options,
      correctAnswer: { optionId: correctOptionId, missingIndex: missing.index },
      graded: true,
      questionKind: "PRIMARY",
      scoreWeight: 1,
      status: "PENDING",
    };
  }
  const tokens = characters.map((label) => ({
    id: opaqueId("letter", random),
    label,
  }));
  return {
    key,
    assignmentItemId: item.id,
    assignmentItemIds: [item.id],
    activityId: activity.id,
    mechanic: "BUILD_WORD",
    presentation: "BUILD_SPELLED_WORD",
    prompt: {
      instruction: "Chạm các chữ theo đúng thứ tự.",
      meaningVi: item.meaningVi,
      speechText: item.speechText ?? item.word,
      ...(hasImage(item) ? { illustration: illustration(item) } : {}),
    },
    options: shuffle(tokens, random),
    correctAnswer: { tokenIds: tokens.map((value) => value.id) },
    graded: true,
    questionKind: "PRIMARY",
    scoreWeight: 1,
    status: "PENDING",
  };
}

function flashcardQuestion(
  item: AssignmentSnapshotItem,
  activity: AssignmentActivity,
  key: string,
): GeneratedQuestion {
  return {
    key,
    assignmentItemId: item.id,
    assignmentItemIds: [item.id],
    activityId: activity.id,
    mechanic: "EXPLORE_CARD",
    presentation: "FLASHCARD",
    prompt: {
      instruction: "Chạm để khám phá từ mới!",
      word: item.word,
      meaningVi: item.meaningVi,
      phonetic: item.phonetic,
      exampleEn: item.exampleEn,
      speechText: item.speechText ?? item.word,
      ...(hasImage(item) ? { illustration: illustration(item) } : {}),
    },
    options: [],
    correctAnswer: { exposure: true },
    graded: false,
    questionKind: "EXPOSURE",
    scoreWeight: 0,
    status: "PENDING",
  };
}

export function generateQuestionQueue(
  assignment: AssignmentDetail,
  seed: string,
): GeneratedQueue {
  const random = randomFromSeed(seed);
  const warnings: string[] = [];
  const canonicalItems = [...assignment.items].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.id - right.id,
  );
  const items = (assignment.shuffleQuestions
    ? shuffle(canonicalItems, random)
    : canonicalItems).slice(0, itemCaps[assignment.ageBand]);
  const minimum = optionCounts[assignment.ageBand];
  const primary: GeneratedQuestion[] = [];

  for (const activity of [...assignment.activities].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  )) {
    if (!isSupportedActivity(activity.mechanic, activity.presentation)) {
      warnings.push(activityCompatibilityMessage(activity));
      continue;
    }
    if (activity.mechanic === "EXPLORE_CARD") {
      for (const item of items)
        primary.push(flashcardQuestion(
          item,
          activity,
          `activity-${activity.id}-item-${item.id}`,
        ));
      continue;
    }
    if (activity.mechanic === "SELECT_ONE") {
      for (const item of items) {
        const question = selectQuestion(
          item,
          activity,
          assignment.items,
          minimum,
          random,
          warnings,
          `activity-${activity.id}-item-${item.id}`,
        );
        if (question) primary.push(question);
      }
      continue;
    }
    if (activity.mechanic === "MATCH_PAIRS" || activity.mechanic === "MEMORY_PAIRS") {
      const question = pairQuestion(
        activity,
        items,
        random,
        `activity-${activity.id}-pairs`,
      );
      if (question) primary.push(question);
      else warnings.push(`${activity.presentation}: không đủ cặp phân biệt.`);
      continue;
    }
    if (activity.mechanic === "BUILD_WORD") {
      if (assignment.ageBand === "PRESCHOOL_G1") {
        warnings.push(`${activity.presentation}: nhóm tuổi chưa phù hợp xếp chữ.`);
        continue;
      }
      for (const item of items) {
        const question = buildWordQuestion(
          item,
          activity,
          assignment.ageBand,
          random,
          `activity-${activity.id}-item-${item.id}`,
        );
        if (question) primary.push(question);
      }
      continue;
    }
    warnings.push(`${activity.presentation}: mechanic chưa có dữ liệu chơi an toàn.`);
  }

  const scoreCap = primaryInteractionCaps[assignment.ageBand];
  let primaryScoreCount = 0;
  const cappedPrimary = primary.filter((question) => {
    if (question.questionKind !== "PRIMARY" || question.scoreWeight !== 1)
      return true;
    const weight = question.assignmentItemIds.length;
    if (primaryScoreCount + weight > scoreCap) return false;
    primaryScoreCount += weight;
    return true;
  });

  const result: GeneratedQuestion[] = [];
  const adaptive = new Map<number, GeneratedQuestion[]>();
  cappedPrimary.forEach((question, index) => {
    const activity = assignment.activities.find((value) => value.id === question.activityId);
    if (!activity) return;
    for (const assignmentItemId of question.assignmentItemIds) {
      const item = assignment.items.find((value) => value.id === assignmentItemId);
      if (!item) continue;
      const presentation = question.mechanic === "SELECT_ONE"
        && question.presentation === "WORD_PICK_MEANING"
        ? "MEANING_PICK_WORD" : "WORD_PICK_MEANING";
      const alternative = selectQuestion(
        item,
        { ...activity, mechanic: "SELECT_ONE", presentation },
        assignment.items,
        minimum,
        random,
        warnings,
        `adaptive-${question.key}-item-${item.id}`,
      );
      if (!alternative) continue;
      alternative.adaptiveSourceKey = question.key;
      alternative.questionKind = "REVIEW";
      alternative.scoreWeight = 0;
      alternative.status = "CONDITIONAL";
      const target = Math.min(cappedPrimary.length, index + 3);
      adaptive.set(target, [...(adaptive.get(target) ?? []), alternative]);
    }
  });
  cappedPrimary.forEach((question, index) => {
    result.push(question);
    result.push(...(adaptive.get(index + 1) ?? []));
  });

  const playable = result.filter((question) => question.status === "PENDING");
  if (!playable.length)
    return { questions: [], warnings: [...warnings, "Không tạo được câu hỏi an toàn."] };
  return {
    questions: result.slice(0, 120),
    warnings: [...new Set(warnings)],
  };
}

export function canonicalAnswer(value: Record<string, unknown>): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, sort(item)]),
      );
    return input;
  };
  return JSON.stringify(sort(value));
}

export function isCorrectAnswer(
  submitted: Record<string, unknown>,
  correct: Record<string, unknown>,
): boolean {
  if (correct.exposure === true) return submitted.exposure === true;
  if (typeof correct.optionId === "string")
    return submitted.optionId === correct.optionId;
  if (Array.isArray(correct.pairs) && Array.isArray(submitted.pairs)) {
    const normalizePairs = (values: unknown[]) => values
      .map((value) => value as { leftId?: unknown; rightId?: unknown })
      .map((value) => `${String(value.leftId)}:${String(value.rightId)}`)
      .sort();
    return JSON.stringify(normalizePairs(submitted.pairs))
      === JSON.stringify(normalizePairs(correct.pairs));
  }
  return canonicalAnswer(submitted) === canonicalAnswer(correct);
}
