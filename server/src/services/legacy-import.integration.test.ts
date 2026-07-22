import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { config } from "../config/config";
import { pool } from "../db/pool";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
const tables = ["lesson_sessions", "classes", "class_enrollments", "tuition_cycles"] as const;

async function clean(): Promise<void> {
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

async function fixture(): Promise<{ actorId: number; studentId: number }> {
  await clean();
  const [actor] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users(username,email,password_hash,display_name) VALUES ('v16a','v16a@example.test','hash','V16A')");
  await pool.execute("INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Lớp hiện tại','ONE_TO_ONE',2000000,90,'2025-06-01')");
  const [student] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name,nickname) VALUES ('Học sinh Preview','Mây')");
  return { actorId: actor.insertId, studentId: student.insertId };
}

async function counts(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of tables) {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) count FROM ${table}`);
    result[table] = Number(rows[0].count);
  }
  return result;
}

async function validWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  learning.getCell("A1").value = "DATE"; learning.getCell("B1").value = "01/06";
  learning.getCell("C1").value = "CONTENT -NỘI DUNG HỌC"; learning.getCell("F1").value = "Nội dung mẫu";
  learning.getCell("A2").value = "TEACHER"; learning.getCell("B2").value = "Cô Vy"; learning.getCell("C2").value = "HOMEWORK";
  ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, index) => learning.getCell(3, index + 1).value = value);
  learning.getCell("A4").value = 1; learning.getCell("B4").value = "Học sinh Preview (Mây)"; learning.getCell("E4").value = "Bài tập mẫu";
  const tuition = workbook.addWorksheet("Học phí");
  ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, index) => tuition.getCell(1, index + 1).value = value);
  tuition.getCell("A2").value = "Học sinh Preview"; tuition.getCell("B2").value = "18:00-19:30";
  tuition.getCell("C2").value = new Date("2025-06-01T00:00:00Z"); tuition.getCell("C2").numFmt = "d/m/yyyy";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function blobPart(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function tempFiles(): Promise<string[]> {
  return (await readdir(tmpdir())).filter((name) => name.startsWith("teacher-hub-legacy-"));
}

integration("authenticated multipart preview removes temp files and leaves business tables unchanged", async () => {
  const data = await fixture();
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/students/${data.studentId}/legacy-imports/preview`;
    const bytes = await validWorkbook();
    const unauthorizedBody = new FormData();
    unauthorizedBody.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "history.xlsx");
    assert.equal((await fetch(url, { method: "POST", body: unauthorizedBody })).status, 401);

    const token = jwt.sign({ id: data.actorId, username: "v16a", displayName: "V16A", role: "TEACHER" }, config.jwt.secret, { expiresIn: "5m" });
    const beforeCounts = await counts();
    const beforeTemp = await tempFiles();
    const body = new FormData();
    body.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Student Grade 9.xlsx");
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: { mode: string; file: { sha256: string }; lessons: unknown[]; academicPeriods: Array<{ gradeLevel: number | null }> } };
    assert.equal(payload.data.mode, "PREVIEW_ONLY");
    assert.match(payload.data.file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(payload.data.lessons.length, 1);
    assert.ok(payload.data.academicPeriods.every((period) => period.gradeLevel == null));
    assert.deepEqual(await counts(), beforeCounts);
    assert.deepEqual(await tempFiles(), beforeTemp);

    const invalidBody = new FormData();
    invalidBody.append("file", new Blob([blobPart(Buffer.from("not an xlsx"))], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "invalid.xlsx");
    const invalid = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: invalidBody });
    assert.equal(invalid.status, 400);
    assert.equal(((await invalid.json()) as { error: { code: string } }).error.code, "INVALID_XLSX_SIGNATURE");
    assert.deepEqual(await tempFiles(), beforeTemp);

    const wrongMimeBody = new FormData();
    wrongMimeBody.append("file", new Blob([blobPart(bytes)], { type: "text/plain" }), "history.xlsx");
    const wrongMime = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: wrongMimeBody });
    assert.equal(wrongMime.status, 400);
    assert.equal(((await wrongMime.json()) as { error: { code: string } }).error.code, "INVALID_XLSX_TYPE");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test.after(async () => { if (enabled) await pool.end(); });
