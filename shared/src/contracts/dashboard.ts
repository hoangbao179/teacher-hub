import type { UnrecordedSession, WeekScheduleResponse } from "./schedule.js";

export interface DashboardResponse {
  monthlyTuitionUnpaidCount: number;
  unrecordedCount: number;
  outstandingMakeupStudentCount: number;
  recentUnrecordedSessions: UnrecordedSession[];
  todaySchedule: WeekScheduleResponse;
}
