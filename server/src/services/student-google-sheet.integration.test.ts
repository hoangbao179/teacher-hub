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
import { GoogleSheetSyncRepository } from "../repositories/google-sheet-sync.repository";
import { GoogleSheetSyncWorker } from "../workers/google-sheet-sync.worker";
import { LessonRepository } from "../repositories/lesson.repository";
import { LessonService } from "./lesson.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
const settings = { enabled: true, clientId: "fake", clientSecret: "fake", refreshToken: "fake", rootFolderId: "fake-root",
  ownerLabel: "Cô Vy test", templateVersion: "v1" };

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "google_sheet_sync_outbox", "student_google_sheets",
      "learning_attempt_answers", "learning_attempt_question_items",
      "learning_attempt_questions", "learning_attempts",
      "learning_access_sessions", "learning_assignment_recipients",
      "learning_assignment_audience_students", "learning_assignment_activities",
      "learning_assignment_items", "learning_assignments",
      "monthly_tuition_payments", "lesson_attendances",
      "lesson_session_participants", "lesson_sessions", "enrollment_active_periods", "class_active_periods",
      "class_enrollments", "audit_logs", "students", "classes", "users",
    ])
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

async function seedSnapshotLessons(studentId: number, statuses: Array<"PRESENT" | "ABSENT">) {
  const [firstClass] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('Lớp 5A','ONE_TO_ONE',90,'2026-06-01')",
  );
  const [firstEnrollment] = await pool.execute<ResultSetHeader>(
    "INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')",
    [firstClass.insertId, studentId],
  );
  for (const [index, status] of statuses.entries()) {
    const date = `2026-07-${String(index + 1).padStart(2, "0")}`;
    const [lesson] = await pool.execute<ResultSetHeader>(
      `INSERT INTO lesson_sessions(class_id,class_name_snapshot,class_type_snapshot,session_date,scheduled_start_time,scheduled_end_time,
        status,content,homework,completed_at) VALUES (?,?, 'ONE_TO_ONE',?,'18:00','19:30','COMPLETED','Nội dung','Bài tập',NOW())`,
      [firstClass.insertId, "Lớp 5A", date],
    );
    const [participant] = await pool.execute<ResultSetHeader>(
      "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id,student_name_snapshot) VALUES (?,?,?)",
      [lesson.insertId, firstEnrollment.insertId, "Học sinh Google Test"],
    );
    await pool.execute<ResultSetHeader>(
      `INSERT INTO lesson_attendances(lesson_session_id,participant_id,enrollment_id,attendance_status)
       VALUES (?,?,?,?)`,
      [lesson.insertId, participant.insertId, firstEnrollment.insertId, status],
    );
  }
  return new StudentGoogleSheetRepository().snapshot(studentId);
}

