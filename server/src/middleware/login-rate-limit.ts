import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase().slice(0, 190) : "unknown";
  const key = `${req.ip}|${username}`;
  const now = Date.now();
  const current = failures.get(key);
  if (current && current.resetAt > now && current.count >= MAX_FAILURES) {
    res.setHeader("retry-after", String(Math.ceil((current.resetAt - now) / 1000)));
    res.status(429).json({ error: { code: "LOGIN_RATE_LIMITED", message: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau." } });
    return;
  }
  res.on("finish", () => {
    if (res.statusCode === 401) failures.set(key, current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + WINDOW_MS });
    else if (res.statusCode < 400) failures.delete(key);
  });
  next();
}
