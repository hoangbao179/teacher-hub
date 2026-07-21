import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { occurrenceKey } from "../domain/schedule-projection";
import { AppError } from "../errors/app-error";
import { ClassRepository } from "../repositories/class.repository";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { StudentRepository } from "../repositories/student.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { ClassService } from "./class.service";
import { EnrollmentService } from "./enrollment.service";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";
import { StudentService } from "./student.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances", "lesson_makeup_replacements",
      "lesson_session_participants", "lesson_sessions", "schedule_exceptions", "teacher_busy_slots",
      "recurring_schedules", "enrollment_active_periods", "class_active_periods",
      "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments",
      "audit_logs", "students", "classes", "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

function services() {
  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  return {
    classes: new ClassService(new ClassRepository()),
    students: new StudentService(new StudentRepository()),
    enrollments: new EnrollmentService(new EnrollmentRepository()),
    lessons,
    schedules: new ScheduleService(new ScheduleRepository(), lessons),
  };
}

integration("V14 migration exposes snapshot, active-period and makeup integrity schema", async () => {
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0008_v14_schedule_history_integrity.sql'",
  );
  assert.equal(migration.length, 1);
  const [tables] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME IN ('class_active_periods','enrollment_active_periods','lesson_makeup_replacements')`,
  );
  assert.equal(tables.length, 3);
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME='lesson_sessions'
     AND COLUMN_NAME IN ('class_name_snapshot','class_type_snapshot','subject_snapshot',
       'cancelled_at','cancelled_by','cancel_reason','makeup_source_occurrence_key')`,
  );
  assert.equal(columns.length, 7);
});