integration("hardening migration narrows attendance enum and adds generation recovery timestamp", async () => {
  const [migrations] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0015_harden_google_before_oauth.sql'",
  );
  assert.equal(migrations.length, 1);
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
       AND ((TABLE_NAME='lesson_attendances' AND COLUMN_NAME='attendance_status')
         OR (TABLE_NAME='student_google_sheets' AND COLUMN_NAME='generation_started_at'))`,
  );
  const attendance = columns.find((row) => row.COLUMN_NAME === "attendance_status");
  assert.equal(attendance?.COLUMN_TYPE, "enum('PRESENT','ABSENT')");
  assert.ok(columns.some((row) => row.COLUMN_NAME === "generation_started_at"));
});

integration("create is concurrent-safe, stable across enrollment and archive allows a new record", async () => {
  const data = await fixture();
  const [first, second] = await Promise.all([
    data.service.create(data.studentId, {}, data.actorId),
    data.service.create(data.studentId, {}, data.actorId),
  ]);
  const active = first.sheet.status === "ACTIVE" ? first : await data.service.retry(data.studentId, data.actorId);
  assert.equal(active.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
  assert.equal(data.provider.lastCreateInput?.appProperties.teacherHubManaged, "true");
  assert.equal(data.provider.lastCreateInput?.appProperties.studentId, String(data.studentId));
  assert.ok(["ACTIVE", "CREATING"].includes(second.sheet.status));
  const [classResult] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('Lớp 7','ONE_TO_ONE',90,'2026-06-01')");
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

integration("regenerate upgrades an existing spreadsheet to the current template version", async () => {
  const data = await fixture();
  const created = await data.service.create(data.studentId, {}, data.actorId);
  await pool.execute("UPDATE student_google_sheets SET template_version='v0' WHERE id=?", [created.sheet.id]);
  const [classResult] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('Lớp 3A','ONE_TO_ONE',90,'2026-06-01')");
  await pool.execute("INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')",
    [classResult.insertId, data.studentId]);

  const regenerated = await data.service.regenerate(data.studentId, data.actorId);

  assert.equal(regenerated.sheet.id, created.sheet.id);
  assert.equal(regenerated.sheet.webViewUrl, created.sheet.webViewUrl);
  assert.equal(regenerated.sheet.templateVersion, settings.templateVersion);
  assert.match(regenerated.sheet.fileName, /Học sinh Google Test - Lớp 3A$/);
  assert.equal(data.provider.resources.get(created.sheet.id)?.name, regenerated.sheet.fileName);
  assert.equal(data.provider.rendered.length, 2);
});

integration("stale CREATING before provider.create is reclaimed after ten minutes", async () => {
  const repository = new StudentGoogleSheetRepository();
  const data = await fixture(repository);
  const claim = await repository.claim({
    studentId: data.studentId, fileName: "Sổ theo dõi - recovery", rootFolderId: "fake-root", templateVersion: "v1",
  }, false);
  assert.equal(claim.owner, true);
  await pool.execute(
    "UPDATE student_google_sheets SET generation_started_at=DATE_SUB(NOW(),INTERVAL 11 MINUTE) WHERE id=?",
    [claim.sheet.id],
  );
  const recovered = await data.service.retry(data.studentId, data.actorId);
  assert.equal(recovered.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
});

integration("fresh CREATING is not reclaimed or sent to the provider", async () => {
  const repository = new StudentGoogleSheetRepository();
  const data = await fixture(repository);
  const claim = await repository.claim({
    studentId: data.studentId, fileName: "Sổ theo dõi - fresh", rootFolderId: "fake-root", templateVersion: "v1",
  }, false);
  const retry = await data.service.retry(data.studentId, data.actorId);
  assert.equal(retry.sheet.id, claim.sheet.id);
  assert.equal(retry.sheet.status, "CREATING");
  assert.equal(data.provider.createCount, 0);
});

integration("stale CREATING after provider.create reuses appProperties resource", async () => {
  const repository = new StudentGoogleSheetRepository();
  const data = await fixture(repository);
  const claim = await repository.claim({
    studentId: data.studentId, fileName: "Sổ theo dõi - created", rootFolderId: "fake-root", templateVersion: "v1",
  }, false);
  await data.provider.create({
    name: claim.sheet.fileName, rootFolderId: "fake-root",
    appProperties: { studentGoogleSheetRecordId: String(claim.sheet.id) },
  });
  await pool.execute(
    "UPDATE student_google_sheets SET generation_started_at=DATE_SUB(NOW(),INTERVAL 11 MINUTE) WHERE id=?",
    [claim.sheet.id],
  );
  const recovered = await data.service.retry(data.studentId, data.actorId);
  assert.equal(recovered.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
  assert.equal(data.provider.rendered.length, 1);
});

integration("stale CREATING before finalize reuses the rendered resource", async () => {
  const repository = new StudentGoogleSheetRepository();
  const data = await fixture(repository);
  const claim = await repository.claim({
    studentId: data.studentId, fileName: "Sổ theo dõi - rendered", rootFolderId: "fake-root", templateVersion: "v1",
  }, false);
  const resource = await data.provider.create({
    name: claim.sheet.fileName, rootFolderId: "fake-root",
    appProperties: { studentGoogleSheetRecordId: String(claim.sheet.id) },
  });
  await data.provider.render(resource, await repository.snapshot(data.studentId), {
    templateVersion: "v1", recordId: claim.sheet.id, generatedAt: new Date().toISOString(),
  });
  await pool.execute(
    "UPDATE student_google_sheets SET generation_started_at=DATE_SUB(NOW(),INTERVAL 11 MINUTE) WHERE id=?",
    [claim.sheet.id],
  );
  const recovered = await data.service.retry(data.studentId, data.actorId);
  assert.equal(recovered.sheet.status, "ACTIVE");
  assert.equal(data.provider.createCount, 1);
  assert.equal(data.provider.rendered.length, 2);
});

integration("concurrent stale retries have one provider owner", async () => {
  const repository = new StudentGoogleSheetRepository();
  const data = await fixture(repository);
  const claim = await repository.claim({
    studentId: data.studentId, fileName: "Sổ theo dõi - concurrent", rootFolderId: "fake-root", templateVersion: "v1",
  }, false);
  await pool.execute(
    "UPDATE student_google_sheets SET generation_started_at=DATE_SUB(NOW(),INTERVAL 11 MINUTE) WHERE id=?",
    [claim.sheet.id],
  );
  data.provider.delayMs = 30;
  const [first, second] = await Promise.all([
    data.service.retry(data.studentId, data.actorId),
    data.service.retry(data.studentId, data.actorId),
  ]);
  assert.equal(data.provider.createCount, 1);
  assert.ok([first.sheet.status, second.sheet.status].includes("ACTIVE"));
  assert.equal(first.sheet.id, second.sheet.id);
});

integration("snapshot isolates group attendance and student note", async () => {
  const data = await fixture();
  const [other] = await pool.execute<ResultSetHeader>("INSERT INTO students(full_name) VALUES ('Học sinh Khác')");
  const [group] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('Nhóm Khối 6','GROUP',90,'2026-06-01')");
  const enrollments: number[] = [];
  for (const studentId of [data.studentId, other.insertId]) {
    const [enrollment] = await pool.execute<ResultSetHeader>(
      "INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')", [group.insertId, studentId]);
    enrollments.push(enrollment.insertId);
  }
  const [lesson] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_sessions(class_id,class_name_snapshot,class_type_snapshot,session_date,scheduled_start_time,scheduled_end_time,
      status,content,homework,general_comment,completed_at) VALUES (?,'Nhóm Khối 6','GROUP','2026-07-20','18:00','19:30','COMPLETED','Nội dung chung','Bài tập chung','Nhận xét chung',NOW())`, [group.insertId]);
  for (const [index, enrollmentId] of enrollments.entries()) {
    const [participant] = await pool.execute<ResultSetHeader>(
      "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id,student_name_snapshot) VALUES (?,?,?)",
      [lesson.insertId, enrollmentId, index ? "Học sinh Khác" : "Học sinh Google Test"]);
    await pool.execute(
      `INSERT INTO lesson_attendances(lesson_session_id,participant_id,enrollment_id,attendance_status,student_note)
       VALUES (?,?,?,'PRESENT',?)`, [lesson.insertId, participant.insertId, enrollmentId, index ? "Ghi chú bí mật của bạn khác" : "Ghi chú đúng học sinh"]);
  }
  const snapshot = await new StudentGoogleSheetRepository().snapshot(data.studentId);
  assert.equal(snapshot.learning.length, 1);
  assert.equal(snapshot.learning[0].studentComment, "Ghi chú đúng học sinh");
  assert.equal(snapshot.learning[0].generalComment, "Nhận xét chung");
  assert.ok(!JSON.stringify(snapshot).includes("bí mật của bạn khác"));
});

