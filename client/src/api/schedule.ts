import type {
  BulkOccurrenceItemResult,
  BulkOccurrenceRequest,
  BulkSkipOccurrenceRequest,
  CreateOccurrenceDraftResult,
  ReconciliationState,
  RescheduleOccurrenceRequest,
  ScheduleExceptionResult,
  ScheduleOccurrence,
  SkipOccurrenceRequest,
  TeacherBusySlot,
  TeacherBusySlotInput,
  TeacherBusySlotMutationResult,
  WeekScheduleResponse,
} from "@teacher/shared";
import { api } from "./client";

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body == null ? undefined : JSON.stringify(body),
});

export const scheduleApi = {
  occurrences(query: { from: string; to: string; classId?: number; state?: ReconciliationState; lookbackDays?: number }) {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.classId) params.set("classId", String(query.classId));
    if (query.state) params.set("state", query.state);
    if (query.lookbackDays) params.set("lookbackDays", String(query.lookbackDays));
    return api<ScheduleOccurrence[]>(`/api/schedule/occurrences?${params}`);
  },
  createDraft(key: string) {
    return api<CreateOccurrenceDraftResult>(`/api/schedule/occurrences/${encodeURIComponent(key)}/create-draft`, json("POST"));
  },
  skip(key: string, input: SkipOccurrenceRequest) {
    return api<ScheduleExceptionResult>(`/api/schedule/occurrences/${encodeURIComponent(key)}/skip`, json("POST", input));
  },
  reschedule(key: string, input: RescheduleOccurrenceRequest) {
    return api<ScheduleExceptionResult>(`/api/schedule/occurrences/${encodeURIComponent(key)}/reschedule`, json("POST", input));
  },
  bulkCreateDrafts(input: BulkOccurrenceRequest) {
    return api<BulkOccurrenceItemResult[]>("/api/schedule/occurrences/bulk-create-drafts", json("POST", input));
  },
  bulkSkip(input: BulkSkipOccurrenceRequest) {
    return api<BulkOccurrenceItemResult[]>("/api/schedule/occurrences/bulk-skip", json("POST", input));
  },
  week(from: string) {
    return api<WeekScheduleResponse>(`/api/schedule/week?from=${encodeURIComponent(from)}`);
  },
  busySlots(from: string, to: string) {
    return api<TeacherBusySlot[]>(`/api/teacher-busy-slots?from=${from}&to=${to}`);
  },
  busySlot(id: number) {
    return api<TeacherBusySlot>(`/api/teacher-busy-slots/${id}`);
  },
  createBusySlot(input: TeacherBusySlotInput) {
    return api<TeacherBusySlotMutationResult>("/api/teacher-busy-slots", json("POST", input));
  },
  updateBusySlot(id: number, input: TeacherBusySlotInput) {
    return api<TeacherBusySlotMutationResult>(`/api/teacher-busy-slots/${id}`, json("PATCH", input));
  },
  deleteBusySlot(id: number) {
    return api<void>(`/api/teacher-busy-slots/${id}`, json("DELETE"));
  },
};
