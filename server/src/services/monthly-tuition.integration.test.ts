import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { TuitionRepository } from "../repositories/tuition.repository";
import { TuitionService } from "./tuition.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "monthly_tuition_payments", "lesson_attendances", "lesson_session_participants",
      "lesson_sessions", "schedule_exceptions", "recurring_schedules",
      "enrollment_active_periods", "class_active_periods",
      "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

async function seedEnrollment(tuitionExempt = false, joinedAt = "2026-01-01") {
  const [createdClass] = await pool.execute<ResultSetHeader>(
    `INSERT INTO classes(name,class_type,default_duration_minutes,start_date)
     VALUES ('Lớp tháng','GROUP',90,'2026-01-01')`,
  );
  const [createdStudent] = await pool.execute<ResultSetHeader>(
    "INSERT INTO students(full_name) VALUES ('An')",
  );
  const [createdEnrollment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_exempt)
     VALUES (?,?,?,?)`,
    [createdClass.insertId, createdStudent.insertId, joinedAt, tuitionExempt],
  );
  await pool.execute(
    "INSERT INTO class_active_periods(class_id,active_from) VALUES (?,?)",
    [createdClass.insertId, joinedAt],
  );
  await pool.execute(
    "INSERT INTO enrollment_active_periods(enrollment_id,active_from) VALUES (?,?)",
    [createdEnrollment.insertId, joinedAt],
  );
  return {
    classId: createdClass.insertId,
    studentId: createdStudent.insertId,
    enrollmentId: createdEnrollment.insertId,
  };
}

async function seedLesson(
  classId: number,
  enrollmentId: number,
  date: string,
  status: "PRESENT" | "ABSENT",
  lessonStatus: "DRAFT" | "COMPLETED" | "CANCELLED" = "COMPLETED",
) {
  const [lesson] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_sessions(
       class_id,session_date,scheduled_start_time,scheduled_end_time,status,completed_at
     ) VALUES (?,?, '18:00','19:30',?,IF(?='COMPLETED',NOW(),NULL))`,
    [classId, date, lessonStatus, lessonStatus],
  );
  const [participant] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id)
     VALUES (?,?)`,
    [lesson.insertId, enrollmentId],
  );
  await pool.execute(
    `INSERT INTO lesson_attendances(
       lesson_session_id,participant_id,enrollment_id,attendance_status
     ) VALUES (?,?,?,?)`,
    [lesson.insertId, participant.insertId, enrollmentId, status],
  );
}

integration("monthly board derives present and absent counts and excludes invalid lessons", async () => {
  await clean();
  const seeded = await seedEnrollment();
  for (let day = 1; day <= 6; day += 1)
    await seedLesson(seeded.classId, seeded.enrollmentId, `2026-09-${String(day).padStart(2, "0")}`, "PRESENT");
  for (let day = 7; day <= 8; day += 1)
    await seedLesson(seeded.classId, seeded.enrollmentId, `2026-09-${String(day).padStart(2, "0")}`, "ABSENT");
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-09-09", "PRESENT", "CANCELLED");
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-10-01", "PRESENT");

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.equal(board.rows.length, 1);
  assert.deepEqual(board.rows[0]?.attendance, { present: 6, absent: 2, total: 8 });
  assert.equal(board.rows[0]?.status, "UNPAID");
});

integration("monthly board omits tuition-exempt enrollment", async () => {
  await clean();
  const free = await seedEnrollment(true);
  await seedLesson(free.classId, free.enrollmentId, "2026-09-01", "PRESENT");
  assert.equal((await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 })).rows.length, 0);
});

integration("monthly board includes valid future schedule occurrences in total", async () => {
  await clean();
  const seeded = await seedEnrollment();
  await pool.execute(
    `INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from)
     VALUES (?,2,'18:00','19:30','2026-09-01'),(?,4,'18:00','19:30','2026-09-01')`,
    [seeded.classId, seeded.classId],
  );
  for (const date of ["2026-09-01", "2026-09-03", "2026-09-08"])
    await seedLesson(seeded.classId, seeded.enrollmentId, date, "PRESENT");

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows[0]?.attendance, { present: 3, absent: 0, total: 9 });
});

integration("invalid enrollment month never persists a payment before returning 404", async () => {
  await clean();
  const seeded = await seedEnrollment(false, "2026-10-01");
  const service = new TuitionService(new TuitionRepository());

  await assert.rejects(
    () => service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, { paidAt: "2026-09-30" }),
    (error: unknown) => (error as { code?: string }).code === "MONTHLY_TUITION_NOT_FOUND",
  );
  const [payments] = await pool.query<RowDataPacket[]>("SELECT id FROM monthly_tuition_payments");
  assert.equal(payments.length, 0);
});

integration("marking monthly tuition paid is idempotent and immutable", async () => {
  await clean();
  const seeded = await seedEnrollment();
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-09-01", "PRESENT");
  const service = new TuitionService(new TuitionRepository());
  const input = { amount: 900_000, paidAt: "2026-09-30", note: "Chuyển khoản" };
  assert.equal((await service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, input)).idempotent, false);
  assert.equal((await service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, input)).idempotent, true);
  await assert.rejects(
    () => service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, { ...input, amount: 800_000 }),
    (error: unknown) => (error as { code?: string }).code === "MONTHLY_TUITION_PAID_IMMUTABLE",
  );
  const [payments] = await pool.query<RowDataPacket[]>("SELECT * FROM monthly_tuition_payments");
  assert.equal(payments.length, 1);
  assert.equal(String(payments[0]?.paid_at).slice(0, 10), "2026-09-30");
});

test.after(async () => {
  if (enabled) await pool.end();
});
