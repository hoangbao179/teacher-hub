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
}

export interface ChangeTuitionModeRequest {
  tuitionMode: TuitionMode;
  customPackagePrice?: number;
  effectiveFrom: string;
  reason?: string;
}
