import type { ClassStatus } from "./classes.js";
import type { AttendanceStatus } from "./lessons.js";

export type LegacyImportRowStatus = "VALID" | "NEEDS_REVIEW" | "BLOCKED" | "RESOLVED" | "SKIPPED";

export type LegacyImportIssueCode =
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "STUDENT_MISMATCH"
  | "ATTENDANCE_AMBIGUOUS"
  | "DUPLICATE_ROW"
  | "DATE_CORRECTION"
  | "TUITION_ROW_UNMATCHED"
  | "ACADEMIC_PERIOD_MAPPING_REQUIRED"
  | "PAYMENT_REVIEW_REQUIRED"
  | "NEAR_LESSON_MATCH"
  | "LESSON_CONTENT_CONFLICT"
  | "TIME_MAPPING_REQUIRED"
  | "TUITION_DATE_CORRECTION"
  | "TUITION_ONLY_GROUP"
  | "PAYMENT_BLOCK_REVIEW_REQUIRED";

export type LegacyImportErrorCode =
  | "LEGACY_FILE_REQUIRED"
  | "LEGACY_FILE_TOO_LARGE"
  | "INVALID_XLSX_TYPE"
  | "INVALID_XLSX_SIGNATURE"
  | "INVALID_XLSX"
  | "LEGACY_SHEETS_MISSING"
  | "LEGACY_PREVIEW_SHA_MISMATCH"
  | "LEGACY_DECISIONS_INVALID"
  | "LEGACY_ROWS_UNRESOLVED"
  | "LEGACY_IMPORT_DUPLICATE"
  | "LEGACY_PAID_CYCLE_CONFLICT";

export type LegacyImportDecisionAction =
  | "EDIT_ROW"
  | "CONFIRM_STUDENT"
  | "SET_ATTENDANCE"
  | "MAP_ACADEMIC_PERIOD"
  | "MATCH_EXISTING_LESSON"
  | "CREATE_LESSON"
  | "KEEP_EXISTING_LESSON"
  | "USE_IMPORTED_LESSON"
  | "EDIT_LESSON_CONTENT"
  | "CONFIRM_PAYMENT"
  | "CONFIRM_TIME_MAPPING"
  | "CREATE_MINIMAL_LEGACY_LESSONS"
  | "EXCLUDE_FINANCE_BLOCK"
  | "SKIP";

export type LegacyImportSkipReason =
  | "UNIDENTIFIABLE_DATA"
  | "DUPLICATE_ROW"
  | "WRONG_STUDENT"
  | "NOT_NEEDED"
  | "OTHER";

export interface LegacyImportDecisionBase {
  sourceSheet: string;
  sourceRow: number;
  issueCode: LegacyImportIssueCode;
  action: LegacyImportDecisionAction;
}

export interface LegacyImportRowResolution extends LegacyImportDecisionBase {
  action: "EDIT_ROW";
  resolvedValue: {
    date?: string;
    startTime?: string;
    endTime?: string;
    content?: string;
    homework?: string;
    studentNote?: string;
  };
}

export interface LegacyImportSkipDecision extends LegacyImportDecisionBase {
  action: "SKIP";
  reason: LegacyImportSkipReason;
  otherReason?: string;
}

export interface LegacyImportLessonMatchDecision extends LegacyImportDecisionBase {
  action: "MATCH_EXISTING_LESSON" | "CREATE_LESSON" | "KEEP_EXISTING_LESSON" |
    "USE_IMPORTED_LESSON" | "EDIT_LESSON_CONTENT";
  lessonId?: number;
  resolvedValue?: { content?: string; homework?: string };
}

export interface LegacyImportAttendanceDecision extends LegacyImportDecisionBase {
  action: "SET_ATTENDANCE";
  resolvedValue: AttendanceStatus;
}

export interface LegacyAcademicPeriodDecision extends LegacyImportDecisionBase {
  action: "MAP_ACADEMIC_PERIOD";
  resolvedValue: {
    periodId: string;
    gradeLevel: number;
    classMapping: LegacyClassMapping;
  };
}

export interface LegacyImportStudentDecision extends LegacyImportDecisionBase {
  action: "CONFIRM_STUDENT";
  resolvedValue: { studentId: number };
}

export interface LegacyImportPaymentDecision extends LegacyImportDecisionBase {
  action: "CONFIRM_PAYMENT";
  resolvedValue: LegacyPaymentResolution;
}

export interface LegacyImportTimeMappingDecision extends LegacyImportDecisionBase {
  action: "CONFIRM_TIME_MAPPING";
  resolvedValue: { mappingId: string; startTime: string; endTime: string };
}

export interface LegacyMinimalLessonDecision extends LegacyImportDecisionBase {
  action: "CREATE_MINIMAL_LEGACY_LESSONS";
  resolvedValue: { groupId: string; tuitionSourceRows: number[] };
}

export interface LegacyExcludeFinanceDecision extends LegacyImportDecisionBase {
  action: "EXCLUDE_FINANCE_BLOCK";
  resolvedValue: { blockId: string };
}

export type LegacyImportRowDecision =
  | LegacyImportRowResolution
  | LegacyImportSkipDecision
  | LegacyImportLessonMatchDecision
  | LegacyImportAttendanceDecision
  | LegacyAcademicPeriodDecision
  | LegacyImportStudentDecision
  | LegacyImportPaymentDecision
  | LegacyImportTimeMappingDecision
  | LegacyMinimalLessonDecision
  | LegacyExcludeFinanceDecision;

export interface LegacyImportApplyRequest {
  previewSha256: string;
  decisions: LegacyImportRowDecision[];
}

