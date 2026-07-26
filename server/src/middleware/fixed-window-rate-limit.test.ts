import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { fixedWindowRateLimit } from "./fixed-window-rate-limit";

test("fixed window limiter rejects requests after its independent limit", () => {
  const middleware = fixedWindowRateLimit({
    limit: 2,
    windowMs: 60_000,
    code: "IMAGE_SEARCH_RATE_LIMITED",
  });
  let nextCalls = 0;
  let status = 0;
  let payload: unknown;
  const headers = new Map<string, string>();
  const request = {
    ip: "127.0.0.44",
    socket: { remoteAddress: "127.0.0.44" },
  } as Request;
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); },
    status: (value: number) => {
      status = value;
      return response;
    },
    json: (value: unknown) => { payload = value; },
  } as unknown as Response;
  const next = (() => { nextCalls += 1; }) as NextFunction;
  middleware(request, response, next);
  middleware(request, response, next);
  middleware(request, response, next);
  assert.equal(nextCalls, 2);
  assert.equal(status, 429);
  assert.ok(Number(headers.get("Retry-After")) >= 1);
  assert.equal(
    (payload as { error: { code: string } }).error.code,
    "IMAGE_SEARCH_RATE_LIMITED",
  );
});
