import type { GoogleDriveSettings } from "../../config/google-drive-settings";
import { classifyGoogleError } from "./google-integration.errors";
import { createGoogleOAuthClient } from "./google-auth.client";
import { GoogleDriveClient } from "./google-drive.client";
import { googleLearningRowValues, googleVocabularyAttemptRowValues, GoogleSheetTemplateService, safeGoogleCell } from "./google-sheet-template.service";
import { GoogleSheetsClient } from "./google-sheets.client";
import type { CreateManagedSpreadsheetInput, GoogleSheetProvider, ManagedSpreadsheet, StudentGoogleSheetSnapshot } from "./google-integration.types";

export class GoogleApiSheetProvider implements GoogleSheetProvider {
  private readonly drive: GoogleDriveClient;
  private readonly sheets: GoogleSheetsClient;
  private readonly template = new GoogleSheetTemplateService();
  constructor(private readonly settings: GoogleDriveSettings) {
    const auth = createGoogleOAuthClient(settings);
    this.drive = new GoogleDriveClient(auth);
    this.sheets = new GoogleSheetsClient(auth);
  }
  async assertReady(rootFolderId: string): Promise<void> {
    try { await this.drive.assertFolder(rootFolderId); } catch (error) {
      throw classifyGoogleError(error, "ROOT_FOLDER_MISSING");
    }
  }
  async findByRecordId(recordId: number): Promise<ManagedSpreadsheet | null> {
    try { return await this.drive.findByRecordId(recordId); } catch (error) {
      throw classifyGoogleError(error, "SPREADSHEET_MISSING");
    }
  }
  async create(input: CreateManagedSpreadsheetInput): Promise<ManagedSpreadsheet> {
    try {
      const spreadsheetId = await this.sheets.create(input.name);
      return await this.drive.attachSpreadsheet(spreadsheetId, input);
    } catch (error) { throw classifyGoogleError(error, "SPREADSHEET_MISSING"); }
  }
  async render(resource: ManagedSpreadsheet, snapshot: StudentGoogleSheetSnapshot, metadata: {
    templateVersion: string; recordId: number; generatedAt: string; syncedAt?: string | null;
  }): Promise<void> {
    try {
      const ids = await this.sheets.ensureSheets(resource.spreadsheetId, this.template.sheetNames);
      const plan = this.template.build(snapshot, resource.spreadsheetId, ids, metadata);
      await this.sheets.clearAndWrite(resource.spreadsheetId, plan.values, plan.requests);
    } catch (error) { throw classifyGoogleError(error, "SPREADSHEET_MISSING"); }
  }
  async syncLesson(
    resource: ManagedSpreadsheet,
    row: StudentGoogleSheetSnapshot["learning"][number] | null,
    overview: StudentGoogleSheetSnapshot["overview"] & {
      currentClass: string; currentGrade: string; currentAcademicYear: string;
    },
    lessonId: number,
    syncedAt: string,
  ): Promise<void> {
    try {
      await this.sheets.syncLearningRow(resource.spreadsheetId, lessonId, row ? googleLearningRowValues(row) : null, [
        { range: "B4", value: safeGoogleCell(overview.currentAcademicYear) },
        { range: "B5", value: safeGoogleCell(overview.currentGrade) },
        { range: "B6", value: safeGoogleCell(overview.currentClass) },
        { range: "B8", value: syncedAt },
        { range: "B10", value: `${overview.currentProgress}/8` },
        { range: "B11", value: `${overview.attendanceRate}%` },
        { range: "B12", value: safeGoogleCell(overview.latestLesson) },
        { range: "B15", value: safeGoogleCell(overview.latestComment) },
        { range: "B16", value: safeGoogleCell(overview.latestHomework) },
      ], syncedAt);
    } catch (error) { throw classifyGoogleError(error); }
  }
  async syncVocabularyAttempt(
    resource: ManagedSpreadsheet,
    row: StudentGoogleSheetSnapshot["vocabularyAttempts"][number],
    attemptId: number,
    syncedAt: string,
  ): Promise<void> {
    try {
      await this.sheets.syncVocabularyRow(
        resource.spreadsheetId,
        attemptId,
        googleVocabularyAttemptRowValues(row),
        syncedAt,
      );
    } catch (error) { throw classifyGoogleError(error); }
  }
  async trash(spreadsheetId: string): Promise<void> {
    try { await this.drive.trash(spreadsheetId); } catch (error) {
      throw classifyGoogleError(error, "SPREADSHEET_MISSING");
    }
  }
}
