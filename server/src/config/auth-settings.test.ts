import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthSettings } from "./auth-settings";

test("development and test auth defaults use 60 seconds and 20 failures", () => {
  for (const nodeEnv of ["development", "test"] as const) {
    assert.deepEqual(resolveAuthSettings({}, nodeEnv), {
      adminPasswordMinLength: 6,
      loginRateLimitWindowSeconds: 60,
      loginRateLimitMaxFailures: 20,
    });
  }
});

test("production auth defaults use 300 seconds and 10 failures", () => {
  assert.deepEqual(resolveAuthSettings({}, "production"), {
    adminPasswordMinLength: 6,
    loginRateLimitWindowSeconds: 300,
    loginRateLimitMaxFailures: 10,
  });
});

test("auth settings reject invalid environment values", () => {
  assert.throws(
    () => resolveAuthSettings({ LOGIN_RATE_LIMIT_WINDOW_SECONDS: "0" }, "development"),
    /LOGIN_RATE_LIMIT_WINDOW_SECONDS/,
  );
  assert.throws(
    () => resolveAuthSettings({ LOGIN_RATE_LIMIT_MAX_FAILURES: "disabled" }, "development"),
    /LOGIN_RATE_LIMIT_MAX_FAILURES/,
  );
  assert.throws(
    () => resolveAuthSettings({ ADMIN_PASSWORD_MIN_LENGTH: "5" }, "development"),
    /ADMIN_PASSWORD_MIN_LENGTH/,
  );
});
