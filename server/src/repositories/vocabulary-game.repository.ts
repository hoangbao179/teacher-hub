import type {
  AnswerFeedbackMode,
  AssignmentAudienceType,
  GameMechanic,
  GamePresentation,
  LearningAgeBand,
  LearningAttemptStatus,
  PublicAssignmentSummary,
  PublicGameOption,
  PublicGamePrompt,
} from "@teacher/shared";
import { createHash } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import {
  canonicalAnswer,
  isCorrectAnswer,
  type GeneratedQueue,
} from "../services/game-question-generator";
import { GoogleSheetSyncRepository } from "./google-sheet-sync.repository";

interface AssignmentAccessRow extends RowDataPacket {
  id: number;
  public_code: string;
  title: string;
  instruction: string | null;
  age_band: LearningAgeBand;
  audience_type: AssignmentAudienceType;
  available_from: string | null;
  due_at: string | null;
  max_attempts: number | null;
  answer_feedback_mode: AnswerFeedbackMode;
  open_access_token_hash: string | null;
  open_access_revoked_at: string | null;
  open_access_version: number;
  item_count: number;
  activity_count: number;
}

interface AccessSessionRow extends RowDataPacket {
  id: number;
  assignment_id: number;
  recipient_id: number | null;
  guest_name: string | null;
  session_token_hash: string;
  access_version_snapshot: number;
  expires_at: string;
  audience_type: AssignmentAudienceType;
  age_band: LearningAgeBand;
  answer_feedback_mode: AnswerFeedbackMode;
  max_attempts: number | null;
  pass_score: number | null;
  public_code: string;
  student_name_snapshot: string | null;
}

export interface InternalQuestionRow extends RowDataPacket {
  id: number;
  sequence_number: number;
  mechanic: GameMechanic;
  presentation: GamePresentation;
  prompt_snapshot_json: unknown;
  options_snapshot_json: unknown;
  correct_answer_snapshot_json: unknown;
  graded: number;
  question_kind: "PRIMARY" | "REVIEW" | "EXPOSURE";
  score_weight: 0 | 1;
  status: "PENDING" | "IN_PROGRESS" | "ANSWERED" | "SKIPPED" | "CONDITIONAL";
  retry_count: number;
}

export interface InternalAttemptRow extends RowDataPacket {
  id: number;
  assignment_id: number;
  recipient_id: number | null;
  attempt_number: number | null;
  guest_name: string | null;
  session_token_hash: string;
  session_expires_at: string;
  status: LearningAttemptStatus;
  age_band: LearningAgeBand;
  answer_feedback_mode: AnswerFeedbackMode;
  max_attempts: number | null;
  generation_warnings_json: unknown;
  total_questions: number;
  graded_question_count: number;
  correct_first_try_count: number;
  final_correct_count: number;
  score_percent: number | null;
  reward_snapshot_json: unknown;
  student_name_snapshot: string | null;
}

export interface InternalAttemptState {
  attempt: InternalAttemptRow;
  question: InternalQuestionRow | null;
  completedQuestions: number;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return (value ?? fallback) as T;
}

function unavailable(): AppError {
  return new AppError(
    404,
    "PUBLIC_ASSIGNMENT_UNAVAILABLE",
    "Bài học hiện không khả dụng.",
  );
}

function expired(): AppError {
  return new AppError(401, "PUBLIC_SESSION_EXPIRED", "Phiên chơi đã hết hạn.");
}

export class VocabularyGameRepository {
  constructor(
    private readonly googleSheetSync = new GoogleSheetSyncRepository(),
  ) {}

