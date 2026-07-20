import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "@teacher/shared";
import { config } from "../config/config";
import { AppError } from "../errors/app-error";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return next(new AppError(401, "UNAUTHORIZED", "Bạn cần đăng nhập."));

  try {
    req.auth = jwt.verify(token, config.jwt.secret) as AuthUser;
    next();
  } catch {
    next(
      new AppError(
        401,
        "INVALID_TOKEN",
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      ),
    );
  }
}
