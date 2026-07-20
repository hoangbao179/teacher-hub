import type {
  MarkTuitionPaidRequest,
  MarkTuitionPaidResult,
  PageResult,
  TuitionCycleDetail,
  TuitionCycleListItem,
  TuitionCycleListQuery,
} from "@teacher/shared";
import { api, apiEnvelope } from "./client";

export async function listTuitionCycles(
  query: TuitionCycleListQuery,
): Promise<PageResult<TuitionCycleListItem>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value != null && value !== "") params.set(key, String(value));
  const envelope = await apiEnvelope<TuitionCycleListItem[]>(
    `/api/tuition-cycles?${params.toString()}`,
  );
  return {
    items: envelope.data,
    total: Number(envelope.meta?.total ?? envelope.data.length),
    page: Number(envelope.meta?.page ?? query.page ?? 1),
    pageSize: Number(envelope.meta?.pageSize ?? query.pageSize ?? envelope.data.length),
  };
}

export function getTuitionCycle(id: number): Promise<TuitionCycleDetail> {
  return api<TuitionCycleDetail>(`/api/tuition-cycles/${id}`);
}

export function markTuitionPaid(
  id: number,
  input: MarkTuitionPaidRequest,
): Promise<MarkTuitionPaidResult> {
  return api<MarkTuitionPaidResult>(`/api/tuition-cycles/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
