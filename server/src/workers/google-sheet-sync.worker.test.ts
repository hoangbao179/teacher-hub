import assert from "node:assert/strict";
import test from "node:test";
import { resolveGoogleSheetSyncSettings } from "../config/google-sheet-sync-settings";
import { GoogleSheetSyncWorker, googleSyncBackoffMs } from "./google-sheet-sync.worker";
import { classifyGoogleError } from "../integrations/google/google-integration.errors";
import { FakeGoogleSheetProvider } from "../integrations/google/fake-google-sheet.provider";

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

test("Google 404 is classified by the resource being accessed", () => {
  const missing = Object.assign(new Error("not found"), { code: 404 });
  assert.equal(classifyGoogleError(missing).failureCode, "SPREADSHEET_MISSING");
  assert.equal(classifyGoogleError(missing, "ROOT_FOLDER_MISSING").failureCode, "ROOT_FOLDER_MISSING");
});

test("vocabulary attempt sync upserts one row without a full workbook render", async () => {
  const provider = new FakeGoogleSheetProvider();
  provider.resources.set(10, { spreadsheetId: "sheet-10", name: "Student", webViewUrl: "https://example.test" });
  const event = {
    id: 1, studentId: 2, entityType: "VOCABULARY_ATTEMPT" as const,
    entityId: 77, lessonId: null, eventType: "VOCABULARY_ATTEMPT_UPSERT" as const,
    revision: 1, payloadVersion: 2, attemptCount: 0,
  };
  let succeeded = false;
  const outbox = {
    claimBatch: async () => [event],
    succeed: async () => { succeeded = true; return true; },
    fail: async () => false,
  };
  const row = {
    attemptId: 77, completedAt: "2026-07-27", assignmentTitle: "Food", className: "3A",
    ageBand: "G2_G3", attemptNumber: 1, scoredQuestionCount: 4, correctFirstTry: 3,
    finalCorrect: 4, scorePercent: 100, masteredWords: 4, learningWords: 0,
    needsReviewWords: 0, reviewWordList: "", status: "COMPLETED", updatedAt: "2026-07-27",
  };
  const sheets = {
    get: async () => ({ id: 10, status: "ACTIVE", templateVersion: "2", lastGeneratedAt: null }),
    snapshot: async () => ({
      student: { id: 2, fullName: "Student", currentClass: "3A", currentGrade: "3", currentAcademicYear: "2026" },
      overview: { currentProgress: 0, attendanceRate: 100, latestLesson: "", tuitionStatus: "", latestComment: "", latestHomework: "", teacher: "Vy" },
      learning: [], tuition: [], vocabularyAttempts: [row],
    }),
  };
  const settings = { ...resolveGoogleSheetSyncSettings({}), enabled: true };
  const worker = new GoogleSheetSyncWorker(outbox as never, sheets as never, provider, settings, true);
  assert.equal(await worker.runOnce(), 1);
  assert.equal(provider.rendered.length, 0);
  assert.deepEqual(provider.vocabularyRows.get("sheet-10:77"), row);
  assert.equal(succeeded, true);
});
