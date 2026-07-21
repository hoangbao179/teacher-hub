import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { extname } from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, callback) => callback(null, `teacher-hub-legacy-${randomUUID()}.xlsx`),
  }),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 4, parts: 5 },
  fileFilter: (_req, file, callback) => {
    if (extname(file.originalname).toLowerCase() !== ".xlsx" || file.mimetype !== XLSX_MIME) {
      callback(new AppError(400, "INVALID_XLSX_TYPE", "Chỉ chấp nhận file .xlsx đúng định dạng Excel."));
      return;
    }
    callback(null, true);
  },
});

export const uploadLegacyWorkbook: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) { next(); return; }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") next(new AppError(413, "LEGACY_FILE_TOO_LARGE", "File XLSX không được vượt quá 10 MB."));
      else next(new AppError(400, "INVALID_MULTIPART", "Yêu cầu upload file không hợp lệ."));
      return;
    }
    next(error);
  });
};
