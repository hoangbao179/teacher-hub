import type { NextFunction, Request, Response } from "express";
import { config } from "../config/config";

interface FailureState {
  count: number;
  resetAt: number;
}

export interface LoginAttemptLimiterOptions {
  windowSeconds: number;
  maxFailures: number;
  now?: () => number;
}

export class LoginAttemptLimiter {
  private readonly failures = new Map<string, FailureState>();
  private readonly now: () => number;

  constructor(private readonly options: LoginAttemptLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  key(clientIp: string, username: string): string {
    return `${clientIp}\n${normalizeLoginUsername(username)}`;
  }

  retryAfterSeconds(key: string): number | null {
    const current = this.failures.get(key);
    const now = this.now();
    if (!current || current.resetAt <= now) {
      if (current) this.failures.delete(key);
      return null;
    }
    if (current.count < this.options.maxFailures) return null;
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }

  recordFailure(key: string): void {
    const now = this.now();
    const current = this.failures.get(key);
    this.failures.set(
      key,
      current && current.resetAt > now
        ? { ...current, count: current.count + 1 }
        : { count: 1, resetAt: now + this.options.windowSeconds * 1_000 },
    );
  }

  clearKey(key: string): void {
    this.failures.delete(key);
  }

  clearUsername(username: string): number {
    const suffix = `\n${normalizeLoginUsername(username)}`;
    let cleared = 0;
    for (const key of this.failures.keys()) {
      if (key.endsWith(suffix)) {
        this.failures.delete(key);
        cleared += 1;
      }
    }
    return cleared;
  }
}

export function normalizeLoginUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 190) || "unknown" : "unknown";
}

export function createLoginRateLimit(limiter: LoginAttemptLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = limiter.key(req.ip ?? "unknown", normalizeLoginUsername(req.body?.username));
    const retryAfter = limiter.retryAfterSeconds(key);
    if (retryAfter !== null) {
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: "LOGIN_RATE_LIMITED",
          message: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
        },
      });
      return;
    }

    res.once("finish", () => {
      if (res.statusCode === 401) limiter.recordFailure(key);
      else if (res.statusCode < 400) limiter.clearKey(key);
    });
    next();
  };
}

export const loginAttemptLimiter = new LoginAttemptLimiter({
  windowSeconds: config.auth.loginRateLimitWindowSeconds,
  maxFailures: config.auth.loginRateLimitMaxFailures,
});

export const loginRateLimit = createLoginRateLimit(loginAttemptLimiter);

export function clearLoginFailuresForUsername(username: string): number {
  return loginAttemptLimiter.clearUsername(username);
}
