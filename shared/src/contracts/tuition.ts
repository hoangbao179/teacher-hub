export type TuitionCycleStatus =
  | "ACCUMULATING"
  | "PAYMENT_DUE"
  | "PAID"
  | "INCOMPLETE"
  | "CANCELLED";

export interface TuitionCycleListItem {
  id: number;
  cycleNumber: number;
  status: TuitionCycleStatus;
  studentId: number;
  studentName: string;
  classId: number;
  className: string;
  packagePriceSnapshot: number;
  progress: number;
  startedAt: string | null;
  reachedTargetAt: string | null;
  paidAt: string | null;
}

export interface TuitionCycleDetail extends TuitionCycleListItem {
  items: Array<{
    sequenceNumber: number;
    attendanceId: number;
    sessionDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    actualStartTime: string | null;
    actualEndTime: string | null;
  }>;
}

export interface MarkTuitionPaidRequest {
  paidAmount: number;
  paidAt: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentNote?: string;
}
