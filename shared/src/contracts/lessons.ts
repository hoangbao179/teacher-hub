export type LessonType = "REGULAR" | "MAKEUP" | "EXTRA";
export type LessonStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "FREE";

export interface CreateLessonRequest {
  classId: number;
  sessionDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  lessonType: LessonType;
  note?: string;
}

export interface CompleteLessonAttendanceInput {
  enrollmentId: number;
  status: AttendanceStatus;
  studentNote?: string;
}

export interface CompleteLessonRequest {
  actualStartTime: string;
  actualEndTime: string;
  content?: string;
  homework?: string;
  note?: string;
  attendances: CompleteLessonAttendanceInput[];
}

export interface LessonSummary {
  id: number;
  classId: number;
  className: string;
  sessionDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  lessonType: LessonType;
  status: LessonStatus;
}

export interface CompleteLessonResult {
  lessonId: number;
  completedAt: string;
  attendanceCount: number;
  newlyDueCycles: Array<{
    cycleId: number;
    studentId: number;
    studentName: string;
  }>;
}
