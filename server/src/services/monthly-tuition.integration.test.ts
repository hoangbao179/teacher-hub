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
      "lesson_sessions", "enrollment_tuition_policies", "class_tuition_policies",
      "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

async function seedEnrollment(mode: "CLASS_DEFAULT" | "FREE" = "CLASS_DEFAULT") {
  const [createdClass] = await pool.execute<ResultSetHeader>(
    `INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date)
     VALUES ('Lớp tháng','GROUP',0,90,'2026-01-01')`,
  );
  const [createdStudent] = await pool.execute<ResultSetHeader>(
    "INSERT INTO students(full_name) VALUES ('An')",
  );
  const [createdEnrollment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode)
     VALUES (?,?,?,?)`,
    [createdClass.insertId, createdStudent.insertId, "2026-01-01", mode],
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
  status: "PRESENT" | "ABSENT" | "FREE",
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
       lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition
     ) VALUES (?,?,?,?,?)`,
    [lesson.insertId, participant.insertId, enrollmentId, status, status === "PRESENT"],
  );
}

integration("monthly board derives 6/8 and excludes invalid lessons", async () => {
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

integration("monthly board treats historical FREE as present and omits free enrollment payment", async () => {
  await clean();
  const tracked = await seedEnrollment();
  await seedLesson(tracked.classId, tracked.enrollmentId, "2026-09-01", "FREE");
  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows[0]?.attendance, { present: 1, absent: 0, total: 1 });

  await clean();
  const free = await seedEnrollment("FREE");
  await seedLesson(free.classId, free.enrollmentId, "2026-09-01", "PRESENT");
  assert.equal((await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 })).rows.length, 0);
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
  assert.equal(payments[0]?.status, "PAID");
});

test.after(async () => {
  if (enabled) await pool.end();
});
