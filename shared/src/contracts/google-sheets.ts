export type StudentGoogleSheetStatus = "CREATING" | "ACTIVE" | "GENERATION_ERROR" | "ARCHIVED";
export type StudentGoogleSheetSharingStatus = "RESTRICTED" | "MANUALLY_SHARED";

export interface StudentGoogleSheetInfo {
  id: number;
  studentId: number;
  legacyImportId: number | null;
  fileName: string;
  webViewUrl: string | null;
  templateVersion: string;
  status: StudentGoogleSheetStatus;
  sharingStatus: StudentGoogleSheetSharingStatus;
  lastGeneratedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface StudentGoogleSheetState {
  enabled: boolean;
  ownerLabel: string | null;
  sheet: StudentGoogleSheetInfo | null;
}

export interface CreateStudentGoogleSheetRequest {
  legacyImportId?: number;
  forceRegenerate?: boolean;
}

export interface StudentGoogleSheetMutationResult {
  sheet: StudentGoogleSheetInfo;
  reused: boolean;
}
