import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../errors/app-error";
import { LessonService } from "../services/lesson.service";
import { attendanceCoverageIssue, isCompletionReplay } from "./lesson-domain";

test("actual end before start is a typed validation error", async () => {
  const service = new LessonService({} as never, {} as never);
  await assert.rejects(
    () => service.complete(1, {
      actualStartTime: "20:00", actualEndTime: "19:00", attendances: [],
    }),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_LESSON_TIME",
  );
});

test("missing participant attendance is detected", () => {
  assert.equal(attendanceCoverageIssue([1, 2], [1]), "MISSING_ATTENDANCE");
});

test("non-participant attendance is detected", () => {
  assert.equal(attendanceCoverageIssue([1, 2], [1, 3]), "INVALID_PARTICIPANT");
});

test("duplicate attendance is detected", () => {
  assert.equal(attendanceCoverageIssue([1, 2], [1, 1]), "DUPLICATE_ATTENDANCE");
});

test("completed status is an idempotent completion replay", () => {
  assert.equal(isCompletionReplay("COMPLETED"), true);
  assert.equal(isCompletionReplay("DRAFT"), false);
  assert.equal(isCompletionReplay("CANCELLED"), false);
});
