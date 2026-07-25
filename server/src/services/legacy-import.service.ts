import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { LegacyImportApplyResult, LegacyImportPreview, LegacyImportRowDecision } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { LegacyWorkbookParser } from "../domain/legacy-workbook-parser";
import { LegacyReconciliationEngine } from "../domain/legacy-reconciliation-engine";
import { LegacyImportPreview as LegacyImportPreviewBuilder } from "../domain/legacy-import-preview";
import { StudentService } from "./student.service";
import { ClassService } from "./class.service";
import { resolveLegacyImportDecisions } from "../domain/legacy-import-decisions";
import { LegacyImportRepository } from "../repositories/legacy-import.repository";

export class LegacyImportService {
  constructor(
    private readonly students: StudentService,
    private readonly classes: ClassService,
    private readonly parser = new LegacyWorkbookParser(),
    private readonly reconciliation = new LegacyReconciliationEngine(),
    private readonly previewBuilder = new LegacyImportPreviewBuilder(),
    private readonly repository = new LegacyImportRepository(),
  ) {}

  async preview(studentId: number, filePath: string, originalName: string): Promise<LegacyImportPreview> {
    if (!Number.isInteger(studentId) || studentId < 1) {
      throw new AppError(400, "VALIDATION_ERROR", "Mã học sinh không hợp lệ.");
    }
    const [student, classItems, fileInfo, bytes] = await Promise.all([
      this.students.detail(studentId),
      this.classes.list(),
      stat(filePath),
      readFile(filePath),
    ]);
    if (fileInfo.size > 10 * 1024 * 1024) throw new AppError(413, "LEGACY_FILE_TOO_LARGE", "File XLSX không được vượt quá 10 MB.");
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      throw new AppError(400, "INVALID_XLSX_SIGNATURE", "Chữ ký file không phải XLSX hợp lệ.");
    }
    this.validateFile(fileInfo.size, bytes);
    const parsed = await this.parser.parse(filePath);
    const preview = this.previewBuilder.build(student, classItems, {
      name: basename(originalName),
      size: fileInfo.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }, this.reconciliation.reconcile(parsed));
    return this.repository.enrichPreview(preview);
  }

  async apply(
    studentId: number,
    filePath: string,
    originalName: string,
    previewSha256: string,
    decisions: LegacyImportRowDecision[],
    actorUserId: number,
  ): Promise<LegacyImportApplyResult> {
    if (!Number.isInteger(studentId) || studentId < 1 || !Number.isInteger(actorUserId) || actorUserId < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã học sinh hoặc người áp dụng không hợp lệ.");
    if (!/^[a-f0-9]{64}$/i.test(previewSha256 ?? ""))
      throw new AppError(400, "LEGACY_DECISIONS_INVALID", "SHA-256 của preview không hợp lệ.");
    const [student, classItems, fileInfo, bytes] = await Promise.all([
      this.students.detail(studentId), this.classes.list(), stat(filePath), readFile(filePath),
    ]);
    this.validateFile(fileInfo.size, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== previewSha256.toLowerCase())
      throw new AppError(409, "LEGACY_PREVIEW_SHA_MISMATCH", "File apply không còn giống file đã preview. Vui lòng preview lại.");
    const parsed = await this.parser.parse(filePath);
    const preview = await this.repository.enrichPreview(this.previewBuilder.build(student, classItems, {
      name: basename(originalName), size: fileInfo.size, sha256,
    }, this.reconciliation.reconcile(parsed)));
    const rows = resolveLegacyImportDecisions(preview, decisions);
    return this.repository.apply({ studentId, actorUserId, filename: basename(originalName),
      fileSize: fileInfo.size, sha256, preview, rows });
  }

  private validateFile(size: number, bytes: Buffer): void {
    if (size > 10 * 1024 * 1024) throw new AppError(413, "LEGACY_FILE_TOO_LARGE", "File XLSX không được vượt quá 10 MB.");
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04)
      throw new AppError(400, "INVALID_XLSX_SIGNATURE", "Chữ ký file không phải XLSX hợp lệ.");
  }
}
