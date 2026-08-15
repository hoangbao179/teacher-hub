import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { ClassRepository } from "../repositories/class.repository";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { LessonService } from "./lesson.service";
import { TuitionService } from "./tuition.service";

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
  const board = await new TuitionService(new TuitionRepository()).board();
  const row = board.rows.find((item) => item.enrollmentId === enrollment.id);
  assert.equal(row?.tuitionTracking, "NOT_CONFIGURED");
  assert.equal(row?.status, "NOT_CONFIGURED");
  assert.equal(row?.currentProgress, null);
  assert.equal(row?.currentAmount, null);
});

integration("tuition board keeps one row and settles the due cycle without changing current progress", async () => {
  await clean();
  const classId = await new ClassRepository().create({
    name: "Lớp board", type: "GROUP", defaultPackagePrice: 1_068_750,
    defaultDurationMinutes: 90, startDate: "2026-01-01", schedules: [],
  });
  const [student] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('Ken Board')");
  const enrollment = await new EnrollmentRepository().create(classId, {
    studentId: student.insertId, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
  });
  assert.equal(enrollment.kind, "OK");
  if (enrollment.kind !== "OK") throw new Error("Không tạo được ghi danh test.");
  const lessons = new LessonService(new LessonRepository(), new TuitionRepository());
  for (let day = 1; day <= 10; day += 1) {
    const date = `2026-08-${String(day).padStart(2, "0")}`;
    const draft = await lessons.create({ classId, sessionDate: date, scheduledStartTime: "18:00",
      scheduledEndTime: "19:30", lessonType: "MAKEUP", selectedEnrollmentIds: [enrollment.id] });
    await lessons.complete(draft.id, { actualStartTime: "18:00", actualEndTime: "19:30",
      attendances: [{ enrollmentId: enrollment.id, status: "PRESENT" }] });
  }
  const createProgressStudent = async (name: string, count: number, month: string) => {
    const [createdStudent] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES (?)", [name]);
    const createdEnrollment = await new EnrollmentRepository().create(classId, {
      studentId: createdStudent.insertId, joinedAt: "2026-01-01", tuitionMode: "CLASS_DEFAULT",
    });
    assert.equal(createdEnrollment.kind, "OK");
    if (createdEnrollment.kind !== "OK") throw new Error("Không tạo được ghi danh test.");
    for (let day = 1; day <= count; day += 1) {
      const date = `2026-${month}-${String(day).padStart(2, "0")}`;
      const draft = await lessons.create({ classId, sessionDate: date, scheduledStartTime: "17:00",
        scheduledEndTime: "18:30", lessonType: "MAKEUP", selectedEnrollmentIds: [createdEnrollment.id] });
      await lessons.complete(draft.id, { actualStartTime: "17:00", actualEndTime: "18:30",
        attendances: [{ enrollmentId: createdEnrollment.id, status: "PRESENT" }] });
    }
    return createdEnrollment.id;
  };
  const learningEnrollmentId = await createProgressStudent("An Board 6 buổi", 6, "06");
  const dueOnlyEnrollmentId = await createProgressStudent("Bình Board 8 buổi", 8, "07");

  const tuition = new TuitionService(new TuitionRepository());
  const before = await tuition.board();
  const row = before.rows.find((item) => item.enrollmentId === enrollment.id);
  assert.equal(before.rows.filter((item) => item.enrollmentId === enrollment.id).length, 1);
  assert.deepEqual(row?.currentProgress, { attended: 2, target: 8 });
  assert.equal(row?.paymentDue, true);
  assert.equal(row?.paymentDueAmount, 1_068_750);
  assert.equal(row?.status, "PAYMENT_DUE");
  assert.ok(row?.paymentDueCycleId);
  const learningRow = before.rows.find((item) => item.enrollmentId === learningEnrollmentId);
  assert.deepEqual(learningRow?.currentProgress, { attended: 6, target: 8 });
  assert.equal(learningRow?.status, "LEARNING");
  assert.equal(learningRow?.paymentDue, false);
  const dueOnlyRow = before.rows.find((item) => item.enrollmentId === dueOnlyEnrollmentId);
  assert.deepEqual(dueOnlyRow?.currentProgress, { attended: 8, target: 8 });
  assert.equal(dueOnlyRow?.status, "PAYMENT_DUE");
  assert.equal(dueOnlyRow?.paymentDueAmount, 1_068_750);

  await tuition.markPaid(row!.paymentDueCycleId!, {
    paidAmount: row!.paymentDueAmount!, paidAt: "2026-08-15", paymentMethod: "BANK_TRANSFER",
  });
  const after = await tuition.board();
  const updated = after.rows.find((item) => item.enrollmentId === enrollment.id);
  assert.equal(updated?.paymentDue, false);
  assert.equal(updated?.status, "LEARNING");
  assert.deepEqual(updated?.currentProgress, { attended: 2, target: 8 });
  const [cycles] = await pool.query<RowDataPacket[]>(
    "SELECT status,COUNT(tcs.id) item_count FROM tuition_cycles tc LEFT JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id WHERE tc.enrollment_id=? GROUP BY tc.id ORDER BY tc.cycle_number",
    [enrollment.id],
  );
  assert.deepEqual(cycles.map((cycle) => [cycle.status, Number(cycle.item_count)]), [["PAID", 8], ["ACCUMULATING", 2]]);
});

test.after(async () => {
  if (enabled) await pool.end();
});
