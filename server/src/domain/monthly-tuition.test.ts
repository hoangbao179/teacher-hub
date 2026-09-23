import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeMonthlyAttendance,
  validateTuitionMonth,
} from "./monthly-tuition";
import { AppError } from "../errors/app-error";

test("validateTuitionMonth accepts a real calendar month", () => {
  assert.deepEqual(validateTuitionMonth(2026, 9), { year: 2026, month: 9 });
});

test("validateTuitionMonth rejects a month outside the calendar", () => {
  assert.throws(
    () => validateTuitionMonth(2026, 13),
    (error: unknown) => error instanceof AppError && error.statusCode === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("validateTuitionMonth rejects an invalid year as a validation error", () => {
  assert.throws(
    () => validateTuitionMonth(1999, 9),
    (error: unknown) => error instanceof AppError && error.statusCode === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("summarizeMonthlyAttendance counts only PRESENT and ABSENT", () => {
  assert.deepEqual(
    summarizeMonthlyAttendance(["PRESENT", "ABSENT", "PRESENT"]),
    { present: 2, absent: 1, total: 3 },
  );
});
