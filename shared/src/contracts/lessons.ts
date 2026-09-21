export type LessonType = "REGULAR" | "MAKEUP" | "EXTRA";
export type LessonStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT";
export type LessonDomainErrorCode =
  | "LESSON_NOT_FOUND"
  | "LESSON_NOT_DRAFT"
  | "LESSON_ALREADY_COMPLETED"
  | "INVALID_LESSON_TIME"
  | "INVALID_PARTICIPANT"
  | "DUPLICATE_PARTICIPANT"
  | "PARTICIPANT_NOT_ELIGIBLE"
  | "MISSING_ATTENDANCE"
  | "DUPLICATE_ATTENDANCE"
  | "TUITION_POLICY_NOT_FOUND"
  | "TUITION_POLICY_OVERLAP"
  | "MAKEUP_SOURCE_INVALID"
  | "MAKEUP_REPLACEMENT_DUPLICATE"
  | "PAID_CYCLE_CONFLICT";

export interface CreateLessonRequest {
  classId: number;
  sessionDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  lessonType: LessonType;
  selectedEnrollmentIds?: number[];
  makeupSourceOccurrenceKey?: string;
  note?: string;
}

export interface UpdateLessonRequest {
  classId?: number;
  sessionDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  lessonType?: LessonType;
  note?: string;
  refreshParticipants?: boolean;
  selectedEnrollmentIds?: number[];
}

export interface UpdateLessonParticipantsRequest {
  enrollmentIds: number[];
  attendances?: CompleteLessonAttendanceInput[];
}

export interface CompleteLessonAttendanceInput {
  enrollmentId: number;
  status: AttendanceStatus;
  studentNote?: string;
}

export interface UpdateLessonAttendancesRequest {
  attendances: CompleteLessonAttendanceInput[];
  generalComment?: string;
}

export interface UpdateLessonContentRequest {
  content?: string;
  homework?: string;
  generalComment?: string;
  note?: string;
}

export interface CompleteLessonRequest {
  actualStartTime: string;
  actualEndTime: string;
  content?: string;
  homework?: string;
  generalComment?: string;
  note?: string;
  attendances: CompleteLessonAttendanceInput[];
}

export interface LessonSummary {
  id: number;
  classId: number;
  className: string;
  sourceOccurrenceKey: string | null;
  sessionDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  lessonType: LessonType;
  status: LessonStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface LessonParticipantDetail {
  participantId: number;
  enrollmentId: number;
  studentId: number;
  studentName: string;
  tuitionMode: "CLASS_DEFAULT" | "CUSTOM" | "FREE";
  attendance: {
    status: AttendanceStatus;
    studentNote: string | null;
  } | null;
}

export interface LessonDetail extends LessonSummary {
  content: string | null;
  homework: string | null;
  generalComment: string | null;
  note: string | null;
  makeupSource: {
    occurrenceKey: string;
    originalDate: string;
    originalStartTime: string;
    originalEndTime: string;
    className: string;
    reason: string | null;
  } | null;
  participants: LessonParticipantDetail[];
}

export interface CompleteLessonResult {
  lessonId: number;
  completedAt: string;
  attendanceCount: number;
  lesson: LessonSummary;
  actualDurationMinutes: number;
  presentCount: number;
  absentCount: number;
}

export interface CancelLessonRequest {
  reason: string;
}
