import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { occurrenceKey, replacementOccurrenceKey } from "../domain/schedule-projection";
import { ClassRepository } from "../repositories/class.repository";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { StudentRepository } from "../repositories/student.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { ClassService } from "./class.service";
import { EnrollmentService } from "./enrollment.service";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";
import { StudentService } from "./student.service";
import { TuitionService } from "./tuition.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of ["tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles",
      "lesson_attendances", "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions",
      "schedule_exceptions", "teacher_busy_slot_schedules", "teacher_busy_slots", "recurring_schedules", "enrollment_active_periods",
      "class_active_periods", "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments",
      "audit_logs", "students", "classes", "users"])
      await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

function services() {
  const tuitionRepository = new TuitionRepository();
  const lessons = new LessonService(new LessonRepository(), tuitionRepository);
  return { classes: new ClassService(new ClassRepository()), students: new StudentService(new StudentRepository()),
    enrollments: new EnrollmentService(new EnrollmentRepository()), lessons,
    schedules: new ScheduleService(new ScheduleRepository(), lessons), tuition: new TuitionService(tuitionRepository) };
}

integration("V15 migration exposes replacement cancellation, entitlement and finance schema", async () => {
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0009_v15_schedule_makeup_finance_transfer.sql'",
  );
  assert.equal(migration.length, 1);
  const [tables] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
     AND TABLE_NAME IN ('tuition_receipts','tuition_receipt_allocations')`,
  );
  assert.equal(tables.length, 2);
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
     AND ((TABLE_NAME='schedule_exceptions' AND COLUMN_NAME='replacement_cancelled_at')
       OR (TABLE_NAME='lesson_makeup_replacements' AND COLUMN_NAME='status')
       OR (TABLE_NAME='tuition_cycles' AND COLUMN_NAME='settlement_status'))`,
  );
  assert.equal(columns.length, 3);
});

integration("bulk temporary reschedule supports one and two weekly schedules without touching unselected patterns", async () => {
  await clean(); const { classes, schedules } = services();
  for (const count of [1, 2]) {
    const classId = await classes.create({ name: `V15 ${count} lịch`, type: "GROUP", defaultPackagePrice: 1_600_000,
      defaultDurationMinutes: 60, startDate: "2026-08-01", schedules: Array.from({ length: count }, (_, index) => ({
        dayOfWeek: (index * 2 + 1) as 1 | 3,
        startTime: `${String(8 + index).padStart(2, "0")}:00`, endTime: `${String(9 + index).padStart(2, "0")}:00`,
      })) });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id,day_of_week FROM recurring_schedules WHERE class_id=? ORDER BY day_of_week", [classId]);
    const mapping = [{ recurringScheduleId: Number(rows[0].id), replacementDayOfWeek: 2 as const,
      replacementStartTime: "12:00", replacementEndTime: "13:00" }];
    const preview = await schedules.previewTemporary({ classId, fromDate: "2026-08-03", toDate: "2026-08-07",
      mappings: mapping, reason: "Đổi subset" });
    assert.equal(preview.items.length, 1);
    await schedules.applyTemporary({ classId, fromDate: "2026-08-03", toDate: "2026-08-07",
      mappings: mapping, reason: "Đổi subset", confirmConflicts: true });
    const projected = await schedules.occurrences({ from: "2026-08-03", to: "2026-08-07", classId, lookbackDays: 60 });
    assert.equal(projected.filter((item) => item.projectionSource === "RESCHEDULED").length, 1);
    if (count === 2) assert.ok(projected.some((item) => item.recurringScheduleId === Number(rows[1].id) && item.projectionSource === "RECURRING"));
  }
});

