import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { createApp } from "../app";
import { AssignmentRepository } from "../repositories/assignment.repository";
import { VocabularyResultsRepository } from "../repositories/vocabulary-results.repository";
import { VocabularyResultsService } from "./vocabulary-results.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
test.after(async () => { if (enabled) await pool.end(); });

integration("V20E aggregates authoritative graded results and creates a source-linked draft", async () => {
  await pool.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers", "learning_attempt_questions", "learning_attempts",
    "learning_access_sessions", "learning_assignment_recipients",
    "learning_assignment_audience_students", "learning_assignment_activities",
    "learning_assignment_items", "learning_assignments", "audit_logs", "students", "users",
  ]) await pool.query(`TRUNCATE TABLE ${table}`);
  await pool.query("SET FOREIGN_KEY_CHECKS=1");
  const [user] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20e','v20e@example.com','hash','V20E')`,
  );
  const [student] = await pool.execute<ResultSetHeader>(
    "INSERT INTO students(full_name,status) VALUES ('Bé An','ACTIVE')",
  );
  const [assignment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignments
      (teacher_user_id,title,audience_type,status,template_code,age_band,
       pass_score,answer_feedback_mode,published_at)
     VALUES (?,'Animals','SELECTED_STUDENTS','CLOSED','CUSTOM','G2_G3',80,
       'IMMEDIATE',UTC_TIMESTAMP())`,
    [user.insertId],
  );
  await pool.execute(
    `INSERT INTO learning_assignment_audience_students(assignment_id,student_id)
     VALUES (?,?)`,
    [assignment.insertId, student.insertId],
  );
  const itemIds: number[] = [];
  for (const [index, word] of ["cat", "dog"].entries()) {
    const [item] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_assignment_items
        (assignment_id,display_order,word,normalized_word,meaning_vi,speech_text,
         tier,illustration_snapshot_json,supports_image_game)
       VALUES (?,?,?,?,?,?,'CORE',JSON_OBJECT('kind','NONE'),FALSE)`,
      [assignment.insertId, index + 1, word, word, `nghĩa ${word}`, word],
    );
    itemIds.push(item.insertId);
  }
  const [activity] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_activities
      (assignment_id,display_order,mechanic,presentation,required,config_json)
     VALUES (?,1,'SELECT_ONE','WORD_PICK_MEANING',TRUE,JSON_OBJECT())`,
    [assignment.insertId],
  );
  const tokenHash = createHash("sha256").update("recipient").digest("hex");
  const [recipient] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_recipients
      (assignment_id,student_id,student_name_snapshot,access_token_hash,assigned_at,completed_at)
     VALUES (?,?,?, ?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
    [assignment.insertId, student.insertId, "Bé An", tokenHash],
  );
  const sessionHash = createHash("sha256").update("session").digest("hex");
  const [session] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_access_sessions
      (assignment_id,recipient_id,session_token_hash,access_version_snapshot,
       expires_at,last_activity_at)
     VALUES (?,?,?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),UTC_TIMESTAMP())`,
    [assignment.insertId, recipient.insertId, sessionHash],
  );
  const [attempt] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempts
      (assignment_id,access_session_id,recipient_id,attempt_number,status,random_seed,
       session_token_hash,session_expires_at,generation_warnings_json,started_at,
       last_activity_at,completed_at,total_questions,graded_question_count,score_percent)
     VALUES (?,?,?,1,'COMPLETED',REPEAT('a',64),?,
       DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY(),UTC_TIMESTAMP(),
       UTC_TIMESTAMP(),UTC_TIMESTAMP(),3,2,50)`,
    [assignment.insertId, session.insertId, recipient.insertId, sessionHash],
  );
  await pool.execute(
    `INSERT INTO learning_attempt_questions
      (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,
       mechanic,presentation,prompt_snapshot_json,options_snapshot_json,
       correct_answer_snapshot_json,graded,status,first_attempt_correct,final_correct,
       retry_count,completed_at)
     VALUES
      (?,?,?,'cat-graded',1,'SELECT_ONE','WORD_PICK_MEANING',JSON_OBJECT(),
       JSON_ARRAY(),JSON_OBJECT(),TRUE,'ANSWERED',TRUE,TRUE,0,UTC_TIMESTAMP()),
      (?,?,?,'dog-graded',2,'SELECT_ONE','WORD_PICK_MEANING',JSON_OBJECT(),
       JSON_ARRAY(),JSON_OBJECT(),TRUE,'ANSWERED',FALSE,FALSE,2,UTC_TIMESTAMP()),
      (?,?,?,'cat-card',3,'EXPLORE_CARD','FLASHCARD',JSON_OBJECT(),
       JSON_ARRAY(),JSON_OBJECT(),FALSE,'ANSWERED',TRUE,TRUE,0,UTC_TIMESTAMP())`,
    [
      attempt.insertId, itemIds[0], activity.insertId,
      attempt.insertId, itemIds[1], activity.insertId,
      attempt.insertId, itemIds[0], activity.insertId,
    ],
  );

  const results = new VocabularyResultsRepository();
  const service = new VocabularyResultsService(results, new AssignmentRepository());
  const started = performance.now();
  const summary = await service.summary(assignment.insertId, user.insertId);
  const words = await service.vocabularyList(assignment.insertId, {
    page: 1, pageSize: 20, sort: "MASTERY", direction: "ASC",
  }, user.insertId);
  const recipients = await service.recipientsList(assignment.insertId, {
    page: 1, pageSize: 20, status: "COMPLETED",
    sort: "LATEST_SCORE", direction: "DESC",
  }, user.insertId);
  const elapsed = performance.now() - started;
  assert.equal(summary.assigned, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.totalAttempts, 1);
  assert.equal(summary.guest.attempts, 0);
  assert.equal(recipients.total, 1);
  assert.equal(recipients.items[0].latestScore, 50);
  assert.equal(words.items.find((word) => word.word === "cat")?.evidence.gradedExposures, 1);
  assert.equal(words.items.find((word) => word.word === "cat")?.exposureCount, 2);
  assert.equal(words.items.find((word) => word.word === "dog")?.mastery, "NEEDS_REVIEW");
  assert.ok(elapsed < 1_500, `result aggregation exceeded local 1500ms budget: ${elapsed}ms`);

  const draft = await service.createReviewDraft(assignment.insertId, {
    assignmentItemIds: [itemIds[1]],
    recipientIds: [recipient.insertId],
  }, user.insertId);
  assert.equal(draft.status, "DRAFT");
  const [draftRows] = await pool.query<RowDataPacket[]>(
    `SELECT status,review_source_assignment_id,published_at
     FROM learning_assignments WHERE id=?`,
    [draft.id],
  );
  assert.equal(draftRows[0].status, "DRAFT");
  assert.equal(Number(draftRows[0].review_source_assignment_id), assignment.insertId);
  assert.equal(draftRows[0].published_at, null);
});

integration("V20E result and review endpoints require teacher authentication", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    for (const [method, route] of [
      ["GET", "/api/vocabulary/assignments/1/results/summary"],
      ["GET", "/api/vocabulary/assignments/1/results/recipients"],
      ["GET", "/api/vocabulary/assignments/1/results/vocabulary"],
      ["GET", "/api/vocabulary/assignments/1/results/recipients/1"],
      ["POST", "/api/vocabulary/assignments/1/review-draft"],
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
      });
      assert.equal(response.status, 401);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});
