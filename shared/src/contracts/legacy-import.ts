import type { ClassStatus } from "./classes.js";

export type LegacyReconciliationStatus =
  | "MATCHED"
  | "LEARNING_ONLY_ABSENT"
  | "LEARNING_ONLY_NEEDS_REVIEW"
  | "TUITION_ONLY_NEEDS_REVIEW"
  | "DATE_CORRECTION_SUGGESTED"
  | "DUPLICATE_SUSPECTED"
  | "UNRESOLVED_DATE";

export type LegacyDateResolution =
  | "EXACT"
  | "TUITION_REFERENCE"
  | "SEQUENCE_INFERENCE"
  | "UNRESOLVED";

export interface LegacyLearningLessonPreview {
  id: string;
  originalDate: string;
  normalizedDate: string | null;
  dateResolution: LegacyDateResolution;
  suggestedDate: string | null;
  teacher: string | null;
  studentName: string | null;
  nickname: string | null;
  content: string | null;
  homework: string | null;
  classwork: string | null;
  note: string | null;
  attendanceStatus: "PRESENT" | "ABSENT";
  billingType: "BILLABLE" | "NONE";
  sourceSheet: "Quá trình học tập";
  sourceRow: number;
  reconciliationStatus: LegacyReconciliationStatus;
  matchedTuitionSourceRow: number | null;
}

export interface LegacyTuitionRowPreview {
  id: string;
  date: string | null;
  time: string | null;
  paidMarker: boolean;
  sourceSheet: "Học phí";
  sourceRow: number;
  reconciliationStatus: LegacyReconciliationStatus;
  matchedLearningSourceRow: number | null;
}

export type LegacyPaymentResolution =
  | "PREVIOUS_CYCLE"
  | "CURRENT_CYCLE_ADVANCE"
  | "SETTLE_INCOMPLETE"
  | "UNDETERMINED";

export interface LegacyPaymentEventPreview {
  id: string;
  date: string | null;
  sourceRow: number;
  recommendedResolution: LegacyPaymentResolution;
  resolutionOptions: LegacyPaymentResolution[];
  requiresReview: boolean;
}

export interface LegacyTuitionCyclePreview {
  cycleNumber: number;
  lessonSourceRows: number[];
  fromDate: string | null;
  toDate: string | null;
  itemCount: number;
  state: "COMPLETE" | "CURRENT";
  paymentState: "PAID_CLEAR" | "UNPAID" | "NEEDS_REVIEW";
}

export type LegacyClassMapping =
  | { type: "EXISTING_CLASS"; classId: number; className: string }
  | { type: "CURRENT_CLASS"; classId: number; className: string }
  | { type: "CREATE_CLOSED_CLASS"; proposedName: string };

export interface LegacyAcademicPeriodPreview {
  id: string;
  fromDate: string;
  toDate: string | null;
  schoolYear: string;
  gradeLevel: number | null;
  proposedClassMapping: LegacyClassMapping;
  lessonCount: number;
}

export interface LegacyClassCandidate {
  id: number;
  name: string;
  status: ClassStatus;
  isCurrent: boolean;
}

export interface LegacyImportPreviewSummary {
  totalLessons: number;
  presentLessons: number;
  absentLessons: number;
  academicPeriodCount: number;
  completedCycleCount: number;
  paidCycleCount: number;
  currentCycleProgress: number;
  hasAdvancePayment: boolean | null;
  unresolvedIssueCount: number;
}

export interface LegacyImportPreview {
  mode: "PREVIEW_ONLY";
  student: { id: number; fullName: string; currentClassId: number | null; currentClassName: string | null };
  file: { name: string; size: number; sha256: string };
  lessons: LegacyLearningLessonPreview[];
  tuitionRows: LegacyTuitionRowPreview[];
  paymentEvents: LegacyPaymentEventPreview[];
  tuitionCycles: LegacyTuitionCyclePreview[];
  academicPeriods: LegacyAcademicPeriodPreview[];
  classCandidates: LegacyClassCandidate[];
  summary: LegacyImportPreviewSummary;
  warnings: string[];
}
