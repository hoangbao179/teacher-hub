import { unlink } from "node:fs/promises";
import type { Request, Response } from "express";
import type { LegacyImportRowDecision } from "@teacher/shared";
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

  apply = async (req: Request, res: Response) => {
    if (!req.file) throw new AppError(400, "LEGACY_FILE_REQUIRED", "Vui lòng chọn file XLSX.");
    try {
      if (typeof req.body.previewSha256 !== "string" || typeof req.body.decisions !== "string")
        throw new AppError(400, "INVALID_MULTIPART", "Apply cần previewSha256 và decisions JSON.");
      let decisions: LegacyImportRowDecision[];
      try {
        const value: unknown = JSON.parse(req.body.decisions);
        if (!Array.isArray(value)) throw new Error("not an array");
        decisions = value as LegacyImportRowDecision[];
      } catch {
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Decisions JSON không hợp lệ.");
      }
      const result = await this.service.apply(Number(req.params.studentId), req.file.path, req.file.originalname,
        req.body.previewSha256, decisions, req.auth!.id);
      res.status(result.idempotent ? 200 : 201).json({ data: result });
    } finally {
      await unlink(req.file.path).catch(() => undefined);
    }
  };
}
