import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { CombinedClassGroupRepository } from "../repositories/combined-class-group.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { CombinedClassGroupService } from "./combined-class-group.service";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";

const integration = process.env.RUN_MYSQL_INTEGRATION === "1" ? test : test.skip;
test.after(async () => {
  if (process.env.RUN_MYSQL_INTEGRATION === "1") {
    await clean();
    await pool.end();
  }
});

async function clean() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_cycle_sessions",
      "tuition_cycles",
      "lesson_attendances",
      "lesson_session_participants",
      "lesson_sessions",
      "combined_teaching_occurrences",
      "combined_class_group_schedules",
      "combined_class_group_classes",
      "combined_class_groups",
      "recurring_schedules",
      "enrollment_active_periods",
      "class_active_periods",
      "enrollment_tuition_policies",
      "class_tuition_policies",
      "class_enrollments",
      "audit_logs",
      "students",
      "classes",
      "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

async function fixture() {
  await clean();
  const connection = await pool.getConnection();
  try {
    const [actor] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users(username,email,password_hash,display_name) VALUES ('combined','combined@example.test','hash','Combined')",
    );
    const classIds: number[] = [];
    const enrollmentIds: number[] = [];
    for (const grade of [4, 5, 6]) {
      const [klass] = await connection.execute<ResultSetHeader>(
        `INSERT INTO classes
          (name,class_type,default_package_price,default_duration_minutes,start_date)
         VALUES (?,'GROUP',1600000,120,'2026-07-01')`,
        [`Lớp ${grade}`],
      );
      classIds.push(klass.insertId);
      await connection.execute(
        "INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2026-07-01')",
        [klass.insertId],
      );
      await connection.execute(
        "INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,1600000,'2026-07-01')",
        [klass.insertId],
      );
      await connection.execute(
        `INSERT INTO recurring_schedules
          (class_id,day_of_week,start_time,end_time,effective_from)
         VALUES (?,1,'08:30','10:30','2026-07-01')`,
        [klass.insertId],
      );
      const [student] = await connection.execute<ResultSetHeader>(
        "INSERT INTO students(full_name) VALUES (?)",
        [`Học sinh ${grade}`],
      );
      const [enrollment] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments
          (class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
         VALUES (?,?,'2026-07-01','CLASS_DEFAULT','2026-07-01')`,
        [klass.insertId, student.insertId],
      );
      enrollmentIds.push(enrollment.insertId);
      await connection.execute(
        "INSERT INTO enrollment_active_periods(enrollment_id,active_from) VALUES (?,'2026-07-01')",
        [enrollment.insertId],
      );
      await connection.execute(
        `INSERT INTO enrollment_tuition_policies
          (enrollment_id,tuition_mode,effective_from)
         VALUES (?,'CLASS_DEFAULT','2026-07-01')`,
        [enrollment.insertId],
      );
    }
    const outsiderClassIds: number[] = [];
    for (const name of ["Lớp ngoài A", "Lớp ngoài B"]) {
      const [klass] = await connection.execute<ResultSetHeader>(
        `INSERT INTO classes
          (name,class_type,default_package_price,default_duration_minutes,start_date)
         VALUES (?,'GROUP',1600000,120,'2026-07-01')`,
        [name],
      );
      outsiderClassIds.push(klass.insertId);
      await connection.execute(
        "INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2026-07-01')",
        [klass.insertId],
      );
      await connection.execute(
        `INSERT INTO recurring_schedules
          (class_id,day_of_week,start_time,end_time,effective_from)
         VALUES (?,1,'09:00','10:00','2026-07-01')`,
        [klass.insertId],
      );
    }
    return { actorId: actor.insertId, classIds, enrollmentIds, outsiderClassIds };
  } finally {
    connection.release();
  }
}

function services() {
  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  const combined = new CombinedClassGroupService(new CombinedClassGroupRepository(), lessons);
  const schedules = new ScheduleService(new ScheduleRepository(), lessons, combined);
  return { lessons, combined, schedules };
}

integration("combined group resolves one card and completes child lessons atomically per class", async () => {
  const data = await fixture();
  const { combined, schedules } = services();
  const group = await combined.create({
    name: "Nhóm Lớp 4–5–6",
    classIds: data.classIds,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2026-08-17",
    schedules: [{ dayOfWeek: 1, startTime: "08:30", endTime: "11:00" }],
  }, data.actorId);

  const before = await schedules.occurrences({
    from: "2026-07-27",
    to: "2026-07-27",
    lookbackDays: 60,
  });
  assert.equal(before.filter((item) => data.classIds.includes(item.classId)).length, 3);
  const active = await schedules.occurrences({
    from: "2026-08-03",
    to: "2026-08-03",
    lookbackDays: 60,
  });
  const groupOccurrence = active.find((item) => item.combinedGroupId === group.id)!;
  assert.ok(groupOccurrence);
  assert.equal(active.some((item) => !item.combinedGroupId && data.classIds.includes(item.classId)), false);
  assert.deepEqual(groupOccurrence.memberClasses.map((item) => item.id).sort(), [...data.classIds].sort());
  assert.equal(groupOccurrence.conflicts.some((item) => item.kind === "PROJECTED_OCCURRENCE"), true);
  await assert.rejects(
    combined.create({
      name: "Nhóm trùng thành viên",
      classIds: data.classIds.slice(0, 2),
      effectiveFrom: "2026-08-01",
      schedules: [{ dayOfWeek: 2, startTime: "13:00", endTime: "14:00" }],
    }, data.actorId),
    (error: { code?: string }) => error.code === "COMBINED_GROUP_MEMBERSHIP_CONFLICT",
  );
  await assert.rejects(
    combined.create({
      name: "Nhóm trùng ca",
      classIds: data.outsiderClassIds,
      effectiveFrom: "2026-08-01",
      schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }],
    }, data.actorId),
    (error: { code?: string }) => error.code === "COMBINED_GROUP_SCHEDULE_CONFLICT",
  );
  const after = await schedules.occurrences({
    from: "2026-08-24",
    to: "2026-08-24",
    lookbackDays: 60,
  });
  assert.equal(after.filter((item) => data.classIds.includes(item.classId)).length, 3);

  const [first, replay] = await Promise.all([
    schedules.createDraft(groupOccurrence.key, data.actorId),
    schedules.createDraft(groupOccurrence.key, data.actorId),
  ]);
  assert.equal(first.combinedTeachingOccurrenceId, replay.combinedTeachingOccurrenceId);
  assert.deepEqual([first.idempotent, replay.idempotent].sort(), [false, true]);
  const occurrenceId = first.combinedTeachingOccurrenceId!;
  const detail = await combined.occurrenceDetail(occurrenceId);
  assert.equal(detail.classes.length, 3);
  assert.equal(detail.classes.every((item) => item.participants.length === 1), true);

  const completed = await combined.completeOccurrence(occurrenceId, {
    actualStartTime: "08:35",
    actualEndTime: "11:05",
    content: "Ôn tập chung",
    attendances: data.enrollmentIds.map((enrollmentId) => ({
      enrollmentId,
      status: "PRESENT" as const,
    })),
  }, data.actorId);
  assert.equal(completed.lessons.length, 3);
  assert.equal(completed.lessons.every((item) => item.lesson.status === "COMPLETED"), true);
  const replayCompletion = await combined.completeOccurrence(occurrenceId, {
    actualStartTime: "08:35",
    actualEndTime: "11:05",
    attendances: data.enrollmentIds.map((enrollmentId) => ({
      enrollmentId,
      status: "PRESENT" as const,
    })),
  }, data.actorId);
  assert.equal(replayCompletion.lessons.every((item) => item.tuitionImpacts.length === 0), true);
  const [progress] = await pool.query<RowDataPacket[]>(
    `SELECT tc.enrollment_id,COUNT(tcs.id) progress
     FROM tuition_cycles tc JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id
     GROUP BY tc.enrollment_id ORDER BY tc.enrollment_id`,
  );
  assert.deepEqual(progress.map((row) => Number(row.progress)), [1, 1, 1]);
});

integration("combined completion rolls back every child when attendance is incomplete", async () => {
  const data = await fixture();
  const { combined, schedules } = services();
  await combined.create({
    name: "Nhóm rollback",
    classIds: data.classIds,
    effectiveFrom: "2026-08-01",
    schedules: [{ dayOfWeek: 1, startTime: "08:30", endTime: "11:00" }],
  }, data.actorId);
  const occurrence = (await schedules.occurrences({
    from: "2026-08-10",
    to: "2026-08-10",
    lookbackDays: 60,
  }))[0];
  const draft = await schedules.createDraft(occurrence.key, data.actorId);
  await assert.rejects(
    combined.completeOccurrence(draft.combinedTeachingOccurrenceId!, {
      actualStartTime: "08:30",
      actualEndTime: "11:00",
      attendances: data.enrollmentIds.slice(0, 2).map((enrollmentId) => ({
        enrollmentId,
        status: "PRESENT" as const,
      })),
    }, data.actorId),
    (error: { code?: string }) => error.code === "MISSING_ATTENDANCE",
  );
  const [lessons] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM lesson_sessions WHERE combined_teaching_occurrence_id=?",
    [draft.combinedTeachingOccurrenceId],
  );
  assert.equal(lessons.length, 3);
  assert.equal(lessons.every((row) => row.status === "DRAFT"), true);
  const [attendances] = await pool.query<RowDataPacket[]>("SELECT id FROM lesson_attendances");
  const [cycles] = await pool.query<RowDataPacket[]>("SELECT id FROM tuition_cycles");
  assert.equal(attendances.length, 0);
  assert.equal(cycles.length, 0);
});
// Keep the July–September fixtures inside the API's rolling 60-day lookback.
// Mock only Date so MySQL/network timers continue to run normally.
beforeEach((context) => {
  assert.ok("mock" in context);
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-01T05:00:00Z") });
});
