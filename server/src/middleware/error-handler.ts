import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    if (error.retryAfterSeconds)
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  const mysqlError = error as {
    code?: unknown;
    errno?: unknown;
    sqlState?: unknown;
  };
  console.error(JSON.stringify({
    level: "error",
    event: "request_failed",
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: error instanceof Error ? error.name : "UnknownError",
    ...(typeof mysqlError.code === "string" ? { mysqlCode: mysqlError.code } : {}),
    ...(typeof mysqlError.errno === "number" ? { errno: mysqlError.errno } : {}),
    ...(typeof mysqlError.sqlState === "string" ? { sqlState: mysqlError.sqlState } : {}),
    ...(process.env.NODE_ENV === "development" && error instanceof Error
      ? { message: error.message, stack: error.stack }
      : {}),
  }));
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: `Có lỗi hệ thống. Vui lòng thử lại. Mã yêu cầu: ${req.requestId}`,
      requestId: req.requestId,
    },
  });
};
