import { Router } from "express";
import { controllers } from "../container";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { loginRateLimit } from "../middleware/login-rate-limit";
import { uploadLegacyWorkbook } from "../middleware/legacy-import-upload";
import { fixedWindowRateLimit } from "../middleware/fixed-window-rate-limit";

const vocabularySearchRateLimit = fixedWindowRateLimit({
  limit: 30,
  windowMs: 60_000,
  code: "VOCABULARY_SEARCH_RATE_LIMITED",
});
const vocabularyImportRateLimit = fixedWindowRateLimit({
  limit: 12,
  windowMs: 60_000,
  code: "VOCABULARY_IMPORT_RATE_LIMITED",
});
const vocabularyPublicMediaRateLimit = fixedWindowRateLimit({
  limit: 60,
  windowMs: 60_000,
  code: "VOCABULARY_MEDIA_RATE_LIMITED",
});
const publicGameResolveRateLimit = fixedWindowRateLimit({
  limit: 60,
  windowMs: 60_000,
  code: "PUBLIC_GAME_RATE_LIMITED",
});
const publicGameAccessRateLimit = fixedWindowRateLimit({
  limit: 20,
  windowMs: 10 * 60_000,
  code: "PUBLIC_GAME_RATE_LIMITED",
});
const publicGameAnswerRateLimit = fixedWindowRateLimit({
  limit: 120,
  windowMs: 60_000,
  code: "PUBLIC_GAME_RATE_LIMITED",
  key: (req) => `${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${req.params.sessionToken ?? ""}`,
});

