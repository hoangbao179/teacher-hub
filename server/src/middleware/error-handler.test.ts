import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { errorHandler } from "./error-handler";

test("unexpected MySQL errors log safe request context and return a request id", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  const lines: string[] = [];
  const original = console.error;
  console.error = (value?: unknown) => lines.push(String(value));
  let status = 0;
  let body: unknown;
  const response = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  const request = {
    requestId: "request-1234",
    method: "PATCH",
    path: "/api/vocabulary/assignments/1",
    body: { password: "must-not-log" },
    headers: { authorization: "Bearer must-not-log" },
  } as unknown as Request;
  const error = Object.assign(new Error("SQL included private params"), {
    code: "ER_ROW_IS_REFERENCED_2",
    errno: 1451,
    sqlState: "23000",
  });
  try {
    errorHandler(error, request, response, (() => undefined) as NextFunction);
  } finally {
    console.error = original;
    process.env.NODE_ENV = previous;
  }
  assert.equal(status, 500);
  assert.deepEqual(body, {
    error: {
      code: "INTERNAL_ERROR",
      message: "Có lỗi hệ thống. Vui lòng thử lại. Mã yêu cầu: request-1234",
      requestId: "request-1234",
    },
  });
  const logged = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.equal(logged.method, "PATCH");
  assert.equal(logged.path, "/api/vocabulary/assignments/1");
  assert.equal(logged.mysqlCode, "ER_ROW_IS_REFERENCED_2");
  assert.equal(logged.errno, 1451);
  assert.equal(logged.sqlState, "23000");
  assert.equal("message" in logged, false);
  assert.doesNotMatch(lines[0], /must-not-log|private params/);
});
