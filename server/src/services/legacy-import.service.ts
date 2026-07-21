import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { LegacyImportPreview } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { LegacyWorkbookParser } from "../domain/legacy-workbook-parser";
import { LegacyReconciliationEngine } from "../domain/legacy-reconciliation-engine";
import { LegacyImportPreview as LegacyImportPreviewBuilder } from "../domain/legacy-import-preview";
import { StudentService } from "./student.service";
import { ClassService } from "./class.service";

export class LegacyImportService {
  constructor(
    private readonly students: StudentService,
    private readonly classes: ClassService,
    private readonly parser = new LegacyWorkbookParser(),
    private readonly reconciliation = new LegacyReconciliationEngine(),
    private readonly previewBuilder = new LegacyImportPreviewBuilder(),
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
    const parsed = await this.parser.parse(filePath);
    return this.previewBuilder.build(student, classItems, {
      name: basename(originalName),
      size: fileInfo.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }, this.reconciliation.reconcile(parsed));
  }
}
