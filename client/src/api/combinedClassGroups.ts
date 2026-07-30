import type {
  CombinedClassGroup,
  CombinedTeachingOccurrenceDetail,
  CompleteCombinedTeachingOccurrenceRequest,
  CompleteCombinedTeachingOccurrenceResult,
  CreateCombinedClassGroupRequest,
  EndCombinedClassGroupRequest,
  UpdateCombinedClassGroupRequest,
} from "@teacher/shared";
import { api } from "./client";

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body == null ? undefined : JSON.stringify(body),
});

export const combinedClassGroupApi = {
  list() {
    return api<CombinedClassGroup[]>("/api/combined-class-groups");
  },
  detail(id: number) {
    return api<CombinedClassGroup>(`/api/combined-class-groups/${id}`);
  },
  create(input: CreateCombinedClassGroupRequest) {
    return api<CombinedClassGroup>("/api/combined-class-groups", json("POST", input));
  },
  update(id: number, input: UpdateCombinedClassGroupRequest) {
    return api<CombinedClassGroup>(`/api/combined-class-groups/${id}`, json("PATCH", input));
  },
  end(id: number, input: EndCombinedClassGroupRequest) {
    return api<CombinedClassGroup>(`/api/combined-class-groups/${id}/end`, json("POST", input));
  },
  occurrence(id: number) {
    return api<CombinedTeachingOccurrenceDetail>(`/api/combined-teaching-occurrences/${id}`);
  },
  completeOccurrence(id: number, input: CompleteCombinedTeachingOccurrenceRequest) {
    return api<CompleteCombinedTeachingOccurrenceResult>(
      `/api/combined-teaching-occurrences/${id}/complete`,
      json("POST", input),
    );
  },
};
