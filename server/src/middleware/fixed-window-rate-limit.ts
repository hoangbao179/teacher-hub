import type { RequestHandler } from "express";

export function fixedWindowRateLimit(options: {
  limit: number;
  windowMs: number;
  code: string;
}): RequestHandler {
  const counters = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = counters.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    counters.set(key, entry);
    if (entry.count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: options.code,
          message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
        },
      });
      return;
    }
    next();
  };
}
