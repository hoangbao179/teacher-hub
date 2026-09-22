export function parseRuntimeAttendanceStatus(status: string): "PRESENT" | "ABSENT" {
  if (status !== "PRESENT" && status !== "ABSENT")
    throw new Error("Trạng thái điểm danh không hợp lệ.");
  return status;
}

export function isEnrollmentEligible(
  joinedAt: string,
  endedAt: string | null,
  sessionDate: string,
): boolean {
  return joinedAt <= sessionDate && (endedAt == null || endedAt >= sessionDate);
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
