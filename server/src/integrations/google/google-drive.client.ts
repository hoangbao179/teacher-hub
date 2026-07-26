import { google, type drive_v3 } from "googleapis";
import type { CreateManagedSpreadsheetInput, ManagedSpreadsheet } from "./google-integration.types";

type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

export class GoogleDriveClient {
  private readonly drive: drive_v3.Drive;
  constructor(auth: GoogleOAuthClient) { this.drive = google.drive({ version: "v3", auth }); }

  async assertFolder(folderId: string): Promise<void> {
    const result = await this.drive.files.get({ fileId: folderId, fields: "id,mimeType,trashed" });
    if (result.data.trashed || result.data.mimeType !== "application/vnd.google-apps.folder")
      throw Object.assign(new Error("root folder missing"), { code: 404 });
  }

  async findByRecordId(recordId: number): Promise<ManagedSpreadsheet | null> {
    const result = await this.drive.files.list({
      q: `trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and appProperties has { key='studentGoogleSheetRecordId' and value='${recordId}' }`,
      spaces: "drive", fields: "files(id,name,webViewLink)", pageSize: 2,
    });
    const file = result.data.files?.[0];
    return file?.id ? { spreadsheetId: file.id, name: file.name ?? "Sổ theo dõi",
      webViewUrl: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}/edit` } : null;
  }

  async attachSpreadsheet(spreadsheetId: string, input: CreateManagedSpreadsheetInput): Promise<ManagedSpreadsheet> {
    const current = await this.drive.files.get({ fileId: spreadsheetId, fields: "parents" });
    const removeParents = current.data.parents?.filter((id) => id !== input.rootFolderId).join(",") || undefined;
    const result = await this.drive.files.update({ fileId: spreadsheetId, addParents: input.rootFolderId,
      removeParents, requestBody: { name: input.name, appProperties: input.appProperties },
      fields: "id,name,webViewLink" });
    return { spreadsheetId, name: result.data.name ?? input.name,
      webViewUrl: result.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
  }

  async trash(spreadsheetId: string): Promise<void> {
    await this.drive.files.update({ fileId: spreadsheetId, requestBody: { trashed: true } });
  }
}
