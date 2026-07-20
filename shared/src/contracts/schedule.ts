import type { LessonStatus } from "./lessons.js";

export type ScheduleExceptionType = "SKIPPED" | "RESCHEDULED";
export type ReconciliationState = "UNRECORDED" | "RECORDED" | "SKIPPED" | "RESCHEDULED";
export type ProjectionSource = "RECURRING" | "RESCHEDULED";

export interface ScheduleConflictWarning {
  kind: "PROJECTED_OCCURRENCE" | "LESSON" | "BUSY_SLOT";
  id: number | null;
  occurrenceKey: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleOccurrence {
  key: string;
  originalKey: string;
  occurrenceDate: string;
  originalOccurrenceDate: string;
  recurringScheduleId: number;
  classId: number;
  className: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  projectionSource: ProjectionSource;
  state: ReconciliationState;
  linkedLessonId: number | null;
  linkedLessonStatus: LessonStatus | null;
  exceptionId: number | null;
  replacementDate: string | null;
  replacementStartTime: string | null;
  replacementEndTime: string | null;
  conflicts: ScheduleConflictWarning[];
}

export interface ScheduleOccurrenceQuery {
  from: string;
  to: string;
  classId?: number;
  state?: ReconciliationState;
  lookbackDays?: number;
}

export interface CreateOccurrenceDraftResult {
  occurrenceKey: string;
  lessonId: number;
  wizardPath: string;
  idempotent: boolean;
  conflicts: ScheduleConflictWarning[];
}

export interface SkipOccurrenceRequest {
  reason: string;
  note?: string;
}

export interface RescheduleOccurrenceRequest {
  replacementDate: string;
  replacementStartTime: string;
  replacementEndTime: string;
  reason: string;
  note?: string;
}

export interface ScheduleExceptionResult {
  occurrenceKey: string;
  exceptionId: number;
  type: ScheduleExceptionType;
  idempotent: boolean;
  conflicts: ScheduleConflictWarning[];
}

export interface BulkOccurrenceRequest {
  keys: string[];
}

export interface BulkSkipOccurrenceRequest extends BulkOccurrenceRequest {
  reason: string;
  note?: string;
}

export interface BulkOccurrenceItemResult {
  key: string;
  success: boolean;
  lessonId?: number;
  exceptionId?: number;
  wizardPath?: string;
  idempotent?: boolean;
  error?: { code: string; message: string };
}

export type BusySlotRecurrenceType = "ONCE" | "WEEKLY";

export interface TeacherBusySlotInput {
  title: string;
  recurrenceType: BusySlotRecurrenceType;
  dayOfWeek?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  specificDate?: string;
  startTime: string;
  endTime: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  location?: string;
  note?: string;
}

export interface TeacherBusySlot extends Omit<TeacherBusySlotInput,
  "dayOfWeek" | "specificDate" | "effectiveFrom" | "effectiveTo" | "location" | "note"> {
  id: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  specificDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  location: string | null;
  note: string | null;
  conflicts: ScheduleConflictWarning[];
}

export interface TeacherBusySlotMutationResult {
  slot: TeacherBusySlot;
  conflicts: ScheduleConflictWarning[];
}

export interface UnrecordedSession {
  occurrenceKey: string;
  recurringScheduleId: number;
  classId: number;
  className: string;
  expectedDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
}

export interface WeekScheduleResponse {
  from: string;
  to: string;
  occurrences?: ScheduleOccurrence[];
  classSchedules: Array<{
    classId: number;
    className: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  busySlots: Array<{
    id: number;
    title: string;
    dayOfWeek: number | null;
    specificDate: string | null;
    startTime: string;
    endTime: string;
    location: string | null;
  }>;
}
