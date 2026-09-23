import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createApp } from "../app";
import { config } from "../config/config";
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
      "lesson_sessions", "combined_teaching_occurrences", "combined_class_group_schedules",
      "combined_class_group_classes", "combined_class_groups", "schedule_exceptions", "recurring_schedules",
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
  identity: {
    lessonType?: "REGULAR" | "MAKEUP" | "EXTRA";
    sourceOccurrenceKey?: string;
    combinedTeachingOccurrenceId?: number;
    startTime?: string;
    endTime?: string;
  } = {},
) {
  const [lesson] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_sessions(
       class_id,source_occurrence_key,combined_teaching_occurrence_id,session_date,
       scheduled_start_time,scheduled_end_time,lesson_type,status,completed_at
     ) VALUES (?,?,?,?,?,?,?,?,IF(?='COMPLETED',NOW(),NULL))`,
    [classId, identity.sourceOccurrenceKey ?? null, identity.combinedTeachingOccurrenceId ?? null, date,
      identity.startTime ?? "18:00", identity.endTime ?? "19:30", identity.lessonType ?? "REGULAR",
      lessonStatus, lessonStatus],
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
  return lesson.insertId;
}

async function seedSchedule(classId: number, dayOfWeek: number, startTime = "18:00", endTime = "19:30") {
  const [schedule] = await pool.execute<ResultSetHeader>(
    `INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from)
     VALUES (?,?,?,?, '2026-09-01')`,
    [classId, dayOfWeek, startTime, endTime],
  );
  return schedule.insertId;
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

integration("monthly board unions nine projected occurrences with one extra lesson", async () => {
  await clean();
  const seeded = await seedEnrollment();
  const tuesday = await seedSchedule(seeded.classId, 2);
  const thursday = await seedSchedule(seeded.classId, 4);
  for (const [date, scheduleId] of [["2026-09-01", tuesday], ["2026-09-03", thursday], ["2026-09-08", tuesday]] as const)
    await seedLesson(seeded.classId, seeded.enrollmentId, date, "PRESENT", "COMPLETED", {
      sourceOccurrenceKey: `${seeded.classId}:${scheduleId}:${date}`,
    });
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-09-02", "PRESENT", "COMPLETED", {
    lessonType: "EXTRA", startTime: "20:00", endTime: "21:00",
  });

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows[0]?.attendance, { present: 4, absent: 0, total: 10 });
});

integration("lesson mapped to a projected occurrence is not double counted", async () => {
  await clean();
  const seeded = await seedEnrollment();
  const scheduleId = await seedSchedule(seeded.classId, 2);
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-09-01", "PRESENT", "COMPLETED", {
    sourceOccurrenceKey: `${seeded.classId}:${scheduleId}:2026-09-01`,
  });

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows[0]?.attendance, { present: 1, absent: 0, total: 5 });
});

integration("rescheduled original occurrence is not double counted", async () => {
  await clean();
  const seeded = await seedEnrollment();
  const scheduleId = await seedSchedule(seeded.classId, 2);
  await pool.execute(
    `INSERT INTO schedule_exceptions(
       class_id,recurring_schedule_id,original_date,original_start_time,original_end_time,
       exception_type,replacement_date,replacement_start_time,replacement_end_time,reason
     ) VALUES (?,?, '2026-09-01','18:00','19:30','RESCHEDULED','2026-09-02','18:00','19:30','Đổi lịch')`,
    [seeded.classId, scheduleId],
  );
  await seedLesson(seeded.classId, seeded.enrollmentId, "2026-09-02", "PRESENT", "COMPLETED", {
    sourceOccurrenceKey: `${seeded.classId}:${scheduleId}:2026-09-01:R`,
  });

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows[0]?.attendance, { present: 1, absent: 0, total: 5 });
});

integration("combined class occurrence contributes one denominator per member enrollment", async () => {
  await clean();
  const first = await seedEnrollment();
  const second = await seedEnrollment();
  const [group] = await pool.execute<ResultSetHeader>(
    "INSERT INTO combined_class_groups(name,effective_from) VALUES ('Lớp ghép','2026-09-01')",
  );
  await pool.execute(
    "INSERT INTO combined_class_group_classes(group_id,class_id) VALUES (?,?),(?,?)",
    [group.insertId, first.classId, group.insertId, second.classId],
  );
  const [schedule] = await pool.execute<ResultSetHeader>(
    `INSERT INTO combined_class_group_schedules(group_id,day_of_week,start_time,end_time)
     VALUES (?,2,'18:00','19:30')`,
    [group.insertId],
  );
  const [occurrence] = await pool.execute<ResultSetHeader>(
    `INSERT INTO combined_teaching_occurrences(
       group_id,group_schedule_id,occurrence_date,scheduled_start_time,scheduled_end_time,status
     ) VALUES (?,?,'2026-09-01','18:00','19:30','COMPLETED')`,
    [group.insertId, schedule.insertId],
  );
  await seedLesson(first.classId, first.enrollmentId, "2026-09-01", "PRESENT", "COMPLETED", {
    combinedTeachingOccurrenceId: occurrence.insertId,
  });

  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.deepEqual(board.rows.find((row) => row.enrollmentId === first.enrollmentId)?.attendance,
    { present: 1, absent: 0, total: 5 });
  assert.deepEqual(board.rows.find((row) => row.enrollmentId === second.enrollmentId)?.attendance,
    { present: 0, absent: 0, total: 5 });
});

integration("monthly board omits an overlapping enrollment with no valid occurrence or lesson", async () => {
  await clean();
  await seedEnrollment();
  const board = await new TuitionService(new TuitionRepository()).monthlyBoard({ year: 2026, month: 9 });
  assert.equal(board.rows.length, 0);
  assert.equal(board.paidCount, 0);
  assert.equal(board.unpaidCount, 0);
});

integration("mark paid rejects a zero-lesson month without persisting payment", async () => {
  await clean();
  const seeded = await seedEnrollment();
  const service = new TuitionService(new TuitionRepository());
  await assert.rejects(
    () => service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, { paidAt: "2026-09-30" }),
    (error: unknown) => (error as { code?: string }).code === "MONTHLY_TUITION_NOT_FOUND",
  );
  const [payments] = await pool.query<RowDataPacket[]>("SELECT id FROM monthly_tuition_payments");
  assert.equal(payments.length, 0);
});

integration("mark paid revalidates nonzero total inside the transaction", async () => {
  await clean();
  const seeded = await seedEnrollment();
  await seedSchedule(seeded.classId, 2);
  const service = new TuitionService(new TuitionRepository());
  const monthlyBoard = service.monthlyBoard.bind(service);
  let boardCalls = 0;
  service.monthlyBoard = async (input) => {
    const board = await monthlyBoard(input);
    boardCalls += 1;
    if (boardCalls === 1) await pool.execute("DELETE FROM recurring_schedules WHERE class_id=?", [seeded.classId]);
    return board;
  };

  await assert.rejects(
    () => service.markMonthlyPaid(seeded.enrollmentId, 2026, 9, { paidAt: "2026-09-30" }),
    (error: unknown) => (error as { code?: string }).code === "MONTHLY_TUITION_NOT_FOUND",
  );
  assert.equal(boardCalls, 2);
  const [payments] = await pool.query<RowDataPacket[]>("SELECT id FROM monthly_tuition_payments");
  assert.equal(payments.length, 0);
});

integration("invalid tuition month and year return HTTP 400 validation errors", async () => {
  await clean();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ id: 1, username: "covy", displayName: "Cô Vy" }, config.jwt.secret);
    for (const query of ["year=2026&month=0", "year=2026&month=13", "year=1999&month=9"]) {
      const httpResponse: Awaited<ReturnType<typeof fetch>> = await fetch(
        `http://127.0.0.1:${address.port}/api/tuition/monthly?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(httpResponse.status, 400);
      assert.equal((await httpResponse.json() as { error: { code: string } }).error.code, "VALIDATION_ERROR");
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
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
