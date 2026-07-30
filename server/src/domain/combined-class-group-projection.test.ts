import assert from "node:assert/strict";
import test from "node:test";
import { expandRecurringSchedules } from "./schedule-projection";
import {
  combinedOccurrenceKey,
  expandCombinedGroupSchedules,
  parseCombinedOccurrenceKey,
  suppressOverriddenClassOccurrences,
} from "./combined-class-group-projection";

const classes = [
  { id: 4, name: "Lớp 4" },
  { id: 5, name: "Lớp 5" },
  { id: 6, name: "Lớp 6" },
];

const classSchedules = classes.map((item) => ({
  recurringScheduleId: item.id * 10,
  classId: item.id,
  className: item.name,
  dayOfWeek: 1,
  startTime: "08:30",
  endTime: "10:30",
  effectiveFrom: "2026-07-01",
  effectiveTo: null,
}));

const groupSchedule = {
  groupId: 2,
  groupName: "Nhóm Lớp 4–5–6",
  scheduleId: 20,
  dayOfWeek: 1,
  startTime: "08:30",
  endTime: "11:00",
  effectiveFrom: "2026-08-01",
  effectiveTo: "2026-08-17",
  memberClasses: classes,
};

test("combined group suppresses only overlapping member schedules during its effective range", () => {
  const individual = expandRecurringSchedules([
    ...classSchedules,
    {
      recurringScheduleId: 41,
      classId: 4,
      className: "Lớp 4",
      dayOfWeek: 5,
      startTime: "18:00",
      endTime: "19:30",
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
    },
  ], "2026-07-27", "2026-08-24");
  const group = expandCombinedGroupSchedules([groupSchedule], "2026-07-27", "2026-08-24");
  const resolved = [...suppressOverriddenClassOccurrences(individual, group), ...group];

  assert.equal(resolved.filter((item) => item.occurrenceDate === "2026-07-27").length, 3);
  assert.deepEqual(
    resolved.filter((item) => item.occurrenceDate === "2026-08-03").map((item) => item.className),
    ["Nhóm Lớp 4–5–6"],
  );
  assert.equal(resolved.filter((item) => item.occurrenceDate === "2026-08-07").length, 1);
  assert.equal(resolved.filter((item) => item.occurrenceDate === "2026-08-24").length, 3);
});

test("combined occurrence keys are deterministic and persisted projection is idempotent", () => {
  const key = combinedOccurrenceKey(2, 20, "2026-08-03");
  assert.deepEqual(parseCombinedOccurrenceKey(key), {
    groupId: 2,
    scheduleId: 20,
    occurrenceDate: "2026-08-03",
    replacement: false,
  });
  const projected = expandCombinedGroupSchedules([{
    ...groupSchedule,
    persistedByDate: {
      "2026-08-03": {
        id: 8,
        status: "DRAFT",
        replacementDate: null,
        replacementStartTime: null,
        replacementEndTime: null,
        linkedLessonId: 100,
      },
    },
  }], "2026-08-03", "2026-08-03");
  assert.equal(projected.length, 1);
  assert.equal(projected[0].key, key);
  assert.equal(projected[0].state, "RECORDED");
  assert.equal(projected[0].combinedTeachingOccurrenceId, 8);
});

test("rescheduled combined occurrence emits one original and one replacement", () => {
  const projected = expandCombinedGroupSchedules([{
    ...groupSchedule,
    persistedByDate: {
      "2026-08-03": {
        id: 9,
        status: "RESCHEDULED",
        replacementDate: "2026-08-04",
        replacementStartTime: "09:00",
        replacementEndTime: "11:30",
        linkedLessonId: null,
      },
    },
  }], "2026-08-03", "2026-08-04");
  assert.deepEqual(projected.map((item) => item.state), ["RESCHEDULED", "UNRECORDED"]);
  assert.equal(projected[1].key, "cg:2:20:2026-08-03:R");
});
