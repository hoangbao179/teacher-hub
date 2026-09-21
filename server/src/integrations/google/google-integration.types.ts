export interface GoogleLearningRow {
  lessonId: number;
  className: string;
  date: string;
  attendance: "PRESENT" | "ABSENT" | "FREE";
  content: string;
  generalComment: string;
  studentComment: string;
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
  learning: GoogleLearningRow[];
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
    lessonId: number,
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
