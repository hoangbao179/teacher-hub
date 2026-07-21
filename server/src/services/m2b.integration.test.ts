import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { LessonRepository } from "../repositories/lesson.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { LessonService } from "./lesson.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances",
      "lesson_session_participants", "lesson_sessions", "enrollment_tuition_policies",
      "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture() {
  await clean();
  const connection = await pool.getConnection();
  try {
    const [klass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('M2B Group','GROUP',2400000,90,'2026-07-01')",
    );
    await connection.execute("INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,2400000,'2026-07-01')", [klass.insertId]);
    const ids: number[] = [];
    const students: number[] = [];
    for (const [name, joined, ended, mode] of [
      ["Paid", "2026-07-01", null, "CLASS_DEFAULT"],
      ["Free", "2026-07-01", null, "FREE"],
      ["Historical", "2026-07-01", "2026-07-15", "CUSTOM"],
      ["Future", "2026-07-11", null, "CLASS_DEFAULT"],
    ] as const) {
      const [student] = await connection.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES (?)", [name]);
      const [enrollment] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments
          (class_id,student_id,joined_at,ended_at,status,tuition_mode,custom_package_price,tuition_effective_from)
         VALUES (?,?,?,?,?,?,?,?)`,
        [klass.insertId, student.insertId, joined, ended, ended ? "ENDED" : "ACTIVE", mode,
          mode === "CUSTOM" ? 2_000_000 : null, joined],
      );
      await connection.execute(
        `INSERT INTO enrollment_tuition_policies
          (enrollment_id,tuition_mode,custom_package_price,effective_from)
         VALUES (?,?,?,?)`,
        [enrollment.insertId, mode, mode === "CUSTOM" ? 2_000_000 : null, joined],
      );
      ids.push(enrollment.insertId); students.push(student.insertId);
    }
    return { classId: klass.insertId, enrollmentIds: ids, studentIds: students };
  } finally { connection.release(); }
}

function service() {
  return new LessonService(new LessonRepository(), new TuitionRepository());
}

integration("canonical lesson workflow snapshots, persists, completes and audits", async () => {
  const data = await fixture();
  const lessons = service();
  const draft = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-10", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "REGULAR", note: "draft",
  });
  assert.deepEqual(draft.participants.map((item) => item.enrollmentId).sort((a, b) => a - b),
    data.enrollmentIds.slice(0, 3).sort((a, b) => a - b));
  await lessons.updateAttendances(draft.id, { attendances: [
    { enrollmentId: data.enrollmentIds[0], status: "PRESENT" },
    { enrollmentId: data.enrollmentIds[1], status: "FREE" },
    { enrollmentId: data.enrollmentIds[2], status: "ABSENT", studentNote: "Có phép" },
  ] });
  await lessons.updateContent(draft.id, { content: "Lesson content", homework: "Homework", note: "General" });
  const result = await lessons.complete(draft.id, {
    actualStartTime: "18:05", actualEndTime: "20:05", content: "Lesson content", homework: "Homework",
    attendances: [
      { enrollmentId: data.enrollmentIds[0], status: "PRESENT" },
      { enrollmentId: data.enrollmentIds[1], status: "FREE" },
      { enrollmentId: data.enrollmentIds[2], status: "ABSENT", studentNote: "Có phép" },
    ],
  });
  assert.equal(result.actualDurationMinutes, 120);
  assert.equal(result.presentCount, 1); assert.equal(result.absentCount, 1); assert.equal(result.freeCount, 1);
  const persisted = await lessons.detail(draft.id);
  assert.equal(persisted.status, "COMPLETED"); assert.equal(persisted.content, "Lesson content");
  assert.ok(result.completedAt);
  assert.equal(result.completedAt, persisted.completedAt);
  assert.equal(Number.isNaN(Date.parse(result.completedAt)), false);
  const [attendanceRows] = await pool.query<RowDataPacket[]>("SELECT * FROM lesson_attendances WHERE lesson_session_id=?", [draft.id]);
  assert.equal(attendanceRows.length, 3);
  const [cycleItems] = await pool.query<RowDataPacket[]>("SELECT * FROM tuition_cycle_sessions");
  assert.equal(cycleItems.length, 1);
  const replay = await lessons.complete(draft.id, {
    actualStartTime: "18:05", actualEndTime: "20:05",
    attendances: persisted.participants.map((item) => ({ enrollmentId: item.enrollmentId, status: item.attendance!.status })),
  });
  assert.equal(replay.lesson.status, "COMPLETED");
  assert.equal(replay.completedAt, result.completedAt);
  assert.equal(replay.lesson.completedAt, result.completedAt);
  const [afterReplay] = await pool.query<RowDataPacket[]>("SELECT * FROM tuition_cycle_sessions");
  assert.equal(afterReplay.length, 1);
  const [audits] = await pool.query<RowDataPacket[]>("SELECT action FROM audit_logs WHERE entity_id=? OR entity_type='TUITION_CYCLE'", [draft.id]);
  for (const action of ["LESSON_DRAFT_CREATED", "LESSON_ATTENDANCE_UPDATED", "LESSON_UPDATED", "LESSON_COMPLETED", "TUITION_ALLOCATION_RECALCULATED", "TUITION_CYCLE_CREATED"])
    assert.ok(audits.some((row) => row.action === action), `missing audit ${action}`);

  const makeup = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-10", scheduledStartTime: "20:00",
    scheduledEndTime: "21:00", lessonType: "MAKEUP",
    selectedEnrollmentIds: [data.enrollmentIds[0], data.enrollmentIds[2]],
  });
  assert.deepEqual(makeup.participants.map((item) => item.enrollmentId).sort((a, b) => a - b),
    [data.enrollmentIds[0], data.enrollmentIds[2]].sort((a, b) => a - b));

  await pool.execute("UPDATE class_enrollments SET status='ENDED',ended_at='2026-07-10' WHERE id=?", [data.enrollmentIds[0]]);
  assert.equal((await lessons.detail(draft.id)).participants.length, 3);
});

integration("completion rollback and free-enrollment validation leave draft unchanged", async () => {
  const data = await fixture();
  const lessons = service();
  const draft = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-10", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollmentIds[0], data.enrollmentIds[1]],
  });
  await assert.rejects(() => lessons.complete(draft.id, {
    actualStartTime: "18:00", actualEndTime: "19:30",
    attendances: [{ enrollmentId: data.enrollmentIds[0], status: "PRESENT" }],
  }), (error: unknown) => error instanceof AppError && error.code === "MISSING_ATTENDANCE");
  assert.equal((await lessons.detail(draft.id)).status, "DRAFT");
  await assert.rejects(() => lessons.updateAttendances(draft.id, { attendances: [
    { enrollmentId: data.enrollmentIds[3], status: "ABSENT" },
  ] }), (error: unknown) => error instanceof AppError && error.code === "INVALID_PARTICIPANT");
  await assert.rejects(() => lessons.complete(draft.id, {
    actualStartTime: "18:00", actualEndTime: "19:30", attendances: [
      { enrollmentId: data.enrollmentIds[0], status: "PRESENT" },
      { enrollmentId: data.enrollmentIds[1], status: "PRESENT" },
    ],
  }), (error: unknown) => error instanceof AppError && error.code === "FREE_ENROLLMENT_BILLABLE");
  assert.equal((await lessons.detail(draft.id)).status, "DRAFT");
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM lesson_attendances WHERE lesson_session_id=?", [draft.id]);
  assert.equal(rows.length, 0);

  const cancelled = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-10", scheduledStartTime: "20:00",
    scheduledEndTime: "21:00", lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollmentIds[0]],
  });
  await lessons.cancel(cancelled.id, { reason: "No class" });
  await assert.rejects(() => lessons.complete(cancelled.id, {
    actualStartTime: "20:00", actualEndTime: "21:00",
    attendances: [{ enrollmentId: data.enrollmentIds[0], status: "PRESENT" }],
  }), (error: unknown) => error instanceof AppError && error.code === "LESSON_NOT_DRAFT");
});

integration("concurrent completion cannot double-count", async () => {
  const data = await fixture();
  const lessons = service();
  const draft = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-10", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollmentIds[0]],
  });
  const request = {
    actualStartTime: "18:00", actualEndTime: "19:30",
    attendances: [{ enrollmentId: data.enrollmentIds[0], status: "PRESENT" as const }],
  };
  const results = await Promise.all([lessons.complete(draft.id, request), lessons.complete(draft.id, request)]);
  assert.equal(results.every((item) => item.lesson.status === "COMPLETED"), true);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM tuition_cycle_sessions");
  assert.equal(rows.length, 1);
});

test.after(async () => { if (enabled) await pool.end(); });
