import type {
  ClassDetail,
  ClassListItem,
  CompleteLessonRequest,
  CompleteLessonResult,
  CreateLessonRequest,
  LessonDetail,
  UpdateLessonAttendancesRequest,
  UpdateLessonContentRequest,
  UpdateLessonParticipantsRequest,
  UpdateLessonRequest,
  CancelLessonRequest,
} from "@teacher/shared";
import { api } from "./client";

export const lessonApi = {
  listClasses: () => api<ClassListItem[]>("/api/classes"),
  classDetail: (id: number) => api<ClassDetail>(`/api/classes/${id}`),
  create: (input: CreateLessonRequest) => api<LessonDetail>("/api/lessons", {
    method: "POST", body: JSON.stringify(input),
  }),
  detail: (id: number) => api<LessonDetail>(`/api/lessons/${id}`),
  update: (id: number, input: UpdateLessonRequest) => api<LessonDetail>(`/api/lessons/${id}`, {
    method: "PATCH", body: JSON.stringify(input),
  }),
  participants: (id: number, input: UpdateLessonParticipantsRequest) => api<LessonDetail>(`/api/lessons/${id}/participants`, {
    method: "PUT", body: JSON.stringify(input),
  }),
  attendances: (id: number, input: UpdateLessonAttendancesRequest) => api<LessonDetail>(`/api/lessons/${id}/attendances`, {
    method: "PUT", body: JSON.stringify(input),
  }),
  content: (id: number, input: UpdateLessonContentRequest) => api<LessonDetail>(`/api/lessons/${id}/content`, {
    method: "PUT", body: JSON.stringify(input),
  }),
  complete: (id: number, input: CompleteLessonRequest) => api<CompleteLessonResult>(`/api/lessons/${id}/complete`, {
    method: "POST", body: JSON.stringify(input),
  }),
  cancel: (id: number, input: CancelLessonRequest) => api<void>(`/api/lessons/${id}/cancel`, {
    method: "POST", body: JSON.stringify(input),
  }),
};
