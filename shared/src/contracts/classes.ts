export type ClassType = "ONE_TO_ONE" | "GROUP";
export type ClassStatus = "ACTIVE" | "PAUSED" | "CLOSED";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RecurringScheduleInput {
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
}

export interface CreateClassRequest {
  name: string;
  type: ClassType;
  subject?: string;
  defaultPackagePrice: number;
  defaultDurationMinutes: number;
  startDate: string;
  expectedEndDate?: string;
  note?: string;
  status?: ClassStatus;
  schedules: RecurringScheduleInput[];
}

export interface UpdateClassRequest {
  name: string;
  type: ClassType;
  subject?: string;
  defaultPackagePrice: number;
  defaultDurationMinutes: number;
  startDate: string;
  expectedEndDate?: string;
  note?: string;
  status: ClassStatus;
  schedules: RecurringScheduleInput[];
}

export interface ClassListItem {
  id: number;
  name: string;
  type: ClassType;
  subject: string | null;
  status: ClassStatus;
  defaultPackagePrice: number;
  defaultDurationMinutes: number;
  activeStudentCount: number;
  paymentDueCount: number;
}

export interface ClassDetail extends ClassListItem {
  startDate: string;
  expectedEndDate: string | null;
  closedAt: string | null;
  note: string | null;
  schedules: Array<RecurringScheduleInput & { id: number }>;
  students: Array<{
    enrollmentId: number;
    studentId: number;
    fullName: string;
    nickname: string | null;
    tuitionMode: "CLASS_DEFAULT" | "CUSTOM" | "FREE";
    currentProgress: number | null;
    hasPaymentDue: boolean;
  }>;
}
