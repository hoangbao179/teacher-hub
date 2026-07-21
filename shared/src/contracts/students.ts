export type StudentStatus = "ACTIVE" | "INACTIVE";
export type EnrollmentStatus = "ACTIVE" | "PAUSED" | "ENDED";
export type TuitionMode = "CLASS_DEFAULT" | "CUSTOM" | "FREE";

export interface CreateStudentRequest {
  fullName: string;
  nickname?: string;
  dateOfBirth?: string;
  parentName?: string;
  parentPhone?: string;
  note?: string;
}

export interface UpdateStudentRequest {
  fullName: string;
  nickname?: string;
  dateOfBirth?: string;
  parentName?: string;
  parentPhone?: string;
  note?: string;
  status: StudentStatus;
}

export interface CreateEnrollmentRequest {
  studentId: number;
  joinedAt: string;
  tuitionMode: TuitionMode;
  customPackagePrice?: number;
  note?: string;
}

export interface UpdateEnrollmentRequest {
  joinedAt?: string;
  status?: EnrollmentStatus;
  note?: string;
}

export interface EndEnrollmentRequest {
  endedAt: string;
  reason?: string;
  note?: string;
  incompleteCycleAction?: IncompleteCycleAction;
  advanceReceiptAction?: EndAdvanceReceiptAction;
}

import type { PaymentMethod } from "./tuition.js";

export type IncompleteCycleAction =
  | { type: "KEEP_OPEN" }
  | { type: "SETTLE"; amount: number; method: PaymentMethod; note?: string }
  | { type: "WAIVE"; reason: string };

export type EndAdvanceReceiptAction =
  | { type: "APPLY_TO_OLD_SETTLEMENT" }
  | { type: "REFUND"; note?: string }
  | { type: "NONE" };

export interface TransferEnrollmentRequest {
  targetClassId: number;
  effectiveDate: string;
  tuitionMode: TuitionMode;
  customPackagePrice?: number;
  reason: string;
  note?: string;
  incompleteCycleAction: IncompleteCycleAction;
  advanceReceiptAction?:
    | { type: "TRANSFER_TO_NEW_ENROLLMENT" }
    | EndAdvanceReceiptAction;
}

export interface TransferEnrollmentResult {
  oldEnrollmentId: number;
  newEnrollmentId: number;
  effectiveDate: string;
}

export interface ChangeEnrollmentStatusRequest {
  effectiveDate: string;
  reason?: string;
}

export interface StudentListItem {
  id: number;
  fullName: string;
  nickname: string | null;
  status: StudentStatus;
  parentName: string | null;
  parentPhone: string | null;
  classId: number | null;
  className: string | null;
  enrollmentId: number | null;
  enrollmentStatus: EnrollmentStatus | null;
  tuitionMode: TuitionMode | null;
  customPackagePrice: number | null;
  currentProgress: number | null;
  hasPaymentDue: boolean;
}

export interface StudentDetail extends StudentListItem {
  dateOfBirth: string | null;
  note: string | null;
  joinedAt: string | null;
  effectivePackagePrice: number | null;
  incompleteCycle: { id: number; itemCount: number; settlementStatus: "OPEN" | "SETTLED" | "WAIVED" } | null;
  advanceReceipt: { id: number; amount: number; status: "AVAILABLE" | "ALLOCATED" | "TRANSFERRED" } | null;
}

export interface ChangeTuitionModeRequest {
  tuitionMode: TuitionMode;
  customPackagePrice?: number;
  effectiveFrom: string;
  reason?: string;
}
