import type {
  AttendanceStatus,
  LegacyImportIssueCode,
  LegacyImportRowDecision,
  LegacyImportRowPreview,
  LegacyImportSkipReason,
  LegacyPaymentResolution,
} from "@teacher/shared";

export interface LegacyImportRowDraft {
  date: string;
  startTime: string;
  endTime: string;
  attendance: AttendanceStatus;
  lessonAction: "MATCH" | "CREATE" | "KEEP" | "USE_IMPORT" | "EDIT";
  content: string;
  homework: string;
  payment: LegacyPaymentResolution;
  skipReason: LegacyImportSkipReason;
  otherReason: string;
}

export type LegacyImportDecisionMap = Record<string, LegacyImportRowDecision>;

export function legacyImportDecisionKey(sheet: string, row: number, issue: LegacyImportIssueCode): string {
  return `${sheet}\u0000${row}\u0000${issue}`;
}

function suggestedEdit(row: LegacyImportRowPreview): Record<string, unknown> {
  return row.suggestedResolution?.action === "EDIT_ROW" ? row.suggestedResolution.resolvedValue : {};
}

export function initialLegacyImportDraft(row: LegacyImportRowPreview): LegacyImportRowDraft {
  const suggestion = suggestedEdit(row);
  return {
    date: String(suggestion.date ?? row.normalizedValues.date ?? ""),
    startTime: String(suggestion.startTime ?? row.normalizedValues.startTime ?? ""),
    endTime: String(suggestion.endTime ?? row.normalizedValues.endTime ?? ""),
    attendance: (row.normalizedValues.attendance ?? "PRESENT") as AttendanceStatus,
    lessonAction: row.normalizedValues.existingLessonId ? "KEEP" : "CREATE",
    content: String(suggestion.content ?? row.normalizedValues.content ?? ""),
    homework: String(suggestion.homework ?? row.normalizedValues.homework ?? ""),
    payment: (String(row.normalizedValues.resolutionOptions ?? "").split(",").filter(Boolean)[0] ??
      row.normalizedValues.paymentResolution ?? "UNDETERMINED") as LegacyPaymentResolution,
    skipReason: "UNIDENTIFIABLE_DATA",
    otherReason: "",
  };
}

export function legacyImportRowStatus(row: LegacyImportRowPreview, decisions: LegacyImportDecisionMap) {
  if (!row.issueCodes.length) return "VALID" as const;
  const selected = row.issueCodes.map((issue) => decisions[legacyImportDecisionKey(row.sourceSheet, row.sourceRow, issue)])
    .filter(Boolean);
  if (selected.some((decision) => decision.action === "SKIP")) return "SKIPPED" as const;
  return selected.length === row.issueCodes.length ? "RESOLVED" as const : row.status;
}

export function isLegacyImportRowVisible(
  row: LegacyImportRowPreview,
  onlyNeedsReview: boolean,
  decisions: LegacyImportDecisionMap,
): boolean {
  return !onlyNeedsReview || ["NEEDS_REVIEW", "BLOCKED"].includes(legacyImportRowStatus(row, decisions));
}

export function legacyImportEditableFields(row: LegacyImportRowPreview) {
  return {
    date: row.issueCodes.some((issue) => ["INVALID_DATE", "DATE_CORRECTION", "TUITION_DATE_CORRECTION"].includes(issue)),
    time: row.issueCodes.includes("INVALID_TIME"),
    attendance: row.issueCodes.includes("ATTENDANCE_AMBIGUOUS"),
    lessonContent: row.issueCodes.some((issue) => ["DUPLICATE_ROW", "NEAR_LESSON_MATCH",
      "LESSON_CONTENT_CONFLICT"].includes(issue)),
    timeMappingReadOnly: Boolean(row.normalizedValues.timeMappingId) && !row.issueCodes.includes("INVALID_TIME"),
  };
}

function normalizedText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
}

function normalizedRawTime(value: unknown): string {
  return normalizedText(value).replace(/[\u2012\u2013\u2014\u2212]/g, "-").replace(/[\s)\],.]+$/g, "").trim();
}

