import { unlink } from "node:fs/promises";
import type { Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { LegacyImportService } from "../services/legacy-import.service";

export class LegacyImportController {
  constructor(private readonly service: LegacyImportService) {}

  preview = async (req: Request, res: Response) => {
    if (!req.file) throw new AppError(400, "LEGACY_FILE_REQUIRED", "Vui lòng chọn file XLSX.");
    try {
      const preview = await this.service.preview(Number(req.params.studentId), req.file.path, req.file.originalname);
      res.json({ data: preview });
    } finally {
      await unlink(req.file.path).catch(() => undefined);
    }
  };
}
