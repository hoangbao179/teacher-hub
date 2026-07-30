export interface GoogleLearningRow {
  lessonId: number;
  lessonType: "REGULAR" | "MAKEUP" | "EXTRA";
  scheduledStartTime: string;
  scheduledEndTime: string;
  academicYear: string;
  grade: string;
  className: string;
  date: string;
  attendance: "PRESENT" | "ABSENT" | "FREE";
  billable: boolean;
  cycleId: number | null;
  cycleSequence: number | null;
  content: string;
  homework: string;
  generalComment: string;
  studentComment: string;
  updatedAt: string;
}

export interface GoogleTuitionRow {
  cycleId: number;
  cycleNumber: number;
  academicYear: string;
  className: string;
  fromDate: string;
  toDate: string;
  billableCount: number;
  absentCount: number;
  totalLessonCount: number;
  packagePrice: number;
  status: "ACCUMULATING" | "PAYMENT_DUE" | "PAID" | "INCOMPLETE";
  paidAt: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "";
  startedAt: string;
  reachedTargetAt: string;
  sessions: Array<{
    sequenceNumber: number;
    sessionDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
  }>;
}

export interface GoogleVocabularyAttemptRow {
  attemptId: number;
  completedAt: string;
  assignmentTitle: string;
  className: string;
  ageBand: string;
  attemptNumber: number;
  scoredQuestionCount: number;
  correctFirstTry: number;
  finalCorrect: number;
  scorePercent: number | null;
  masteredWords: number;
  learningWords: number;
  needsReviewWords: number;
  reviewWordList: string;
  status: string;
  updatedAt: string;
}

export interface StudentGoogleSheetSnapshot {
  student: { id: number; fullName: string; currentClass: string; currentGrade: string; currentAcademicYear: string };
  overview: { currentProgress: number; attendanceRate: number; latestLesson: string; tuitionStatus: string;
    latestComment: string; latestHomework: string; teacher: string };
  learning: GoogleLearningRow[];
  tuition: GoogleTuitionRow[];
  vocabularyAttempts: GoogleVocabularyAttemptRow[];
}

export interface ManagedSpreadsheet {
  spreadsheetId: string;
  webViewUrl: string;
  name: string;
}

export interface CreateManagedSpreadsheetInput {
  name: string;
  rootFolderId: string;
  appProperties: Record<string, string>;
}

export interface GoogleSheetProvider {
  findByRecordId(recordId: number): Promise<ManagedSpreadsheet | null>;
  create(input: CreateManagedSpreadsheetInput): Promise<ManagedSpreadsheet>;
  rename(resource: ManagedSpreadsheet, name: string): Promise<ManagedSpreadsheet>;
  render(resource: ManagedSpreadsheet, snapshot: StudentGoogleSheetSnapshot, metadata: {
    templateVersion: string; recordId: number; generatedAt: string; syncedAt?: string | null;
  }): Promise<void>;
  syncLesson(
    resource: ManagedSpreadsheet,
    row: GoogleLearningRow | null,
    overview: StudentGoogleSheetSnapshot["overview"] & {
      currentClass: string;
      currentGrade: string;
      currentAcademicYear: string;
    },
    lessonId: number,
    tuition: StudentGoogleSheetSnapshot["tuition"],
    syncedAt: string,
  ): Promise<void>;
  syncVocabularyAttempt(
    resource: ManagedSpreadsheet,
    row: GoogleVocabularyAttemptRow,
    attemptId: number,
    syncedAt: string,
  ): Promise<void>;
  trash(spreadsheetId: string): Promise<void>;
  assertReady(rootFolderId: string): Promise<void>;
}
