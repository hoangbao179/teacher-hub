import assert from "node:assert/strict";
import test from "node:test";
import { LoginAttemptLimiter } from "./login-rate-limit";

test("login failures reach the limit and Retry-After counts down", () => {
  let now = 1_000;
  const limiter = new LoginAttemptLimiter({ windowSeconds: 60, maxFailures: 2, now: () => now });
  const key = limiter.key("127.0.0.1", " COVY ");
  limiter.recordFailure(key);
  assert.equal(limiter.retryAfterSeconds(key), null);
  limiter.recordFailure(key);
  assert.equal(limiter.retryAfterSeconds(key), 60);
  now += 41_000;
  assert.equal(limiter.retryAfterSeconds(key), 19);
  now += 19_000;
  assert.equal(limiter.retryAfterSeconds(key), null);
});

test("successful-login clear and username reset remove relevant failures", () => {
  const limiter = new LoginAttemptLimiter({ windowSeconds: 60, maxFailures: 1 });
  const first = limiter.key("127.0.0.1", "covy");
  const second = limiter.key("10.0.0.2", "covy");
  const other = limiter.key("127.0.0.1", "other");
  limiter.recordFailure(first);
  limiter.clearKey(first);
  assert.equal(limiter.retryAfterSeconds(first), null);
  limiter.recordFailure(first);
  limiter.recordFailure(second);
  limiter.recordFailure(other);
  assert.equal(limiter.clearUsername("COVY"), 2);
  assert.equal(limiter.retryAfterSeconds(first), null);
  assert.equal(limiter.retryAfterSeconds(other), 60);
});
