import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import jwt from "jsonwebtoken";
import type {
  AssignmentDetail,
  UpdateAssignmentDraftRequest,
} from "@teacher/shared";
import { createApp } from "../app";
import { config } from "../config/config";
import { pool } from "../db/pool";
import { AssignmentRepository } from "../repositories/assignment.repository";
import { VocabularyRepository } from "../repositories/vocabulary.repository";
import { AssignmentService, verifyAssignmentToken } from "./assignment.service";
import { VocabularyService } from "./vocabulary.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
test.after(async () => { if (enabled) await pool.end(); });

async function clean() {
  await pool.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers",
    "learning_attempt_question_items",
    "learning_attempt_questions",
    "learning_attempts",
    "learning_access_sessions",
    "learning_assignment_recipients",
    "learning_assignment_audience_students",
    "learning_assignment_activities",
    "learning_assignment_items",
    "learning_assignments",
    "vocabulary_items",
    "vocabulary_sets",
    "vocabulary_media",
    "class_enrollments",
    "classes",
    "students",
    "audit_logs",
    "users",
  ]) await pool.query(`TRUNCATE TABLE ${table}`);
  await pool.query("SET FOREIGN_KEY_CHECKS=1");
}

async function fixture() {
  await clean();
  const [user] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20c','v20c@example.com','hash','V20C')`,
  );
  const [classResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO classes
      (name,class_type,subject,default_package_price,default_duration_minutes,start_date,status)
     VALUES ('V20C class','GROUP','English',800000,90,'2026-07-01','ACTIVE')`,
  );
  const studentIds: number[] = [];
  for (const [index, name] of ["An", "Bình"].entries()) {
    const [student] = await pool.execute<ResultSetHeader>(
      "INSERT INTO students(full_name,status) VALUES (?,'ACTIVE')",
      [name],
    );
    studentIds.push(student.insertId);
    await pool.execute(
      `INSERT INTO class_enrollments
        (class_id,student_id,joined_at,tuition_mode,status)
       VALUES (?,?,'2026-07-01','CLASS_DEFAULT','ACTIVE')`,
      [classResult.insertId, student.insertId],
    );
  }
  return {
    teacherId: user.insertId,
    classId: classResult.insertId,
    studentIds,
  };
}

const items = [
  { displayOrder: 1, word: "cat", meaningVi: "con mèo", tier: "CORE" as const,
    illustration: { kind: "EMOJI" as const, value: "🐱" }, supportsImageGame: true },
  { displayOrder: 2, word: "dog", meaningVi: "con chó", tier: "CORE" as const,
    illustration: { kind: "EMOJI" as const, value: "🐶" }, supportsImageGame: true },
];
const activities = [{
  displayOrder: 1,
  mechanic: "SELECT_ONE" as const,
  presentation: "LISTEN_PICK_IMAGE" as const,
  required: true,
}];

function updateInput(
  assignment: AssignmentDetail,
): UpdateAssignmentDraftRequest {
  return {
    title: assignment.title,
    instruction: assignment.instruction ?? undefined,
    vocabularySetId: assignment.vocabularySetId ?? undefined,
    ageBand: assignment.ageBand,
    audienceType: assignment.audienceType ?? undefined,
    classId: assignment.classId ?? undefined,
    selectedStudentIds: assignment.selectedStudentIds,
    templateCode: assignment.templateCode,
    availableFrom: assignment.availableFrom ?? undefined,
    dueAt: assignment.dueAt ?? undefined,
    maxAttempts: assignment.maxAttempts ?? undefined,
    passScore: assignment.passScore ?? undefined,
    answerFeedbackMode: assignment.answerFeedbackMode,
    shuffleQuestions: assignment.shuffleQuestions,
    items: assignment.items,
    activities: assignment.activities,
    version: assignment.version,
  };
}

function service() {
  return new AssignmentService(
    new AssignmentRepository(),
    "https://tienganhcovy.com",
    { materializeItems: async (values: unknown) => values } as never,
  );
}

integration("V20C migration, class snapshot, concurrency and immutable state work atomically", async () => {
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0018_v20c_vocabulary_assignments.sql'",
  );
  assert.equal(migration.length, 1);
  const data = await fixture();
  const assignments = service();
  const draft = await assignments.create({
    title: "Animals",
    ageBand: "PRESCHOOL_G1",
    audienceType: "CLASS",
    classId: data.classId,
    templateCode: "YOUNG_BEGINNER",
    answerFeedbackMode: "IMMEDIATE",
    shuffleQuestions: true,
    items,
    activities,
  }, data.teacherId);
  assert.equal(draft.status, "DRAFT");
  const updated = await assignments.update(draft.id, {
    ...updateInput(draft),
    title: "Animals reviewed",
    items,
    activities,
  }, data.teacherId);
  assert.equal(updated.version, 2);
  await assert.rejects(
    assignments.update(draft.id, {
      ...updateInput(draft),
      items,
      activities,
    }, data.teacherId),
    (error: unknown) => (error as { code?: string }).code === "ASSIGNMENT_VERSION_CONFLICT",
  );
  const published = await assignments.publish(draft.id, updated.version, data.teacherId);
  assert.equal(published.assignment.status, "PUBLISHED");
  assert.equal(published.shares.length, 2);
  assert.ok(published.shares.every((share) => share.qrSvg.startsWith("<svg")));

  const [recipients] = await pool.query<RowDataPacket[]>(
    "SELECT student_id,access_token_hash FROM learning_assignment_recipients WHERE assignment_id=? ORDER BY student_id",
    [draft.id],
  );
  assert.deepEqual(recipients.map((row) => Number(row.student_id)), data.studentIds);
  for (const share of published.shares) {
    const row = recipients.find((value) => Number(value.student_id) === share.studentId);
    assert.ok(row);
    assert.equal(verifyAssignmentToken(share.accessToken, String(row.access_token_hash)), true);
  }
  const rawTokens = published.shares.map((share) => share.accessToken);
  const [rawMatches] = await pool.query<Array<RowDataPacket & { count: number }>>(
    `SELECT COUNT(*) count FROM learning_assignment_recipients
     WHERE access_token_hash IN (?,?)`,
    rawTokens,
  );
  assert.equal(Number(rawMatches[0].count), 0);
  await assert.rejects(
    assignments.publish(draft.id, updated.version, data.teacherId),
    (error: unknown) => (error as { code?: string }).code === "ASSIGNMENT_ALREADY_PUBLISHED",
  );
  await assert.rejects(
    assignments.update(draft.id, {
      ...updateInput(draft),
      version: published.assignment.version,
      items,
      activities,
    }, data.teacherId),
    (error: unknown) => (error as { code?: string }).code === "ASSIGNMENT_NOT_EDITABLE",
  );
  await pool.execute(
    "UPDATE class_enrollments SET status='ENDED',ended_at='2026-07-26' WHERE student_id=?",
    [data.studentIds[0]],
  );
  assert.equal((await assignments.recipients(draft.id, data.teacherId)).length, 2);
  const rotated = await assignments.regenerateAccess(
    draft.id,
    published.shares[0].recipientId,
    data.teacherId,
  );
  assert.notEqual(rotated.accessToken, published.shares[0].accessToken);
  await assignments.changeDueDate(
    draft.id,
    new Date(Date.now() + 86_400_000).toISOString(),
    data.teacherId,
  );
  await assignments.close(draft.id, data.teacherId);
  assert.equal((await assignments.detail(draft.id, data.teacherId)).status, "CLOSED");
  const duplicate = await assignments.duplicate(draft.id, "Animals copy", data.teacherId);
  assert.equal(duplicate.status, "DRAFT");
  assert.equal(duplicate.publicCode, null);
  assert.equal(duplicate.recipientCount, 0);
});

integration("selected students and open link keep separate recipient semantics", async () => {
  const data = await fixture();
  const assignments = service();
  const selected = await assignments.create({
    title: "Selected",
    ageBand: "PRESCHOOL_G1",
    audienceType: "SELECTED_STUDENTS",
    selectedStudentIds: [data.studentIds[1], data.studentIds[1]],
    templateCode: "WORD_RECOGNITION",
    answerFeedbackMode: "AFTER_COMPLETION",
    shuffleQuestions: false,
    items,
    activities,
  }, data.teacherId);
  const selectedPublished = await assignments.publish(
    selected.id,
    selected.version,
    data.teacherId,
  );
  assert.equal(selectedPublished.shares.length, 1);
  assert.equal(selectedPublished.shares[0].studentId, data.studentIds[1]);

  const open = await assignments.create({
    title: "Open",
    ageBand: "PRESCHOOL_G1",
    audienceType: "OPEN_LINK",
    templateCode: "PRE_TEST_REVIEW",
    answerFeedbackMode: "IMMEDIATE",
    shuffleQuestions: true,
    items,
    activities,
  }, data.teacherId);
  const openPublished = await assignments.publish(open.id, open.version, data.teacherId);
  assert.equal(openPublished.shares.length, 1);
  assert.equal(openPublished.shares[0].studentId, undefined);
  assert.equal((await assignments.recipients(open.id, data.teacherId)).length, 0);
});

integration("V20C teacher routes require auth", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/vocabulary/assignments`,
    );
    assert.equal(response.status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});

