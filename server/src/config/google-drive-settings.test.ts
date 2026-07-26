import assert from "node:assert/strict";
import test from "node:test";
import { redactGoogleError, resolveGoogleDriveSettings } from "./google-drive-settings";

test("Google Drive may be disabled without credentials", () => {
  const settings = resolveGoogleDriveSettings({ GOOGLE_DRIVE_ENABLED: "false" });
  assert.equal(settings.enabled, false);
  assert.equal(settings.templateVersion, "v1");
});

test("enabled Google Drive requires every runtime credential", () => {
  assert.throws(() => resolveGoogleDriveSettings({ GOOGLE_DRIVE_ENABLED: "true" }), /GOOGLE_DRIVE_CLIENT_ID/);
  const settings = resolveGoogleDriveSettings({ GOOGLE_DRIVE_ENABLED: "true", GOOGLE_DRIVE_CLIENT_ID: "id",
    GOOGLE_DRIVE_CLIENT_SECRET: "secret", GOOGLE_DRIVE_REFRESH_TOKEN: "refresh", GOOGLE_DRIVE_ROOT_FOLDER_ID: "folder" });
  assert.equal(settings.enabled, true);
});

test("Google credential-like values are redacted", () => {
  const redacted = redactGoogleError(new Error("invalid refresh_token=private access_token:abc Bearer xyz.123"));
  assert.ok(!redacted.includes("private"));
  assert.ok(!redacted.includes("abc"));
  assert.ok(!redacted.includes("xyz.123"));
});
