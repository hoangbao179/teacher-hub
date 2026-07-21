import type { UnrecordedSession, WeekScheduleResponse } from "./schedule.js";

export interface DashboardResponse {
  paymentDueCount: number;
  totalUnpaidAmount: number;
  accumulatingStudentCount: number;
  paidCycleCount: number;
  unrecordedCount: number;
  outstandingMakeupStudentCount: number;
  openIncompleteCycleCount: number;
  recentUnrecordedSessions: UnrecordedSession[];
  todaySchedule: WeekScheduleResponse;
}
