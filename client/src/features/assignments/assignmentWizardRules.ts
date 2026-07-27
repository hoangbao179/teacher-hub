import type { AssignmentActivityInput, LearningAgeBand } from "@teacher/shared";

export function assignmentSourceAgeBand(parentAgeBand: LearningAgeBand): LearningAgeBand {
  return parentAgeBand;
}

export function toggleAssignmentActivity(
  current: AssignmentActivityInput[],
  activity: AssignmentActivityInput,
  maximum: number,
): AssignmentActivityInput[] {
  const selected = current.some((value) => value.presentation === activity.presentation);
  if (!selected && current.length >= maximum) return current;
  const next = selected
    ? current.filter((value) => value.presentation !== activity.presentation)
    : [...current, activity];
  return next.map((value, index) => ({ ...value, displayOrder: index + 1 }));
}

export function autoAssignmentTitle(input: {
  userEdited: boolean; currentTitle: string; className?: string; sourceTitle: string;
}): string {
  if (input.userEdited || !input.sourceTitle) return input.currentTitle;
  return input.className ? `${input.className} – ${input.sourceTitle}` : input.sourceTitle;
}
