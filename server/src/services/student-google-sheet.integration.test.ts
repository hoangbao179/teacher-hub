import assert from "node:assert/strict";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AuditRepository } from "../repositories/audit.repository";
import { StudentGoogleSheetRepository } from "../repositories/student-google-sheet.repository";
import { StudentRepository } from "../repositories/student.repository";
import { FakeGoogleSheetProvider } from "../integrations/google/fake-google-sheet.provider";
import { StudentGoogleSheetService } from "./student-google-sheet.service";
import { StudentService } from "./student.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
const settings = { enabled: true, clientId: "fake", clientSecret: "fake", refreshToken: "fake", rootFolderId: "fake-root",
  ownerLabel: "Cô Vy test", templateVersion: "v1" };

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of ["student_google_sheets", "legacy_import_lesson_links", "legacy_import_row_audits", "legacy_imports",
      "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances",
      "lesson_session_participants", "lesson_sessions", "enrollment_active_periods", "class_active_periods", "enrollment_tuition_policies",
      "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes", "users"])
      await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally { connection.release(); }
}

async function fixture(repository = new StudentGoogleSheetRepository()) {
  await clean();
  const [actor] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users(username,email,password_hash,display_name) VALUES ('google','google@example.test','hash','Google Test')");
  const [student] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('Học sinh Google Test')");
  const provider = new FakeGoogleSheetProvider();
  const service = new StudentGoogleSheetService(repository, new StudentService(new StudentRepository()), settings, provider);
  return { actorId: actor.insertId, studentId: student.insertId, provider, service };
}

integration("create is concurrent-safe, linked to import, stable across enrollment and archive allows a new record", async () => {
  const data = await fixture();
  const [legacy] = await pool.execute<ResultSetHeader>(
    `INSERT INTO legacy_imports(student_id,original_filename,file_size,sha256,status,total_row_count,applied_by_user_id,applied_at)
     VALUES (?,'history.xlsx',100,?,'APPLIED',1,?,NOW())`, [data.studentId, "a".repeat(64), data.actorId]);
  const [first, second] = await Promise.all([
    data.service.create(data.studentId, { legacyImportId: legacy.insertId }, data.actorId),
    data.service.create(data.studentId, { legacyImportId: legacy.insertId }, data.actorId),
  ]);
  const active = first.sheet.status === "ACTIVE" ? first : await data.service.retry(data.studentId, data.actorId);
  assert.equal(active.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
  assert.equal(data.provider.lastCreateInput?.appProperties.teacherHubManaged, "true");
  assert.equal(data.provider.lastCreateInput?.appProperties.studentId, String(data.studentId));
  assert.ok(["ACTIVE", "CREATING"].includes(second.sheet.status));
  const [classResult] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Lớp 7','ONE_TO_ONE',2000000,90,'2026-06-01')");
  await pool.execute("INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')",
    [classResult.insertId, data.studentId]);
  const repeated = await data.service.create(data.studentId, {}, data.actorId);
  assert.equal(repeated.sheet.id, active.sheet.id);
  assert.equal(data.provider.createCount, 1);
  await data.service.archive(data.studentId, data.actorId);
  const replacement = await data.service.create(data.studentId, {}, data.actorId);
  assert.notEqual(replacement.sheet.id, active.sheet.id);
  const [counts] = await pool.query<RowDataPacket[]>(
    "SELECT SUM(status='ACTIVE') active_count,SUM(status='ARCHIVED') archived_count FROM student_google_sheets WHERE student_id=?", [data.studentId]);
  assert.equal(Number(counts[0].active_count), 1); assert.equal(Number(counts[0].archived_count), 1);
});

integration("timeout-after-create is recovered by appProperties and retry keeps one spreadsheet", async () => {
  const data = await fixture(); data.provider.timeoutAfterCreate = true;
  await assert.rejects(() => data.service.create(data.studentId, {}, data.actorId), (error: { code?: string }) => error.code === "GOOGLE_NETWORK");
  const result = await data.service.retry(data.studentId, data.actorId);
  assert.equal(result.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
  assert.equal(data.provider.rendered.length, 1);
});

integration("snapshot isolates group attendance and student note", async () => {
  const data = await fixture();
  const [other] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('Học sinh Khác')");
  const [group] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('Nhóm Khối 6','GROUP',2000000,90,'2026-06-01')");
  const enrollments: number[] = [];
  for (const studentId of [data.studentId, other.insertId]) {
    const [enrollment] = await pool.execute<ResultSetHeader>(
      "INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')", [group.insertId, studentId]);
    enrollments.push(enrollment.insertId);
  }
  const [lesson] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_sessions(class_id,class_name_snapshot,class_type_snapshot,session_date,scheduled_start_time,scheduled_end_time,
      status,content,homework,completed_at) VALUES (?,'Nhóm Khối 6','GROUP','2026-07-20','18:00','19:30','COMPLETED','Nội dung chung','Bài tập chung',NOW())`, [group.insertId]);
  for (const [index, enrollmentId] of enrollments.entries()) {
    const [participant] = await pool.execute<ResultSetHeader>(
      "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id,student_name_snapshot) VALUES (?,?,?)",
      [lesson.insertId, enrollmentId, index ? "Học sinh Khác" : "Học sinh Google Test"]);
    await pool.execute(
      `INSERT INTO lesson_attendances(lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition,student_note)
       VALUES (?,?,?,'PRESENT',1,?)`, [lesson.insertId, participant.insertId, enrollmentId, index ? "Ghi chú bí mật của bạn khác" : "Ghi chú đúng học sinh"]);
  }
  const snapshot = await new StudentGoogleSheetRepository().snapshot(data.studentId);
  assert.equal(snapshot.learning.length, 1);
  assert.equal(snapshot.learning[0].studentComment, "Ghi chú đúng học sinh");
  assert.ok(!JSON.stringify(snapshot).includes("bí mật của bạn khác"));
});

integration("DB finalize failure trashes provider resource and leaves retryable error record", async () => {
  class FailingAudit extends AuditRepository { override async record(): Promise<void> { throw new Error("audit failure"); } }
  const repository = new StudentGoogleSheetRepository(new FailingAudit());
  const data = await fixture(repository);
  await assert.rejects(() => data.service.create(data.studentId, {}, data.actorId), /audit failure/);
  assert.equal(data.provider.trashed.length, 1);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT status FROM student_google_sheets WHERE student_id=?", [data.studentId]);
  assert.equal(rows[0].status, "GENERATION_ERROR");
});

test.after(async () => { if (enabled) await pool.end(); });
