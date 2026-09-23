import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { LessonRepository } from "../repositories/lesson.repository";
import { LessonService } from "./lesson.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "monthly_tuition_payments", "lesson_attendances",
      "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions", "enrollment_active_periods",
      "class_active_periods", "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture() {
  await clean();
  const connection = await pool.getConnection();
  try {
    const [klass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('M2B Group','GROUP',90,'2026-07-01')",
    );
    await connection.execute("INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2026-07-01')", [klass.insertId]);
    const ids: number[] = [];
    const students: number[] = [];
    for (const [name, joined, ended, tuitionExempt] of [
      ["Paid", "2026-07-01", null, false],
      ["Exempt", "2026-07-01", null, true],
      ["Historical", "2026-07-01", "2026-07-15", false],
      ["Future", "2026-07-11", null, false],
    ] as const) {
      const [student] = await connection.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES (?)", [name]);
      const [enrollment] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments
          (class_id,student_id,joined_at,ended_at,status,tuition_exempt)
         VALUES (?,?,?,?,?,?)`,
        [klass.insertId, student.insertId, joined, ended, ended ? "ENDED" : "ACTIVE", tuitionExempt],
      );
      await connection.execute(
        "INSERT INTO enrollment_active_periods(enrollment_id,active_from,active_to) VALUES (?,?,?)",
        [enrollment.insertId, joined, ended],
      );
      ids.push(enrollment.insertId); students.push(student.insertId);
    }
    return { classId: klass.insertId, enrollmentIds: ids, studentIds: students };
  } finally { connection.release(); }
}

function service() {
  return new LessonService(new LessonRepository());
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
    { enrollmentId: data.enrollmentIds[1], status: "PRESENT" },
    { enrollmentId: data.enrollmentIds[2], status: "ABSENT", studentNote: "Có phép" },
  ] });
  await lessons.updateContent(draft.id, { content: "Lesson content", homework: "Homework", note: "General" });
  const result = await lessons.complete(draft.id, {
    actualStartTime: "18:05", actualEndTime: "20:05", content: "Lesson content", homework: "Homework",
    attendances: [
      { enrollmentId: data.enrollmentIds[0], status: "PRESENT" },
      { enrollmentId: data.enrollmentIds[1], status: "PRESENT" },
      { enrollmentId: data.enrollmentIds[2], status: "ABSENT", studentNote: "Có phép" },
    ],
  });
  assert.equal(result.actualDurationMinutes, 120);
  assert.equal(result.presentCount, 2); assert.equal(result.absentCount, 1);
  const persisted = await lessons.detail(draft.id);
  assert.equal(persisted.status, "COMPLETED"); assert.equal(persisted.content, "Lesson content");
  assert.ok(result.completedAt);
  assert.equal(result.completedAt, persisted.completedAt);
  assert.equal(Number.isNaN(Date.parse(result.completedAt)), false);
  const [attendanceRows] = await pool.query<RowDataPacket[]>("SELECT * FROM lesson_attendances WHERE lesson_session_id=?", [draft.id]);
  assert.equal(attendanceRows.length, 3);
  const replay = await lessons.complete(draft.id, {
    actualStartTime: "18:05", actualEndTime: "20:05",
    attendances: persisted.participants.map((item) => ({ enrollmentId: item.enrollmentId, status: item.attendance!.status })),
  });
  assert.equal(replay.lesson.status, "COMPLETED");
  assert.equal(replay.completedAt, result.completedAt);
  assert.equal(replay.lesson.completedAt, result.completedAt);
  const [audits] = await pool.query<RowDataPacket[]>("SELECT action FROM audit_logs WHERE entity_id=?", [draft.id]);
  for (const action of ["LESSON_DRAFT_CREATED", "LESSON_ATTENDANCE_UPDATED", "LESSON_UPDATED", "LESSON_COMPLETED"])
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

integration("completion accepts PRESENT for a tuition-exempt enrollment", async () => {
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
  const completed = await lessons.complete(draft.id, {
    actualStartTime: "18:00", actualEndTime: "19:30", attendances: [
      { enrollmentId: data.enrollmentIds[0], status: "PRESENT" },
      { enrollmentId: data.enrollmentIds[1], status: "PRESENT" },
    ],
  });
  assert.equal(completed.presentCount, 2);
  assert.equal((await lessons.detail(draft.id)).status, "COMPLETED");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT enrollment_id,attendance_status FROM lesson_attendances WHERE lesson_session_id=? ORDER BY enrollment_id",
    [draft.id],
  );
  assert.deepEqual(rows.map((row) => row.attendance_status), ["PRESENT", "PRESENT"]);

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

integration("concurrent completion keeps one attendance row", async () => {
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
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM lesson_attendances WHERE lesson_session_id=?", [draft.id]);
  assert.equal(rows.length, 1);
});

test.after(async () => { if (enabled) await pool.end(); });
