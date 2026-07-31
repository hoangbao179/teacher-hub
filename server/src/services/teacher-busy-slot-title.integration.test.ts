import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { AppError } from "../errors/app-error";
import { pool } from "../db/pool";
import { LessonRepository } from "../repositories/lesson.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

test.after(async () => {
  await pool.end();
});

function service(): ScheduleService {
  return new ScheduleService(
    new ScheduleRepository(),
    new LessonService(new LessonRepository(), new TuitionRepository()),
  );
}

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of ["teacher_busy_slot_schedules", "teacher_busy_slots", "audit_logs"])
      await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

integration("creates and updates optional busy-slot titles with stable PATCH semantics", async () => {
  await clean();
  const schedules = service();
  const [managedBefore] = await pool.query<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM students) students,
      (SELECT COUNT(*) FROM class_enrollments) enrollments,
      (SELECT COUNT(*) FROM lesson_sessions) lessons,
      (SELECT COUNT(*) FROM lesson_attendances) attendances,
      (SELECT COUNT(*) FROM tuition_cycles) cycles`,
  );
  const recurringInput = {
    slotType: "EXTERNAL_CLASS" as const,
    organizationType: "SCHOOL" as const,
    organizationName: "Mầm non Hoa Thủy Tiên",
    recurrenceType: "WEEKLY" as const,
    schedules: [
      { dayOfWeek: 5 as const, startTime: "09:00", endTime: "10:00" },
      { dayOfWeek: 1 as const, startTime: "08:00", endTime: "09:00" },
    ],
    effectiveFrom: "2026-07-31",
  };

  const recurring = await schedules.createBusySlot(recurringInput);
  assert.equal(recurring.slot.title, "Mầm non Hoa Thủy Tiên · Thứ 2 08:00");

  const oneTime = await schedules.createBusySlot({
    slotType: "EXTERNAL_CLASS",
    organizationType: "SCHOOL",
    organizationName: "Mầm non Hoa Thủy Tiên",
    recurrenceType: "ONCE",
    specificDate: "2026-07-31",
    startTime: "08:00",
    endTime: "09:00",
  });
  assert.equal(oneTime.slot.title, "Mầm non Hoa Thủy Tiên · 31/07/2026 08:00");
  const overlapping = await schedules.createBusySlot({
    slotType: "OTHER",
    title: "Lịch trùng",
    recurrenceType: "ONCE",
    specificDate: "2026-07-31",
    startTime: "08:30",
    endTime: "09:30",
  });
  assert.ok(overlapping.conflicts.some((warning) => warning.kind === "BUSY_SLOT" && warning.id === oneTime.slot.id));
  await assert.rejects(() => schedules.createBusySlot({
    slotType: "OTHER",
    recurrenceType: "ONCE",
    specificDate: "2026-07-31",
    startTime: "10:00",
    endTime: "09:00",
  }), (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR");

  for (const [title, expected] of [
    ["  Lớp Bé Gấu  ", "Lớp Bé Gấu"],
    ["", "Mầm non Hoa Thủy Tiên · Thứ 2 08:00"],
    ["   ", "Mầm non Hoa Thủy Tiên · Thứ 2 08:00"],
  ] as const) {
    const created = await schedules.createBusySlot({ ...recurringInput, title });
    assert.equal(created.slot.title, expected);
  }

  const manual = await schedules.createBusySlot({ ...recurringInput, title: "Tên giữ nguyên" });
  const omittedTitle = await schedules.updateBusySlot(manual.slot.id, {
    ...recurringInput,
    schedules: [{ dayOfWeek: 2, startTime: "10:00", endTime: "11:00" }],
  });
  assert.equal(omittedTitle.slot.title, "Tên giữ nguyên");

  const renamed = await schedules.updateBusySlot(manual.slot.id, {
    ...recurringInput,
    title: "  Tên mới  ",
  });
  assert.equal(renamed.slot.title, "Tên mới");

  const regenerated = await schedules.updateBusySlot(manual.slot.id, {
    ...recurringInput,
    organizationName: "Trung tâm Ánh Dương",
    title: "",
    schedules: [{ dayOfWeek: 6, startTime: "14:30", endTime: "16:00" }],
  });
  assert.equal(regenerated.slot.title, "Trung tâm Ánh Dương · Thứ 7 14:30");
  assert.equal((await schedules.getBusySlot(manual.slot.id)).title, regenerated.slot.title);

  const longGenerated = await schedules.createBusySlot({
    ...recurringInput,
    organizationName: "A".repeat(160),
  });
  assert.equal(Array.from(longGenerated.slot.title).length, 160);
  const [managedAfter] = await pool.query<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM students) students,
      (SELECT COUNT(*) FROM class_enrollments) enrollments,
      (SELECT COUNT(*) FROM lesson_sessions) lessons,
      (SELECT COUNT(*) FROM lesson_attendances) attendances,
      (SELECT COUNT(*) FROM tuition_cycles) cycles`,
  );
  assert.deepEqual(managedAfter[0], managedBefore[0]);
});
