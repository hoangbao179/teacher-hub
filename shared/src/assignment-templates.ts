import type {
  AssignmentActivityInput,
  AssignmentTemplateCode,
} from "./contracts/assignments.js";
import type { LearningAgeBand } from "./contracts/vocabulary.js";

export interface AssignmentTemplateContext {
  ageBand: LearningAgeBand;
  itemCount: number;
  imageItemCount: number;
  exampleItemCount: number;
}

export interface AssignmentTemplateResult {
  activities: AssignmentActivityInput[];
  warnings: string[];
}

function activities(
  values: Array<Omit<AssignmentActivityInput, "displayOrder" | "required">>,
): AssignmentActivityInput[] {
  return values.map((value, index) => ({
    ...value,
    displayOrder: index + 1,
    required: true,
  }));
}

export function assignmentActivitiesForTemplate(
  code: AssignmentTemplateCode,
  context: AssignmentTemplateContext,
): AssignmentTemplateResult {
  const hasImages = context.imageItemCount >= 2;
  const older = context.ageBand !== "PRESCHOOL_G1";
  const warnings: string[] = [];
  if (!hasImages)
    warnings.push("Chưa đủ 2 từ có hình; lộ trình đã dùng hoạt động chữ/nghĩa thay thế.");

  if (code === "YOUNG_BEGINNER")
    return {
      warnings,
      activities: activities([
        { mechanic: "EXPLORE_CARD", presentation: "FLASHCARD" },
        hasImages
          ? { mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_IMAGE" }
          : { mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD" },
        {
          mechanic: "MATCH_PAIRS",
          presentation: hasImages ? "MATCH_WORD_IMAGE" : "MATCH_WORD_MEANING",
        },
        {
          mechanic: "MEMORY_PAIRS",
          presentation: hasImages ? "MEMORY_WORD_IMAGE" : "MEMORY_WORD_MEANING",
        },
      ]),
    };
  if (code === "WORD_RECOGNITION")
    return {
      warnings,
      activities: activities([
        { mechanic: "EXPLORE_CARD", presentation: "FLASHCARD" },
        hasImages
          ? { mechanic: "SELECT_ONE", presentation: "IMAGE_PICK_WORD" }
          : { mechanic: "SELECT_ONE", presentation: "WORD_PICK_MEANING" },
        { mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD" },
        { mechanic: "MATCH_PAIRS", presentation: "MATCH_WORD_MEANING" },
      ]),
    };
  if (code === "SPELLING_REVIEW") {
    if (!older)
      return {
        ...assignmentActivitiesForTemplate("WORD_RECOGNITION", context),
        warnings: ["Lớp tuổi này chưa phù hợp ôn chính tả; đã dùng Nhớ mặt chữ."],
      };
    return {
      warnings,
      activities: activities([
        { mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD" },
        { mechanic: "BUILD_WORD", presentation: "MISSING_LETTER" },
        { mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD" },
      ]),
    };
  }
  if (code === "PRE_TEST_REVIEW")
    return {
      warnings: context.exampleItemCount < 2
        ? [...warnings, "Ít câu ví dụ; lộ trình tập trung từ, nghĩa và chính tả."]
        : warnings,
      activities: activities([
        { mechanic: "SELECT_ONE", presentation: "WORD_PICK_MEANING" },
        { mechanic: "SELECT_ONE", presentation: "MEANING_PICK_WORD" },
        { mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD" },
        { mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD" },
      ]),
    };
  return { activities: [], warnings };
}
