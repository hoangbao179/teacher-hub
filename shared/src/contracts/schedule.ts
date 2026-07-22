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
  skipReason: string | null;
  makeupRequired: boolean;
  replacementCancelled: boolean;
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
  makeupRequired?: boolean;
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
  makeupRequired?: boolean;
}

export interface BulkOccurrenceItemResult {
  key: string;
  success: boolean;
  lessonId?: number;
  exceptionId?: number;
  wizardPath?: string;
  idempotent?: boolean;
  conflicts?: ScheduleConflictWarning[];
  error?: { code: string; message: string };
}

export interface ScheduleConflictCheckRequest {
  date: string;
  startTime: string;
  endTime: string;
  excludedOccurrenceKey?: string;
  excludedLessonId?: number;
}

export interface MakeupSourceOption {
  enrollmentId: number;
  studentName: string;
  studentNickname: string | null;
  alreadyReplaced: boolean;
  entitlementStatus: MakeupEntitlementStatus;
}

export type MakeupEntitlementStatus = "OPEN" | "RESERVED" | "FULFILLED" | "WAIVED";

export interface MakeupSourceOptions {
  occurrenceKey: string;
  classId: number;
  className: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  reason: string | null;
  participants: MakeupSourceOption[];
}

export interface TemporaryRescheduleRequest {
  classId: number;
  recurringScheduleId: number;
  fromDate: string;
  toDate: string;
  replacementDayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  replacementStartTime: string;
  replacementEndTime: string;
  reason: string;
  note?: string;
  confirmConflicts?: boolean;
}

export interface TemporaryRescheduleMapping {
  recurringScheduleId: number;
  replacementDayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  replacementStartTime: string;
  replacementEndTime: string;
}

export interface BulkTemporaryRescheduleRequest {
  classId: number;
  fromDate: string;
  toDate: string;
  mappings: TemporaryRescheduleMapping[];
  reason: string;
  note?: string;
  confirmConflicts?: boolean;
}

export interface TemporaryReschedulePreviewItem {
  recurringScheduleId: number;
  originalOccurrenceKey: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  replacementDate: string;
  replacementStartTime: string;
  replacementEndTime: string;
  currentState: ReconciliationState;
  eligible: boolean;
  conflicts: ScheduleConflictWarning[];
}

export interface TemporaryReschedulePreview {
  items: TemporaryReschedulePreviewItem[];
  canApply: boolean;
  conflictCount: number;
}

export interface OutstandingMakeupItem {
  sourceOccurrenceKey: string;
  classId: number;
  className: string;
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  replacementDate: string | null;
  replacementStartTime: string | null;
  replacementEndTime: string | null;
  reason: string | null;
  skippedAt: string;
  openCount: number;
  reservedCount: number;
  fulfilledCount: number;
  waivedCount: number;
  participants: MakeupSourceOption[];
}

export type BusySlotRecurrenceType = "ONCE" | "WEEKLY";
export type TeacherBusySlotType = "EXTERNAL_CLASS" | "PERSONAL" | "OTHER";
export type ExternalOrganizationType = "SCHOOL" | "CENTER";

export interface TeacherBusySlotInput {
  slotType: TeacherBusySlotType;
  organizationType?: ExternalOrganizationType;
  organizationName?: string;
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
  "organizationType" | "organizationName" | "dayOfWeek" | "specificDate" | "effectiveFrom" | "effectiveTo" | "location" | "note"> {
  id: number;
  organizationType: ExternalOrganizationType | null;
  organizationName: string | null;
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

export interface CalendarLessonEvent {
  id: number;
  sourceKey: string | null;
  classId: number;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: LessonStatus;
  lessonType: "REGULAR" | "MAKEUP" | "EXTRA";
}

export interface CalendarBusyOccurrence {
  id: number;
  slotType: TeacherBusySlotType;
  organizationType: ExternalOrganizationType | null;
  organizationName: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

export interface WeekScheduleResponse {
  from: string;
  to: string;
  occurrences: ScheduleOccurrence[];
  lessons: CalendarLessonEvent[];
  busyOccurrences: CalendarBusyOccurrence[];
  classSchedules: Array<{
    classId: number;
    className: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  busySlots: Array<{
    id: number;
    slotType: TeacherBusySlotType;
    organizationType: ExternalOrganizationType | null;
    organizationName: string | null;
    title: string;
    dayOfWeek: number | null;
    specificDate: string | null;
    startTime: string;
    endTime: string;
    location: string | null;
  }>;
}
