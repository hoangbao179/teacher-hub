import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { occurrenceKey, replacementOccurrenceKey } from "../domain/schedule-projection";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { LessonRepository } from "../repositories/lesson.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances", "lesson_makeup_replacements", "lesson_session_participants",
      "lesson_sessions", "schedule_exceptions", "teacher_busy_slot_schedules", "teacher_busy_slots", "recurring_schedules", "enrollment_active_periods",
      "class_active_periods", "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments",
      "audit_logs", "students", "classes", "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture() {
  await clean();
  const connection = await pool.getConnection();
  try {
    const [actor] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users(username,email,password_hash,display_name) VALUES ('m5a','m5a@example.test','hash','M5A')",
    );
    const [klass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('M5A Group','GROUP',2400000,90,'2026-07-01')",
    );
    await connection.execute("INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,2400000,'2026-07-01')", [klass.insertId]);
    await connection.execute("INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2026-07-01')", [klass.insertId]);
    const scheduleIds: number[] = [];
    for (let day = 1; day <= 5; day += 1) {
      const [schedule] = await connection.execute<ResultSetHeader>(
        "INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from) VALUES (?,?, '18:00','19:30','2026-07-01')",
        [klass.insertId, day],
      );
      scheduleIds.push(schedule.insertId);
    }
    const enrollmentIds: number[] = [];
    for (const name of ["M5A One", "M5A Two"]) {
      const [student] = await connection.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES (?)", [name]);
      const [enrollment] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
         VALUES (?,?,'2026-07-01','CLASS_DEFAULT','2026-07-01')`, [klass.insertId, student.insertId],
      );
      await connection.execute(
        "INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2026-07-01')",
        [enrollment.insertId],
      );
      await connection.execute("INSERT INTO enrollment_active_periods(enrollment_id,active_from) VALUES (?,'2026-07-01')", [enrollment.insertId]);
      enrollmentIds.push(enrollment.insertId);
    }
    return { actorId: actor.insertId, classId: klass.insertId, scheduleIds, enrollmentIds };
  } finally { connection.release(); }
}

function services() {
  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  return { lessons, schedules: new ScheduleService(new ScheduleRepository(), lessons) };
}

integration("project, cancel canonical draft as skipped and preserve pre-pause history", async () => {
  const data = await fixture();
  const { lessons, schedules } = services();
  const items = await schedules.occurrences({ from: "2026-07-20", to: "2026-07-31", lookbackDays: 60 });
  assert.equal(items.length, 10);
  assert.equal(new Set(items.map((item) => item.key)).size, items.length);
  const mondayKey = occurrenceKey(data.classId, data.scheduleIds[0], "2026-07-20");
  const [first, replay] = await Promise.all([
    schedules.createDraft(mondayKey, data.actorId),
    schedules.createDraft(mondayKey, data.actorId),
  ]);
  assert.equal(replay.lessonId, first.lessonId);
  assert.deepEqual([first.idempotent, replay.idempotent].sort(), [false, true]);
  const detail = await lessons.detail(first.lessonId);
  assert.equal(detail.status, "DRAFT");
  assert.deepEqual(detail.participants.map((item) => item.enrollmentId), data.enrollmentIds);
  const [attendances] = await pool.query<RowDataPacket[]>("SELECT id FROM lesson_attendances WHERE lesson_session_id=?", [first.lessonId]);
  const [cycles] = await pool.query<RowDataPacket[]>("SELECT id FROM tuition_cycles");
  assert.equal(attendances.length, 0);
  assert.equal(cycles.length, 0);
  await lessons.cancel(first.lessonId, { reason: "Teacher cancelled" }, data.actorId);
  const handled = (await schedules.occurrences({ from: "2026-07-20", to: "2026-07-20", lookbackDays: 60 }))[0];
  assert.equal(handled.state, "SKIPPED");
  assert.equal(handled.linkedLessonStatus, "CANCELLED");
  await pool.execute("UPDATE classes SET status='PAUSED' WHERE id=?", [data.classId]);
  await pool.execute("UPDATE class_active_periods SET active_to='2026-07-24' WHERE class_id=? AND active_to IS NULL", [data.classId]);
  const historical = await schedules.occurrences({ from: "2026-07-20", to: "2026-07-31", lookbackDays: 60 });
  assert.ok(historical.length > 0);
  assert.equal(historical.every((item) => item.occurrenceDate <= "2026-07-24"), true);
});

integration("skip, reschedule, replacement draft and busy-slot conflicts are operational", async () => {
  const data = await fixture();
  const { lessons, schedules } = services();
  const tuesdayKey = occurrenceKey(data.classId, data.scheduleIds[1], "2026-07-21");
  const wednesdayKey = occurrenceKey(data.classId, data.scheduleIds[2], "2026-07-22");
  const skipped = await schedules.skip(tuesdayKey, { reason: "Nghỉ lễ", note: "E2E" }, data.actorId);
  const skippedReplay = await schedules.skip(tuesdayKey, { reason: "Nghỉ lễ", note: "E2E" }, data.actorId);
  assert.equal(skippedReplay.exceptionId, skipped.exceptionId);
  assert.equal(skippedReplay.idempotent, true);

  await lessons.create({
    classId: data.classId, sessionDate: "2026-07-23", scheduledStartTime: "18:40",
    scheduledEndTime: "19:40", lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollmentIds[0]],
  }, data.actorId);
  const busy = await schedules.createBusySlot({
    slotType: "EXTERNAL_CLASS", organizationType: "SCHOOL", organizationName: "Trường M5A",
    title: "Dạy ở trường", recurrenceType: "ONCE", specificDate: "2026-07-23",
    startTime: "18:30", endTime: "20:00", location: "Trường",
  }, data.actorId);
  assert.ok(busy.conflicts.some((item) => item.kind === "PROJECTED_OCCURRENCE"));
  assert.ok(busy.conflicts.some((item) => item.kind === "LESSON"));
  const rescheduled = await schedules.reschedule(wednesdayKey, {
    replacementDate: "2026-07-23", replacementStartTime: "18:45", replacementEndTime: "20:15",
    reason: "Đổi lịch", note: "Một occurrence",
  }, data.actorId);
  assert.ok(rescheduled.conflicts.some((item) => item.kind === "BUSY_SLOT"));
  assert.ok(rescheduled.conflicts.some((item) => item.kind === "LESSON"));
  const rescheduledReplay = await schedules.reschedule(wednesdayKey, {
    replacementDate: "2026-07-23", replacementStartTime: "18:45", replacementEndTime: "20:15",
    reason: "Đổi lịch", note: "Một occurrence",
  }, data.actorId);
  assert.equal(rescheduledReplay.exceptionId, rescheduled.exceptionId);
  assert.equal(rescheduledReplay.idempotent, true);
  await assert.rejects(
    () => schedules.reschedule(wednesdayKey, {
      replacementDate: "2026-07-24", replacementStartTime: "20:00", replacementEndTime: "21:00", reason: "Khác",
    }, data.actorId),
    (error: unknown) => error instanceof AppError && error.code === "OCCURRENCE_ALREADY_RESOLVED",
  );
  const occurrences = await schedules.occurrences({ from: "2026-07-20", to: "2026-07-24", lookbackDays: 60 });
  assert.equal(occurrences.find((item) => item.key === tuesdayKey)?.state, "SKIPPED");
  assert.equal(occurrences.find((item) => item.key === wednesdayKey)?.state, "RESCHEDULED");
  assert.equal((await schedules.occurrences({ from: "2026-07-20", to: "2026-07-24", classId: data.classId,
    state: "SKIPPED", lookbackDays: 60 })).length, 1);
  const replacementKey = replacementOccurrenceKey(wednesdayKey);
  assert.equal(occurrences.find((item) => item.key === replacementKey)?.projectionSource, "RESCHEDULED");
  const replacementDraft = await schedules.createDraft(replacementKey, data.actorId);
  assert.equal(replacementDraft.idempotent, false);
  const [tuition] = await pool.query<RowDataPacket[]>("SELECT id FROM tuition_cycles");
  assert.equal(tuition.length, 0);

  const updated = await schedules.updateBusySlot(busy.slot.id, {
    slotType: "EXTERNAL_CLASS", organizationType: "SCHOOL", organizationName: "Trường M5A",
    title: "Dạy ở trường cập nhật", recurrenceType: "WEEKLY",
    schedules: [{ dayOfWeek: 4, startTime: "08:00", endTime: "10:00" }],
    effectiveFrom: "2026-07-01", effectiveTo: "2026-08-01",
  }, data.actorId);
  assert.equal(updated.slot.recurrenceType, "WEEKLY");
  assert.equal((await schedules.listBusySlots("2026-07-20", "2026-07-31")).length, 1);
  await schedules.deleteBusySlot(busy.slot.id, data.actorId);
  assert.equal((await schedules.listBusySlots("2026-07-20", "2026-07-31")).length, 0);
  const [deletedSchedules] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM teacher_busy_slot_schedules WHERE teacher_busy_slot_id=?", [busy.slot.id],
  );
  assert.equal(deletedSchedules.length, 0);
});

integration("0011 schema backfills legacy weekly busy slots", async () => {
  await clean();
  const [legacy] = await pool.execute<ResultSetHeader>(
    `INSERT INTO teacher_busy_slots
      (slot_type,title,recurrence_type,day_of_week,start_time,end_time,effective_from)
     VALUES ('OTHER','Lịch tuần cũ','WEEKLY',3,'13:00','14:30','2026-07-01')`,
  );
  const sql = await readFile(path.join(process.cwd(), "src/db/migrations/0011_multiple_busy_slot_schedules.sql"), "utf8");
  const backfill = sql.match(/INSERT INTO teacher_busy_slot_schedules[\s\S]*?end_time IS NOT NULL/)?.[0];
  assert.ok(backfill);
  await pool.query(backfill);
  const slot = await new ScheduleRepository().findBusySlot(legacy.insertId);
  assert.deepEqual(slot?.schedules.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
    [{ dayOfWeek: 3, startTime: "13:00", endTime: "14:30" }]);
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0011_multiple_busy_slot_schedules.sql'",
  );
  assert.equal(migration.length, 1);
});

integration("multiple external schedules project, conflict and update atomically without managed-class side effects", async () => {
  const data = await fixture();
  const { schedules } = services();
  const repository = new ScheduleRepository();
  const [before] = await pool.query<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM students) students,
      (SELECT COUNT(*) FROM class_enrollments) enrollments,
      (SELECT COUNT(*) FROM lesson_sessions) lessons,
      (SELECT COUNT(*) FROM lesson_attendances) attendances,
      (SELECT COUNT(*) FROM tuition_cycles) cycles`,
  );
  const school = await schedules.createBusySlot({
    slotType: "EXTERNAL_CLASS", organizationType: "SCHOOL", organizationName: "Trường Nguyễn Huệ",
    title: "Tiếng Anh 7A", recurrenceType: "WEEKLY",
    schedules: [1, 2, 3, 4].map((dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 1 | 2 | 3 | 4, startTime: "18:15", endTime: "19:15",
    })),
    effectiveFrom: "2026-07-20", effectiveTo: "2026-08-31",
    location: "Phòng 12", note: "Lịch do nhà trường quản lý",
  }, data.actorId);
  const conflictDates = new Set(school.conflicts.filter((item) => item.kind === "PROJECTED_OCCURRENCE" && item.date <= "2026-07-26").map((item) => item.date));
  assert.deepEqual([...conflictDates].sort(), ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23"]);
  const center = await schedules.createBusySlot({
    slotType: "EXTERNAL_CLASS", organizationType: "CENTER", organizationName: "Trung tâm Ánh Dương",
    title: "Lớp giao tiếp", recurrenceType: "WEEKLY",
    schedules: [
      { dayOfWeek: 2, startTime: "09:00", endTime: "10:30" },
      { dayOfWeek: 6, startTime: "09:00", endTime: "10:30" },
    ],
    effectiveFrom: "2026-07-20", location: "Cơ sở 2",
  }, data.actorId);
  const oneTime = await schedules.createBusySlot({
    slotType: "EXTERNAL_CLASS", organizationType: "CENTER", organizationName: "Trung tâm Ánh Dương",
    title: "Chuyên đề một lần", recurrenceType: "ONCE", specificDate: "2026-07-24",
    startTime: "09:00", endTime: "10:30",
  }, data.actorId);
  const personal = await schedules.createBusySlot({
    slotType: "PERSONAL", title: "Khám sức khỏe", recurrenceType: "ONCE", specificDate: "2026-07-22",
    startTime: "08:00", endTime: "09:00",
  }, data.actorId);

  const week = await schedules.week("2026-07-20");
  assert.equal(week.busyOccurrences.filter((item) => item.id === school.slot.id).length, 4);
  assert.equal(week.busyOccurrences.filter((item) => item.id === center.slot.id).length, 2);
  assert.equal(week.busyOccurrences.filter((item) => item.id === oneTime.slot.id).length, 1);
  assert.equal(week.busyOccurrences.find((item) => item.id === personal.slot.id)?.slotType, "PERSONAL");
  assert.equal((await schedules.listBusySlots()).length, 4);
  assert.equal((await schedules.occurrences({ from: "2026-07-20", to: "2026-07-26", state: "UNRECORDED", lookbackDays: 60 })).length, 5);

  const common = {
    slotType: "EXTERNAL_CLASS" as const, organizationType: "SCHOOL" as const, organizationName: "Trường Nguyễn Huệ",
    title: "Tiếng Anh 7A", recurrenceType: "WEEKLY" as const, effectiveFrom: "2026-07-20", effectiveTo: "2026-08-31",
    location: "Phòng 12", note: "Lịch do nhà trường quản lý",
  };
  const added = await schedules.updateBusySlot(school.slot.id, { ...common, schedules: [
    ...school.slot.schedules, { dayOfWeek: 5, startTime: "18:15", endTime: "19:15" },
  ] }, data.actorId);
  assert.equal(added.slot.schedules.length, 5);
  const removed = await schedules.updateBusySlot(school.slot.id, { ...common,
    schedules: added.slot.schedules.filter((item) => item.dayOfWeek !== 2),
  }, data.actorId);
  assert.equal(removed.slot.schedules.length, 4);
  await assert.rejects(() => schedules.updateBusySlot(school.slot.id, { ...common,
    schedules: [removed.slot.schedules[0], { ...removed.slot.schedules[0], id: undefined }],
  }, data.actorId), (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR");
  assert.equal((await schedules.getBusySlot(school.slot.id)).schedules.length, 4);

  await assert.rejects(() => repository.updateBusySlot(center.slot.id, {
    slotType: "EXTERNAL_CLASS", organizationType: "CENTER", organizationName: "Trung tâm Ánh Dương",
    title: "Không được lưu", recurrenceType: "WEEKLY", effectiveFrom: "2026-07-20",
    schedules: [{ dayOfWeek: 2, startTime: "11:00", endTime: "10:00" }],
  }, data.actorId));
  const rolledBack = await schedules.getBusySlot(center.slot.id);
  assert.equal(rolledBack.title, "Lớp giao tiếp");
  assert.equal(rolledBack.schedules.length, 2);

  const [after] = await pool.query<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM students) students,
      (SELECT COUNT(*) FROM class_enrollments) enrollments,
      (SELECT COUNT(*) FROM lesson_sessions) lessons,
      (SELECT COUNT(*) FROM lesson_attendances) attendances,
      (SELECT COUNT(*) FROM tuition_cycles) cycles`,
  );
  assert.deepEqual(after[0], before[0]);
});

integration("bulk draft and skip return independent results without tuition mutation", async () => {
  const data = await fixture();
  const { schedules } = services();
  const createKeys = [
    occurrenceKey(data.classId, data.scheduleIds[3], "2026-07-23"),
    occurrenceKey(data.classId, data.scheduleIds[4], "2026-07-24"),
  ];
  const skipKeys = [
    occurrenceKey(data.classId, data.scheduleIds[0], "2026-07-27"),
    occurrenceKey(data.classId, data.scheduleIds[1], "2026-07-28"),
  ];
  const drafts = await schedules.bulkCreateDrafts({ keys: createKeys }, data.actorId);
  const skipped = await schedules.bulkSkip({ keys: skipKeys, reason: "Bulk nghỉ" }, data.actorId);
  assert.equal(drafts.every((item) => item.success && item.lessonId), true);
  assert.equal(skipped.every((item) => item.success && item.exceptionId), true);
  const [lessons] = await pool.query<RowDataPacket[]>("SELECT status FROM lesson_sessions");
  assert.equal(lessons.length, 2);
  assert.equal(lessons.every((row) => row.status === "DRAFT"), true);
  const [attendances] = await pool.query<RowDataPacket[]>("SELECT id FROM lesson_attendances");
  const [tuition] = await pool.query<RowDataPacket[]>("SELECT id FROM tuition_cycles");
  assert.equal(attendances.length, 0);
  assert.equal(tuition.length, 0);
  const unrecorded = await schedules.unrecorded(60);
  assert.equal(unrecorded.some((item) => skipKeys.includes(item.occurrenceKey)), false);
});

test.after(async () => { if (enabled) await pool.end(); });
