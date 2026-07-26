import assert from "node:assert/strict";
import test from "node:test";
import { resolveGoogleSheetSyncSettings } from "../config/google-sheet-sync-settings";
import { googleSyncBackoffMs } from "./google-sheet-sync.worker";
import { classifyGoogleError } from "../integrations/google/google-integration.errors";

test("Google Sheet sync settings are disabled by default and validate bounds", () => {
  const settings = resolveGoogleSheetSyncSettings({});
  assert.equal(settings.enabled, false);
  assert.equal(settings.intervalMs, 30_000);
  assert.throws(
    () => resolveGoogleSheetSyncSettings({ GOOGLE_SHEET_SYNC_BATCH_SIZE: "0" }),
    /GOOGLE_SHEET_SYNC_BATCH_SIZE/,
  );
});

test("Google Sheet sync retry uses bounded exponential backoff", () => {
  assert.deepEqual([0, 1, 2, 3].map(googleSyncBackoffMs), [60_000, 300_000, 900_000, 3_600_000]);
  assert.equal(googleSyncBackoffMs(20), 86_400_000);
});

test("Google rate-limit and permission failures have different retry behavior", () => {
  const rateLimited = classifyGoogleError(Object.assign(new Error("userRateLimitExceeded"), { code: 403 }));
  assert.equal(rateLimited.failureCode, "RATE_LIMITED");
  assert.equal(rateLimited.retryable, true);
  const denied = classifyGoogleError(Object.assign(new Error("permission denied"), { code: 403 }));
  assert.equal(denied.failureCode, "PERMISSION_DENIED");
  assert.equal(denied.retryable, false);
});
