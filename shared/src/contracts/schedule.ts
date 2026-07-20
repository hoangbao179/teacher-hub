export type ScheduleExceptionType = "SKIPPED" | "RESCHEDULED";

export interface UnrecordedSession {
  classId: number;
  className: string;
  expectedDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
}

export interface WeekScheduleResponse {
  from: string;
  to: string;
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
