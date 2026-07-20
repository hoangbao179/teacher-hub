import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
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

  console.error(JSON.stringify({ level: "error", event: "request_failed", requestId: req.requestId,
    error: error instanceof Error ? error.name : "UnknownError" }));
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Có lỗi hệ thống. Vui lòng thử lại.",
    },
  });
};
