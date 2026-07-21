import assert from "node:assert/strict";
import test from "node:test";
import { parseRetryAfterSeconds } from "../src/auth/retryAfter.ts";

test("Retry-After delta seconds are parsed for the login countdown", () => {
  assert.equal(parseRetryAfterSeconds("42"), 42);
  assert.equal(parseRetryAfterSeconds("0"), 0);
});

test("Retry-After HTTP dates and invalid fallbacks are handled", () => {
  const now = Date.parse("2026-07-21T05:00:00.000Z");
  assert.equal(parseRetryAfterSeconds("Tue, 21 Jul 2026 05:00:42 GMT", now), 42);
  assert.equal(parseRetryAfterSeconds("not-a-retry-value", now), undefined);
  assert.equal(parseRetryAfterSeconds(null, now), undefined);
});
