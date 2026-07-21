import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthSettings } from "./auth-settings";

test("development auth settings use fixed safe defaults", () => {
  assert.deepEqual(resolveAuthSettings("development"), {
    adminPasswordMinLength: 6,
    loginRateLimitWindowSeconds: 60,
    loginRateLimitMaxFailures: 20,
  });
});

test("test auth settings use a short fixed rate-limit window", () => {
  assert.deepEqual(resolveAuthSettings("test"), {
    adminPasswordMinLength: 6,
    loginRateLimitWindowSeconds: 3,
    loginRateLimitMaxFailures: 2,
  });
});

test("production auth defaults use 300 seconds and 10 failures", () => {
  assert.deepEqual(resolveAuthSettings("production"), {
    adminPasswordMinLength: 6,
    loginRateLimitWindowSeconds: 300,
    loginRateLimitMaxFailures: 10,
  });
});
