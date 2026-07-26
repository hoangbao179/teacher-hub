import type { GoogleDriveSettings } from "../../config/google-drive-settings";
import { classifyGoogleError } from "./google-integration.errors";
import { createGoogleOAuthClient } from "./google-auth.client";
import { GoogleDriveClient } from "./google-drive.client";
import { GoogleSheetTemplateService } from "./google-sheet-template.service";
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
    try { await this.drive.assertFolder(rootFolderId); } catch (error) { throw classifyGoogleError(error); }
  }
  async findByRecordId(recordId: number): Promise<ManagedSpreadsheet | null> {
    try { return await this.drive.findByRecordId(recordId); } catch (error) { throw classifyGoogleError(error); }
  }
  async create(input: CreateManagedSpreadsheetInput): Promise<ManagedSpreadsheet> {
    try {
      const spreadsheetId = await this.sheets.create(input.name);
      return await this.drive.attachSpreadsheet(spreadsheetId, input);
    } catch (error) { throw classifyGoogleError(error); }
  }
  async render(resource: ManagedSpreadsheet, snapshot: StudentGoogleSheetSnapshot, metadata: {
    templateVersion: string; recordId: number; generatedAt: string; syncedAt?: string | null;
  }): Promise<void> {
    try {
      const ids = await this.sheets.ensureSheets(resource.spreadsheetId, this.template.sheetNames);
      const plan = this.template.build(snapshot, resource.spreadsheetId, ids, metadata);
      await this.sheets.clearAndWrite(resource.spreadsheetId, plan.values, plan.requests);
    } catch (error) { throw classifyGoogleError(error); }
  }
  async trash(spreadsheetId: string): Promise<void> {
    try { await this.drive.trash(spreadsheetId); } catch (error) { throw classifyGoogleError(error); }
  }
}
