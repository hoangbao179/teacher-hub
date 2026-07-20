import { Router } from "express";
import { controllers } from "../container";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export function createRouter(): Router {
  const router = Router();
  router.get("/health", controllers.health.health);
  router.get("/ready", asyncHandler(controllers.health.ready));
  router.post("/api/auth/login", asyncHandler(controllers.auth.login));
  router.get("/api/auth/me", requireAuth, asyncHandler(controllers.auth.me));
  router.post("/api/auth/logout", requireAuth, asyncHandler(controllers.auth.logout));

  router.use("/api", requireAuth);
  router.get("/api/dashboard", asyncHandler(controllers.dashboard.get));
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
  router.post("/api/enrollments/:id/pause", asyncHandler(controllers.enrollments.pause));
  router.post("/api/enrollments/:id/resume", asyncHandler(controllers.enrollments.resume));
  router.post("/api/enrollments/:id/end", asyncHandler(controllers.enrollments.end));
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
  router.get(
    "/api/tuition-cycles/:id",
    asyncHandler(controllers.tuition.detail),
  );
  router.post(
    "/api/tuition-cycles/:id/mark-paid",
    asyncHandler(controllers.tuition.markPaid),
  );
  router.get(
    "/api/schedule/unrecorded",
    asyncHandler(controllers.schedule.unrecorded),
  );
  router.get("/api/schedule/week", asyncHandler(controllers.schedule.week));
  return router;
}
