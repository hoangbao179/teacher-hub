import type { ClassListItem } from "./classes.js";
import type { UnrecordedSession } from "./schedule.js";

export interface DashboardResponse {
  paymentDueCount: number;
  accumulatingStudentCount: number;
  paidCycleCount: number;
  todayClasses: ClassListItem[];
  recentUnrecordedSessions: UnrecordedSession[];
}