integration("outbox is transactional, revision-safe and worker syncs the canonical student row", async () => {
  const data = await fixture();
  const active = await data.service.create(data.studentId, {}, data.actorId);
  const [classResult] = await pool.execute<ResultSetHeader>(
    "INSERT INTO classes(name,class_type,default_duration_minutes,start_date) VALUES ('Lớp Sync','ONE_TO_ONE',90,'2026-06-01')");
  const [enrollment] = await pool.execute<ResultSetHeader>(
    "INSERT INTO class_enrollments(class_id,student_id,joined_at,status) VALUES (?,?,'2026-06-01','ACTIVE')",
    [classResult.insertId, data.studentId]);
  const [lesson] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lesson_sessions(class_id,class_name_snapshot,class_type_snapshot,session_date,scheduled_start_time,scheduled_end_time,
      status,content,homework,general_comment,completed_at)
     VALUES (?,'Lớp Sync','ONE_TO_ONE','2026-07-21','18:00','19:30','COMPLETED','Nội dung','Bài tập','Tiến bộ tốt',NOW())`,
    [classResult.insertId]);
  const [participant] = await pool.execute<ResultSetHeader>(
    "INSERT INTO lesson_session_participants(lesson_session_id,enrollment_id,student_name_snapshot) VALUES (?,?,?)",
    [lesson.insertId, enrollment.insertId, "Học sinh Google Test"]);
  await pool.execute(
    `INSERT INTO lesson_attendances(lesson_session_id,participant_id,enrollment_id,attendance_status,student_note)
     VALUES (?,?,?,'PRESENT','Riêng')`,
    [lesson.insertId, participant.insertId, enrollment.insertId]);

  const outbox = new GoogleSheetSyncRepository();
  const lessonService = new LessonService(
    new LessonRepository(), undefined, outbox,
  );
  await lessonService.updateContent(
    lesson.insertId,
    { content: "Nội dung", homework: "Bài tập", generalComment: "Tiến bộ tốt", note: "Nội bộ" },
    data.actorId,
  );
  let [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status,event_type FROM google_sheet_sync_outbox WHERE student_id=? AND lesson_id=?",
    [data.studentId, lesson.insertId],
  );
  assert.equal(rows[0].status, "PENDING");
  assert.equal(rows[0].event_type, "LESSON_UPSERT");
  await pool.execute("DELETE FROM google_sheet_sync_outbox");

  const rolledBack = await pool.getConnection();
  await rolledBack.beginTransaction();
  await outbox.enqueue(rolledBack, data.studentId, lesson.insertId, "LESSON_UPSERT");
  await rolledBack.rollback();
  rolledBack.release();
  [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM google_sheet_sync_outbox");
  assert.equal(rows.length, 0);

  const committed = await pool.getConnection();
  await committed.beginTransaction();
  await outbox.enqueue(committed, data.studentId, lesson.insertId, "LESSON_UPSERT");
  await committed.commit();
  committed.release();
  const claimed = await outbox.claimBatch(10, 10_000, "stale-worker");
  assert.equal(claimed.length, 1);

  const revised = await pool.getConnection();
  await revised.beginTransaction();
  await outbox.enqueue(revised, data.studentId, lesson.insertId, "LESSON_UPSERT");
  await revised.commit();
  revised.release();
  assert.equal(await outbox.succeed(claimed[0], new Date().toISOString()), false);

  const worker = new GoogleSheetSyncWorker(outbox, new StudentGoogleSheetRepository(), data.provider,
    { enabled: true, intervalMs: 1_000, batchSize: 10, maxAttempts: 8, lockTimeoutMs: 10_000 }, true);
  assert.equal(await worker.runOnce(), 1);
  assert.equal(data.provider.synced.length, 1);
  assert.equal(data.provider.synced[0].row?.generalComment, "Tiến bộ tốt");
  assert.equal(data.provider.synced[0].row?.studentComment, "Riêng");
  [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status,revision FROM google_sheet_sync_outbox WHERE student_id=? AND lesson_id=?",
    [data.studentId, lesson.insertId]);
  assert.equal(rows[0].status, "SUCCEEDED");
  assert.equal(Number(rows[0].revision), 2);
  assert.equal(active.sheet.id > 0, true);
});

integration("legacy vocabulary events are acknowledged without recreating a vocabulary tab", async () => {
  const data = await fixture();
  const active = await data.service.create(data.studentId, {}, data.actorId);
  const [assignment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignments
      (teacher_user_id,title,audience_type,status,template_code,age_band,
       max_attempts,answer_feedback_mode,published_at)
     VALUES (?,'Ôn tập con vật','SELECTED_STUDENTS','PUBLISHED',
       'WORD_RECOGNITION','G2_G3',2,'IMMEDIATE',UTC_TIMESTAMP())`,
    [data.actorId],
  );
  const [item] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_items
      (assignment_id,display_order,word,normalized_word,meaning_vi,speech_text,
       tier,illustration_snapshot_json,supports_image_game)
     VALUES (?,1,'cat','cat','con mèo','cat','CORE',
       JSON_OBJECT('kind','NONE'),FALSE)`,
    [assignment.insertId],
  );
  const [activity] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_activities
      (assignment_id,display_order,mechanic,presentation,required,config_json)
     VALUES (?,1,'SELECT_ONE','WORD_PICK_MEANING',TRUE,JSON_OBJECT())`,
    [assignment.insertId],
  );
  const [recipient] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_recipients
      (assignment_id,student_id,student_name_snapshot,access_token_hash,
       assigned_at,completed_at)
     VALUES (?,?,'Học sinh Google Test',REPEAT('b',64),
       UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
    [assignment.insertId, data.studentId],
  );
  const [session] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_access_sessions
      (assignment_id,recipient_id,session_token_hash,access_version_snapshot,
       expires_at,last_activity_at)
     VALUES (?,?,REPEAT('c',64),1,
       DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),UTC_TIMESTAMP())`,
    [assignment.insertId, recipient.insertId],
  );
  const [attempt] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempts
      (assignment_id,access_session_id,recipient_id,attempt_number,status,
       random_seed,session_token_hash,session_expires_at,
       generation_warnings_json,started_at,last_activity_at,completed_at,
       correct_first_try_count,final_correct_count,total_questions,
       graded_question_count,score_percent)
     VALUES (?,?,?,1,'COMPLETED',REPEAT('d',64),REPEAT('e',64),
       DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY(),
       UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),1,1,1,1,100)`,
    [assignment.insertId, session.insertId, recipient.insertId],
  );
  const [question] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempt_questions
      (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,
       mechanic,presentation,prompt_snapshot_json,options_snapshot_json,
       correct_answer_snapshot_json,graded,question_kind,score_weight,status,
       first_attempt_correct,final_correct,completed_at)
     VALUES (?,?,?,'cat-primary',1,'SELECT_ONE','WORD_PICK_MEANING',
       JSON_OBJECT(),JSON_ARRAY(),JSON_OBJECT(),TRUE,'PRIMARY',1,'ANSWERED',
       TRUE,TRUE,UTC_TIMESTAMP())`,
    [attempt.insertId, item.insertId, activity.insertId],
  );
  await pool.execute(
    `UPDATE learning_attempt_question_items
     SET first_attempt_correct=TRUE,final_correct=TRUE
     WHERE question_id=? AND assignment_item_id=?`,
    [question.insertId, item.insertId],
  );

  const outbox = new GoogleSheetSyncRepository();
  for (let index = 0; index < 2; index += 1) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    await outbox.enqueueVocabularyAttempt(connection, data.studentId, attempt.insertId);
    await connection.commit();
    connection.release();
  }
  const worker = new GoogleSheetSyncWorker(
    outbox,
    new StudentGoogleSheetRepository(),
    data.provider,
    { enabled: true, intervalMs: 1_000, batchSize: 10, maxAttempts: 8, lockTimeoutMs: 10_000 },
    true,
  );
  assert.equal(await worker.runOnce(), 1);
  assert.equal(data.provider.vocabularyRows.has(`fake-sheet-${active.sheet.id}:${attempt.insertId}`), false);
  const [events] = await pool.query<RowDataPacket[]>(
    `SELECT status,revision FROM google_sheet_sync_outbox
     WHERE entity_type='VOCABULARY_ATTEMPT' AND entity_id=?`,
    [attempt.insertId],
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].status, "SUCCEEDED");
  assert.equal(Number(events[0].revision), 2);
});

integration("worker reports a missing spreadsheet without claiming the root folder is missing", async () => {
  const data = await fixture();
  const active = await data.service.create(data.studentId, {}, data.actorId);
  const snapshot = await seedSnapshotLessons(data.studentId, ["PRESENT"]);
  const lessonId = snapshot.learning[0].lessonId;
  data.provider.resources.delete(active.sheet.id);
  const outbox = new GoogleSheetSyncRepository();
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  await outbox.enqueue(connection, data.studentId, lessonId, "LESSON_UPSERT");
  await connection.commit();
  connection.release();
  const worker = new GoogleSheetSyncWorker(outbox, new StudentGoogleSheetRepository(), data.provider,
    { enabled: true, intervalMs: 1_000, batchSize: 10, maxAttempts: 8, lockTimeoutMs: 10_000 }, true);
  assert.equal(await worker.runOnce(), 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status,last_error_code,last_error_message FROM google_sheet_sync_outbox WHERE student_id=? AND lesson_id=?",
    [data.studentId, lessonId],
  );
  assert.equal(rows[0].status, "DEAD");
  assert.equal(rows[0].last_error_code, "SPREADSHEET_MISSING");
  assert.match(String(rows[0].last_error_message), /Google Sheet/);
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
