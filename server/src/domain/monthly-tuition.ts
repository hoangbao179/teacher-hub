export type StoredAttendanceStatus = "PRESENT" | "ABSENT";

export interface MonthlyAttendanceSummary {
  present: number;
  absent: number;
  total: number;
}

export function validateTuitionMonth(year: number, month: number): {
  year: number;
  month: number;
} {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new Error("Năm học phí không hợp lệ.");
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new Error("Tháng học phí không hợp lệ.");
  return { year, month };
}

export function summarizeMonthlyAttendance(
  statuses: StoredAttendanceStatus[],
): MonthlyAttendanceSummary {
  let present = 0;
  let absent = 0;
  for (const status of statuses) {
    if (status === "PRESENT") present += 1;
    else absent += 1;
  }
  return { present, absent, total: present + absent };
}
