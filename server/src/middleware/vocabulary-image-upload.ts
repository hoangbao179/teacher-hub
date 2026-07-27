import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
});

export const uploadVocabularyImage: RequestHandler = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE")
      return next(new AppError(422, "IMAGE_IMPORT_TOO_LARGE", "Ảnh tải lên vượt quá 5 MiB."));
    return next(new AppError(422, "IMAGE_IMPORT_INVALID_CONTENT_TYPE", "Chỉ được tải lên một file ảnh."));
  });
};