integration("PATCH assignment saves an owned vocabulary snapshot and protects attempt history", async () => {
  const data = await fixture();
  const vocabularies = new VocabularyService(new VocabularyRepository());
  const setId = await vocabularies.create({
    title: "Animals source",
    sourceType: "MANUAL",
    ageBand: "G4_G5",
    items,
  }, data.teacherId);
  const set = await vocabularies.setDetail(setId, data.teacherId);
  const assignments = service();
  const draft = await assignments.create({
    title: "Draft before choosing a set",
    ageBand: "G4_G5",
    templateCode: "CUSTOM",
    answerFeedbackMode: "IMMEDIATE",
    shuffleQuestions: true,
    items: [],
    activities: [],
  }, data.teacherId);
  const patch = {
    ...updateInput(draft),
    vocabularySetId: setId,
    title: set.title,
    items: set.items.map((value, index) => ({
      sourceVocabularyItemId: value.id,
      displayOrder: index + 1,
      word: value.word,
      meaningVi: value.meaningVi,
      phonetic: value.phonetic ?? undefined,
      partOfSpeech: value.partOfSpeech ?? undefined,
      exampleEn: value.exampleEn ?? undefined,
      speechText: value.speechText,
      tier: value.tier,
      illustration: value.illustration,
      supportsImageGame: value.supportsImageGame,
      imageSearchTerms: value.imageSearchTerms,
    })),
    activities,
  };
  const token = jwt.sign({
    id: data.teacherId,
    username: "v20c",
    displayName: "V20C",
    role: "TEACHER",
  }, config.jwt.secret, { expiresIn: "5m" });
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(`${base}/api/vocabulary/assignments/${draft.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: AssignmentDetail };
    assert.equal(payload.data.vocabularySetId, setId);
    assert.equal(payload.data.items.length, items.length);
    assert.equal(payload.data.activities.length, activities.length);
    assert.deepEqual(payload.data.items.map((value) => value.word), items.map((value) => value.word));

    const [session] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_access_sessions
        (assignment_id,guest_name,session_token_hash,access_version_snapshot,expires_at,last_activity_at)
       VALUES (?,NULL,REPEAT('a',64),1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),UTC_TIMESTAMP())`,
      [draft.id],
    );
    const [attempt] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_attempts
        (assignment_id,access_session_id,random_seed,session_token_hash,session_expires_at,
         generation_warnings_json,started_at,last_activity_at,total_questions,graded_question_count)
       VALUES (?,?,REPEAT('b',64),REPEAT('c',64),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),
         JSON_ARRAY(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),0,0)`,
      [draft.id, session.insertId],
    );
    await pool.execute(
      `INSERT INTO learning_attempt_questions
        (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,
         mechanic,presentation,prompt_snapshot_json,options_snapshot_json,
         correct_answer_snapshot_json)
       VALUES (?,?,?,'primary-1',1,'SELECT_ONE','LISTEN_PICK_IMAGE',
         JSON_OBJECT(),JSON_ARRAY(),JSON_OBJECT())`,
      [attempt.insertId, payload.data.items[0].id, payload.data.activities[0].id],
    );
    const blocked = await fetch(`${base}/api/vocabulary/assignments/${draft.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, version: payload.data.version }),
    });
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json() as { error: { code: string } }).error.code, "ASSIGNMENT_NOT_EDITABLE");
    assert.equal((await assignments.detail(draft.id, data.teacherId)).items.length, items.length);

    const [other] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users(username,email,password_hash,display_name)
       VALUES ('v20c-other','v20c-other@example.com','hash','Other')`,
    );
    const otherDraft = await assignments.create({
      title: "Other draft",
      ageBand: "G4_G5",
      templateCode: "CUSTOM",
      answerFeedbackMode: "IMMEDIATE",
      shuffleQuestions: true,
      items: [],
      activities: [],
    }, other.insertId);
    await assert.rejects(
      assignments.update(otherDraft.id, {
        ...patch,
        version: otherDraft.version,
      }, other.insertId),
      (error: unknown) => (error as { code?: string }).code === "VOCABULARY_SET_NOT_FOUND",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});
