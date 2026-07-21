import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { EnrollmentService } from "./enrollment.service";
import { LessonService } from "./lesson.service";
import { TuitionService } from "./tuition.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances",
      "lesson_session_participants", "lesson_sessions", "enrollment_tuition_policies",
      "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes", "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture(names: string[]) {
  await clean();
  const connection = await pool.getConnection();
  try {
    const [actor] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users(username,email,password_hash,display_name) VALUES ('m4a','m4a@example.com','hash','M4A')",
    );
    const [klass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('M4A Class','GROUP',2400000,90,'2026-07-01')",
    );
    await connection.execute(
      "INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,2400000,'2026-07-01')",
      [klass.insertId],
    );
    const enrollments: Record<string, number> = {};
    const students: Record<string, number> = {};
    for (const name of names) {
      const [student] = await connection.execute<ResultSetHeader>(
        "INSERT INTO students(full_name,nickname) VALUES (?,?)", [name, name.slice(0, 2)],
      );
      const [enrollment] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments
          (class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
         VALUES (?,?,'2026-07-01','CLASS_DEFAULT','2026-07-01')`,
        [klass.insertId, student.insertId],
      );
      await connection.execute(
        `INSERT INTO enrollment_tuition_policies
          (enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2026-07-01')`,
        [enrollment.insertId],
      );
      enrollments[name] = enrollment.insertId;
      students[name] = student.insertId;
    }
    return { actorId: actor.insertId, classId: klass.insertId, enrollments, students };
  } finally { connection.release(); }
}

