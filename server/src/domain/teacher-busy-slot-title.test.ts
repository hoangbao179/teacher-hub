import assert from "node:assert/strict";
import test from "node:test";
import type { TeacherBusySlotInput } from "@teacher/shared";
import {
  buildTeacherBusySlotTitle,
  TEACHER_BUSY_SLOT_TITLE_MAX_LENGTH,
} from "./teacher-busy-slot-title";

const weekly = (overrides: Partial<TeacherBusySlotInput> = {}): TeacherBusySlotInput => ({
  slotType: "EXTERNAL_CLASS",
  organizationType: "SCHOOL",
  organizationName: "Mầm non Hoa Thủy Tiên",
  recurrenceType: "WEEKLY",
  schedules: [{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
  effectiveFrom: "2026-07-31",
  ...overrides,
} as TeacherBusySlotInput);

test("builds a recurring title from the earliest weekday and start time", () => {
  assert.equal(buildTeacherBusySlotTitle(weekly({
    schedules: [
      { dayOfWeek: 5, startTime: "09:00", endTime: "10:00" },
      { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
    ],
  })), "Mầm non Hoa Thủy Tiên · Thứ 2 08:00");
});

test("builds a one-time title with Vietnamese date and 24-hour time", () => {
  assert.equal(buildTeacherBusySlotTitle({
    slotType: "EXTERNAL_CLASS",
    organizationType: "SCHOOL",
    organizationName: "Mầm non Hoa Thủy Tiên",
    recurrenceType: "ONCE",
    specificDate: "2026-07-31",
    startTime: "08:00",
    endTime: "09:00",
  }), "Mầm non Hoa Thủy Tiên · 31/07/2026 08:00");
});

test("preserves and trims a manual title", () => {
  assert.equal(buildTeacherBusySlotTitle(weekly({ title: "  Lớp Bé Gấu  " })), "Lớp Bé Gấu");
});

test("treats empty, whitespace and null titles as omitted", () => {
  for (const title of ["", "   ", null])
    assert.equal(buildTeacherBusySlotTitle(weekly({ title })), "Mầm non Hoa Thủy Tiên · Thứ 2 08:00");
});

test("falls back to the organization when no schedule can be used", () => {
  assert.equal(buildTeacherBusySlotTitle(weekly({ schedules: [] })), "Lịch dạy tại Mầm non Hoa Thủy Tiên");
});

test("uses the final fallback without organization or schedule data", () => {
  assert.equal(buildTeacherBusySlotTitle(weekly({
    slotType: "OTHER",
    organizationType: undefined,
    organizationName: undefined,
    schedules: [],
  })), "Lịch dạy ngoài");
});

test("truncates generated titles to the database limit without invalid fragments", () => {
  const title = buildTeacherBusySlotTitle(weekly({ organizationName: "A".repeat(200) }));
  assert.equal(Array.from(title).length, TEACHER_BUSY_SLOT_TITLE_MAX_LENGTH);
  assert.equal(title.includes("undefined"), false);
  assert.equal(title.includes("null"), false);
});
