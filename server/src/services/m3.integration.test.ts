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
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('M3 Class','GROUP',2200000,90,'2026-06-01')",
    );
    await connection.execute(
      "INSERT INTO class_tuition_policies(class_id,package_price,effective_from,effective_to) VALUES (?,2000000,'2026-06-01','2026-07-14'),(?,2200000,'2026-07-15',NULL)",
      [klass.insertId, klass.insertId],
    );
    const [student] = await connection.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('M3 Student')");
    const [enrollment] = await connection.execute<ResultSetHeader>(
      `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
       VALUES (?,?,'2026-06-01','CLASS_DEFAULT','2026-06-01')`, [klass.insertId, student.insertId],
    );
    await connection.execute(
      "INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2026-06-01')",
      [enrollment.insertId],
    );
    const [secondStudent] = await connection.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('M3 Second Student')");
    const [secondEnrollment] = await connection.execute<ResultSetHeader>(
      `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
       VALUES (?,?,'2026-06-01','CLASS_DEFAULT','2026-06-01')`, [klass.insertId, secondStudent.insertId],
    );
    await connection.execute(
      "INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2026-06-01')",
      [secondEnrollment.insertId],
    );
    return { classId: klass.insertId, enrollmentId: enrollment.insertId, studentId: student.insertId,
      secondEnrollmentId: secondEnrollment.insertId };
  } finally { connection.release(); }
}

function service() { return new LessonService(new LessonRepository(), new TuitionRepository()); }

async function completeOn(lessons: LessonService, classId: number, enrollmentId: number, date: string, status: "PRESENT" | "ABSENT" = "PRESENT") {
  const draft = await lessons.create({
    classId, sessionDate: date, scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [enrollmentId],
  });
  await lessons.complete(draft.id, {
    actualStartTime: "18:05", actualEndTime: "19:35",
    attendances: [{ enrollmentId, status }],
  });
  return draft.id;
}

