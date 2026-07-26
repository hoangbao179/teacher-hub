import type { CreateStudentGoogleSheetRequest, StudentGoogleSheetMutationResult, StudentGoogleSheetState } from "@teacher/shared";
import type { GoogleDriveSettings } from "../config/google-drive-settings";
import { AppError } from "../errors/app-error";
import { GoogleIntegrationError, classifyGoogleError } from "../integrations/google/google-integration.errors";
import type { GoogleSheetProvider, ManagedSpreadsheet } from "../integrations/google/google-integration.types";
import { StudentGoogleSheetRepository } from "../repositories/student-google-sheet.repository";
import { StudentService } from "./student.service";

function providerError(error: unknown): AppError {
  const classified = classifyGoogleError(error);
  const status = classified.failureCode === "RATE_LIMITED" ? 429 : 503;
  return new AppError(status, `GOOGLE_${classified.failureCode}`, classified.message, { retryable: classified.retryable });
}

function safeName(name: string): string {
  return `Sổ theo dõi - ${name.replace(/[\u0000-\u001f/\\]/g, " ").replace(/\s+/g, " ").trim()}`.slice(0, 240);
}

export class StudentGoogleSheetService {
  constructor(private readonly repository: StudentGoogleSheetRepository, private readonly students: StudentService,
    private readonly settings: GoogleDriveSettings, private readonly provider: GoogleSheetProvider | null) {}

  async state(studentId: number): Promise<StudentGoogleSheetState> {
    await this.students.detail(studentId);
    return { enabled: this.settings.enabled, ownerLabel: this.settings.enabled ? this.settings.ownerLabel : null,
      sheet: await this.repository.get(studentId) };
  }

  async create(studentId: number, input: CreateStudentGoogleSheetRequest, actorUserId: number): Promise<StudentGoogleSheetMutationResult> {
    return this.generate(studentId, input, actorUserId, false);
  }

  async retry(studentId: number, actorUserId: number): Promise<StudentGoogleSheetMutationResult> {
    return this.generate(studentId, {}, actorUserId, true);
  }

  private async generate(studentId: number, input: CreateStudentGoogleSheetRequest, actorUserId: number, retry: boolean): Promise<StudentGoogleSheetMutationResult> {
    const provider = this.requireProvider();
    if (input.forceRegenerate) throw new AppError(400, "VALIDATION_ERROR", "Hãy dùng thao tác tạo lại nội dung.");
    const student = await this.students.detail(studentId);
    const claim = await this.repository.claim({ studentId, legacyImportId: input.legacyImportId,
      fileName: safeName(student.fullName), rootFolderId: this.settings.rootFolderId, templateVersion: this.settings.templateVersion }, retry);
    if (claim.sheet.status === "ACTIVE") return { sheet: claim.sheet, reused: true };
    if (!claim.owner && !retry) return { sheet: claim.sheet, reused: true };
    let resource: ManagedSpreadsheet | null = null;
    try {
      await provider.assertReady(this.settings.rootFolderId);
      resource = await provider.findByRecordId(claim.sheet.id);
      if (!claim.owner && !resource) return { sheet: claim.sheet, reused: true };
      resource ??= await provider.create({ name: claim.sheet.fileName, rootFolderId: this.settings.rootFolderId,
        appProperties: { teacherHubManaged: "true", studentId: String(studentId), studentGoogleSheetRecordId: String(claim.sheet.id),
          templateVersion: this.settings.templateVersion } });
      const snapshot = await this.repository.snapshot(studentId);
      await provider.render(resource, snapshot, { templateVersion: this.settings.templateVersion, recordId: claim.sheet.id,
        generatedAt: new Date().toISOString(), syncedAt: null });
    } catch (error) {
      const classified = classifyGoogleError(error);
      await this.repository.fail(claim.sheet.id, classified.message, resource?.spreadsheetId);
      throw providerError(classified);
    }
    if (!resource) throw new AppError(500, "GOOGLE_MALFORMED_TEMPLATE", "Google không trả về tài nguyên hợp lệ.");
    try {
      return { sheet: await this.repository.finalize(claim.sheet.id, resource, actorUserId), reused: !claim.owner };
    } catch (error) {
      try { await provider.trash(resource.spreadsheetId); } catch (cleanupError) {
        const cleanup = classifyGoogleError(cleanupError);
        console.error(JSON.stringify({ level: "error", event: "google_sheet_orphan_cleanup_failed", error: cleanup.failureCode }));
      }
      await this.repository.fail(claim.sheet.id, "Không thể hoàn tất liên kết Google Sheet sau khi tạo.", resource.spreadsheetId);
      throw error;
    }
  }

  async regenerate(studentId: number, actorUserId: number): Promise<StudentGoogleSheetMutationResult> {
    const provider = this.requireProvider();
    await this.students.detail(studentId);
    const sheet = await this.repository.get(studentId);
    if (!sheet || sheet.status !== "ACTIVE") throw new AppError(409, "GOOGLE_SHEET_NOT_ACTIVE", "Học sinh chưa có Google Sheet đang hoạt động.");
    try {
      const resource = await provider.findByRecordId(sheet.id);
      if (!resource) throw new GoogleIntegrationError("ROOT_FOLDER_MISSING", "Không tìm thấy Google Sheet đã liên kết.", false);
      await provider.render(resource, await this.repository.snapshot(studentId), { templateVersion: sheet.templateVersion,
        recordId: sheet.id, generatedAt: new Date().toISOString(), syncedAt: sheet.lastSyncedAt });
      return { sheet: await this.repository.regenerated(sheet.id, actorUserId), reused: true };
    } catch (error) {
      const classified = classifyGoogleError(error);
      await this.repository.recordRegenerationError(sheet.id, classified.message);
      throw providerError(classified);
    }
  }

  async archive(studentId: number, actorUserId: number): Promise<StudentGoogleSheetMutationResult> {
    await this.students.detail(studentId);
    return { sheet: await this.repository.archive(studentId, actorUserId), reused: true };
  }

  private requireProvider(): GoogleSheetProvider {
    if (!this.settings.enabled || !this.provider)
      throw new AppError(503, "GOOGLE_INTEGRATION_DISABLED", "Google Drive chưa được bật trên máy chủ.", { retryable: false });
    return this.provider;
  }
}
