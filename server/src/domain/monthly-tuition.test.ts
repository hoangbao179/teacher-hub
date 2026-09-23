import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeMonthlyAttendance,
  validateTuitionMonth,
} from "./monthly-tuition";

test("validateTuitionMonth accepts a real calendar month", () => {
  assert.deepEqual(validateTuitionMonth(2026, 9), { year: 2026, month: 9 });
});

test("validateTuitionMonth rejects a month outside the calendar", () => {
  assert.throws(() => validateTuitionMonth(2026, 13), /Tháng học phí không hợp lệ/);
});

test("summarizeMonthlyAttendance counts only PRESENT and ABSENT", () => {
  assert.deepEqual(
    summarizeMonthlyAttendance(["PRESENT", "ABSENT", "PRESENT"]),
    { present: 2, absent: 1, total: 3 },
  );
});
