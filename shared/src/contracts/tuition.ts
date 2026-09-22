export type MonthlyTuitionStatus = "UNPAID" | "PAID";

export interface MonthlyTuitionQuery {
  year: number;
  month: number;
  classId?: number;
  search?: string;
}

export interface MonthlyTuitionAttendanceSummary {
  present: number;
  absent: number;
  total: number;
}

export interface MonthlyTuitionRow {
  paymentId: number | null;
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentNickname: string | null;
  classId: number;
  className: string;
  year: number;
  month: number;
  attendance: MonthlyTuitionAttendanceSummary;
  status: MonthlyTuitionStatus;
  amount: number | null;
  paidAt: string | null;
  note: string | null;
}

export interface MonthlyTuitionBoard {
  year: number;
  month: number;
  rows: MonthlyTuitionRow[];
  paidCount: number;
  unpaidCount: number;
}

export interface MarkMonthlyTuitionPaidRequest {
  amount?: number | null;
  paidAt: string;
  note?: string;
}

export interface MarkMonthlyTuitionPaidResult {
  payment: MonthlyTuitionRow;
  idempotent: boolean;
}
