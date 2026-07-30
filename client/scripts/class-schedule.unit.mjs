import assert from "node:assert/strict";
import test from "node:test";
import { formatClassSchedule } from "../src/utils/classSchedule.ts";

test("ISO weekdays use Vietnamese class schedule labels", () => {
  assert.equal(
    formatClassSchedule([{ dayOfWeek: 1, startTime: "08:30", endTime: "10:00" }]),
    "T2 08:30–10:00",
  );
  assert.equal(
    formatClassSchedule([{ dayOfWeek: 3, startTime: "08:30", endTime: "19:30" }]),
    "T4 08:30–19:30",
  );
  assert.equal(
    formatClassSchedule([{ dayOfWeek: 7, startTime: "08:00", endTime: "09:30" }]),
    "CN 08:00–09:30",
  );
});

test("class schedules include both times and are joined with commas", () => {
  const result = formatClassSchedule([
    { dayOfWeek: 1, startTime: "08:30", endTime: "10:00" },
    { dayOfWeek: 3, startTime: "08:30", endTime: "19:30" },
  ]);

  assert.equal(result, "T2 08:30–10:00, T4 08:30–19:30");
  assert.equal(result.includes("T1"), false);
});

test("class schedules are sorted from Monday to Sunday", () => {
  assert.equal(
    formatClassSchedule([
      { dayOfWeek: 7, startTime: "08:00", endTime: "09:30" },
      { dayOfWeek: 3, startTime: "08:30", endTime: "19:30" },
      { dayOfWeek: 1, startTime: "08:30", endTime: "10:00" },
    ]),
    "T2 08:30–10:00, T4 08:30–19:30, CN 08:00–09:30",
  );
});

test("multiple class schedules on one day are sorted by start time", () => {
  assert.equal(
    formatClassSchedule([
      { dayOfWeek: 1, startTime: "18:00", endTime: "19:30" },
      { dayOfWeek: 1, startTime: "08:30", endTime: "10:00" },
      { dayOfWeek: 1, startTime: "13:00", endTime: "14:30" },
    ]),
    "T2 08:30–10:00, T2 13:00–14:30, T2 18:00–19:30",
  );
});

test("API-shaped schedules still format correctly after serialization and reload", () => {
  const reloadedSchedules = JSON.parse(JSON.stringify([
    { id: 11, dayOfWeek: 3, startTime: "08:30", endTime: "19:30" },
    { id: 10, dayOfWeek: 1, startTime: "08:30", endTime: "10:00" },
  ]));

  assert.equal(formatClassSchedule(reloadedSchedules), "T2 08:30–10:00, T4 08:30–19:30");
});
