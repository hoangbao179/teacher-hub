import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header("x-request-id");
  req.requestId = supplied && /^[A-Za-z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  const started = performance.now();
  res.on("finish", () => console.log(JSON.stringify({
    level: "info", event: "http_request", requestId: req.requestId, method: req.method,
    path: req.path, status: res.statusCode, durationMs: Math.round(performance.now() - started),
  })));
  next();
}