async function cycleShape(enrollmentId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT tc.cycle_number,tc.status,tc.package_price_snapshot,tcs.sequence_number,
      a.id attendance_id,l.session_date
     FROM tuition_cycles tc LEFT JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id
     LEFT JOIN lesson_attendances a ON a.id=tcs.attendance_id
     LEFT JOIN lesson_sessions l ON l.id=a.lesson_session_id
     WHERE tc.enrollment_id=? ORDER BY tc.cycle_number,tcs.sequence_number`, [enrollmentId],
  );
  return rows.map((row) => ({
    cycle: Number(row.cycle_number), status: String(row.status), price: Number(row.package_price_snapshot),
    sequence: Number(row.sequence_number), attendanceId: Number(row.attendance_id),
    date: row.session_date instanceof Date ? row.session_date.toISOString().slice(0, 10) : String(row.session_date).slice(0, 10),
  }));
}

integration("out-of-order lessons rebuild 8/8 + 2/8 and edits regroup deterministically", async () => {
  const data = await fixture();
  const lessons = service();
  const dates = ["2026-07-20", "2026-07-03", "2026-07-18", "2026-07-01", "2026-07-16", "2026-07-05", "2026-07-12", "2026-07-08", "2026-07-22", "2026-07-10"];
  const lessonIds = new Map<string, number>();
  for (const date of dates) lessonIds.set(date, await completeOn(lessons, data.classId, data.enrollmentId, date));
  let shape = await cycleShape(data.enrollmentId);
  assert.deepEqual([...new Set(shape.map((row) => `${row.cycle}:${row.status}`))], ["1:PAYMENT_DUE", "2:ACCUMULATING"]);
  assert.equal(shape.filter((row) => row.cycle === 1).length, 8);
  assert.equal(shape.filter((row) => row.cycle === 2).length, 2);
  assert.equal(shape[0].date, "2026-07-01");
  assert.equal(shape[0].price, 2_000_000);

  const earlierId = await completeOn(lessons, data.classId, data.enrollmentId, "2026-06-20");
  shape = await cycleShape(data.enrollmentId);
  assert.equal(shape[0].date, "2026-06-20");
  assert.deepEqual([shape.filter((row) => row.cycle === 1).length, shape.filter((row) => row.cycle === 2).length], [8, 3]);

  const targetId = lessonIds.get("2026-07-10")!;
  await lessons.updateAttendances(targetId, { attendances: [{ enrollmentId: data.enrollmentId, status: "ABSENT" }] });
  shape = await cycleShape(data.enrollmentId);
  assert.deepEqual([shape.filter((row) => row.cycle === 1).length, shape.filter((row) => row.cycle === 2).length], [8, 2]);
  await lessons.updateAttendances(targetId, { attendances: [{ enrollmentId: data.enrollmentId, status: "PRESENT" }] });
  shape = await cycleShape(data.enrollmentId);
  assert.deepEqual([shape.filter((row) => row.cycle === 1).length, shape.filter((row) => row.cycle === 2).length], [8, 3]);

  await pool.execute(
    `UPDATE lesson_attendances SET counts_for_tuition=0,excluded_from_tuition=1
     WHERE lesson_session_id=? AND enrollment_id=?`, [earlierId, data.enrollmentId],
  );
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tuition = new TuitionRepository();
    await tuition.recalculateEnrollment(connection, data.enrollmentId);
    await connection.commit();
  } finally { connection.release(); }
  const first = await cycleShape(data.enrollmentId);
  const secondConnection = await pool.getConnection();
  try {
    await secondConnection.beginTransaction();
    await new TuitionRepository().recalculateEnrollment(secondConnection, data.enrollmentId);
    await secondConnection.commit();
  } finally { secondConnection.release(); }
  const second = await cycleShape(data.enrollmentId);
  assert.deepEqual(second.map(({ cycle, status, price, sequence, attendanceId, date }) => ({ cycle, status, price, sequence, attendanceId, date })),
    first.map(({ cycle, status, price, sequence, attendanceId, date }) => ({ cycle, status, price, sequence, attendanceId, date })));
  const [duplicates] = await pool.query<RowDataPacket[]>(
    "SELECT attendance_id,COUNT(*) count FROM tuition_cycle_sessions GROUP BY attendance_id HAVING COUNT(*)>1",
  );
  assert.equal(duplicates.length, 0);
  const [audits] = await pool.query<RowDataPacket[]>("SELECT action FROM audit_logs WHERE action='TUITION_ALLOCATION_RECALCULATED'");
  assert.ok(audits.length >= 10);
  await lessons.updateParticipants(targetId, {
    enrollmentIds: [data.secondEnrollmentId],
    attendances: [{ enrollmentId: data.secondEnrollmentId, status: "PRESENT" }],
  });
  assert.deepEqual((await lessons.detail(targetId)).participants.map((item) => item.enrollmentId), [data.secondEnrollmentId]);
  const secondShape = await cycleShape(data.secondEnrollmentId);
  assert.equal(secondShape.length, 1);
});

integration("PAID boundary remains unchanged and conflicting insert/edit roll back", async () => {
  const data = await fixture();
  const lessons = service();
  const lessonIds: number[] = [];
  for (let day = 1; day <= 10; day += 1)
    lessonIds.push(await completeOn(lessons, data.classId, data.enrollmentId, `2026-07-${String(day).padStart(2, "0")}`));
  const [cycleRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM tuition_cycles WHERE enrollment_id=? AND cycle_number=1", [data.enrollmentId],
  );
  const paidId = Number(cycleRows[0].id);
  await pool.execute(
    "UPDATE tuition_cycles SET status='PAID',paid_at='2026-07-20 10:00:00',paid_amount=package_price_snapshot,payment_method='CASH' WHERE id=?",
    [paidId],
  );
  const [paidBefore] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tuition_cycles WHERE id=?", [paidId],
  );
  const [itemsBefore] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM tuition_cycle_sessions WHERE tuition_cycle_id=? ORDER BY sequence_number", [paidId],
  );

  await assert.rejects(
    () => lessons.updateAttendances(lessonIds[0], { attendances: [{ enrollmentId: data.enrollmentId, status: "ABSENT" }] }),
    (error: unknown) => error instanceof AppError && error.code === "PAID_CYCLE_CONFLICT",
  );
  assert.equal((await lessons.detail(lessonIds[0])).participants[0].attendance?.status, "PRESENT");

  const late = await lessons.create({
    classId: data.classId, sessionDate: "2026-06-20", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [data.enrollmentId],
  });
  await assert.rejects(
    () => lessons.complete(late.id, { actualStartTime: "18:00", actualEndTime: "19:30", attendances: [{ enrollmentId: data.enrollmentId, status: "PRESENT" }] }),
    (error: unknown) => error instanceof AppError && error.code === "PAID_CYCLE_CONFLICT",
  );
  assert.equal((await lessons.detail(late.id)).status, "DRAFT");

  const mutableLesson = lessonIds[9];
  const originalDate = (await lessons.detail(mutableLesson)).sessionDate;
  await assert.rejects(
    () => lessons.update(mutableLesson, { sessionDate: "2026-06-21", actualStartTime: "18:00", actualEndTime: "19:30" }),
    (error: unknown) => error instanceof AppError && error.code === "PAID_CYCLE_CONFLICT",
  );
  assert.equal((await lessons.detail(mutableLesson)).sessionDate, originalDate);

  const [paidAfter] = await pool.query<RowDataPacket[]>("SELECT * FROM tuition_cycles WHERE id=?", [paidId]);
  const [itemsAfter] = await pool.query<RowDataPacket[]>("SELECT * FROM tuition_cycle_sessions WHERE tuition_cycle_id=? ORDER BY sequence_number", [paidId]);
  assert.deepEqual(JSON.parse(JSON.stringify(paidAfter)), JSON.parse(JSON.stringify(paidBefore)));
  assert.deepEqual(JSON.parse(JSON.stringify(itemsAfter)), JSON.parse(JSON.stringify(itemsBefore)));
});

test.after(async () => { if (enabled) await pool.end(); });
