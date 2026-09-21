import type { MonthlyTuitionRow } from "@teacher/shared";

export type TuitionBoardScope = "ALL" | "UNPAID" | "PAID";

export function filterTuitionBoardRows(
  rows: MonthlyTuitionRow[],
  input: { search: string; classId: string; scope: TuitionBoardScope },
): MonthlyTuitionRow[] {
  const keyword = input.search.trim().toLocaleLowerCase("vi");
  return rows.filter((row) =>
    (!input.classId || row.classId === Number(input.classId)) &&
    (input.scope === "ALL" || row.status === input.scope) &&
    (!keyword || `${row.studentName} ${row.studentNickname ?? ""}`.toLocaleLowerCase("vi").includes(keyword)));
}

export function tuitionAttendanceLabel(row: MonthlyTuitionRow): { progress: string; absent: string } {
  return {
    progress: `${row.attendance.present}/${row.attendance.total}`,
    absent: `Vắng ${row.attendance.absent}`,
  };
}

export function moveTuitionMonth(
  current: { year: number; month: number },
  offset: -1 | 1,
): { year: number; month: number } {
  if (!Number.isInteger(current.year) || current.year < 2000 || current.year > 2100 ||
      !Number.isInteger(current.month) || current.month < 1 || current.month > 12)
    throw new Error("Invalid tuition year/month");
  if (current.month === 1 && offset === -1) return { year: current.year - 1, month: 12 };
  if (current.month === 12 && offset === 1) return { year: current.year + 1, month: 1 };
  return { year: current.year, month: current.month + offset };
}
