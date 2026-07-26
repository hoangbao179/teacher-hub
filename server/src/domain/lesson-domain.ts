import type { AttendanceStatus, TuitionMode } from "@teacher/shared";

export interface EffectiveRange {
  effectiveFrom: string;
  effectiveTo: string | null;
}

export function isEnrollmentEligible(
  joinedAt: string,
  endedAt: string | null,
  sessionDate: string,
): boolean {
  return joinedAt <= sessionDate && (endedAt == null || endedAt >= sessionDate);
}

export function rangesOverlap(a: EffectiveRange, b: EffectiveRange): boolean {
  const aEnd = a.effectiveTo ?? "9999-12-31";
  const bEnd = b.effectiveTo ?? "9999-12-31";
  return a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd;
}

export function assertNonOverlappingRanges(ranges: EffectiveRange[]): void {
  const ordered = [...ranges].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (let index = 1; index < ordered.length; index += 1) {
    if (rangesOverlap(ordered[index - 1], ordered[index]))
      throw new Error("TUITION_POLICY_OVERLAP");
  }
}

export function resolvePolicyPrice(
  mode: TuitionMode,
  customPackagePrice: number | null,
  classPackagePrice: number | null,
): number | null {
  if (mode === "FREE") return null;
  const price = mode === "CUSTOM" ? customPackagePrice : classPackagePrice;
  if (!Number.isInteger(price) || (price ?? 0) <= 0)
    throw new Error("Không tìm thấy giá học phí dương có hiệu lực.");
  return price;
}

export function isBillableAttendance(
  status: AttendanceStatus,
  mode: TuitionMode,
): boolean {
  return status === "PRESENT" && mode !== "FREE";
}

export function attendanceCoverageIssue(
  participantEnrollmentIds: number[],
  submittedEnrollmentIds: number[],
): "DUPLICATE_ATTENDANCE" | "INVALID_PARTICIPANT" | "MISSING_ATTENDANCE" | null {
  if (new Set(submittedEnrollmentIds).size !== submittedEnrollmentIds.length)
    return "DUPLICATE_ATTENDANCE";
  const participants = new Set(participantEnrollmentIds);
  if (submittedEnrollmentIds.some((id) => !participants.has(id)))
    return "INVALID_PARTICIPANT";
  if (participantEnrollmentIds.some((id) => !submittedEnrollmentIds.includes(id)))
    return "MISSING_ATTENDANCE";
  return null;
}

export function isCompletionReplay(status: string): boolean {
  return status === "COMPLETED";
}

export interface BillableAttendanceOrder {
  sessionDate: string;
  actualStartTime: string | null;
  scheduledStartTime: string;
  lessonId: number;
  attendanceId: number;
}

export function compareBillableAttendance(
  left: BillableAttendanceOrder,
  right: BillableAttendanceOrder,
): number {
  const leftValues: Array<string | number> = [
    left.sessionDate, left.actualStartTime ?? left.scheduledStartTime,
    left.scheduledStartTime, left.lessonId, left.attendanceId,
  ];
  const rightValues: Array<string | number> = [
    right.sessionDate, right.actualStartTime ?? right.scheduledStartTime,
    right.scheduledStartTime, right.lessonId, right.attendanceId,
  ];
  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] < rightValues[index]) return -1;
    if (leftValues[index] > rightValues[index]) return 1;
  }
  return 0;
}

export function groupIntoTuitionCycles<T>(items: T[]): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += 8) groups.push(items.slice(index, index + 8));
  return groups;
}

export function crossesPaidBoundary(
  paidItems: BillableAttendanceOrder[],
  mutableItems: BillableAttendanceOrder[],
): boolean {
  if (!paidItems.length) return false;
  const boundary = [...paidItems].sort(compareBillableAttendance).at(-1)!;
  return mutableItems.some((item) => compareBillableAttendance(item, boundary) <= 0);
}
