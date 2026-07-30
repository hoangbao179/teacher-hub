import type { CompleteLessonRequest, CompleteLessonResult, LessonParticipantDetail } from "./lessons.js";
import type { Weekday } from "./classes.js";

export type CombinedClassGroupStatus = "ACTIVE" | "ENDED";

export interface CombinedClassGroupScheduleInput {
  id?: number;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
}

export interface CombinedClassGroupMutationRequest {
  name: string;
  classIds: number[];
  effectiveFrom: string;
  effectiveTo?: string;
  schedules: CombinedClassGroupScheduleInput[];
}

export type CreateCombinedClassGroupRequest = CombinedClassGroupMutationRequest;
export type UpdateCombinedClassGroupRequest = CombinedClassGroupMutationRequest;

export interface EndCombinedClassGroupRequest {
  effectiveTo: string;
  reason?: string;
}

export interface CombinedClassGroup {
  id: number;
  name: string;
  status: CombinedClassGroupStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  classes: Array<{ id: number; name: string }>;
  schedules: Array<CombinedClassGroupScheduleInput & { id: number }>;
}

export interface CombinedTeachingOccurrenceClass {
  classId: number;
  className: string;
  lessonId: number;
  participants: LessonParticipantDetail[];
}

export interface CombinedTeachingOccurrenceDetail {
  id: number;
  key: string;
  groupId: number;
  groupName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "DRAFT" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
  classes: CombinedTeachingOccurrenceClass[];
}

export interface CreateCombinedOccurrenceDraftResult {
  occurrenceKey: string;
  occurrenceId: number;
  wizardPath: string;
  idempotent: boolean;
}

export interface CompleteCombinedTeachingOccurrenceRequest
  extends Omit<CompleteLessonRequest, "attendances"> {
  attendances: CompleteLessonRequest["attendances"];
}

export interface CompleteCombinedTeachingOccurrenceResult {
  occurrenceId: number;
  lessons: CompleteLessonResult[];
}