integration("V14 preserves history and enforces pause, cancel, makeup and temporary reschedule", async () => {
  await clean();
  const { classes, students, enrollments, lessons, schedules } = services();
  const classId = await classes.create({
    name: "V14 Group", type: "GROUP", subject: "English", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 90, startDate: "2026-07-01",
    schedules: [{ dayOfWeek: 1, startTime: "18:00", endTime: "19:30" }],
  });
  const studentId = await students.create({ fullName: "V14 Student", nickname: "Old" });
  const enrollmentId = await enrollments.create(classId, {
    studentId, joinedAt: "2026-07-01", tuitionMode: "CLASS_DEFAULT",
  });
  const first = await lessons.create({
    classId, sessionDate: "2026-07-02", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR",
  });
  const before = await classes.detail(classId);
  const scheduleId = before.schedules[0].id;
  await classes.update(classId, {
    name: "V14 Renamed", type: "GROUP", subject: "English", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 90, startDate: "2026-07-01", status: "ACTIVE",
    schedules: before.schedules, scheduleEffectiveDate: "2026-07-21",
  });
  await students.update(studentId, { fullName: "V14 Student Renamed", nickname: "New", status: "ACTIVE" });
  assert.equal((await classes.detail(classId)).schedules[0].id, scheduleId);
  const historical = await lessons.detail(first.id);
  assert.equal(historical.className, "V14 Group");
  assert.equal(historical.participants[0].studentName, "V14 Student");
  const newer = await lessons.create({
    classId, sessionDate: "2026-07-03", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR",
  });
  assert.equal(newer.className, "V14 Renamed");
  assert.equal(newer.participants[0].studentName, "V14 Student Renamed");

  await classes.setStatus(classId, "PAUSED", { effectiveDate: "2026-07-14", reason: "Nghỉ hè" });
  await classes.setStatus(classId, "ACTIVE", { effectiveDate: "2026-07-21", reason: "Dạy lại" });
  const projected = await schedules.occurrences({ from: "2026-07-06", to: "2026-07-27", lookbackDays: 60 });
  assert.ok(projected.some((item) => item.occurrenceDate === "2026-07-06"));
  assert.equal(projected.some((item) => item.occurrenceDate === "2026-07-20"), false);
  assert.ok(projected.some((item) => item.occurrenceDate === "2026-07-27"));

  await enrollments.pause(enrollmentId, { effectiveDate: "2026-07-14" });
  await enrollments.resume(enrollmentId, { effectiveDate: "2026-07-21" });
  const inPause = await lessons.create({
    classId, sessionDate: "2026-07-16", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR",
  });
  assert.equal(inPause.participants.length, 0);
  const lateBeforePause = await lessons.create({
    classId, sessionDate: "2026-07-10", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR",
  });
  assert.deepEqual(lateBeforePause.participants.map((item) => item.enrollmentId), [enrollmentId]);

  const secondStudentId = await students.create({ fullName: "V14 Student Two" });
  const secondEnrollmentId = await enrollments.create(classId, {
    studentId: secondStudentId, joinedAt: "2026-07-01", tuitionMode: "CLASS_DEFAULT",
  });
  const freeStudentId = await students.create({ fullName: "V14 Student Free" });
  const freeEnrollmentId = await enrollments.create(classId, {
    studentId: freeStudentId, joinedAt: "2026-07-01", tuitionMode: "FREE",
  });

  const sourceKey = occurrenceKey(classId, scheduleId, "2026-07-06");
  const draft = await schedules.createDraft(sourceKey);
  await lessons.cancel(draft.lessonId, { reason: "Mưa lớn" });
  const skipped = await schedules.occurrences({ from: "2026-07-06", to: "2026-07-06", lookbackDays: 60 });
  assert.equal(skipped[0].state, "SKIPPED");
  assert.equal(skipped[0].linkedLessonStatus, "CANCELLED");
  assert.equal((await lessons.detail(draft.lessonId)).cancelReason, "Mưa lớn");
  const [cancelAudits] = await pool.query<RowDataPacket[]>(
    "SELECT action FROM audit_logs WHERE action IN ('LESSON_CANCELLED','SCHEDULE_OCCURRENCE_SKIPPED') ORDER BY action",
  );
  assert.deepEqual(cancelAudits.map((row) => row.action), ["LESSON_CANCELLED", "SCHEDULE_OCCURRENCE_SKIPPED"]);

  const options = await lessons.makeupOptions(sourceKey);
  assert.deepEqual(options.participants.map((item) => item.enrollmentId).sort((a, b) => a - b),
    [enrollmentId, secondEnrollmentId, freeEnrollmentId].sort((a, b) => a - b));
  const makeup = await lessons.create({
    classId, sessionDate: "2026-07-08", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollmentId], makeupSourceOccurrenceKey: sourceKey,
  });
  await lessons.complete(makeup.id, {
    actualStartTime: "18:00", actualEndTime: "19:30",
    attendances: [{ enrollmentId, status: "PRESENT" }],
  });
  const secondMakeup = await lessons.create({
    classId, sessionDate: "2026-07-09", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [secondEnrollmentId], makeupSourceOccurrenceKey: sourceKey,
  });
  await lessons.complete(secondMakeup.id, {
    actualStartTime: "18:00", actualEndTime: "19:30",
    attendances: [{ enrollmentId: secondEnrollmentId, status: "ABSENT" }],
  });
  const freeMakeup = await lessons.create({
    classId, sessionDate: "2026-07-10", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [freeEnrollmentId], makeupSourceOccurrenceKey: sourceKey,
  });
  await lessons.complete(freeMakeup.id, {
    actualStartTime: "20:00", actualEndTime: "21:30",
    attendances: [{ enrollmentId: freeEnrollmentId, status: "FREE" }],
  });
  await assert.rejects(() => lessons.create({
    classId, sessionDate: "2026-07-11", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollmentId], makeupSourceOccurrenceKey: sourceKey,
  }), (error: unknown) => error instanceof AppError && error.code === "MAKEUP_REPLACEMENT_DUPLICATE");
  await assert.rejects(() => lessons.cancel(makeup.id, { reason: "Không hợp lệ" }),
    (error: unknown) => error instanceof AppError && error.code === "LESSON_NOT_DRAFT");
  const genericMakeup = await lessons.create({
    classId, sessionDate: "2026-07-12", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [secondEnrollmentId],
  });
  assert.equal(genericMakeup.makeupSource, null);
  const [cycleItems] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM tuition_cycle_sessions WHERE tuition_cycle_id IN (SELECT id FROM tuition_cycles WHERE enrollment_id=?)",
    [enrollmentId],
  );
  assert.equal(cycleItems.length, 1);

  await schedules.createBusySlot({
    title: "Bận", recurrenceType: "ONCE", specificDate: "2026-07-28",
    startTime: "18:00", endTime: "19:30",
  });
  const temporaryInput = {
    classId, recurringScheduleId: scheduleId, fromDate: "2026-07-27", toDate: "2026-08-10",
    replacementDayOfWeek: 2 as const, replacementStartTime: "18:00", replacementEndTime: "19:30",
    reason: "Đổi tạm ba tuần",
  };
  const preview = await schedules.previewTemporary(temporaryInput);
  assert.equal(preview.items.length, 3);
  assert.ok(preview.conflictCount > 0);
  await assert.rejects(() => schedules.applyTemporary(temporaryInput),
    (error: unknown) => error instanceof AppError && error.code === "SCHEDULE_CONFLICT_CONFIRMATION_REQUIRED");
  await schedules.applyTemporary({ ...temporaryInput, confirmConflicts: true });
  const [scheduleRows] = await pool.query<RowDataPacket[]>("SELECT id,start_time FROM recurring_schedules WHERE id=?", [scheduleId]);
  assert.equal(scheduleRows.length, 1);
  const afterRange = await schedules.occurrences({ from: "2026-08-17", to: "2026-08-17", lookbackDays: 60 });
  assert.ok(afterRange.some((item) => item.recurringScheduleId === scheduleId && item.scheduledStartTime === "18:00"));

  const [duplicateAttempt] = await pool.execute<ResultSetHeader>(
    "INSERT IGNORE INTO lesson_makeup_replacements(source_occurrence_key,makeup_lesson_id,enrollment_id) VALUES (?,?,?)",
    [sourceKey, makeup.id, enrollmentId],
  );
  assert.equal(duplicateAttempt.affectedRows, 0);
  await assert.rejects(() => schedules.applyTemporary({ ...temporaryInput, confirmConflicts: true }),
    (error: unknown) => error instanceof AppError && error.code === "TEMPORARY_RESCHEDULE_INELIGIBLE");
});

