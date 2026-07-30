import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { ClassRepository } from "../repositories/class.repository";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
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
      "google_sheet_sync_outbox", "tuition_receipt_allocations", "tuition_receipts",
      "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances",
      "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions",
      "enrollment_active_periods", "class_active_periods", "enrollment_tuition_policies",
      "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

integration("zero class price keeps PRESENT history without creating tuition cycles", async () => {
  await clean();
  const classId = await new ClassRepository().create({
    name: "Lớp chưa cấu hình học phí",
    type: "GROUP",
    defaultPackagePrice: 0,
    defaultDurationMinutes: 90,
    startDate: "2026-07-01",
    schedules: [],
  });
  const [student] = await pool.execute<ResultSetHeader>(
    "INSERT INTO students(full_name) VALUES ('Học sinh không theo dõi học phí')",
  );
  const enrollment = await new EnrollmentRepository().create(classId, {
    studentId: student.insertId,
    joinedAt: "2026-07-01",
    tuitionMode: "CLASS_DEFAULT",
  });
  assert.equal(enrollment.kind, "OK");
  if (enrollment.kind !== "OK") throw new Error("Không tạo được ghi danh test.");

  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  const draft = await lessons.create({
    classId,
    sessionDate: "2026-07-30",
    scheduledStartTime: "18:00",
    scheduledEndTime: "19:30",
    lessonType: "MAKEUP",
    selectedEnrollmentIds: [enrollment.id],
  });
  const completed = await lessons.complete(draft.id, {
    actualStartTime: "18:00",
    actualEndTime: "19:30",
    attendances: [{ enrollmentId: enrollment.id, status: "PRESENT" }],
  });

  assert.equal(completed.presentCount, 1);
  assert.equal(completed.tuitionImpacts[0]?.newProgress, 0);
  const [attendance] = await pool.query<RowDataPacket[]>(
    "SELECT attendance_status,counts_for_tuition FROM lesson_attendances WHERE lesson_session_id=?",
    [draft.id],
  );
  assert.deepEqual(
    [attendance[0]?.attendance_status, Number(attendance[0]?.counts_for_tuition)],
    ["PRESENT", 0],
  );
  const [cycles] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM tuition_cycles WHERE enrollment_id=?",
    [enrollment.id],
  );
  assert.equal(cycles.length, 0);
  const [prices] = await pool.query<RowDataPacket[]>(
    `SELECT c.default_package_price,p.package_price
     FROM classes c JOIN class_tuition_policies p ON p.class_id=c.id WHERE c.id=?`,
    [classId],
  );
  assert.deepEqual(
    [Number(prices[0]?.default_package_price), Number(prices[0]?.package_price)],
    [0, 0],
  );
});

test.after(async () => {
  if (enabled) await pool.end();
});
