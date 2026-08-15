import type { TuitionBoardRow } from "@teacher/shared";

export type TuitionBoardScope = "ALL" | "PAYMENT_DUE";

export function filterTuitionBoardRows(
  rows: TuitionBoardRow[],
  input: { search: string; classId: string; scope: TuitionBoardScope },
): TuitionBoardRow[] {
  const keyword = input.search.trim().toLocaleLowerCase("vi");
  return rows.filter((row) =>
    (!input.classId || row.classId === Number(input.classId)) &&
    (input.scope === "ALL" || row.paymentDue) &&
    (!keyword || `${row.studentName} ${row.studentNickname ?? ""}`.toLocaleLowerCase("vi").includes(keyword)));
}

export function tuitionBoardProgress(row: TuitionBoardRow): string {
  return row.currentProgress ? `${row.currentProgress.attended}/${row.currentProgress.target}` : "—";
}

export function tuitionBoardAmount(row: TuitionBoardRow): number | null {
  return row.paymentDue ? row.paymentDueAmount : row.currentAmount;
}

export function tuitionBoardMultipleDue(row: TuitionBoardRow): { label: string; totalAmount: number } | null {
  if (row.paymentDueCount <= 1) return null;
  return { label: `${row.paymentDueCount} khoản cần thu`, totalAmount: row.totalDueAmount };
}

export function tuitionBoardDetailCycleId(row: TuitionBoardRow): number | null {
  return row.needsReview ? row.needsReviewCycleId : row.currentCycleId;
}