integration("combined bulk reschedule, replacement skip and subset makeup lifecycle is transactional", async () => {
  await clean(); const { classes, students, enrollments, lessons, schedules } = services();
  const classId = await classes.create({ name: "V15 Ba lịch", type: "GROUP", defaultPackagePrice: 2_400_000,
    defaultDurationMinutes: 90, startDate: "2026-08-01", schedules: [
      { dayOfWeek: 1, startTime: "18:00", endTime: "19:30" },
      { dayOfWeek: 3, startTime: "18:00", endTime: "19:30" },
      { dayOfWeek: 5, startTime: "18:00", endTime: "19:30" },
    ] });
  const a = await students.create({ fullName: "Học sinh A" });
  const b = await students.create({ fullName: "Học sinh B" });
  const ea = await enrollments.create(classId, { studentId: a, joinedAt: "2026-08-01", tuitionMode: "CLASS_DEFAULT" });
  const eb = await enrollments.create(classId, { studentId: b, joinedAt: "2026-08-01", tuitionMode: "CLASS_DEFAULT" });
  const [scheduleRows] = await pool.query<RowDataPacket[]>("SELECT id,day_of_week FROM recurring_schedules WHERE class_id=? ORDER BY day_of_week", [classId]);
  const mon = { id: Number(scheduleRows[0].id) };
  const [wedRows] = await pool.query<RowDataPacket[]>("SELECT id FROM recurring_schedules WHERE class_id=? AND day_of_week=3", [classId]);
  const wed = { id: Number(wedRows[0].id) };
  const fri = { id: Number(scheduleRows[2].id) };
  const internalConflict = await schedules.previewTemporary({ classId, fromDate: "2026-08-03", toDate: "2026-08-07",
    mappings: [
      { recurringScheduleId: mon.id, replacementDayOfWeek: 2, replacementStartTime: "20:00", replacementEndTime: "21:00" },
      { recurringScheduleId: wed.id, replacementDayOfWeek: 2, replacementStartTime: "20:00", replacementEndTime: "21:00" },
    ], reason: "Kiểm tra trùng nội bộ" });
  assert.ok(internalConflict.conflictCount >= 2);
  const preview = await schedules.previewTemporary({ classId, fromDate: "2026-08-03", toDate: "2026-08-21",
    mappings: [{ recurringScheduleId: wed.id, replacementDayOfWeek: 4, replacementStartTime: "18:00", replacementEndTime: "19:30" }],
    reason: "Đổi thứ Tư sang thứ Năm" });
  assert.equal(preview.items.length, 3);
  await schedules.applyTemporary({ classId, fromDate: "2026-08-03", toDate: "2026-08-21",
    mappings: [{ recurringScheduleId: wed.id, replacementDayOfWeek: 4, replacementStartTime: "18:00", replacementEndTime: "19:30" }],
    reason: "Đổi thứ Tư sang thứ Năm" });
  const source = occurrenceKey(classId, wed.id, "2026-08-12");
  await schedules.skip(replacementOccurrenceKey(source), { reason: "Lịch thay thế tiếp tục nghỉ", makeupRequired: true });
  const projected = await schedules.occurrences({ from: "2026-08-12", to: "2026-08-13", classId, lookbackDays: 60 });
  assert.equal(projected.find((item) => item.key === source)?.state, "RESCHEDULED");
  assert.equal(projected.find((item) => item.key === replacementOccurrenceKey(source))?.state, "SKIPPED");
  assert.deepEqual((await lessons.makeupOptions(source)).participants.map((item) => item.entitlementStatus), ["OPEN", "OPEN"]);
  const first = await lessons.create({ classId, sessionDate: "2026-09-03", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [ea, eb], makeupSourceOccurrenceKey: source });
  await lessons.cancel(first.id, { reason: "Tạo lại giờ khác" });
  assert.deepEqual((await lessons.makeupOptions(source)).participants.map((item) => item.entitlementStatus), ["OPEN", "OPEN"]);
  const second = await lessons.create({ classId, sessionDate: "2026-09-04", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [ea, eb], makeupSourceOccurrenceKey: source });
  await lessons.complete(second.id, { actualStartTime: "20:00", actualEndTime: "21:30",
    attendances: [{ enrollmentId: ea, status: "PRESENT" }, { enrollmentId: eb, status: "ABSENT" }] });
  let options = await lessons.makeupOptions(source);
  assert.equal(options.participants.find((item) => item.enrollmentId === ea)?.entitlementStatus, "FULFILLED");
  assert.equal(options.participants.find((item) => item.enrollmentId === eb)?.entitlementStatus, "OPEN");
  const third = await lessons.create({ classId, sessionDate: "2026-09-05", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [eb], makeupSourceOccurrenceKey: source });
  await lessons.complete(third.id, { actualStartTime: "20:00", actualEndTime: "21:30",
    attendances: [{ enrollmentId: eb, status: "PRESENT" }] });
  options = await lessons.makeupOptions(source);
  assert.deepEqual(options.participants.map((item) => item.entitlementStatus), ["FULFILLED", "FULFILLED"]);
  await assert.rejects(() => lessons.create({ classId, sessionDate: "2026-09-06", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [ea], makeupSourceOccurrenceKey: source }));
  await lessons.updateAttendances(second.id, { attendances: [{ enrollmentId: ea, status: "ABSENT" }] });
  assert.equal((await lessons.makeupOptions(source)).participants.find((item) => item.enrollmentId === ea)?.entitlementStatus, "OPEN");
  await lessons.updateAttendances(second.id, { attendances: [{ enrollmentId: ea, status: "FREE" }] });
  assert.equal((await lessons.makeupOptions(source)).participants.find((item) => item.enrollmentId === ea)?.entitlementStatus, "FULFILLED");
  const [freeBilling] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) total FROM tuition_cycle_sessions tcs JOIN lesson_attendances a ON a.id=tcs.attendance_id
     WHERE a.lesson_session_id=? AND a.enrollment_id=?`, [second.id, ea]);
  assert.equal(Number(freeBilling[0].total), 0);

  const cancelledReplacementSource = occurrenceKey(classId, wed.id, "2026-08-05");
  const cancelledReplacement = await schedules.createDraft(replacementOccurrenceKey(cancelledReplacementSource));
  await lessons.cancel(cancelledReplacement.lessonId, { reason: "Nghỉ lịch thay thế từ draft" });
  const replacementProjection = await schedules.occurrences({ from: "2026-08-05", to: "2026-08-06", classId, lookbackDays: 60 });
  assert.equal(replacementProjection.find((item) => item.key === cancelledReplacementSource)?.state, "RESCHEDULED");
  assert.equal(replacementProjection.find((item) => item.key === replacementOccurrenceKey(cancelledReplacementSource))?.state, "SKIPPED");
  const editable = await lessons.create({ classId, sessionDate: "2026-09-10", scheduledStartTime: "20:00", scheduledEndTime: "21:30",
    lessonType: "MAKEUP", selectedEnrollmentIds: [ea, eb], makeupSourceOccurrenceKey: cancelledReplacementSource });
  await lessons.updateParticipants(editable.id, { enrollmentIds: [ea] });
  assert.equal((await lessons.makeupOptions(cancelledReplacementSource)).participants.find((item) => item.enrollmentId === eb)?.entitlementStatus, "OPEN");
  await lessons.cancel(editable.id, { reason: "Hủy draft sau khi bỏ participant" });
  assert.deepEqual((await lessons.makeupOptions(cancelledReplacementSource)).participants.map((item) => item.entitlementStatus), ["OPEN", "OPEN"]);

  const after = await schedules.occurrences({ from: "2026-08-24", to: "2026-08-28", classId, lookbackDays: 60 });
  assert.ok(after.some((item) => item.recurringScheduleId === wed.id && item.occurrenceDate === "2026-08-26" && item.projectionSource === "RECURRING"));
  const allMappings = [
    { recurringScheduleId: mon.id, replacementDayOfWeek: 2 as const, replacementStartTime: "18:00", replacementEndTime: "19:30" },
    { recurringScheduleId: wed.id, replacementDayOfWeek: 4 as const, replacementStartTime: "18:00", replacementEndTime: "19:30" },
    { recurringScheduleId: fri.id, replacementDayOfWeek: 6 as const, replacementStartTime: "18:00", replacementEndTime: "19:30" },
  ];
  const allPreview = await schedules.previewTemporary({ classId, fromDate: "2026-09-07", toDate: "2026-09-11",
    mappings: allMappings, reason: "Đổi cả ba lịch" });
  assert.equal(allPreview.items.length, 3);
  await schedules.applyTemporary({ classId, fromDate: "2026-09-07", toDate: "2026-09-11",
    mappings: allMappings, reason: "Đổi cả ba lịch", confirmConflicts: true });
  const allProjected = await schedules.occurrences({ from: "2026-09-07", to: "2026-09-12", classId, lookbackDays: 60 });
  assert.equal(allProjected.filter((item) => item.originalOccurrenceDate >= "2026-09-07" && item.originalOccurrenceDate <= "2026-09-11" && item.projectionSource === "RESCHEDULED").length, 3);
});

integration("advance receipt waits for 8 lessons and transfer starts a new 0/8 enrollment", async () => {
  await clean(); const { classes, students, enrollments, lessons, tuition } = services();
  const oldClass = await classes.create({ name: "Lớp cũ", type: "GROUP", defaultPackagePrice: 1_600_000,
    defaultDurationMinutes: 60, startDate: "2026-08-01", schedules: [] });
  const target = await classes.create({ name: "Lớp mới 1-1", type: "ONE_TO_ONE", defaultPackagePrice: 1_600_000,
    defaultDurationMinutes: 60, startDate: "2026-08-01", schedules: [] });
  const student = await students.create({ fullName: "Học sinh chuyển lớp" });
  const enrollment = await enrollments.create(oldClass, { studentId: student, joinedAt: "2026-08-01", tuitionMode: "CLASS_DEFAULT" });
  for (let index = 1; index <= 3; index++) {
    const lesson = await lessons.create({ classId: oldClass, sessionDate: `2026-08-0${index + 1}`,
      scheduledStartTime: "18:00", scheduledEndTime: "19:00", lessonType: "REGULAR" });
    await lessons.complete(lesson.id, { actualStartTime: "18:00", actualEndTime: "19:00",
      attendances: [{ enrollmentId: enrollment, status: "PRESENT" }] });
  }
  const [before] = await pool.query<RowDataPacket[]>("SELECT status FROM tuition_cycles WHERE enrollment_id=?", [enrollment]);
  assert.equal(before[0].status, "ACCUMULATING");
  const receipt = await tuition.createAdvanceReceipt(enrollment, { amount: 1_600_000, receivedAt: "2026-08-04", paymentMethod: "BANK_TRANSFER" });
  assert.equal(receipt.packagePriceSnapshot, 1_600_000);
  await enrollments.changeTuitionMode(enrollment, { tuitionMode: "CUSTOM", customPackagePrice: 1_800_000, effectiveFrom: "2026-08-05" });
  assert.equal((await tuition.listReceipts(enrollment))[0].packagePriceSnapshot, 1_600_000);
  const occupiedStudent = await students.create({ fullName: "Học sinh chiếm lớp 1-1" });
  const occupiedEnrollment = await enrollments.create(target, { studentId: occupiedStudent, joinedAt: "2026-08-01", tuitionMode: "CLASS_DEFAULT" });
  await assert.rejects(() => enrollments.transfer(enrollment, { targetClassId: target, effectiveDate: "2026-08-10",
    tuitionMode: "CLASS_DEFAULT", reason: "Phải rollback", incompleteCycleAction: { type: "KEEP_OPEN" },
    advanceReceiptAction: { type: "TRANSFER_TO_NEW_ENROLLMENT" } }));
  const [rollback] = await pool.query<RowDataPacket[]>("SELECT status FROM class_enrollments WHERE id=?", [enrollment]);
  assert.equal(rollback[0].status, "ACTIVE");
  assert.equal((await tuition.listReceipts(enrollment))[0].status, "ALLOCATED");
  await enrollments.end(occupiedEnrollment, { endedAt: "2026-08-09", reason: "Giải phóng lớp" });
  const transferred = await enrollments.transfer(enrollment, { targetClassId: target, effectiveDate: "2026-08-10",
    tuitionMode: "CLASS_DEFAULT", reason: "Phù hợp học 1-1", incompleteCycleAction: { type: "KEEP_OPEN" },
    advanceReceiptAction: { type: "TRANSFER_TO_NEW_ENROLLMENT" } });
  const [oldRows] = await pool.query<RowDataPacket[]>("SELECT status,ended_at FROM class_enrollments WHERE id=?", [enrollment]);
  const [newRows] = await pool.query<RowDataPacket[]>("SELECT status,class_id FROM class_enrollments WHERE id=?", [transferred.newEnrollmentId]);
  assert.equal(oldRows[0].status, "ENDED"); assert.equal(newRows[0].status, "ACTIVE"); assert.equal(Number(newRows[0].class_id), target);
  const [oldCycle] = await pool.query<RowDataPacket[]>("SELECT status,settlement_status FROM tuition_cycles WHERE enrollment_id=?", [enrollment]);
  assert.equal(oldCycle[0].status, "INCOMPLETE"); assert.equal(oldCycle[0].settlement_status, "OPEN");
  const [progress] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) total FROM tuition_cycles WHERE enrollment_id=?", [transferred.newEnrollmentId]);
  assert.equal(Number(progress[0].total), 0);
  const [receiptRows] = await pool.query<RowDataPacket[]>("SELECT enrollment_id,status FROM tuition_receipts WHERE id=?", [receipt.id]);
  assert.equal(Number(receiptRows[0].enrollment_id), transferred.newEnrollmentId); assert.equal(receiptRows[0].status, "TRANSFERRED");
  const [history] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) lesson_count,(SELECT COUNT(*) FROM tuition_cycles WHERE enrollment_id=?) cycle_count
     FROM lesson_attendances WHERE enrollment_id=?`, [enrollment, enrollment]);
  assert.equal(Number(history[0].lesson_count), 3); assert.equal(Number(history[0].cycle_count), 1);
});