function sameIssueSet(left: LegacyImportRowPreview, right: LegacyImportRowPreview): boolean {
  return [...left.issueCodes].sort().join("|") === [...right.issueCodes].sort().join("|");
}

function sameTimeCase(current: LegacyImportRowPreview, candidate: LegacyImportRowPreview): boolean {
  const currentMapping = normalizedText(current.normalizedValues.mappingId);
  const candidateMapping = normalizedText(candidate.normalizedValues.mappingId);
  const sameMapping = Boolean(currentMapping) && currentMapping === candidateMapping;
  const currentRaw = normalizedRawTime(current.rawValues.rawTime ?? current.rawValues.time);
  const candidateRaw = normalizedRawTime(candidate.rawValues.rawTime ?? candidate.rawValues.time);
  const sameRaw = Boolean(currentRaw) && currentRaw === candidateRaw;
  return (sameMapping || sameRaw) &&
    normalizedText(current.normalizedValues.startTime) === normalizedText(candidate.normalizedValues.startTime) &&
    normalizedText(current.normalizedValues.endTime) === normalizedText(candidate.normalizedValues.endTime);
}

function sameFinancialGroup(current: LegacyImportRowPreview, candidate: LegacyImportRowPreview): boolean {
  const currentGroup = normalizedText(current.normalizedValues.blockId ?? current.normalizedValues.groupId);
  return Boolean(currentGroup) && currentGroup ===
    normalizedText(candidate.normalizedValues.blockId ?? candidate.normalizedValues.groupId);
}

function equivalentForIssue(
  issue: LegacyImportIssueCode,
  current: LegacyImportRowPreview,
  candidate: LegacyImportRowPreview,
  draft: LegacyImportRowDraft,
): boolean {
  if (issue === "ATTENDANCE_AMBIGUOUS") {
    if (!(["PRESENT", "ABSENT", "FREE"] as AttendanceStatus[]).includes(draft.attendance)) return false;
    const reason = current.normalizedValues.attendanceReason ?? current.normalizedValues.legacyReason ??
      current.rawValues.attendanceReason ?? issue;
    const candidateReason = candidate.normalizedValues.attendanceReason ?? candidate.normalizedValues.legacyReason ??
      candidate.rawValues.attendanceReason ?? issue;
    return normalizedText(reason) === normalizedText(candidateReason);
  }
  if (issue === "STUDENT_MISMATCH")
    return Boolean(normalizedText(current.rawValues.studentName)) &&
      normalizedText(current.rawValues.studentName) === normalizedText(candidate.rawValues.studentName);
  if (issue === "INVALID_TIME" || issue === "TIME_MAPPING_REQUIRED") return sameTimeCase(current, candidate);
  if (["INVALID_DATE", "DATE_CORRECTION", "TUITION_DATE_CORRECTION"].includes(issue)) return false;
  if (["TUITION_ROW_UNMATCHED", "TUITION_ONLY_GROUP", "PAYMENT_REVIEW_REQUIRED",
    "PAYMENT_BLOCK_REVIEW_REQUIRED"].includes(issue)) return sameFinancialGroup(current, candidate);
  return false;
}

export function getEquivalentImportRows(
  currentRow: LegacyImportRowPreview,
  allRows: LegacyImportRowPreview[],
  draft: LegacyImportRowDraft,
): LegacyImportRowPreview[] {
  return allRows.filter((candidate) => candidate.id === currentRow.id ||
    sameIssueSet(currentRow, candidate) && currentRow.issueCodes.length > 0 &&
    currentRow.issueCodes.every((issue) => equivalentForIssue(issue, currentRow, candidate, draft)));
}

export function mergeLegacyImportDecisionsAfterConfirmation(
  current: LegacyImportDecisionMap,
  next: LegacyImportRowDecision[],
  confirm: () => boolean,
): { applied: boolean; decisions: LegacyImportDecisionMap } {
  if (!confirm()) return { applied: false, decisions: current };
  const decisions = { ...current };
  for (const decision of next)
    decisions[legacyImportDecisionKey(decision.sourceSheet, decision.sourceRow, decision.issueCode)] = decision;
  return { applied: true, decisions };
}
