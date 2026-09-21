import type {
  MarkMonthlyTuitionPaidRequest,
  MarkMonthlyTuitionPaidResult,
  MonthlyTuitionBoard,
  MonthlyTuitionQuery,
} from "@teacher/shared";
import { api } from "./client";

export function getMonthlyTuitionBoard(query: MonthlyTuitionQuery): Promise<MonthlyTuitionBoard> {
  const params = new URLSearchParams({ year: String(query.year), month: String(query.month) });
  if (query.classId != null) params.set("classId", String(query.classId));
  if (query.search) params.set("search", query.search);
  return api<MonthlyTuitionBoard>(`/api/tuition/monthly?${params.toString()}`);
}

export function markMonthlyTuitionPaid(
  enrollmentId: number,
  year: number,
  month: number,
  input: MarkMonthlyTuitionPaidRequest,
): Promise<MarkMonthlyTuitionPaidResult> {
  return api<MarkMonthlyTuitionPaidResult>(
    `/api/tuition/monthly/${enrollmentId}/${year}/${month}/paid`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}
