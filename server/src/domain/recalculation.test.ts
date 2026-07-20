import assert from "node:assert/strict";
import test from "node:test";
import {
  compareBillableAttendance,
  crossesPaidBoundary,
  groupIntoTuitionCycles,
  isBillableAttendance,
  type BillableAttendanceOrder,
} from "./lesson-domain";

const item = (overrides: Partial<BillableAttendanceOrder>): BillableAttendanceOrder => ({
  sessionDate: "2026-07-10", actualStartTime: "18:00", scheduledStartTime: "18:00",
  lessonId: 1, attendanceId: 1, ...overrides,
});

test("billable order uses date, actual fallback, scheduled and stable ids", () => {
  const values = [
    item({ lessonId: 3, attendanceId: 4 }),
    item({ sessionDate: "2026-07-09", lessonId: 9 }),
    item({ actualStartTime: null, scheduledStartTime: "17:00", lessonId: 2 }),
    item({ lessonId: 3, attendanceId: 3 }),
  ].sort(compareBillableAttendance);
  assert.deepEqual(values.map((value) => value.attendanceId), [1, 1, 3, 4]);
  assert.equal(values[0].sessionDate, "2026-07-09");
  assert.equal(values[1].scheduledStartTime, "17:00");
});

test("seven plus two late entries group into 8 and 1", () => {
  assert.deepEqual(groupIntoTuitionCycles(Array.from({ length: 9 }, (_, index) => index + 1)).map((group) => group.length), [8, 1]);
});

test("absent, per-session free and globally free are excluded", () => {
  assert.equal(isBillableAttendance("ABSENT", "CUSTOM"), false);
  assert.equal(isBillableAttendance("FREE", "CUSTOM"), false);
  assert.equal(isBillableAttendance("PRESENT", "FREE"), false);
});

test("mutable attendance at or before paid boundary conflicts", () => {
  const paid = [item({ sessionDate: "2026-07-10" })];
  assert.equal(crossesPaidBoundary(paid, [item({ sessionDate: "2026-07-09", lessonId: 8 })]), true);
  assert.equal(crossesPaidBoundary(paid, [item({ sessionDate: "2026-07-11", lessonId: 8 })]), false);
});
