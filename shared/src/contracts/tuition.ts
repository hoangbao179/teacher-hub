export type TuitionCycleStatus =
  | "ACCUMULATING"
  | "PAYMENT_DUE"
  | "PAID"
  | "INCOMPLETE"
  | "CANCELLED";

export type TuitionCycleSort = "OLDEST_DUE" | "NEWEST" | "STUDENT_NAME";

export interface TuitionCycleListQuery {
  status?: Exclude<TuitionCycleStatus, "CANCELLED">;
  classId?: number;
  studentId?: number;
  enrollmentId?: number;
  search?: string;
  from?: string;
  to?: string;
  sort?: TuitionCycleSort;
  page?: number;
  pageSize?: number;
}

export interface TuitionCycleListItem {
  id: number;
  enrollmentId: number;
  cycleNumber: number;
  status: TuitionCycleStatus;
  studentId: number;
  studentName: string;
  studentNickname: string | null;
  classId: number;
  className: string;
  packagePriceSnapshot: number;
  itemCount: number;
  targetCount: 8;
  progress: number;
  startedAt: string | null;
  reachedTargetAt: string | null;
  paidAt: string | null;
  activeNextCycleProgress: number | null;
}

export interface TuitionCycleDetail extends TuitionCycleListItem {
  paidAmount: number | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | null;
  paymentNote: string | null;
  items: Array<{
    sequenceNumber: number;
    attendanceId: number;
    lessonId: number;
    sessionDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    actualStartTime: string | null;
    actualEndTime: string | null;
    actualDurationMinutes: number | null;
    lessonType: "REGULAR" | "MAKEUP" | "EXTRA";
    attendanceStatus: "PRESENT";
  }>;
}

export interface MarkTuitionPaidRequest {
  paidAmount: number;
  paidAt: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentNote?: string;
}

export interface MarkTuitionPaidResult {
  cycleId: number;
  status: "PAID";
  paidAmount: number;
  paidAt: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentNote: string | null;
  idempotent: boolean;
}

export interface TuitionSummaryQuery {
  from?: string;
  to?: string;
}

export interface TuitionSummary {
  paymentDueCount: number;
  totalUnpaidAmount: number;
  accumulatingEnrollmentCount: number;
  paidCycleCount: number;
  from: string | null;
  to: string | null;
}