export function createRouter(): Router {
  const router = Router();
  router.get("/health", controllers.health.health);
  router.get("/ready", asyncHandler(controllers.health.ready));
  router.post("/api/auth/login", loginRateLimit, asyncHandler(controllers.auth.login));
  router.get("/api/auth/me", requireAuth, asyncHandler(controllers.auth.me));
  router.post("/api/auth/logout", requireAuth, asyncHandler(controllers.auth.logout));
  router.get(
    "/api/public/vocabulary-media/:mediaId",
    vocabularyPublicMediaRateLimit,
    asyncHandler(controllers.vocabularyMedia.serve),
  );
  router.get(
    "/api/public/learning-assignments/:publicCode",
    publicGameResolveRateLimit,
    asyncHandler(controllers.vocabularyGames.summary),
  );
  router.post(
    "/api/public/learning-assignments/:publicCode/access",
    publicGameAccessRateLimit,
    asyncHandler(controllers.vocabularyGames.access),
  );
  router.post(
    "/api/public/learning-assignments/:publicCode/attempts",
    publicGameAccessRateLimit,
    asyncHandler(controllers.vocabularyGames.start),
  );
  router.get(
    "/api/public/learning-attempts/:sessionToken",
    publicGameAnswerRateLimit,
    asyncHandler(controllers.vocabularyGames.attempt),
  );
  router.post(
    "/api/public/learning-attempts/:sessionToken/answers",
    publicGameAnswerRateLimit,
    asyncHandler(controllers.vocabularyGames.answer),
  );
  router.post(
    "/api/public/learning-attempts/:sessionToken/complete",
    publicGameAnswerRateLimit,
    asyncHandler(controllers.vocabularyGames.complete),
  );

  router.use("/api", requireAuth);
  router.get("/api/dashboard", asyncHandler(controllers.dashboard.get));
  router.get("/api/vocabulary/topics", asyncHandler(controllers.vocabulary.listTopics));
  router.get("/api/vocabulary/topics/:slug", asyncHandler(controllers.vocabulary.topicDetail));
  router.post("/api/vocabulary/topic-suggestions", asyncHandler(controllers.vocabulary.suggest));
  router.get("/api/vocabulary/media/status", asyncHandler(controllers.vocabularyMedia.status));
  router.get(
    "/api/vocabulary/media/search",
    vocabularySearchRateLimit,
    asyncHandler(controllers.vocabularyMedia.search),
  );
  router.post(
    "/api/vocabulary/media/import",
    vocabularyImportRateLimit,
    asyncHandler(controllers.vocabularyMedia.import),
  );
  router.get("/api/vocabulary/assignments", asyncHandler(controllers.assignments.list));
  router.post("/api/vocabulary/assignments", asyncHandler(controllers.assignments.create));
  router.get("/api/vocabulary/assignments/:id", asyncHandler(controllers.assignments.detail));
  router.patch("/api/vocabulary/assignments/:id", asyncHandler(controllers.assignments.update));
  router.get("/api/vocabulary/assignments/:id/preview", asyncHandler(controllers.assignments.preview));
  router.post("/api/vocabulary/assignments/:id/publish", asyncHandler(controllers.assignments.publish));
  router.post("/api/vocabulary/assignments/:id/close", asyncHandler(controllers.assignments.close));
  router.post("/api/vocabulary/assignments/:id/duplicate", asyncHandler(controllers.assignments.duplicate));
  router.patch("/api/vocabulary/assignments/:id/due-date", asyncHandler(controllers.assignments.dueDate));
  router.get("/api/vocabulary/assignments/:id/recipients", asyncHandler(controllers.assignments.recipients));
  router.get(
    "/api/vocabulary/assignments/:id/results/summary",
    asyncHandler(controllers.vocabularyResults.summary),
  );
  router.get(
    "/api/vocabulary/assignments/:id/results/recipients",
    asyncHandler(controllers.vocabularyResults.recipients),
  );
  router.get(
    "/api/vocabulary/assignments/:id/results/vocabulary",
    asyncHandler(controllers.vocabularyResults.vocabulary),
  );
  router.get(
    "/api/vocabulary/assignments/:id/results/recipients/:recipientId",
    asyncHandler(controllers.vocabularyResults.recipient),
  );
  router.post(
    "/api/vocabulary/assignments/:id/review-draft",
    asyncHandler(controllers.vocabularyResults.reviewDraft),
  );
  router.post(
    "/api/vocabulary/assignments/:id/recipients/regenerate-access",
    asyncHandler(controllers.assignments.regenerateAccess),
  );
  router.post(
    "/api/vocabulary/assignments/:id/recipients/revoke-access",
    asyncHandler(controllers.assignments.revokeAccess),
  );
  router.get("/api/vocabulary/sets", asyncHandler(controllers.vocabulary.listSets));
  router.post("/api/vocabulary/sets", asyncHandler(controllers.vocabulary.createSet));
  router.post(
    "/api/vocabulary/sets/import-public-unit",
    asyncHandler(controllers.vocabulary.importPublicUnit),
  );
  router.get("/api/vocabulary/sets/:id", asyncHandler(controllers.vocabulary.setDetail));
  router.patch("/api/vocabulary/sets/:id", asyncHandler(controllers.vocabulary.updateSet));
  router.post(
    "/api/vocabulary/sets/:id/duplicate",
    asyncHandler(controllers.vocabulary.duplicateSet),
  );
  router.post(
    "/api/vocabulary/sets/:id/archive",
    asyncHandler(controllers.vocabulary.archiveSet),
  );
  router.get("/api/classes", asyncHandler(controllers.classes.list));
  router.post("/api/classes", asyncHandler(controllers.classes.create));
  router.get("/api/classes/:id", asyncHandler(controllers.classes.detail));
  router.patch("/api/classes/:id", asyncHandler(controllers.classes.update));
  router.post("/api/classes/:id/pause", asyncHandler(controllers.classes.pause));
  router.post("/api/classes/:id/resume", asyncHandler(controllers.classes.resume));
  router.post("/api/classes/:id/close", asyncHandler(controllers.classes.close));
  router.post("/api/classes/:id/enrollments", asyncHandler(controllers.enrollments.create));
  router.post("/api/classes/:id/schedules", asyncHandler(controllers.schedule.createRecurring));
  router.patch("/api/recurring-schedules/:id", asyncHandler(controllers.schedule.updateRecurring));
  router.delete("/api/recurring-schedules/:id", asyncHandler(controllers.schedule.deleteRecurring));
  router.get(
    "/api/classes/:id/lessons",
    asyncHandler(controllers.classes.lessonsByClass),
  );
  router.get("/api/students", asyncHandler(controllers.students.list));
  router.post("/api/students", asyncHandler(controllers.students.create));
  router.get("/api/students/:id", asyncHandler(controllers.students.detail));
  router.patch("/api/students/:id", asyncHandler(controllers.students.update));
  router.get("/api/students/:studentId/export.xlsx", asyncHandler(controllers.studentReports.export));
  router.post(
    "/api/students/:studentId/legacy-imports/preview",
    uploadLegacyWorkbook,
    asyncHandler(controllers.legacyImports.preview),
  );
  router.get("/api/students/:studentId/google-sheet", asyncHandler(controllers.studentGoogleSheets.get));
  router.post("/api/students/:studentId/google-sheet", asyncHandler(controllers.studentGoogleSheets.create));
  router.post("/api/students/:studentId/google-sheet/retry", asyncHandler(controllers.studentGoogleSheets.retry));
  router.post("/api/students/:studentId/google-sheet/regenerate", asyncHandler(controllers.studentGoogleSheets.regenerate));
  router.post("/api/students/:studentId/google-sheet/resync", asyncHandler(controllers.studentGoogleSheets.resync));
  router.post("/api/students/:studentId/google-sheet/archive", asyncHandler(controllers.studentGoogleSheets.archive));
  router.post(
    "/api/students/:studentId/legacy-imports/apply",
    uploadLegacyWorkbook,
    asyncHandler(controllers.legacyImports.apply),
  );
  router.post("/api/enrollments/:id/pause", asyncHandler(controllers.enrollments.pause));
  router.post("/api/enrollments/:id/resume", asyncHandler(controllers.enrollments.resume));
  router.post("/api/enrollments/:id/end", asyncHandler(controllers.enrollments.end));
  router.post("/api/enrollments/:id/transfer", asyncHandler(controllers.enrollments.transfer));
  router.patch("/api/enrollments/:id/tuition-mode", asyncHandler(controllers.enrollments.changeTuitionMode));
  router.post("/api/lessons", asyncHandler(controllers.lessons.create));
  router.get("/api/lessons/:id", asyncHandler(controllers.lessons.detail));
  router.patch("/api/lessons/:id", asyncHandler(controllers.lessons.update));
  router.put("/api/lessons/:id/participants", asyncHandler(controllers.lessons.updateParticipants));
  router.put("/api/lessons/:id/attendances", asyncHandler(controllers.lessons.updateAttendances));
  router.put("/api/lessons/:id/content", asyncHandler(controllers.lessons.updateContent));
  router.post(
    "/api/lessons/:id/complete",
    asyncHandler(controllers.lessons.complete),
  );
  router.post("/api/lessons/:id/cancel", asyncHandler(controllers.lessons.cancel));
  router.get("/api/tuition-cycles", asyncHandler(controllers.tuition.list));
  router.get("/api/tuition-cycles/summary", asyncHandler(controllers.tuition.summary));
  router.get(
    "/api/tuition-cycles/:id",
    asyncHandler(controllers.tuition.detail),
  );
  router.post(
    "/api/tuition-cycles/:id/mark-paid",
    asyncHandler(controllers.tuition.markPaid),
  );
  router.post("/api/tuition-cycles/:id/settle-incomplete", asyncHandler(controllers.tuition.settleIncomplete));
  router.get("/api/enrollments/:id/tuition-receipts", asyncHandler(controllers.tuition.listReceipts));
  router.post("/api/enrollments/:id/tuition-receipts/advance", asyncHandler(controllers.tuition.createAdvanceReceipt));
  router.get(
    "/api/schedule/unrecorded",
    asyncHandler(controllers.schedule.unrecorded),
  );
  router.get("/api/schedule/occurrences", asyncHandler(controllers.schedule.occurrences));
  router.get("/api/schedule/makeup-outstanding", asyncHandler(controllers.schedule.outstandingMakeups));
  router.post("/api/schedule/occurrences/bulk-create-drafts", asyncHandler(controllers.schedule.bulkCreateDrafts));
  router.post("/api/schedule/occurrences/bulk-skip", asyncHandler(controllers.schedule.bulkSkip));
  router.post("/api/schedule/occurrences/:key/create-draft", asyncHandler(controllers.schedule.createDraft));
  router.get("/api/schedule/occurrences/:key/makeup-options", asyncHandler(controllers.schedule.makeupOptions));
  router.post("/api/schedule/occurrences/:key/skip", asyncHandler(controllers.schedule.skip));
  router.post("/api/schedule/occurrences/:key/reschedule", asyncHandler(controllers.schedule.reschedule));
  router.get("/api/schedule/week", asyncHandler(controllers.schedule.week));
  router.post("/api/schedule/conflicts/check", asyncHandler(controllers.schedule.checkConflicts));
  router.post("/api/schedule/temporary-reschedules/preview", asyncHandler(controllers.schedule.previewTemporary));
  router.post("/api/schedule/temporary-reschedules", asyncHandler(controllers.schedule.applyTemporary));
  router.get("/api/teacher-busy-slots", asyncHandler(controllers.schedule.listBusySlots));
  router.post("/api/teacher-busy-slots", asyncHandler(controllers.schedule.createBusySlot));
  router.get("/api/teacher-busy-slots/:id", asyncHandler(controllers.schedule.getBusySlot));
  router.patch("/api/teacher-busy-slots/:id", asyncHandler(controllers.schedule.updateBusySlot));
  router.delete("/api/teacher-busy-slots/:id", asyncHandler(controllers.schedule.deleteBusySlot));
  return router;
}