export interface LegacyImportRowPreview {
  id: string;
  rowType: "LESSON" | "TUITION" | "TUITION_GROUP" | "PAYMENT" | "ACADEMIC_PERIOD" | "TIME_MAPPING";
  sourceSheet: string;
  sourceRow: number;
  rawValues: Record<string, string | number | boolean | null>;
  normalizedValues: Record<string, string | number | boolean | null>;
  issueCodes: LegacyImportIssueCode[];
  status: LegacyImportRowStatus;
  supportedActions: LegacyImportDecisionAction[];
  suggestedResolution?: LegacyImportRowDecision;
}

export interface LegacyImportApplyResult {
  importId: number;
  idempotent: boolean;
  acceptedRowCount: number;
  resolvedRowCount: number;
  skippedRowCount: number;
  importedLessonCount: number;
  matchedLessonCount: number;
  importedAttendanceCount: number;
  importedClassCount: number;
  importedEnrollmentCount: number;
  importedTuitionCycleCount: number;
}

export type LegacyReconciliationStatus =
  | "MATCHED"
  | "LEARNING_ONLY_ABSENT"
  | "LEARNING_ONLY_PRESENT"
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
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  dateResolution: LegacyDateResolution;
  suggestedDate: string | null;
  teacher: string | null;
  studentName: string | null;
  nickname: string | null;
  content: string | null;
  homework: string | null;
  classwork: string | null;
  note: string | null;
  attendanceStatus: "PRESENT" | "ABSENT" | "FREE";
  billingType: "BILLABLE" | "NONE";
  sourceSheet: "Quá trình học tập";
  sourceRow: number;
  reconciliationStatus: LegacyReconciliationStatus;
  matchedTuitionSourceRow: number | null;
  rawTime: string | null;
  timeMappingId: string | null;
}

export interface LegacyTuitionRowPreview {
  id: string;
  date: string | null;
  suggestedDate: string | null;
  time: string | null;
  paidMarker: boolean;
  offMarker: boolean;
  kind: LegacyTuitionRowKind;
  sourceSheet: "Học phí";
  sourceRow: number;
  reconciliationStatus: LegacyReconciliationStatus;
  matchedLearningSourceRow: number | null;
  blockId: string;
  postPaidFree: boolean;
}

export interface LegacyTuitionBlockPreview {
  id: string;
  sourceStartRow: number;
  sourceEndRow: number;
  paidMarkerSourceRow: number | null;
  unpaidMarkerSourceRow: number | null;
  tuitionSourceRows: number[];
  paidCandidateSourceRows: number[];
}

export interface LegacyTimeMappingPreview {
  id: string;
  periodId: string;
  rawValues: string[];
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  reason: "AMBIGUOUS_12H" | "TYPO_SUGGESTION";
  lessonSourceRows: number[];
  tuitionSourceRows: number[];
}

export type LegacyPaymentResolution =
  | "PREVIOUS_CYCLE"
  | "CURRENT_CYCLE_ADVANCE"
  | "SETTLE_INCOMPLETE"
  | "PAID_UNDATED"
  | "UNPAID"
  | "EXCLUDE_FINANCE"
  | "UNDETERMINED";

export interface LegacyPaymentEventPreview {
  id: string;
  date: string | null;
  sourceRow: number;
  recommendedResolution: LegacyPaymentResolution;
  resolutionOptions: LegacyPaymentResolution[];
  requiresReview: boolean;
  blockId: string;
  kind: "PAID_MARKER" | "MISSING_PAYMENT_STATUS" | "INCOMPLETE_PAID_BLOCK";
  billableCount: number;
}

export interface LegacyTuitionCyclePreview {
  cycleNumber: number;
  lessonSourceRows: number[];
  fromDate: string | null;
  toDate: string | null;
  itemCount: number;
  state: "COMPLETE" | "CURRENT";
  paymentState: "PAID_CLEAR" | "UNPAID" | "NEEDS_REVIEW";
  blockId: string;
  tuitionSourceRows: number[];
}

export type LegacyTuitionRowKind = "BILLABLE" | "FREE" | "ABSENT" | "OFF";

export interface LegacyMinimalLessonGroupPreview {
  id: string;
  tuitionSourceRows: number[];
  lessonCount: number;
  fromDate: string;
  toDate: string;
}

export interface LegacyTuitionCyclePlan {
  blockId: string;
  lessonSourceRows: number[];
  tuitionSourceRows: number[];
  attendanceKind: "BILLABLE";
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
  freeLessonCount: number;
  currentCycleProgress: number;
  hasAdvancePayment: boolean | null;
  unresolvedIssueCount: number;
  validRowCount: number;
  needsReviewRowCount: number;
  blockedRowCount: number;
  resolvedRowCount: number;
  skippedRowCount: number;
  expectedLessonCount: number;
  expectedTuitionCycleCount: number;
}

export interface LegacyImportPreview {
  mode: "PREVIEW_ONLY";
  student: { id: number; fullName: string; currentClassId: number | null; currentClassName: string | null };
  file: { name: string; size: number; sha256: string };
  lessons: LegacyLearningLessonPreview[];
  tuitionRows: LegacyTuitionRowPreview[];
  tuitionBlocks: LegacyTuitionBlockPreview[];
  paymentEvents: LegacyPaymentEventPreview[];
  tuitionCycles: LegacyTuitionCyclePreview[];
  tuitionCyclePlans: LegacyTuitionCyclePlan[];
  minimalLessonGroups: LegacyMinimalLessonGroupPreview[];
  timeMappings: LegacyTimeMappingPreview[];
  academicPeriods: LegacyAcademicPeriodPreview[];
  classCandidates: LegacyClassCandidate[];
  rows: LegacyImportRowPreview[];
  summary: LegacyImportPreviewSummary;
  warnings: string[];
}
