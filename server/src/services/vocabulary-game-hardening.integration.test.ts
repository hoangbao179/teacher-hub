import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { VocabularyGameRepository } from "../repositories/vocabulary-game.repository";
import { VocabularyGameService } from "./vocabulary-game.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
test.after(async () => { if (enabled) await pool.end(); });

async function clean() {
  await pool.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers", "learning_attempt_question_items", "learning_attempt_questions",
    "learning_attempts", "learning_access_sessions", "learning_assignment_activities",
    "learning_assignment_items", "learning_assignments", "users",
  ]) await pool.query(`TRUNCATE TABLE ${table}`);
  await pool.query("SET FOREIGN_KEY_CHECKS=1");
}

async function baseAssignment() {
  const [user] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('hardening','hardening@example.com','hash','Hardening')`,
  );
  const [assignment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignments
      (teacher_user_id,title,audience_type,public_code,status,template_code,
       age_band,pass_score,answer_feedback_mode,published_at)
     VALUES (?,'Pass score hardening','OPEN_LINK','HARDPASS','PUBLISHED','CUSTOM',
       'G4_G5',80,'IMMEDIATE',UTC_TIMESTAMP())`,
    [user.insertId],
  );
  const itemIds: number[] = [];
  for (const [index, word] of ["cat", "dog", "bird", "fish"].entries()) {
    const [item] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_assignment_items
        (assignment_id,display_order,word,normalized_word,meaning_vi,speech_text,
         tier,illustration_snapshot_json,supports_image_game)
       VALUES (?,?,?,?,?,?,'CORE',JSON_OBJECT('kind','NONE'),FALSE)`,
      [assignment.insertId, index + 1, word, word, `meaning-${word}`, word],
    );
    itemIds.push(item.insertId);
  }
  const [activity] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignment_activities
      (assignment_id,display_order,mechanic,presentation,required,config_json)
     VALUES (?,1,'SELECT_ONE','WORD_PICK_MEANING',TRUE,JSON_OBJECT())`,
    [assignment.insertId],
  );
  return { assignmentId: assignment.insertId, activityId: activity.insertId, itemIds };
}

async function accessAndAttempt(
  assignmentId: number,
  totalQuestions: number,
  gradedQuestions: number,
) {
  const token = randomUUID().repeat(2);
  const hash = createHash("sha256").update(token).digest("hex");
  const [session] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_access_sessions
      (assignment_id,recipient_id,guest_name,session_token_hash,access_version_snapshot,
       expires_at,last_activity_at)
     VALUES (?,NULL,'Guest',?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),UTC_TIMESTAMP())`,
    [assignmentId, hash],
  );
  const [attempt] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempts
      (assignment_id,access_session_id,recipient_id,guest_name,attempt_number,random_seed,
       session_token_hash,session_expires_at,generation_warnings_json,started_at,last_activity_at,
       total_questions,graded_question_count)
     VALUES (?,?,NULL,'Guest',NULL,REPEAT('a',64),?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY),
       JSON_ARRAY(),UTC_TIMESTAMP(),UTC_TIMESTAMP(),?,?)`,
    [assignmentId, session.insertId, hash, totalQuestions, gradedQuestions],
  );
  return { token, attemptId: attempt.insertId };
}

async function completedAttempt(
  fixture: Awaited<ReturnType<typeof baseAssignment>>,
  finalCorrectCount: number,
) {
  const attempt = await accessAndAttempt(fixture.assignmentId, 4, 4);
  for (const [index, itemId] of fixture.itemIds.entries()) {
    const correct = index < finalCorrectCount;
    await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_attempt_questions
        (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,mechanic,
         presentation,prompt_snapshot_json,options_snapshot_json,correct_answer_snapshot_json,
         graded,question_kind,score_weight,status,first_attempt_correct,final_correct,completed_at)
       VALUES (?,?,?, ?,?,'SELECT_ONE','WORD_PICK_MEANING',JSON_OBJECT('instruction','Pick'),
         JSON_ARRAY(),JSON_OBJECT('optionId','correct'),TRUE,'PRIMARY',1,'ANSWERED',?,?,UTC_TIMESTAMP())`,
      [attempt.attemptId, itemId, fixture.activityId, `scored-${attempt.attemptId}-${index}`, index + 1, correct, correct],
    );
  }
  return attempt;
}

integration("completion reads passScore at runtime, is idempotent, and REVIEW persists plus activates adaptive", async () => {
  await clean();
  const fixture = await baseAssignment();
  const service = new VocabularyGameService(new VocabularyGameRepository(), {} as never);

  const score75 = await completedAttempt(fixture, 3);
  const failed = await service.complete(score75.token);
  assert.equal(failed.scorePercent, 75);
  assert.equal(failed.passScore, 80);
  assert.equal(failed.passed, false);
  assert.deepEqual(await service.complete(score75.token), failed);

  const score100 = await completedAttempt(fixture, 4);
  const passed = await service.complete(score100.token);
  assert.equal(passed.scorePercent, 100);
  assert.equal(passed.passScore, 80);
  assert.equal(passed.passed, true);
  assert.deepEqual(await service.complete(score100.token), passed);

  const reviewAttempt = await accessAndAttempt(fixture.assignmentId, 1, 0);
  const [source] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempt_questions
      (attempt_id,assignment_item_id,activity_id,question_key,sequence_number,mechanic,presentation,
       prompt_snapshot_json,options_snapshot_json,correct_answer_snapshot_json,graded,
       question_kind,score_weight,status)
     VALUES (?,?,?,'flash-source',1,'EXPLORE_CARD','FLASHCARD',JSON_OBJECT('instruction','Explore'),
       JSON_ARRAY(),JSON_OBJECT('exposure',TRUE),FALSE,'EXPOSURE',0,'IN_PROGRESS')`,
    [reviewAttempt.attemptId, fixture.itemIds[0], fixture.activityId],
  );
  const [adaptive] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_attempt_questions
      (attempt_id,assignment_item_id,activity_id,question_key,adaptive_source_key,sequence_number,
       mechanic,presentation,prompt_snapshot_json,options_snapshot_json,correct_answer_snapshot_json,
       graded,question_kind,score_weight,status)
     VALUES (?,?,?,'flash-review','flash-source',2,'SELECT_ONE','WORD_PICK_MEANING',
       JSON_OBJECT('instruction','Review'),JSON_ARRAY(),JSON_OBJECT('optionId','correct'),
       TRUE,'REVIEW',0,'CONDITIONAL')`,
    [reviewAttempt.attemptId, fixture.itemIds[0], fixture.activityId],
  );
  await service.answer(reviewAttempt.token, {
    questionId: source.insertId,
    clientAnswerId: randomUUID(),
    answerSequence: 1,
    submittedAnswer: { exposure: true, selfAssessment: "REVIEW" },
  });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.self_assessment,q.status
     FROM learning_attempt_answers a
     JOIN learning_attempt_questions q ON q.id=?
     WHERE a.attempt_question_id=?`,
    [adaptive.insertId, source.insertId],
  );
  assert.equal(rows[0].self_assessment, "REVIEW");
  assert.equal(rows[0].status, "IN_PROGRESS");
});
