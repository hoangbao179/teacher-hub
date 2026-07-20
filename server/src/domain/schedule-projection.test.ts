import assert from "node:assert/strict";
import test from "node:test";
import {
  expandRecurringSchedules,
  occurrenceKey,
  parseOccurrenceKey,
  reconcileOccurrence,
  replacementOccurrenceKey,
  timeRangesOverlap,
} from "./schedule-projection";

const schedule = {
  recurringScheduleId: 7,
  classId: 3,
  className: "Lớp A",
  dayOfWeek: 1,
  startTime: "18:00",
  endTime: "19:30",
  effectiveFrom: "2026-07-06",
  effectiveTo: "2026-07-20",
};

test("recurring expansion includes effective boundaries and prevents duplicate keys", () => {
  const result = expandRecurringSchedules([schedule, schedule], "2026-07-01", "2026-07-31");
  assert.deepEqual(result.map((item) => item.occurrenceDate), ["2026-07-06", "2026-07-13", "2026-07-20"]);
  assert.equal(new Set(result.map((item) => item.key)).size, result.length);
});

test("occurrence and replacement keys are deterministic and parseable", () => {
  const key = occurrenceKey(3, 7, "2026-07-13");
  assert.equal(key, "3:7:2026-07-13");
  assert.deepEqual(parseOccurrenceKey(key), { classId: 3, recurringScheduleId: 7, occurrenceDate: "2026-07-13", replacement: false });
  assert.equal(parseOccurrenceKey(replacementOccurrenceKey(key))?.replacement, true);
});

test("occurrence parser rejects impossible calendar dates", () => {
  assert.equal(parseOccurrenceKey("1:2:2026-02-29"), null);
  assert.equal(parseOccurrenceKey("1:2:2026-13-01"), null);
});

test("skipped original is handled and reschedule emits one replacement", () => {
  const base = expandRecurringSchedules([schedule], "2026-07-13", "2026-07-13")[0];
  assert.equal(reconcileOccurrence(base, { id: 2, type: "SKIPPED", replacementDate: null, replacementStartTime: null, replacementEndTime: null }, null)[0].state, "SKIPPED");
  const moved = reconcileOccurrence(base, { id: 3, type: "RESCHEDULED", replacementDate: "2026-07-14", replacementStartTime: "20:00", replacementEndTime: "21:00" }, null);
  assert.deepEqual(moved.map((item) => item.state), ["RESCHEDULED", "UNRECORDED"]);
  assert.equal(moved[1].projectionSource, "RESCHEDULED");
});

test("draft, completed and cancelled lessons all handle their source occurrence", () => {
  const base = expandRecurringSchedules([schedule], "2026-07-13", "2026-07-13")[0];
  for (const status of ["DRAFT", "COMPLETED", "CANCELLED"] as const) {
    const result = reconcileOccurrence(base, null, { id: 9, status });
    assert.equal(result[0].state, "RECORDED");
    assert.equal(result[0].linkedLessonStatus, status);
  }
});

test("overlap detection uses half-open ranges on one date", () => {
  assert.equal(timeRangesOverlap("2026-07-20", "18:00", "19:30", "2026-07-20", "19:00", "20:00"), true);
  assert.equal(timeRangesOverlap("2026-07-20", "18:00", "19:30", "2026-07-20", "19:30", "20:00"), false);
  assert.equal(timeRangesOverlap("2026-07-20", "18:00", "19:30", "2026-07-21", "18:00", "19:30"), false);
});