integration("advance receipt auto-pays only at 8/8 and incomplete settlement keeps INCOMPLETE", async () => {
  await clean(); const { classes, students, enrollments, lessons, tuition } = services();
  const classId = await classes.create({ name: "Lớp thu trước", type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 60, startDate: "2026-09-01", schedules: [] });
  const studentId = await students.create({ fullName: "Học sinh thu trước" });
  const enrollmentId = await enrollments.create(classId, { studentId, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT" });
  const receipt = await tuition.createAdvanceReceipt(enrollmentId,
    { amount: 2_000_000, receivedAt: "2026-09-01", paymentMethod: "CASH" });
  await assert.rejects(() => tuition.createAdvanceReceipt(enrollmentId,
    { amount: 1_000_000, receivedAt: "2026-09-01", paymentMethod: "CASH" }));
  for (let index = 1; index <= 8; index++) {
    const lesson = await lessons.create({ classId, sessionDate: `2026-09-${String(index + 1).padStart(2, "0")}`,
      scheduledStartTime: "18:00", scheduledEndTime: "19:00", lessonType: "REGULAR" });
    await lessons.complete(lesson.id, { actualStartTime: "18:00", actualEndTime: "19:00",
      attendances: [{ enrollmentId, status: "PRESENT" }] });
    const [cycles] = await pool.query<RowDataPacket[]>("SELECT status FROM tuition_cycles WHERE enrollment_id=?", [enrollmentId]);
    assert.equal(cycles[0].status, index < 8 ? "ACCUMULATING" : "PAID");
  }
  const paid = await tuition.listReceipts(enrollmentId);
  assert.equal(paid[0].id, receipt.id); assert.equal(paid[0].status, "ALLOCATED");
  await enrollments.end(enrollmentId, { endedAt: "2026-09-30", reason: "Hoàn tất" });
  const freeStudent = await students.create({ fullName: "Học sinh miễn phí không thu trước" });
  const freeEnrollment = await enrollments.create(classId,
    { studentId: freeStudent, joinedAt: "2026-09-30", tuitionMode: "FREE" });
  await assert.rejects(() => tuition.createAdvanceReceipt(freeEnrollment,
    { amount: 2_000_000, receivedAt: "2026-09-30", paymentMethod: "CASH" }));
  await enrollments.end(freeEnrollment, { endedAt: "2026-09-30", reason: "Kết thúc dữ liệu test miễn phí" });

  const partialStudent = await students.create({ fullName: "Học sinh chốt dở" });
  const partialEnrollment = await enrollments.create(classId, { studentId: partialStudent, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT" });
  for (let index = 1; index <= 3; index++) {
    const lesson = await lessons.create({ classId, sessionDate: `2026-10-0${index}`,
      scheduledStartTime: "18:00", scheduledEndTime: "19:00", lessonType: "REGULAR" });
    await lessons.complete(lesson.id, { actualStartTime: "18:00", actualEndTime: "19:00",
      attendances: [{ enrollmentId: partialEnrollment, status: "PRESENT" }] });
  }
  await enrollments.end(partialEnrollment, { endedAt: "2026-10-10", reason: "Ngừng học",
    incompleteCycleAction: { type: "SETTLE", amount: 750_000, method: "BANK_TRANSFER" },
    advanceReceiptAction: { type: "NONE" } });
  const [incomplete] = await pool.query<RowDataPacket[]>(
    "SELECT status,settlement_status,settled_amount FROM tuition_cycles WHERE enrollment_id=?", [partialEnrollment],
  );
  assert.equal(incomplete[0].status, "INCOMPLETE"); assert.equal(incomplete[0].settlement_status, "SETTLED");
  assert.equal(Number(incomplete[0].settled_amount), 750_000);

  const waivedStudent = await students.create({ fullName: "Học sinh miễn đợt dở" });
  const waivedEnrollment = await enrollments.create(classId,
    { studentId: waivedStudent, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT" });
  const waivedLesson = await lessons.create({ classId, sessionDate: "2026-10-11", scheduledStartTime: "18:00",
    scheduledEndTime: "19:00", lessonType: "REGULAR" });
  await lessons.complete(waivedLesson.id, { actualStartTime: "18:00", actualEndTime: "19:00",
    attendances: [{ enrollmentId: waivedEnrollment, status: "PRESENT" }] });
  await enrollments.end(waivedEnrollment, { endedAt: "2026-10-12", reason: "Miễn đợt dở",
    incompleteCycleAction: { type: "WAIVE", reason: "Hỗ trợ học sinh" }, advanceReceiptAction: { type: "NONE" } });
  const [waived] = await pool.query<RowDataPacket[]>(
    "SELECT status,settlement_status FROM tuition_cycles WHERE enrollment_id=?", [waivedEnrollment]);
  assert.equal(waived[0].status, "INCOMPLETE"); assert.equal(waived[0].settlement_status, "WAIVED");

  const applyStudent = await students.create({ fullName: "Học sinh dùng khoản thu trước" });
  const applyEnrollment = await enrollments.create(classId,
    { studentId: applyStudent, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT" });
  const applyLesson = await lessons.create({ classId, sessionDate: "2026-10-13", scheduledStartTime: "18:00",
    scheduledEndTime: "19:00", lessonType: "REGULAR" });
  await lessons.complete(applyLesson.id, { actualStartTime: "18:00", actualEndTime: "19:00",
    attendances: [{ enrollmentId: applyEnrollment, status: "PRESENT" }] });
  const appliedReceipt = await tuition.createAdvanceReceipt(applyEnrollment,
    { amount: 2_000_000, receivedAt: "2026-10-13", paymentMethod: "BANK_TRANSFER" });
  const targetClass = await classes.create({ name: "Lớp đích áp dụng khoản thu", type: "GROUP", defaultPackagePrice: 2_000_000,
    defaultDurationMinutes: 60, startDate: "2026-09-01", schedules: [] });
  await enrollments.transfer(applyEnrollment, { targetClassId: targetClass, effectiveDate: "2026-10-15",
    tuitionMode: "CLASS_DEFAULT", reason: "Chuyển và chốt đợt cũ", incompleteCycleAction: { type: "KEEP_OPEN" },
    advanceReceiptAction: { type: "APPLY_TO_OLD_SETTLEMENT" } });
  const [applied] = await pool.query<RowDataPacket[]>(
    `SELECT tc.status,tc.settlement_status,tc.settled_amount,tr.status receipt_status
     FROM tuition_cycles tc JOIN tuition_receipt_allocations tra ON tra.tuition_cycle_id=tc.id
     JOIN tuition_receipts tr ON tr.id=tra.receipt_id WHERE tc.enrollment_id=? AND tr.id=?`,
    [applyEnrollment, appliedReceipt.id]);
  assert.equal(applied[0].status, "INCOMPLETE"); assert.equal(applied[0].settlement_status, "SETTLED");
  assert.equal(Number(applied[0].settled_amount), 2_000_000); assert.equal(applied[0].receipt_status, "ALLOCATED");

  const refundStudent = await students.create({ fullName: "Học sinh hoàn khoản thu trước" });
  const refundEnrollment = await enrollments.create(classId,
    { studentId: refundStudent, joinedAt: "2026-09-01", tuitionMode: "CLASS_DEFAULT" });
  const refundReceipt = await tuition.createAdvanceReceipt(refundEnrollment,
    { amount: 2_000_000, receivedAt: "2026-10-16", paymentMethod: "CASH" });
  await enrollments.end(refundEnrollment, { endedAt: "2026-10-17", reason: "Hoàn tiền",
    incompleteCycleAction: { type: "KEEP_OPEN" }, advanceReceiptAction: { type: "REFUND", note: "Đã hoàn tiền mặt" } });
  assert.equal((await tuition.listReceipts(refundEnrollment)).find((item) => item.id === refundReceipt.id)?.status, "REFUNDED");
  const [audits] = await pool.query<RowDataPacket[]>(
    `SELECT action,COUNT(*) total FROM audit_logs WHERE action IN
      ('TUITION_INCOMPLETE_SETTLED','TUITION_INCOMPLETE_WAIVED','TUITION_ADVANCE_REFUNDED','ENROLLMENT_TRANSFERRED')
     GROUP BY action`,
  );
  assert.deepEqual(new Set(audits.map((row) => row.action)), new Set([
    "TUITION_INCOMPLETE_SETTLED", "TUITION_INCOMPLETE_WAIVED", "TUITION_ADVANCE_REFUNDED", "ENROLLMENT_TRANSFERRED",
  ]));
});

test.after(async () => { if (enabled) await pool.end(); });