  async summary(publicCode: string): Promise<PublicAssignmentSummary | null> {
    const [rows] = await pool.query<AssignmentAccessRow[]>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM learning_assignment_items i WHERE i.assignment_id=a.id) item_count,
        (SELECT COUNT(*) FROM learning_assignment_activities x WHERE x.assignment_id=a.id) activity_count
       FROM learning_assignments a
       WHERE a.public_code=? AND a.status='PUBLISHED'
         AND (a.available_from IS NULL OR a.available_from<=UTC_TIMESTAMP())
         AND (a.due_at IS NULL OR a.due_at>=UTC_TIMESTAMP())
       LIMIT 1`,
      [publicCode],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      publicCode: row.public_code,
      title: row.title,
      instruction: row.instruction,
      ageBand: row.age_band,
      audienceType: row.audience_type,
      itemCount: Number(row.item_count),
      estimatedMinutes: Math.max(3, Math.ceil(Number(row.item_count) * Math.max(1, Number(row.activity_count)) * 0.45)),
      availableFrom: row.available_from ? new Date(row.available_from).toISOString() : null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    };
  }

  async createAccess(input: {
    publicCode: string;
    accessTokenHash: string;
    sessionTokenHash: string;
    guestName: string | null;
    expiresAt: Date;
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [assignments] = await connection.query<AssignmentAccessRow[]>(
        `SELECT a.*,
          (SELECT COUNT(*) FROM learning_assignment_items i WHERE i.assignment_id=a.id) item_count,
          (SELECT COUNT(*) FROM learning_assignment_activities x WHERE x.assignment_id=a.id) activity_count
         FROM learning_assignments a
         WHERE a.public_code=? AND a.status='PUBLISHED'
           AND (a.available_from IS NULL OR a.available_from<=UTC_TIMESTAMP())
           AND (a.due_at IS NULL OR a.due_at>=UTC_TIMESTAMP())
         LIMIT 1 FOR UPDATE`,
        [input.publicCode],
      );
      const assignment = assignments[0];
      if (!assignment) throw unavailable();

      let recipientId: number | null = null;
      let displayName: string | undefined;
      let accessVersion = Number(assignment.open_access_version);
      let attemptsUsed: number | null = null;
      if (assignment.audience_type === "OPEN_LINK") {
        if (
          assignment.open_access_revoked_at
          || assignment.open_access_token_hash !== input.accessTokenHash
        ) throw new AppError(403, "PUBLIC_ACCESS_DENIED", "Liên kết truy cập không hợp lệ.");
      } else {
        const [recipients] = await connection.query<Array<RowDataPacket & {
          id: number;
          student_name_snapshot: string;
          access_version: number;
        }>>(
          `SELECT id,student_name_snapshot,access_version
           FROM learning_assignment_recipients
           WHERE assignment_id=? AND access_token_hash=? AND token_revoked_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [assignment.id, input.accessTokenHash],
        );
        const recipient = recipients[0];
        if (!recipient)
          throw new AppError(403, "PUBLIC_ACCESS_DENIED", "Liên kết truy cập không hợp lệ.");
        recipientId = Number(recipient.id);
        displayName = recipient.student_name_snapshot;
        accessVersion = Number(recipient.access_version);
        const [counts] = await connection.query<Array<RowDataPacket & { count: number }>>(
          "SELECT COUNT(*) count FROM learning_attempts WHERE recipient_id=?",
          [recipientId],
        );
        attemptsUsed = Number(counts[0]?.count ?? 0);
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_access_sessions
          (assignment_id,recipient_id,guest_name,session_token_hash,
           access_version_snapshot,expires_at,last_activity_at)
         VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())`,
        [
          assignment.id,
          recipientId,
          recipientId ? null : input.guestName,
          input.sessionTokenHash,
          accessVersion,
          input.expiresAt,
        ],
      );
      await connection.commit();
      return {
        id: Number(result.insertId),
        assignmentId: Number(assignment.id),
        audienceType: assignment.audience_type,
        displayName: displayName ?? input.guestName ?? undefined,
        attemptsUsed,
        maxAttempts: recipientId && assignment.max_attempts != null
          ? Number(assignment.max_attempts)
          : null,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async sessionAssignmentCode(sessionHash: string): Promise<string> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await this.lockAccessSession(connection, sessionHash);
      await connection.commit();
      return session.public_code;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async startAttempt(
    sessionHash: string,
    seed: string,
    queue: GeneratedQueue,
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await this.lockAccessSession(connection, sessionHash);
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM learning_attempts WHERE access_session_id=? LIMIT 1",
        [session.id],
      );
      if (existing[0]) {
        await connection.commit();
        return;
      }
      if (!queue.questions.some((question) => question.status === "PENDING"))
        throw new AppError(422, "CONTENT_NOT_PLAYABLE", "Bài học chưa có nội dung chơi phù hợp.");
      let attemptNumber: number | null = null;
      if (session.recipient_id) {
        const [counts] = await connection.query<Array<RowDataPacket & { count: number }>>(
          "SELECT COUNT(*) count FROM learning_attempts WHERE recipient_id=? FOR UPDATE",
          [session.recipient_id],
        );
        attemptNumber = Number(counts[0]?.count ?? 0) + 1;
        if (session.max_attempts != null && attemptNumber > Number(session.max_attempts))
          throw new AppError(409, "ATTEMPT_LIMIT_REACHED", "Con đã dùng hết lượt chơi.");
      }
      const initial = queue.questions.filter((question) => question.status === "PENDING");
      const [attemptResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_attempts
          (assignment_id,access_session_id,recipient_id,guest_name,attempt_number,
           random_seed,session_token_hash,session_expires_at,generation_warnings_json,
           started_at,last_activity_at,total_questions,graded_question_count)
         VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP(),?,?)`,
        [
          session.assignment_id,
          session.id,
          session.recipient_id,
          session.guest_name,
          attemptNumber,
          seed,
          sessionHash,
          session.expires_at,
          JSON.stringify(queue.warnings),
          initial.length,
          initial.reduce((total, question) => total + question.scoreWeight, 0),
        ],
      );
      const attemptId = Number(attemptResult.insertId);
      for (const [index, question] of queue.questions.entries()) {
        await connection.execute(
          `INSERT INTO learning_attempt_questions
            (attempt_id,assignment_item_id,activity_id,question_key,adaptive_source_key,
             sequence_number,mechanic,presentation,prompt_snapshot_json,
             options_snapshot_json,correct_answer_snapshot_json,graded,
             question_kind,score_weight,status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            attemptId,
            question.assignmentItemId,
            question.activityId,
            question.key,
            question.adaptiveSourceKey ?? null,
            index + 1,
            question.mechanic,
            question.presentation,
            JSON.stringify(question.prompt),
            JSON.stringify(question.options),
            JSON.stringify(question.correctAnswer),
            question.graded,
            question.questionKind,
            question.scoreWeight,
            question.status,
          ],
        );
        const questionId = Number((await connection.query<RowDataPacket[]>(
          "SELECT LAST_INSERT_ID() id",
        ))[0][0]?.id);
        for (const [itemIndex, assignmentItemId] of question.assignmentItemIds.entries())
          await connection.execute(
            `INSERT IGNORE INTO learning_attempt_question_items
              (question_id,assignment_item_id,display_order)
             VALUES (?,?,?)`,
            [questionId, assignmentItemId, itemIndex + 1],
          );
      }
      await connection.execute(
        `UPDATE learning_attempt_questions SET status='IN_PROGRESS'
         WHERE attempt_id=? AND status='PENDING'
         ORDER BY sequence_number LIMIT 1`,
        [attemptId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async state(sessionHash: string): Promise<InternalAttemptState> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.lockAccessSession(connection, sessionHash);
      const state = await this.readState(connection, sessionHash, true);
      await connection.commit();
      return state;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createReplayAccess(
    sessionHash: string,
    nextSessionHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await this.lockAccessSession(connection, sessionHash);
      const state = await this.readState(connection, sessionHash, true);
      if (state.attempt.status !== "COMPLETED")
        throw new AppError(409, "ATTEMPT_NOT_PLAYABLE", "Lượt chơi hiện tại chưa hoàn thành.");
      if (
        state.attempt.recipient_id != null
        && state.attempt.max_attempts != null
        && Number(state.attempt.attempt_number) >= Number(state.attempt.max_attempts)
      ) throw new AppError(409, "ATTEMPT_LIMIT_REACHED", "Con đã dùng hết lượt chơi.");
      await connection.execute(
        `INSERT INTO learning_access_sessions
          (assignment_id,recipient_id,guest_name,session_token_hash,
           access_version_snapshot,expires_at,last_activity_at)
         VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())`,
        [
          session.assignment_id,
          session.recipient_id,
          session.guest_name,
          nextSessionHash,
          session.access_version_snapshot,
          expiresAt,
        ],
      );
      await connection.commit();
      return session.public_code;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async answer(input: {
    sessionHash: string;
    questionId: number;
    clientAnswerId: string;
    answerSequence: number;
    submittedAnswer: Record<string, unknown>;
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.lockAccessSession(connection, input.sessionHash);
      const state = await this.readState(connection, input.sessionHash, true);
      const attempt = state.attempt;
      if (attempt.status !== "IN_PROGRESS")
        throw new AppError(409, "ATTEMPT_NOT_PLAYABLE", "Lượt chơi đã kết thúc.");
      const submittedCanonical = canonicalAnswer(input.submittedAnswer);
      const submittedHash = createHash("sha256").update(submittedCanonical).digest("hex");
      const [replays] = await connection.query<Array<RowDataPacket & {
        attempt_id: number;
        attempt_question_id: number;
        submitted_answer_sha256: string;
        response_snapshot_json: unknown;
      }>>(
        `SELECT attempt_id,attempt_question_id,submitted_answer_sha256,response_snapshot_json
         FROM learning_attempt_answers WHERE client_answer_id=? LIMIT 1`,
        [input.clientAnswerId],
      );
      if (replays[0]) {
        if (
          Number(replays[0].attempt_id) !== Number(attempt.id)
          ||
          Number(replays[0].attempt_question_id) !== input.questionId
          || replays[0].submitted_answer_sha256 !== submittedHash
        ) throw new AppError(
          409,
          "ANSWER_IDEMPOTENCY_CONFLICT",
          "Mã câu trả lời đã được dùng cho nội dung khác.",
        );
        await connection.commit();
        return {
          ...parseJson<Record<string, unknown>>(replays[0].response_snapshot_json, {}),
          idempotent: true,
        };
      }
      const question = state.question;
      if (!question || Number(question.id) !== input.questionId)
        throw new AppError(409, "QUESTION_NOT_CURRENT", "Đây không phải câu hỏi hiện tại.");
      const expectedSequence = Number(question.retry_count) + 1;
      if (input.answerSequence !== expectedSequence)
        throw new AppError(409, "ANSWER_SEQUENCE_CONFLICT", "Thứ tự trả lời không hợp lệ.");

      const correctSnapshot = parseJson<Record<string, unknown>>(
        question.correct_answer_snapshot_json,
        {},
      );
      const correct = isCorrectAnswer(input.submittedAnswer, correctSnapshot);
      const firstAttemptCorrect = correct && expectedSequence === 1;
      const immediateRetry = attempt.answer_feedback_mode === "IMMEDIATE"
        && Boolean(question.graded) && !correct && expectedSequence < 2;
      const finalCorrect = correct;
      const submittedPairs = Array.isArray(input.submittedAnswer.pairs)
        ? input.submittedAnswer.pairs as Array<{ leftId?: unknown; rightId?: unknown }>
        : [];
      const expectedPairs = Array.isArray(correctSnapshot.pairs)
        ? correctSnapshot.pairs as Array<{
          assignmentItemId?: unknown;
          leftId?: unknown;
          rightId?: unknown;
        }>
        : [];
      const [questionItems] = await connection.query<RowDataPacket[]>(
        `SELECT assignment_item_id,first_attempt_correct,retry_count
         FROM learning_attempt_question_items
         WHERE question_id=? FOR UPDATE`,
        [question.id],
      );
      for (const itemRow of questionItems) {
        const assignmentItemId = Number(itemRow.assignment_item_id);
        const expectedPair = expectedPairs.find(
          (pair) => Number(pair.assignmentItemId) === assignmentItemId,
        );
        const itemCorrect = expectedPair
          ? submittedPairs.some((pair) =>
            pair.leftId === expectedPair.leftId
            && pair.rightId === expectedPair.rightId)
          : correct;
        const itemRetryCount = expectedSequence > 1
          && !Boolean(itemRow.first_attempt_correct)
          ? Math.max(Number(itemRow.retry_count), expectedSequence - 1)
          : Number(itemRow.retry_count);
        await connection.execute(
          `UPDATE learning_attempt_question_items
           SET first_attempt_correct=CASE
               WHEN ?=1 THEN ? ELSE first_attempt_correct END,
             final_correct=CASE
               WHEN final_correct=1 OR ?=1 THEN 1 ELSE 0 END,
             retry_count=?
           WHERE question_id=? AND assignment_item_id=?`,
          [
            expectedSequence,
            itemCorrect,
            itemCorrect,
            itemRetryCount,
            question.id,
            assignmentItemId,
          ],
        );
      }
      if (immediateRetry) {
        await connection.execute(
          "UPDATE learning_attempt_questions SET retry_count=? WHERE id=?",
          [expectedSequence, question.id],
        );
      } else {
        await connection.execute(
          `UPDATE learning_attempt_questions
           SET status='ANSWERED',first_attempt_correct=?,
             final_correct=?,retry_count=?,completed_at=UTC_TIMESTAMP()
           WHERE id=?`,
          [firstAttemptCorrect, finalCorrect, expectedSequence - 1, question.id],
        );
        if (question.graded) {
          const [adaptives] = await connection.query<Array<RowDataPacket & {
            id: number;
          }>>(
            `SELECT id FROM learning_attempt_questions
             WHERE attempt_id=? AND adaptive_source_key=(
               SELECT question_key FROM learning_attempt_questions WHERE id=?
             ) AND status='CONDITIONAL' FOR UPDATE`,
            [attempt.id, question.id],
          );
          if (adaptives[0]) {
            if (correct) {
              await connection.execute(
                `UPDATE learning_attempt_questions
                 SET status='SKIPPED',skip_reason='SOURCE_CORRECT' WHERE id=?`,
                [adaptives[0].id],
              );
            } else {
              await connection.execute(
                "UPDATE learning_attempt_questions SET status='PENDING' WHERE id=?",
                [adaptives[0].id],
              );
              await connection.execute(
                `UPDATE learning_attempts
                 SET total_questions=total_questions+1 WHERE id=?`,
                [attempt.id],
              );
            }
          }
        }
        await connection.execute(
          `UPDATE learning_attempt_questions SET status='IN_PROGRESS'
           WHERE attempt_id=? AND status='PENDING'
           ORDER BY sequence_number LIMIT 1`,
          [attempt.id],
        );
      }
      const revealFeedback = attempt.answer_feedback_mode === "IMMEDIATE";
      const response = {
        clientAnswerId: input.clientAnswerId,
        questionId: input.questionId,
        isCorrect: revealFeedback ? correct : null,
        firstAttemptCorrect: revealFeedback ? firstAttemptCorrect : null,
        finalCorrect: revealFeedback ? finalCorrect : null,
        retryCount: immediateRetry ? expectedSequence : expectedSequence - 1,
        idempotent: false,
        shouldRetry: immediateRetry,
        feedback: {
          tone: revealFeedback && correct
            ? "POSITIVE" : immediateRetry ? "TRY_AGAIN" : "CONTINUE",
          message: !revealFeedback
            ? "Cô đã ghi nhận câu trả lời của con."
            : correct
            ? "Chính xác! Giỏi lắm!"
            : immediateRetry ? "Gần đúng rồi, con thử lại nhé!" : "Mình cùng sang câu tiếp theo nhé!",
        },
      };
      await connection.execute(
        `INSERT INTO learning_attempt_answers
          (attempt_id,attempt_question_id,client_answer_id,answer_sequence,
           submitted_answer_json,submitted_answer_sha256,is_correct,
           response_snapshot_json,submitted_at)
         VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,
        [
          attempt.id,
          question.id,
          input.clientAnswerId,
          expectedSequence,
          submittedCanonical,
          submittedHash,
          correct,
          JSON.stringify(response),
        ],
      );
      await connection.execute(
        `UPDATE learning_attempts SET last_activity_at=UTC_TIMESTAMP(),
          session_expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR),version=version+1
         WHERE id=?`,
        [attempt.id],
      );
      await connection.commit();
      return response;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async complete(sessionHash: string) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.lockAccessSession(connection, sessionHash);
      const state = await this.readState(connection, sessionHash, true);
      if (state.attempt.status === "COMPLETED") {
        const previous = parseJson<Record<string, unknown>>(
          state.attempt.reward_snapshot_json,
          {},
        );
        const normalized = {
          ...previous,
          ageBand: previous.ageBand ?? state.attempt.age_band,
          resultMode: previous.resultMode ?? (
            ["PRESCHOOL_G1", "G2_G3"].includes(state.attempt.age_band)
              ? "CHILD_REWARD"
              : "SCORE"
          ),
          reviewWords: Array.isArray(previous.reviewWords)
            ? previous.reviewWords
            : [],
        };
        await connection.commit();
        return normalized;
      }
      if (state.question)
        throw new AppError(409, "ATTEMPT_INCOMPLETE", "Con vẫn còn câu hỏi chưa hoàn thành.");
      const [stats] = await connection.query<Array<RowDataPacket & {
        scored: number;
        first_try: number;
        final_correct: number;
      }>>(
        `SELECT
           SUM(score_weight) scored,
           SUM(score_weight=1 AND first_attempt_correct=1) first_try,
           SUM(score_weight=1 AND final_correct=1) final_correct
         FROM learning_attempt_questions WHERE attempt_id=?`,
        [state.attempt.id],
      );
      const graded = Number(state.attempt.graded_question_count);
      const firstTry = Number(stats[0]?.first_try ?? 0);
      const finalCorrect = Number(stats[0]?.final_correct ?? 0);
      const score = graded ? Math.round((finalCorrect / graded) * 100) : null;
      const stars = score == null ? 3 : score >= 85 ? 3 : score >= 60 ? 2 : 1;
      const reward = {
        attemptId: Number(state.attempt.id),
        status: "COMPLETED",
        stars,
        sticker: stars === 3 ? "🌟" : stars === 2 ? "🦋" : "🌱",
        message: stars === 3
          ? "Xuất sắc! Con đã chinh phục bài học!"
          : "Con đã hoàn thành rồi. Mỗi lần chơi là một lần tiến bộ!",
        ageBand: state.attempt.age_band,
        resultMode: ["PRESCHOOL_G1", "G2_G3"].includes(state.attempt.age_band)
          ? "CHILD_REWARD" : "SCORE",
        gradedExposureCount: graded,
        firstTryCorrectCount: firstTry,
        finalCorrectCount: finalCorrect,
        scorePercent: score,
        canPlayAgain: state.attempt.recipient_id == null
          || state.attempt.max_attempts == null
          || Number(state.attempt.attempt_number) < Number(state.attempt.max_attempts),
        reviewWords: [] as Array<{ word: string; meaningVi: string }>,
      };
      const [reviewRows] = await connection.query<RowDataPacket[]>(
        `SELECT i.word,i.meaning_vi
         FROM learning_attempt_question_items qi
         JOIN learning_attempt_questions q ON q.id=qi.question_id
         JOIN learning_assignment_items i ON i.id=qi.assignment_item_id
         WHERE q.attempt_id=? AND q.graded=1
         GROUP BY i.id,i.word,i.meaning_vi
         HAVING SUM(qi.final_correct=1)<COUNT(*)
         ORDER BY MIN(i.display_order)`,
        [state.attempt.id],
      );
      reward.reviewWords = reviewRows.map((row) => ({
        word: String(row.word),
        meaningVi: String(row.meaning_vi),
      }));
      await connection.execute(
        `UPDATE learning_attempts
         SET status='COMPLETED',completed_at=UTC_TIMESTAMP(),
           correct_first_try_count=?,correct_after_retry_count=?,
           final_correct_count=?,score_percent=?,
           reward_snapshot_json=?,version=version+1 WHERE id=?`,
        [
          firstTry,
          Math.max(0, finalCorrect - firstTry),
          finalCorrect,
          score,
          JSON.stringify(reward),
          state.attempt.id,
        ],
      );
      if (state.attempt.recipient_id) {
        await connection.execute(
          `UPDATE learning_assignment_recipients SET completed_at=UTC_TIMESTAMP()
           WHERE id=? AND completed_at IS NULL`,
          [state.attempt.recipient_id],
        );
        const [recipients] = await connection.query<RowDataPacket[]>(
          `SELECT student_id FROM learning_assignment_recipients
           WHERE id=? LIMIT 1`,
          [state.attempt.recipient_id],
        );
        if (recipients[0])
          await this.googleSheetSync.enqueueVocabularyAttempt(
            connection,
            Number(recipients[0].student_id),
            Number(state.attempt.id),
          );
      }
      await connection.commit();
      return reward;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async lockAccessSession(
    connection: PoolConnection,
    sessionHash: string,
  ): Promise<AccessSessionRow> {
    const [rows] = await connection.query<AccessSessionRow[]>(
      `SELECT s.*,a.audience_type,a.age_band,a.answer_feedback_mode,
        a.max_attempts,a.pass_score,a.public_code,r.student_name_snapshot
       FROM learning_access_sessions s
       JOIN learning_assignments a ON a.id=s.assignment_id
       LEFT JOIN learning_assignment_recipients r ON r.id=s.recipient_id
       WHERE s.session_token_hash=? AND s.revoked_at IS NULL
         AND s.expires_at>UTC_TIMESTAMP()
         AND a.status='PUBLISHED'
         AND (a.available_from IS NULL OR a.available_from<=UTC_TIMESTAMP())
         AND (a.due_at IS NULL OR a.due_at>=UTC_TIMESTAMP())
         AND (
           (s.recipient_id IS NULL
             AND a.audience_type='OPEN_LINK'
             AND a.open_access_revoked_at IS NULL
             AND s.access_version_snapshot=a.open_access_version)
           OR
           (s.recipient_id IS NOT NULL
             AND r.token_revoked_at IS NULL
             AND s.access_version_snapshot=r.access_version)
         )
       LIMIT 1 FOR UPDATE`,
      [sessionHash],
    );
    if (!rows[0]) throw expired();
    const nextExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await connection.execute(
      `UPDATE learning_access_sessions
       SET last_activity_at=UTC_TIMESTAMP(),expires_at=? WHERE id=?`,
      [nextExpiry, rows[0].id],
    );
    await connection.execute(
      `UPDATE learning_attempts
       SET last_activity_at=UTC_TIMESTAMP(),session_expires_at=?
       WHERE access_session_id=? AND status='IN_PROGRESS'`,
      [nextExpiry, rows[0].id],
    );
    rows[0].expires_at = nextExpiry.toISOString().slice(0, 19).replace("T", " ");
    return rows[0];
  }

  private async readState(
    connection: PoolConnection,
    sessionHash: string,
    lock: boolean,
  ): Promise<InternalAttemptState> {
    const [attempts] = await connection.query<InternalAttemptRow[]>(
      `SELECT t.*,a.age_band,a.answer_feedback_mode,a.max_attempts,
        r.student_name_snapshot
       FROM learning_attempts t
       JOIN learning_assignments a ON a.id=t.assignment_id
       LEFT JOIN learning_assignment_recipients r ON r.id=t.recipient_id
       WHERE t.session_token_hash=? LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [sessionHash],
    );
    if (!attempts[0])
      throw new AppError(404, "ATTEMPT_NOT_FOUND", "Chưa bắt đầu lượt chơi.");
    const [questions] = await connection.query<InternalQuestionRow[]>(
      `SELECT * FROM learning_attempt_questions
       WHERE attempt_id=? AND status='IN_PROGRESS' LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [attempts[0].id],
    );
    const [counts] = await connection.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) count FROM learning_attempt_questions
       WHERE attempt_id=? AND status='ANSWERED'`,
      [attempts[0].id],
    );
    return {
      attempt: attempts[0],
      question: questions[0] ?? null,
      completedQuestions: Number(counts[0]?.count ?? 0),
    };
  }
}

export function publicQuestion(row: InternalQuestionRow) {
  return {
    id: Number(row.id),
    sequenceNumber: Number(row.sequence_number),
    mechanic: row.mechanic,
    presentation: row.presentation,
    prompt: parseJson<PublicGamePrompt>(row.prompt_snapshot_json, { instruction: "" }),
    options: parseJson<PublicGameOption[]>(row.options_snapshot_json, []),
    graded: Boolean(row.graded),
    questionKind: row.question_kind,
    scoreWeight: Number(row.score_weight) as 0 | 1,
    answerSequence: Number(row.retry_count) + 1,
    status: row.status as "PENDING" | "IN_PROGRESS",
  };
}

export function internalJson<T>(value: unknown, fallback: T): T {
  return parseJson(value, fallback);
}