integration("V14 versions recurring schedules and preserves linked operational history", async () => {
  await clean();
  const { classes, lessons, schedules } = services();
  const classId = await classes.create({
    name: "V14 Schedule History", type: "GROUP", subject: "English",
    defaultPackagePrice: 2_000_000, defaultDurationMinutes: 90, startDate: "2026-06-01",
    schedules: [{ dayOfWeek: 1, startTime: "18:00", endTime: "19:30" }],
  });
  const original = (await classes.detail(classId)).schedules[0];
  const skippedKey = occurrenceKey(classId, original.id, "2026-07-06");
  const rescheduledKey = occurrenceKey(classId, original.id, "2026-07-13");
  const draftKey = occurrenceKey(classId, original.id, "2026-07-20");
  await schedules.skip(skippedKey, { reason: "Nghỉ có chủ ý" });
  await schedules.reschedule(rescheduledKey, {
    replacementDate: "2026-07-14", replacementStartTime: "20:00",
    replacementEndTime: "21:30", reason: "Đổi một buổi",
  });
  const draft = await schedules.createDraft(draftKey);

  await classes.update(classId, {
    name: "V14 Schedule History Renamed", type: "GROUP", subject: "English Advanced",
    defaultPackagePrice: 2_200_000, defaultDurationMinutes: 75, startDate: "2026-06-01",
    expectedEndDate: "2026-12-31", note: "Metadata only", status: "ACTIVE",
    schedules: [original], scheduleEffectiveDate: "2026-07-21",
  });
  assert.equal((await classes.detail(classId)).schedules[0].id, original.id);
  assert.equal((await lessons.detail(draft.lessonId)).sourceOccurrenceKey, draftKey);
  const preserved = await schedules.occurrences({ from: "2026-07-06", to: "2026-07-20", classId, lookbackDays: 60 });
  assert.equal(preserved.find((item) => item.originalKey === skippedKey)?.state, "SKIPPED");
  assert.equal(preserved.find((item) => item.originalKey === rescheduledKey)?.state, "RESCHEDULED");
  assert.equal(preserved.find((item) => item.originalKey === draftKey)?.linkedLessonId, draft.lessonId);
  assert.equal(new Set(preserved.map((item) => item.key)).size, preserved.length);

  await schedules.update(original.id, {
    dayOfWeek: 1, startTime: "19:00", endTime: "20:30", effectiveFrom: "2026-08-03",
  });
  const [versions] = await pool.query<RowDataPacket[]>(
    `SELECT id,TIME_FORMAT(start_time,'%H:%i') start_time,DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from,
      DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to
     FROM recurring_schedules WHERE class_id=? ORDER BY effective_from`, [classId],
  );
  assert.equal(versions.length, 2);
  assert.equal(Number(versions[0].id), original.id);
  assert.equal(versions[0].start_time, "18:00");
  assert.equal(versions[0].effective_to, "2026-08-02");
  const nextVersionId = Number(versions[1].id);
  assert.notEqual(nextVersionId, original.id);
  const boundary = await schedules.occurrences({ from: "2026-07-27", to: "2026-08-03", classId, lookbackDays: 60 });
  assert.equal(boundary.find((item) => item.occurrenceDate === "2026-07-27")?.scheduledStartTime, "18:00");
  assert.equal(boundary.find((item) => item.occurrenceDate === "2026-08-03")?.scheduledStartTime, "19:00");
  const recordedKey = occurrenceKey(classId, nextVersionId, "2026-08-10");
  await schedules.createDraft(recordedKey);
  const recordedPreviewInput = {
    classId, recurringScheduleId: nextVersionId, fromDate: "2026-08-10", toDate: "2026-08-10",
    replacementDayOfWeek: 2 as const, replacementStartTime: "19:00", replacementEndTime: "20:30",
    reason: "Không được đổi buổi đã ghi nhận",
  };
  const recordedPreview = await schedules.previewTemporary(recordedPreviewInput);
  assert.equal(recordedPreview.canApply, false);
  assert.equal(recordedPreview.items[0].currentState, "RECORDED");
  await assert.rejects(() => schedules.applyTemporary(recordedPreviewInput),
    (error: unknown) => error instanceof AppError && error.code === "TEMPORARY_RESCHEDULE_INELIGIBLE");

  await schedules.remove(nextVersionId, { effectiveDate: "2026-08-17", reason: "Kết thúc pattern" });
  const [ended] = await pool.query<RowDataPacket[]>(
    "SELECT DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to FROM recurring_schedules WHERE id=?", [nextVersionId],
  );
  assert.equal(ended.length, 1);
  assert.equal(ended[0].effective_to, "2026-08-16");
  assert.equal((await schedules.occurrences({ from: "2026-08-17", to: "2026-08-17", classId, lookbackDays: 60 })).length, 0);
  const [exception] = await pool.query<RowDataPacket[]>(
    "SELECT recurring_schedule_id FROM schedule_exceptions WHERE original_date='2026-07-06' AND class_id=?", [classId],
  );
  assert.equal(Number(exception[0].recurring_schedule_id), original.id);

  const immediateClassId = await classes.create({
    name: "V14 Immediate Pause", type: "GROUP", defaultPackagePrice: 1_800_000,
    defaultDurationMinutes: 60, startDate: "2026-09-01", schedules: [],
  });
  const immediateStudentId = await services().students.create({ fullName: "V14 Immediate Student" });
  const immediateEnrollmentId = await services().enrollments.create(immediateClassId, {
    studentId: immediateStudentId, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT",
  });
  await services().enrollments.pause(immediateEnrollmentId, { effectiveDate: "2026-09-01" });
  const [emptyEnrollmentPeriods] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM enrollment_active_periods WHERE enrollment_id=?", [immediateEnrollmentId],
  );
  assert.equal(emptyEnrollmentPeriods.length, 0);
  await services().enrollments.resume(immediateEnrollmentId, { effectiveDate: "2026-09-02" });
  await classes.setStatus(immediateClassId, "PAUSED", { effectiveDate: "2026-09-01" });
  const [emptyClassPeriods] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM class_active_periods WHERE class_id=?", [immediateClassId],
  );
  assert.equal(emptyClassPeriods.length, 0);
  await classes.setStatus(immediateClassId, "ACTIVE", { effectiveDate: "2026-09-02" });
});

test.after(async () => { if (enabled) await pool.end(); });