async function seedBillable(classId: number, enrollmentId: number, count: number, dayOffset = 0): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let index = 0; index < count; index += 1) {
      const date = new Date(Date.UTC(2026, 6, 1 + dayOffset + index)).toISOString().slice(0, 10);
      const [lesson] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lesson_sessions
          (class_id,session_date,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,
           actual_duration_minutes,lesson_type,status,completed_at)
         VALUES (?,?, '18:00','19:30','18:05','19:35',90,'MAKEUP','COMPLETED',NOW())`,
        [classId, date],
      );
      const [participant] = await connection.execute<ResultSetHeader>(
        "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id) VALUES (?,?)",
        [lesson.insertId, enrollmentId],
      );
      await connection.execute(
        `INSERT INTO lesson_attendances
          (lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition)
         VALUES (?,?,?,'PRESENT',1)`,
        [lesson.insertId, participant.insertId, enrollmentId],
      );
    }
    await new TuitionRepository().recalculateEnrollment(connection, enrollmentId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function cycle(enrollmentId: number, number: number): Promise<RowDataPacket> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tuition_cycles WHERE enrollment_id=? AND cycle_number=?", [enrollmentId, number],
  );
  return rows[0];
}

integration("list/filter/sort, SQL summary and detail expose stable ordered items", async () => {
  const data = await fixture(["An", "Bình"]);
  await seedBillable(data.classId, data.enrollments.An, 8);
  await seedBillable(data.classId, data.enrollments["Bình"], 5, 10);
  const tuition = new TuitionService(new TuitionRepository());

  const due = await tuition.list({ status: "PAYMENT_DUE", page: 1, pageSize: 10, sort: "OLDEST_DUE" });
  assert.equal(due.total, 1);
  assert.equal(due.items[0].studentName, "An");
  assert.equal(due.items[0].itemCount, 8);
  assert.equal(due.items[0].targetCount, 8);

  const searched = await tuition.list({ search: "Bình", classId: data.classId, studentId: data.students["Bình"],
    enrollmentId: data.enrollments["Bình"], from: "2026-07-01", to: "2026-07-31",
    page: 1, pageSize: 1, sort: "STUDENT_NAME" });
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0].progress, 5);

  const detail = await tuition.detail(due.items[0].id);
  assert.equal(detail.items.length, 8);
  assert.deepEqual(detail.items.map((item) => item.sequenceNumber), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(detail.items.every((item) => item.attendanceStatus === "PRESENT"), true);
  assert.equal(detail.items[0].actualDurationMinutes, 90);
  assert.equal(detail.items[0].lessonType, "MAKEUP");

  const summary = await tuition.summary({ from: "2026-07-01", to: "2026-07-31" });
  assert.equal(summary.paymentDueCount, 1);
  assert.equal(summary.totalUnpaidAmount, 2_400_000);
  assert.equal(summary.accumulatingEnrollmentCount, 1);
  assert.equal(summary.paidCycleCount, 0);
});

integration("mark-paid is atomic, audited, idempotent and concurrency-safe", async () => {
  const data = await fixture(["An"]);
  await seedBillable(data.classId, data.enrollments.An, 9);
  const tuition = new TuitionService(new TuitionRepository());
  const due = await cycle(data.enrollments.An, 1);
  const nextBefore = JSON.parse(JSON.stringify(await cycle(data.enrollments.An, 2)));

  await assert.rejects(
    () => tuition.markPaid(Number(due.id), {
      paidAmount: 2_000_000, paidAt: "2026-07-20", paymentMethod: "CASH",
    }, data.actorId),
    (error: unknown) => error instanceof AppError && error.code === "FULL_PAYMENT_REQUIRED",
  );
  assert.equal((await cycle(data.enrollments.An, 1)).status, "PAYMENT_DUE");

  const payment = { paidAmount: 2_400_000, paidAt: "2026-07-20", paymentMethod: "BANK_TRANSFER" as const, paymentNote: "Đã nhận" };
  const results = await Promise.all([
    tuition.markPaid(Number(due.id), payment, data.actorId),
    tuition.markPaid(Number(due.id), payment, data.actorId),
  ]);
  assert.deepEqual(results.map((result) => result.idempotent).sort(), [false, true]);
  const [audits] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM audit_logs WHERE action='TUITION_CYCLE_MARKED_PAID' AND entity_id=?", [due.id],
  );
  assert.equal(audits.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(await cycle(data.enrollments.An, 2))), nextBefore);
  await assert.rejects(
    () => tuition.markPaid(Number(due.id), { ...payment, paymentMethod: "CASH" }, data.actorId),
    (error: unknown) => error instanceof AppError && error.code === "PAYMENT_CONFLICT",
  );

  const paidBefore = JSON.parse(JSON.stringify(await cycle(data.enrollments.An, 1)));
  const [itemsBefore] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tuition_cycle_sessions WHERE tuition_cycle_id=? ORDER BY sequence_number", [due.id],
  );
  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  const draft = await lessons.create({
    classId: data.classId, sessionDate: "2026-07-20", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollments.An],
  });
  await lessons.complete(draft.id, {
    actualStartTime: "18:00", actualEndTime: "19:30",
    attendances: [{ enrollmentId: data.enrollments.An, status: "PRESENT" }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await cycle(data.enrollments.An, 1))), paidBefore);
  const [itemsAfter] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tuition_cycle_sessions WHERE tuition_cycle_id=? ORDER BY sequence_number", [due.id],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(itemsAfter)), JSON.parse(JSON.stringify(itemsBefore)));
});

integration("ending enrollment converts only partial cycle to INCOMPLETE", async () => {
  const data = await fixture(["Due", "Paid"]);
  await seedBillable(data.classId, data.enrollments.Due, 13);
  await seedBillable(data.classId, data.enrollments.Paid, 13, 20);
  const tuition = new TuitionService(new TuitionRepository());
  const paidDue = await cycle(data.enrollments.Paid, 1);
  await tuition.markPaid(Number(paidDue.id), {
    paidAmount: 2_400_000, paidAt: "2026-08-15", paymentMethod: "CASH",
  }, data.actorId);
  const dueBefore = JSON.parse(JSON.stringify(await cycle(data.enrollments.Due, 1)));
  const paidBefore = JSON.parse(JSON.stringify(await cycle(data.enrollments.Paid, 1)));

  const enrollments = new EnrollmentService(new EnrollmentRepository());
  await enrollments.end(data.enrollments.Due, { endedAt: "2026-08-01", reason: "Dừng học" }, data.actorId);
  await enrollments.end(data.enrollments.Paid, { endedAt: "2026-08-10", reason: "Dừng học" }, data.actorId);

  assert.deepEqual(JSON.parse(JSON.stringify(await cycle(data.enrollments.Due, 1))), dueBefore);
  assert.equal((await cycle(data.enrollments.Due, 2)).status, "INCOMPLETE");
  assert.deepEqual(JSON.parse(JSON.stringify(await cycle(data.enrollments.Paid, 1))), paidBefore);
  assert.equal((await cycle(data.enrollments.Paid, 2)).status, "INCOMPLETE");
});

test.after(async () => { if (enabled) await pool.end(); });
