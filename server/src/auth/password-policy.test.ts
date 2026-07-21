import assert from "node:assert/strict";
import test from "node:test";
import { assertAdminPassword, assertPasswordConfirmation } from "./password-policy";

test("central admin password policy accepts six characters", () => {
  assert.doesNotThrow(() => assertAdminPassword("abc123", 6));
});

test("central admin password policy rejects five characters", () => {
  assert.throws(() => assertAdminPassword("abc12", 6), /ít nhất 6 ký tự/);
});

test("password reset confirmation rejects mismatch", () => {
  assert.throws(() => assertPasswordConfirmation("abc123", "abc124"), /không khớp/);
  assert.doesNotThrow(() => assertPasswordConfirmation("abc123", "abc123"));
});
