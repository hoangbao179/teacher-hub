import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  console.error(
    error instanceof Error ? error.message : "Unknown server error",
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Có lỗi hệ thống. Vui lòng thử lại.",
    },
  });
};
