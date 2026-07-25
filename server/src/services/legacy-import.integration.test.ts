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
    for (const table of ["legacy_import_lesson_links", "legacy_import_row_audits", "legacy_imports",
      "tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles",
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

async function validWorkbook(studentName = "Học sinh Preview (Mây)"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  learning.getCell("A1").value = "DATE"; learning.getCell("B1").value = "01/06";
  learning.getCell("C1").value = "CONTENT -NỘI DUNG HỌC"; learning.getCell("F1").value = "Nội dung mẫu";
  learning.getCell("A2").value = "TEACHER"; learning.getCell("B2").value = "Cô Vy"; learning.getCell("C2").value = "HOMEWORK";
  ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, index) => learning.getCell(3, index + 1).value = value);
  learning.getCell("A4").value = 1; learning.getCell("B4").value = studentName; learning.getCell("E4").value = "Bài tập mẫu";
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

integration("apply reparses the workbook, writes atomically, audits rows and replays by student plus SHA", async () => {
  const data = await fixture();
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/students/${data.studentId}/legacy-imports`;
    const token = jwt.sign({ id: data.actorId, username: "v16a", displayName: "V16A", role: "TEACHER" },
      config.jwt.secret, { expiresIn: "5m" });
    const bytes = await validWorkbook();
    const previewBody = new FormData();
    previewBody.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "history.xlsx");
    const previewResponse = await fetch(`${base}/preview`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: previewBody });
    assert.equal(previewResponse.status, 200);
    const preview = ((await previewResponse.json()) as { data: {
      file: { sha256: string };
      rows: Array<{ sourceSheet: string; sourceRow: number; rowType: string; issueCodes: string[] }>;
      academicPeriods: Array<{ id: string; schoolYear: string }>;
    } }).data;
    const periodRow = preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD")!;
    const period = preview.academicPeriods[0];
    const decisions = [{ sourceSheet: periodRow.sourceSheet, sourceRow: periodRow.sourceRow,
      issueCode: "ACADEMIC_PERIOD_MAPPING_REQUIRED", action: "MAP_ACADEMIC_PERIOD",
      resolvedValue: { periodId: period.id, gradeLevel: 6,
        classMapping: { type: "CREATE_CLOSED_CLASS", proposedName: `Lớp lịch sử ${period.schoolYear}` } } }];

    const sendApply = async (sha256 = preview.file.sha256) => {
      const body = new FormData();
      body.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "history.xlsx");
      body.append("previewSha256", sha256);
      body.append("decisions", JSON.stringify(decisions));
      return fetch(`${base}/apply`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    };

    const mismatch = await sendApply("b".repeat(64));
    assert.equal(mismatch.status, 409);
    assert.equal(((await mismatch.json()) as { error: { code: string } }).error.code, "LEGACY_PREVIEW_SHA_MISMATCH");
    const concurrentResponses = await Promise.all([sendApply(), sendApply()]);
    assert.deepEqual(concurrentResponses.map((response) => response.status).sort(), [200, 201]);
    const concurrentResults = await Promise.all(concurrentResponses.map(async (response) =>
      ((await response.json()) as { data: { importId: number; idempotent: boolean;
        importedLessonCount: number; importedAttendanceCount: number; importedTuitionCycleCount: number } }).data));
    const firstResult = concurrentResults.find((item) => !item.idempotent)!;
    assert.ok(firstResult);
    assert.equal(new Set(concurrentResults.map((item) => item.importId)).size, 1);
    assert.equal(firstResult.importedLessonCount, 1);
    assert.equal(firstResult.importedAttendanceCount, 1);
    assert.equal(firstResult.importedTuitionCycleCount, 1);
    const [business] = await pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM legacy_imports WHERE status='APPLIED') imports,
        (SELECT COUNT(*) FROM legacy_import_row_audits) row_audits,
        (SELECT COUNT(*) FROM legacy_import_lesson_links) links,
        (SELECT COUNT(*) FROM lesson_attendances WHERE attendance_status='PRESENT' AND counts_for_tuition=1) attendances,
        (SELECT COUNT(*) FROM tuition_cycle_sessions) cycle_items`,
    );
    assert.equal(Number(business[0].imports), 1);
    assert.ok(Number(business[0].row_audits) >= 2);
    assert.equal(Number(business[0].links), 1);
    assert.equal(Number(business[0].attendances), 1);
    assert.equal(Number(business[0].cycle_items), 1);

    const replay = await sendApply();
    assert.equal(replay.status, 200);
    const replayResult = ((await replay.json()) as { data: { importId: number; idempotent: boolean } }).data;
    assert.equal(replayResult.idempotent, true);
    assert.equal(replayResult.importId, firstResult.importId);
    const [afterReplay] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) count FROM lesson_attendances");
    assert.equal(Number(afterReplay[0].count), 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

integration("skipped row writes audit but no class, enrollment, lesson, attendance or tuition data", async () => {
  const data = await fixture();
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/students/${data.studentId}/legacy-imports`;
    const token = jwt.sign({ id: data.actorId, username: "v16a", displayName: "V16A", role: "TEACHER" },
      config.jwt.secret, { expiresIn: "5m" });
    const bytes = await validWorkbook("Học sinh Khác");
    const previewBody = new FormData();
    previewBody.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "skip.xlsx");
    const previewResponse = await fetch(`${base}/preview`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: previewBody });
    const preview = ((await previewResponse.json()) as { data: { file: { sha256: string };
      rows: Array<{ sourceSheet: string; sourceRow: number; rowType: string; issueCodes: string[] }>;
      academicPeriods: Array<{ id: string; schoolYear: string }> } }).data;
    const lessonRow = preview.rows.find((row) => row.rowType === "LESSON")!;
    const periodRow = preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD")!;
    assert.ok(lessonRow.issueCodes.includes("STUDENT_MISMATCH"));
    const period = preview.academicPeriods[0];
    const decisions = [
      { sourceSheet: lessonRow.sourceSheet, sourceRow: lessonRow.sourceRow, issueCode: "STUDENT_MISMATCH",
        action: "SKIP", reason: "WRONG_STUDENT" },
      { sourceSheet: periodRow.sourceSheet, sourceRow: periodRow.sourceRow,
        issueCode: "ACADEMIC_PERIOD_MAPPING_REQUIRED", action: "MAP_ACADEMIC_PERIOD",
        resolvedValue: { periodId: period.id, gradeLevel: 6,
          classMapping: { type: "CREATE_CLOSED_CLASS", proposedName: "Không được tạo" } } },
    ];
    const body = new FormData();
    body.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "skip.xlsx");
    body.append("previewSha256", preview.file.sha256); body.append("decisions", JSON.stringify(decisions));
    const response = await fetch(`${base}/apply`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    assert.equal(response.status, 201);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM classes) classes,
        (SELECT COUNT(*) FROM class_enrollments) enrollments,
        (SELECT COUNT(*) FROM lesson_sessions) lessons,
        (SELECT COUNT(*) FROM lesson_attendances) attendances,
        (SELECT COUNT(*) FROM tuition_cycles) cycles,
        (SELECT COUNT(*) FROM legacy_import_row_audits WHERE row_status='SKIPPED') skipped_audits`,
    );
    assert.equal(Number(rows[0].classes), 1);
    assert.equal(Number(rows[0].enrollments), 0);
    assert.equal(Number(rows[0].lessons), 0);
    assert.equal(Number(rows[0].attendances), 0);
    assert.equal(Number(rows[0].cycles), 0);
    assert.equal(Number(rows[0].skipped_audits), 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

integration("two student imports reuse one exact group lesson and keep separate attendance", async () => {
  await clean();
  const [actor] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users(username,email,password_hash,display_name) VALUES ('v16b','v16b@example.test','hash','V16B')");
  const [group] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Nhóm lịch sử','GROUP',2000000,90,'2025-06-01')");
  await pool.execute("INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2025-06-01')", [group.insertId]);
  await pool.execute("INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,2000000,'2025-06-01')", [group.insertId]);
  const studentIds: number[] = [];
  for (const name of ["Học sinh Nhóm A", "Học sinh Nhóm B"]) {
    const [student] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES (?)", [name]);
    const [enrollment] = await pool.execute<ResultSetHeader>(
      "INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_effective_from) VALUES (?,?,'2025-06-01','2025-06-01')",
      [group.insertId, student.insertId]);
    await pool.execute("INSERT INTO enrollment_active_periods(enrollment_id,active_from) VALUES (?,'2025-06-01')", [enrollment.insertId]);
    await pool.execute("INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,effective_from) VALUES (?,'CLASS_DEFAULT','2025-06-01')", [enrollment.insertId]);
    studentIds.push(student.insertId);
  }
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const token = jwt.sign({ id: actor.insertId, username: "v16b", displayName: "V16B", role: "TEACHER" },
      config.jwt.secret, { expiresIn: "5m" });
    for (const [index, studentId] of studentIds.entries()) {
      const bytes = await validWorkbook(`Học sinh Nhóm ${index === 0 ? "A" : "B"}`);
      const base = `http://127.0.0.1:${port}/api/students/${studentId}/legacy-imports`;
      const previewBody = new FormData();
      previewBody.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `group-${index}.xlsx`);
      const previewResponse = await fetch(`${base}/preview`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: previewBody });
      assert.equal(previewResponse.status, 200);
      const preview = ((await previewResponse.json()) as { data: { file: { sha256: string };
        rows: Array<{ sourceSheet: string; sourceRow: number; rowType: string; issueCodes: string[] }>;
        academicPeriods: Array<{ id: string }> } }).data;
      const periodRow = preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD")!;
      const decisions = [{ sourceSheet: periodRow.sourceSheet, sourceRow: periodRow.sourceRow,
        issueCode: "ACADEMIC_PERIOD_MAPPING_REQUIRED", action: "MAP_ACADEMIC_PERIOD",
        resolvedValue: { periodId: preview.academicPeriods[0].id, gradeLevel: 6,
          classMapping: { type: "CURRENT_CLASS", classId: group.insertId, className: "Nhóm lịch sử" } } }];
      const applyBody = new FormData();
      applyBody.append("file", new Blob([blobPart(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `group-${index}.xlsx`);
      applyBody.append("previewSha256", preview.file.sha256); applyBody.append("decisions", JSON.stringify(decisions));
      const applied = await fetch(`${base}/apply`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: applyBody });
      assert.equal(applied.status, 201);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM lesson_sessions) lessons,
        (SELECT COUNT(*) FROM lesson_session_participants) participants,
        (SELECT COUNT(*) FROM lesson_attendances) attendances`,
    );
    assert.equal(Number(rows[0].lessons), 1);
    assert.equal(Number(rows[0].participants), 2);
    assert.equal(Number(rows[0].attendances), 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test.after(async () => { if (enabled) await pool.end(); });
