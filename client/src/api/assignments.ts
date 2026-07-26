import type {
  AssignmentAudienceType,
  AssignmentDetail,
  AssignmentListItem,
  AssignmentPreviewPayload,
  AssignmentRecipient,
  AssignmentShare,
  AssignmentStatus,
  CreateAssignmentDraftRequest,
  DuplicateAssignmentRequest,
  LearningAgeBand,
  PublishAssignmentRequest,
  PublishAssignmentResult,
  RegenerateAssignmentAccessRequest,
  UpdateAssignmentDraftRequest,
} from "@teacher/shared";
import { api, apiEnvelope } from "./client";

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : "";
}

export const listAssignments = (values: {
  search?: string;
  status?: AssignmentStatus;
  audienceType?: AssignmentAudienceType;
  ageBand?: LearningAgeBand;
  page?: number;
  pageSize?: number;
}) => apiEnvelope<AssignmentListItem[]>(
  `/api/vocabulary/assignments${query(values)}`,
);

export const getAssignment = (id: number) =>
  api<AssignmentDetail>(`/api/vocabulary/assignments/${id}`);

export const createAssignment = (values: CreateAssignmentDraftRequest) =>
  api<AssignmentDetail>("/api/vocabulary/assignments", {
    method: "POST",
    body: JSON.stringify(values),
  });

export const updateAssignment = (id: number, values: UpdateAssignmentDraftRequest) =>
  api<AssignmentDetail>(`/api/vocabulary/assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });

export const previewAssignment = (id: number) =>
  api<AssignmentPreviewPayload>(`/api/vocabulary/assignments/${id}/preview`);

export const publishAssignment = (id: number, values: PublishAssignmentRequest) =>
  api<PublishAssignmentResult>(`/api/vocabulary/assignments/${id}/publish`, {
    method: "POST",
    body: JSON.stringify(values),
  });

export const duplicateAssignment = (id: number, values: DuplicateAssignmentRequest = {}) =>
  api<AssignmentDetail>(`/api/vocabulary/assignments/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(values),
  });

export const closeAssignment = (id: number) =>
  api<void>(`/api/vocabulary/assignments/${id}/close`, { method: "POST" });

export const changeAssignmentDueDate = (id: number, dueAt: string | null) =>
  api<AssignmentDetail>(`/api/vocabulary/assignments/${id}/due-date`, {
    method: "PATCH",
    body: JSON.stringify({ dueAt }),
  });

export const listAssignmentRecipients = (id: number) =>
  api<AssignmentRecipient[]>(`/api/vocabulary/assignments/${id}/recipients`);

export const regenerateAssignmentAccess = (
  id: number,
  values: RegenerateAssignmentAccessRequest = {},
) => api<AssignmentShare>(`/api/vocabulary/assignments/${id}/recipients/regenerate-access`, {
  method: "POST",
  body: JSON.stringify(values),
});

export const revokeAssignmentAccess = (
  id: number,
  values: RegenerateAssignmentAccessRequest = {},
) => api<void>(`/api/vocabulary/assignments/${id}/recipients/revoke-access`, {
  method: "POST",
  body: JSON.stringify(values),
});
