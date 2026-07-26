import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "./audit.repository";

export type GoogleSheetSyncEventType =
  | "LESSON_UPSERT"
  | "LESSON_REMOVE"
  | "VOCABULARY_ATTEMPT_UPSERT";
export type GoogleSheetSyncStatus = "PENDING" | "PROCESSING" | "RETRY" | "SUCCEEDED" | "DEAD";

export interface GoogleSheetSyncEvent {
  id: number;
  studentId: number;
  entityType: "LESSON" | "VOCABULARY_ATTEMPT";
  entityId: number;
  lessonId: number | null;
  eventType: GoogleSheetSyncEventType;
  revision: number;
  payloadVersion: number;
  attemptCount: number;
}

export interface GoogleSheetSyncSummary {
  pendingCount: number;
  retryCount: number;
  deadCount: number;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
}

function dateTime(value: unknown): string | null {
  if (value == null) return null;
  return String(value).replace(" ", "T") + "+07:00";
}

export class GoogleSheetSyncRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async enqueue(
    connection: PoolConnection,
    studentId: number,
    lessonId: number,
    eventType: GoogleSheetSyncEventType,
  ): Promise<boolean> {
    await connection.execute(
      `UPDATE google_sheet_sync_outbox
       SET status='SUCCEEDED',processed_at=NOW(),locked_at=NULL,locked_by=NULL,
         last_error_code=NULL,last_error_message=NULL
       WHERE student_id=? AND lesson_id=? AND event_type<>?
         AND status IN ('PENDING','PROCESSING','RETRY','DEAD')`,
      [studentId, lessonId, eventType],
    );
    const [result] = await connection.execute(
      `INSERT INTO google_sheet_sync_outbox
        (student_id,entity_type,entity_id,lesson_id,event_type,revision,
         payload_version,status,next_attempt_at)
       SELECT ?,'LESSON',?,?,?,1,1,'PENDING',NOW()
       FROM student_google_sheets
       WHERE student_id=? AND status='ACTIVE' LIMIT 1
       ON DUPLICATE KEY UPDATE revision=revision+1,status='PENDING',attempt_count=0,
         next_attempt_at=NOW(),locked_at=NULL,locked_by=NULL,last_error_code=NULL,
         last_error_message=NULL,processed_at=NULL`,
      [studentId, lessonId, lessonId, eventType, studentId],
    );
    return "affectedRows" in result && Number(result.affectedRows) > 0;
  }

  async enqueueVocabularyAttempt(
    connection: PoolConnection,
    studentId: number,
    attemptId: number,
  ): Promise<boolean> {
    const [result] = await connection.execute(
      `INSERT INTO google_sheet_sync_outbox
        (student_id,entity_type,entity_id,lesson_id,event_type,revision,
         payload_version,status,next_attempt_at)
       SELECT ?,'VOCABULARY_ATTEMPT',?,NULL,'VOCABULARY_ATTEMPT_UPSERT',
         1,2,'PENDING',NOW()
       FROM student_google_sheets
       WHERE student_id=? AND status='ACTIVE' LIMIT 1
       ON DUPLICATE KEY UPDATE revision=revision+1,status='PENDING',
         attempt_count=0,next_attempt_at=NOW(),locked_at=NULL,locked_by=NULL,
         last_error_code=NULL,last_error_message=NULL,processed_at=NULL`,
      [studentId, attemptId, studentId],
    );
    return "affectedRows" in result && Number(result.affectedRows) > 0;
  }

  async enqueueMany(
    connection: PoolConnection,
    studentIds: Iterable<number>,
    lessonId: number,
    eventType: GoogleSheetSyncEventType,
  ): Promise<number> {
    let count = 0;
    for (const studentId of new Set(studentIds))
      if (await this.enqueue(connection, studentId, lessonId, eventType)) count += 1;
    return count;
  }

  async claimBatch(batchSize: number, lockTimeoutMs: number, lockedBy: string): Promise<GoogleSheetSyncEvent[]> {
    const size = Math.max(1, Math.min(200, Math.floor(batchSize)));
    const staleSeconds = Math.max(10, Math.ceil(lockTimeoutMs / 1000));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id,student_id,entity_type,entity_id,lesson_id,event_type,
           revision,payload_version,attempt_count
         FROM google_sheet_sync_outbox
         WHERE ((status IN ('PENDING','RETRY') AND next_attempt_at<=NOW())
           OR (status='PROCESSING' AND locked_at<DATE_SUB(NOW(),INTERVAL ${staleSeconds} SECOND)))
         ORDER BY next_attempt_at,id LIMIT ${size} FOR UPDATE SKIP LOCKED`,
      );
      if (rows.length) {
        const ids = rows.map((row) => Number(row.id));
        await connection.query(
          `UPDATE google_sheet_sync_outbox SET status='PROCESSING',locked_at=NOW(),locked_by=?
           WHERE id IN (${ids.map(() => "?").join(",")})`,
          [lockedBy, ...ids],
        );
      }
      await connection.commit();
      return rows.map((row) => ({
        id: Number(row.id),
        studentId: Number(row.student_id),
        entityType: row.entity_type,
        entityId: Number(row.entity_id),
        lessonId: row.lesson_id == null ? null : Number(row.lesson_id),
        eventType: row.event_type,
        revision: Number(row.revision),
        payloadVersion: Number(row.payload_version),
        attemptCount: Number(row.attempt_count),
      }));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async succeed(event: GoogleSheetSyncEvent, syncedAt: string): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `UPDATE google_sheet_sync_outbox SET status='SUCCEEDED',processed_at=?,locked_at=NULL,
           locked_by=NULL,last_error_code=NULL,last_error_message=NULL
         WHERE id=? AND revision=? AND status='PROCESSING'`,
        [syncedAt.slice(0, 19).replace("T", " "), event.id, event.revision],
      );
      const changed = "affectedRows" in result && Number(result.affectedRows) === 1;
      if (changed)
        await connection.execute(
          `UPDATE student_google_sheets SET last_synced_at=?,last_sync_error=NULL
           WHERE student_id=? AND status='ACTIVE'`,
          [syncedAt.slice(0, 19).replace("T", " "), event.studentId],
        );
      await connection.commit();
      return changed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async fail(
    event: GoogleSheetSyncEvent,
    errorCode: string,
    safeMessage: string,
    retryable: boolean,
    maxAttempts: number,
    delayMs: number,
  ): Promise<boolean> {
    const attempt = event.attemptCount + 1;
    const status: GoogleSheetSyncStatus = retryable && attempt < maxAttempts ? "RETRY" : "DEAD";
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `UPDATE google_sheet_sync_outbox SET status=?,attempt_count=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? MICROSECOND),
           locked_at=NULL,locked_by=NULL,last_error_code=?,last_error_message=?,processed_at=IF(?='DEAD',NOW(),NULL)
         WHERE id=? AND revision=? AND status='PROCESSING'`,
        [status, attempt, Math.max(0, Math.floor(delayMs * 1000)), errorCode.slice(0, 80),
          safeMessage.slice(0, 500), status, event.id, event.revision],
      );
      const changed = "affectedRows" in result && Number(result.affectedRows) === 1;
      if (changed)
        await connection.execute(
          `UPDATE student_google_sheets SET last_sync_error=?
           WHERE student_id=? AND status='ACTIVE'`,
          [safeMessage.slice(0, 500), event.studentId],
        );
      await connection.commit();
      return changed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async summary(studentId: number): Promise<GoogleSheetSyncSummary> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         SUM(status='PENDING' OR status='PROCESSING') pending_count,
         SUM(status='RETRY') retry_count,
         SUM(status='DEAD') dead_count,
         MAX(CASE WHEN status='SUCCEEDED' THEN processed_at END) last_success,
         SUBSTRING_INDEX(GROUP_CONCAT(
           CASE WHEN status IN ('RETRY','DEAD') THEN last_error_message END
           ORDER BY updated_at DESC SEPARATOR '\n'
         ),'\n',1) last_error
       FROM google_sheet_sync_outbox WHERE student_id=?`,
      [studentId],
    );
    const row = rows[0] ?? {};
    return {
      pendingCount: Number(row.pending_count ?? 0),
      retryCount: Number(row.retry_count ?? 0),
      deadCount: Number(row.dead_count ?? 0),
      lastSuccessfulSyncAt: dateTime(row.last_success),
      lastSyncError: row.last_error == null ? null : String(row.last_error),
    };
  }

  async resyncStudent(studentId: number, actorUserId: number): Promise<{
    enqueuedLessonCount: number;
    enqueuedVocabularyAttemptCount: number;
  }> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [sheets] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM student_google_sheets
         WHERE student_id=? AND status='ACTIVE' ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [studentId],
      );
      if (!sheets[0])
        throw new AppError(409, "GOOGLE_SHEET_NOT_ACTIVE", "Học sinh chưa có Google Sheet đang hoạt động.");
      const [lessons] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT l.id
         FROM lesson_sessions l
         JOIN lesson_attendances a ON a.lesson_session_id=l.id
         JOIN class_enrollments e ON e.id=a.enrollment_id
         WHERE e.student_id=? AND l.status='COMPLETED' ORDER BY l.id`,
        [studentId],
      );
      let enqueued = 0;
      for (const lesson of lessons)
        if (await this.enqueue(connection, studentId, Number(lesson.id), "LESSON_UPSERT")) enqueued += 1;
      const [attempts] = await connection.query<RowDataPacket[]>(
        `SELECT attempt.id
         FROM learning_attempts attempt
         JOIN learning_assignment_recipients recipient
           ON recipient.id=attempt.recipient_id AND recipient.student_id=?
         WHERE attempt.status='COMPLETED'
         ORDER BY attempt.id`,
        [studentId],
      );
      let vocabularyAttempts = 0;
      for (const attempt of attempts)
        if (await this.enqueueVocabularyAttempt(
          connection,
          studentId,
          Number(attempt.id),
        )) vocabularyAttempts += 1;
      await this.audit.record(connection, {
        actorUserId,
        action: "STUDENT_GOOGLE_SHEET_RESYNC_ENQUEUED",
        entityType: "STUDENT_GOOGLE_SHEET",
        entityId: Number(sheets[0].id),
        newValues: {
          studentId,
          enqueuedLessonCount: enqueued,
          enqueuedVocabularyAttemptCount: vocabularyAttempts,
        },
      });
      await connection.commit();
      return {
        enqueuedLessonCount: enqueued,
        enqueuedVocabularyAttemptCount: vocabularyAttempts,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
