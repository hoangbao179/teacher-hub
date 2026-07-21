import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { config } from "../config/config";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { StudentReportRepository } from "../repositories/student-report.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { StudentReportService } from "./student-report.service";
import { TuitionService } from "./tuition.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances", "lesson_session_participants",
      "lesson_sessions", "schedule_exceptions", "teacher_busy_slots", "recurring_schedules",
      "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments", "audit_logs",
      "students", "classes", "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture() {
  await clean();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [actor] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users(username,email,password_hash,display_name) VALUES ('m6b','m6b@example.com','hash','M6B')",
    );
    const [klass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Lớp M6B','GROUP',2400000,90,'2026-07-01')",
    );
    const [otherClass] = await connection.execute<ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Lớp khác','GROUP',1800000,90,'2026-07-01')",
    );
    await connection.execute(
      "INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,2400000,'2026-07-01'),(?,1800000,'2026-07-01')",
      [klass.insertId, otherClass.insertId],
    );
    const [student] = await connection.execute<ResultSetHeader>(
      "INSERT INTO students(full_name,nickname,parent_name,parent_phone) VALUES ('Nguyễn Minh An','An','Phụ huynh An','0900000000')",
    );
    const [enrollment] = await connection.execute<ResultSetHeader>(
      `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from)
       VALUES (?,?,'2026-07-01','CLASS_DEFAULT','2026-07-01')`,
      [klass.insertId, student.insertId],
    );
    await connection.execute(
      "INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2026-07-01')",
      [enrollment.insertId],
    );

    for (let day = 1; day <= 12; day += 1) {
      const status = day === 11 ? "ABSENT" : day === 12 ? "FREE" : "PRESENT";
      const billable = status === "PRESENT" ? 1 : 0;
      const date = `2026-07-${String(day).padStart(2, "0")}`;
      const [lesson] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lesson_sessions
          (class_id,session_date,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,
           actual_duration_minutes,lesson_type,status,content,homework,note,completed_at)
         VALUES (?,?,'18:00','19:30','18:05','19:45',100,?,'COMPLETED',?,?,?,NOW())`,
        [klass.insertId, date, day === 10 ? "MAKEUP" : "REGULAR",
          day === 1 ? "=HYPERLINK(\"https://invalid\")" : `Nội dung ${day}`,
          `Bài tập ${day}`, "Ghi chú chung"],
      );
      const [participant] = await connection.execute<ResultSetHeader>(
        "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id) VALUES (?,?)",
        [lesson.insertId, enrollment.insertId],
      );
      await connection.execute(
        `INSERT INTO lesson_attendances
          (lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition,student_note)
         VALUES (?,?,?,?,?,?)`,
        [lesson.insertId, participant.insertId, enrollment.insertId, status, billable, day === 2 ? "+cmd" : `Nhận xét ${day}`],
      );
    }
    await new TuitionRepository().recalculateEnrollment(connection, enrollment.insertId);
    await connection.commit();
    const [cycles] = await pool.query<RowDataPacket[]>(
      "SELECT id,status FROM tuition_cycles WHERE enrollment_id=? ORDER BY cycle_number", [enrollment.insertId],
    );
    await new TuitionService(new TuitionRepository()).markPaid(Number(cycles[0].id), {
      paidAmount: 2_400_000, paidAt: "2026-07-15", paymentMethod: "BANK_TRANSFER", paymentNote: "@đã nhận",
    }, actor.insertId);
    return { actorId: actor.insertId, classId: klass.insertId, otherClassId: otherClass.insertId, studentId: student.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

integration("canonical workbook contains normalized history, paid eight-item and accumulating cycles", async () => {
  const data = await fixture();
  const service = new StudentReportService(new StudentReportRepository());
  const result = await service.export(data.studentId, {}, data.actorId);
  assert.match(result.filename, /^Bao-cao-Nguyen-Minh-An-\d{8}\.xlsx$/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer as never);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Quá trình học tập", "Học phí", "Tổng hợp"]);
  const history = workbook.getWorksheet("Quá trình học tập")!;
  const fees = workbook.getWorksheet("Học phí")!;
  assert.equal(history.rowCount, 13);
  assert.equal(fees.rowCount, 11);
  assert.equal(history.getCell("A2").numFmt, "dd/mm/yyyy");
  assert.equal(history.getCell("I12").value, "Nghỉ");
  assert.equal(history.getCell("I13").value, "Miễn phí");
  assert.equal(history.getCell("J2").value, "'=HYPERLINK(\"https://invalid\")");
  assert.equal(history.getCell("L3").value, "'+cmd");
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => fees.getCell(`O${index + 2}`).value), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(fees.getCell("B2").value, "Đã thu");
  assert.equal(fees.getCell("F2").value, 2_400_000);
  assert.equal(fees.getCell("B10").value, "Đang tích lũy");
  assert.equal(fees.getCell("J2").value, 8);
  assert.equal(fees.getCell("I2").value, "'@đã nhận");
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)));

  const [audits] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM audit_logs WHERE action='STUDENT_REPORT_EXPORTED' AND entity_id=?", [data.studentId],
  );
  assert.equal(audits.length, 1);
  const auditPayload = typeof audits[0].after_json === "string" ? JSON.parse(audits[0].after_json) : audits[0].after_json;
  assert.deepEqual(auditPayload.filters, {});
});

integration("filters validate dates and class relationship and bound representative rows", async () => {
  const data = await fixture();
  const service = new StudentReportService(new StudentReportRepository());
  await assert.rejects(() => service.export(999999, {}, data.actorId), (error: unknown) => error instanceof AppError && error.code === "STUDENT_NOT_FOUND");
  await assert.rejects(() => service.export(data.studentId, { fromDate: "2026-07-09", toDate: "2026-07-01" }, data.actorId),
    (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR");
  await assert.rejects(() => service.export(data.studentId, { classId: data.otherClassId }, data.actorId),
    (error: unknown) => error instanceof AppError && error.code === "STUDENT_CLASS_MISMATCH");

  const result = await service.export(data.studentId, { fromDate: "2026-07-03", toDate: "2026-07-05", classId: data.classId }, data.actorId);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer as never);
  assert.equal(workbook.getWorksheet("Quá trình học tập")!.rowCount, 4);
  assert.equal(workbook.getWorksheet("Học phí")!.rowCount, 4);
});

integration("HTTP export requires auth and returns a parseable XLSX attachment", async () => {
  const data = await fixture();
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/students/${data.studentId}/export.xlsx`;
    assert.equal((await fetch(url)).status, 401);
    const token = jwt.sign({ id: data.actorId, username: "m6b", displayName: "M6B", role: "TEACHER" }, config.jwt.secret, { expiresIn: "5m" });
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="Bao-cao-Nguyen-Minh-An-/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
    assert.equal(workbook.getWorksheet("Học phí")!.rowCount, 11);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test.after(async () => { if (enabled) await pool.end(); });
