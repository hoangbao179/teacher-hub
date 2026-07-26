import type {
  AssignmentRecipientResult,
  AssignmentResultListQuery,
  AssignmentVocabularyResult,
} from "@teacher/shared";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { vocabularyMastery } from "../domain/vocabulary-mastery";

type ResultQuery = Required<Pick<AssignmentResultListQuery, "page" | "pageSize" | "sort" | "direction">>
  & Omit<AssignmentResultListQuery, "page" | "pageSize" | "sort" | "direction">;

interface AssignmentResultOwner extends RowDataPacket {
  id: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  audience_type: "CLASS" | "SELECTED_STUDENTS" | "OPEN_LINK" | null;
  pass_score: number | null;
}

function iso(value: unknown): string | null {
  return value == null ? null : new Date(value as string | Date).toISOString();
}

function percent(correct: number, total: number): number | null {
  return total ? Math.round(correct * 100 / total) : null;
}

export class VocabularyResultsRepository {
  async owner(assignmentId: number, teacherUserId: number): Promise<AssignmentResultOwner> {
    const [rows] = await pool.query<AssignmentResultOwner[]>(
      `SELECT id,status,audience_type,pass_score FROM learning_assignments
       WHERE id=? AND teacher_user_id=? LIMIT 1`,
      [assignmentId, teacherUserId],
    );
    if (!rows[0]) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Không tìm thấy bài tập.");
    if (!rows[0].audience_type)
      throw new AppError(409, "ASSIGNMENT_NOT_PUBLISHED", "Bài nháp chưa có kết quả.");
    return rows[0];
  }

  async recipientRows(assignmentId: number): Promise<AssignmentRecipientResult[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id recipient_id,r.student_id,r.student_name_snapshot,
        COUNT(DISTINCT a.id) attempt_count,
        MIN(a.started_at) started_at,
        MAX(a.completed_at) completed_at,
        CAST(SUBSTRING_INDEX(
          GROUP_CONCAT(a.score_percent ORDER BY a.started_at DESC,a.id DESC),',',1
        ) AS UNSIGNED) latest_score,
        MAX(a.score_percent) best_score,
        MAX(a.last_activity_at) last_activity_at,
        SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) graded_exposures,
        SUM(CASE WHEN q.graded=1 AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) correct_first,
        SUM(CASE WHEN q.graded=1 AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct,
        MAX(CASE WHEN a.status='COMPLETED' THEN 1 ELSE 0 END) has_completed,
        MAX(CASE WHEN a.status='IN_PROGRESS' THEN 1 ELSE 0 END) has_progress
       FROM learning_assignment_recipients r
       LEFT JOIN learning_attempts a
         ON a.recipient_id=r.id AND a.assignment_id=r.assignment_id
       LEFT JOIN learning_attempt_questions q ON q.attempt_id=a.id
       WHERE r.assignment_id=?
       GROUP BY r.id,r.student_id,r.student_name_snapshot`,
      [assignmentId],
    );
    const [reviewRows] = await pool.query<RowDataPacket[]>(
      `SELECT x.recipient_id,COUNT(*) needs_review
       FROM (
         SELECT a.recipient_id,q.assignment_item_id,
           SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) exposures,
           SUM(CASE WHEN q.graded=1 AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct,
           SUM(CASE WHEN q.graded=1 AND a.status='ABANDONED' THEN 1 ELSE 0 END) abandoned
         FROM learning_attempts a
         JOIN learning_attempt_questions q ON q.attempt_id=a.id
         WHERE a.assignment_id=? AND a.recipient_id IS NOT NULL
         GROUP BY a.recipient_id,q.assignment_item_id
       ) x
       WHERE x.exposures>0 AND (x.final_correct<x.exposures OR x.abandoned>0)
       GROUP BY x.recipient_id`,
      [assignmentId],
    );
    const needs = new Map(reviewRows.map((row) => [Number(row.recipient_id), Number(row.needs_review)]));
    return this.mapRecipientRows(rows, needs);
  }

  async recipientPage(assignmentId: number, query: ResultQuery) {
    const where = ["r.assignment_id=?"];
    const params: unknown[] = [assignmentId];
    if (query.search) {
      where.push("r.student_name_snapshot LIKE ?");
      params.push(`%${query.search}%`);
    }
    const statusExpression = `CASE
      WHEN MAX(a.status='COMPLETED')=1 THEN 'COMPLETED'
      WHEN COUNT(DISTINCT a.id)>0 THEN 'IN_PROGRESS'
      ELSE 'NOT_STARTED' END`;
    const having = query.status ? `HAVING ${statusExpression}=?` : "";
    if (query.status) params.push(query.status);
    const order = query.sort === "LAST_ACTIVITY"
      ? "last_activity_at" : query.sort === "COMPLETED_AT"
        ? "completed_at" : query.sort === "LATEST_SCORE"
          ? "latest_score" : query.sort === "FIRST_TRY"
        ? "first_try_percent" : query.sort === "MASTERY"
          ? "needs_review" : "student_name_snapshot";
    const direction = query.direction;
    const grouped = `SELECT r.id recipient_id,r.student_id,r.student_name_snapshot,
        COUNT(DISTINCT a.id) attempt_count,MIN(a.started_at) started_at,
        MAX(a.completed_at) completed_at,MAX(a.last_activity_at) last_activity_at,
        CAST(SUBSTRING_INDEX(
          GROUP_CONCAT(a.score_percent ORDER BY a.started_at DESC,a.id DESC),',',1
        ) AS UNSIGNED) latest_score,MAX(a.score_percent) best_score,
        SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) graded_exposures,
        SUM(CASE WHEN q.graded=1 AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) correct_first,
        SUM(CASE WHEN q.graded=1 AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct,
        ROUND(100*SUM(CASE WHEN q.graded=1 AND q.first_attempt_correct=1 THEN 1 ELSE 0 END)
          /NULLIF(SUM(q.graded=1),0)) first_try_percent,
        COUNT(DISTINCT CASE WHEN q.graded=1
          AND (q.final_correct<>1 OR a.status='ABANDONED')
          THEN q.assignment_item_id END) needs_review,
        MAX(a.status='COMPLETED') has_completed,MAX(a.status='IN_PROGRESS') has_progress
       FROM learning_assignment_recipients r
       LEFT JOIN learning_attempts a
         ON a.recipient_id=r.id AND a.assignment_id=r.assignment_id
       LEFT JOIN learning_attempt_questions q ON q.attempt_id=a.id
       WHERE ${where.join(" AND ")}
       GROUP BY r.id,r.student_id,r.student_name_snapshot ${having}`;
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM (${grouped}) result_rows`,
      params,
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `${grouped} ORDER BY ${order} ${direction},recipient_id ASC LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const needs = new Map(rows.map((row) => [Number(row.recipient_id), Number(row.needs_review)]));
    return {
      items: this.mapRecipientRows(rows, needs),
      total: Number(countRows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private mapRecipientRows(
    rows: RowDataPacket[],
    needs: Map<number, number>,
  ): AssignmentRecipientResult[] {
    return rows.map((row) => {
      const graded = Number(row.graded_exposures ?? 0);
      const first = Number(row.correct_first ?? 0);
      const final = Number(row.final_correct ?? 0);
      const status: AssignmentRecipientResult["status"] = Number(row.has_completed)
        ? "COMPLETED" : Number(row.has_progress) || Number(row.attempt_count)
          ? "IN_PROGRESS" : "NOT_STARTED";
      return {
        recipientId: Number(row.recipient_id),
        studentId: Number(row.student_id),
        studentName: String(row.student_name_snapshot),
        status,
        attemptCount: Number(row.attempt_count),
        startedAt: iso(row.started_at),
        completedAt: iso(row.completed_at),
        latestScore: row.latest_score == null ? null : Number(row.latest_score),
        bestScore: row.best_score == null ? null : Number(row.best_score),
        correctFirstTry: first,
        finalCorrect: final,
        gradedExposures: graded,
        firstTryPercent: percent(first, graded),
        finalCorrectPercent: percent(final, graded),
        needsReviewWords: needs.get(Number(row.recipient_id)) ?? 0,
        lastActivityAt: iso(row.last_activity_at),
      };
    });
  }

  async vocabularyRows(assignmentId: number): Promise<AssignmentVocabularyResult[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.id assignment_item_id,i.word,i.meaning_vi,
        COUNT(DISTINCT CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1
          THEN a.recipient_id END) students_seen,
        SUM(CASE WHEN a.recipient_id IS NOT NULL THEN 1 ELSE 0 END) all_exposures,
        SUM(CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1 THEN 1 ELSE 0 END) exposures,
        SUM(CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1
          AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) correct_first,
        SUM(CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1
          AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct,
        SUM(CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1
          AND a.status='ABANDONED' THEN 1 ELSE 0 END) abandoned,
        SUM(CASE WHEN a.recipient_id IS NOT NULL AND q.graded=1
          THEN q.retry_count ELSE 0 END) retries,
        SUM(CASE WHEN a.recipient_id IS NULL AND q.graded=1 THEN 1 ELSE 0 END) guest_exposures,
        SUM(CASE WHEN a.recipient_id IS NULL AND q.graded=1
          AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) guest_first,
        SUM(CASE WHEN a.recipient_id IS NULL AND q.graded=1
          AND q.final_correct=1 THEN 1 ELSE 0 END) guest_final,
        SUM(CASE WHEN a.recipient_id IS NULL AND q.graded=1
          AND a.status='ABANDONED' THEN 1 ELSE 0 END) guest_abandoned
       FROM learning_assignment_items i
       LEFT JOIN learning_attempt_questions q
         ON q.assignment_item_id=i.id
       LEFT JOIN learning_attempts a
         ON a.id=q.attempt_id AND a.assignment_id=i.assignment_id
       WHERE i.assignment_id=?
       GROUP BY i.id,i.word,i.meaning_vi,i.display_order
       ORDER BY i.display_order`,
      [assignmentId],
    );
    return rows.map((row) => {
      const classified = vocabularyMastery({
        gradedExposures: Number(row.exposures ?? 0),
        correctFirstTry: Number(row.correct_first ?? 0),
        finalCorrect: Number(row.final_correct ?? 0),
        abandonedExposures: Number(row.abandoned ?? 0),
      });
      const guestTotal = Number(row.guest_exposures ?? 0);
      const guestFirst = Number(row.guest_first ?? 0);
      const guestFinal = Number(row.guest_final ?? 0);
      return {
        assignmentItemId: Number(row.assignment_item_id),
        word: String(row.word),
        meaningVi: String(row.meaning_vi),
        studentsSeen: Number(row.students_seen ?? 0),
        exposureCount: Number(row.all_exposures ?? 0),
        retryCount: Number(row.retries ?? 0),
        firstTryErrorPercent: classified.evidence.firstTryPercent == null
          ? null : 100 - classified.evidence.firstTryPercent,
        finalErrorPercent: classified.evidence.finalCorrectPercent == null
          ? null : 100 - classified.evidence.finalCorrectPercent,
        mastery: classified.status,
        evidence: classified.evidence,
        guestEvidence: {
          gradedExposures: guestTotal,
          correctFirstTry: guestFirst,
          finalCorrect: guestFinal,
          abandonedExposures: Number(row.guest_abandoned ?? 0),
          firstTryPercent: percent(guestFirst, guestTotal),
          finalCorrectPercent: percent(guestFinal, guestTotal),
        },
      };
    });
  }

  async guestSummary(assignmentId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT a.id) attempts,
        COUNT(DISTINCT CASE WHEN a.status='COMPLETED' THEN a.id END) completed,
        SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) graded_exposures
       FROM learning_attempts a
       LEFT JOIN learning_attempt_questions q ON q.attempt_id=a.id
       WHERE a.assignment_id=? AND a.recipient_id IS NULL`,
      [assignmentId],
    );
    return {
      attempts: Number(rows[0]?.attempts ?? 0),
      completed: Number(rows[0]?.completed ?? 0),
      gradedExposures: Number(rows[0]?.graded_exposures ?? 0),
    };
  }

  async authoritativeAttemptSummary(assignmentId: number, passScore: number | null) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total_attempts,
        ROUND(AVG(CASE WHEN status='COMPLETED' THEN score_percent END)) average_score,
        COUNT(DISTINCT CASE WHEN status='COMPLETED' AND ? IS NOT NULL
          AND score_percent>=? THEN recipient_id END) passed_count
       FROM learning_attempts
       WHERE assignment_id=? AND recipient_id IS NOT NULL`,
      [passScore, passScore, assignmentId],
    );
    return {
      totalAttempts: Number(rows[0]?.total_attempts ?? 0),
      averageScore: rows[0]?.average_score == null ? null : Number(rows[0].average_score),
      passedCount: passScore == null ? null : Number(rows[0]?.passed_count ?? 0),
    };
  }

  async recipientVocabularyRows(
    assignmentId: number,
    recipientId: number,
  ): Promise<AssignmentVocabularyResult[]> {
    const [exists] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM learning_assignment_recipients WHERE id=? AND assignment_id=? LIMIT 1",
      [recipientId, assignmentId],
    );
    if (!exists[0])
      throw new AppError(404, "ASSIGNMENT_RECIPIENT_NOT_FOUND", "Không tìm thấy người nhận.");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.id assignment_item_id,i.word,i.meaning_vi,
        COUNT(q.id) all_exposures,
        SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) exposures,
        SUM(CASE WHEN q.graded=1 AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) correct_first,
        SUM(CASE WHEN q.graded=1 AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct,
        SUM(CASE WHEN q.graded=1 AND a.status='ABANDONED' THEN 1 ELSE 0 END) abandoned,
        SUM(CASE WHEN q.graded=1 THEN q.retry_count ELSE 0 END) retries
       FROM learning_assignment_items i
       LEFT JOIN learning_attempts a
         ON a.assignment_id=i.assignment_id AND a.recipient_id=?
       LEFT JOIN learning_attempt_questions q
         ON q.assignment_item_id=i.id AND q.attempt_id=a.id
       WHERE i.assignment_id=?
       GROUP BY i.id,i.word,i.meaning_vi,i.display_order
       ORDER BY i.display_order`,
      [recipientId, assignmentId],
    );
    return rows.map((row) => {
      const classified = vocabularyMastery({
        gradedExposures: Number(row.exposures ?? 0),
        correctFirstTry: Number(row.correct_first ?? 0),
        finalCorrect: Number(row.final_correct ?? 0),
        abandonedExposures: Number(row.abandoned ?? 0),
      });
      return {
        assignmentItemId: Number(row.assignment_item_id),
        word: String(row.word),
        meaningVi: String(row.meaning_vi),
        studentsSeen: classified.evidence.gradedExposures ? 1 : 0,
        exposureCount: Number(row.all_exposures ?? 0),
        retryCount: Number(row.retries ?? 0),
        firstTryErrorPercent: classified.evidence.firstTryPercent == null
          ? null : 100 - classified.evidence.firstTryPercent,
        finalErrorPercent: classified.evidence.finalCorrectPercent == null
          ? null : 100 - classified.evidence.finalCorrectPercent,
        mastery: classified.status,
        evidence: classified.evidence,
        guestEvidence: {
          gradedExposures: 0,
          correctFirstTry: 0,
          finalCorrect: 0,
          abandonedExposures: 0,
          firstTryPercent: null,
          finalCorrectPercent: null,
        },
      };
    });
  }

  async recipientAttempts(assignmentId: number, recipientId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id,a.attempt_number,a.status,a.started_at,a.completed_at,a.score_percent,
        SUM(CASE WHEN q.graded=1 THEN 1 ELSE 0 END) graded_exposures,
        SUM(CASE WHEN q.graded=1 AND q.first_attempt_correct=1 THEN 1 ELSE 0 END) correct_first,
        SUM(CASE WHEN q.graded=1 AND q.final_correct=1 THEN 1 ELSE 0 END) final_correct
       FROM learning_attempts a
       LEFT JOIN learning_attempt_questions q ON q.attempt_id=a.id
       WHERE a.assignment_id=? AND a.recipient_id=?
       GROUP BY a.id,a.attempt_number,a.status,a.started_at,a.completed_at,a.score_percent
       ORDER BY a.started_at DESC,a.id DESC LIMIT 50`,
      [assignmentId, recipientId],
    );
    return rows.map((row) => ({
      attemptId: Number(row.id),
      attemptNumber: Number(row.attempt_number),
      status: row.status as "IN_PROGRESS" | "COMPLETED" | "ABANDONED",
      startedAt: iso(row.started_at)!,
      completedAt: iso(row.completed_at),
      scorePercent: row.score_percent == null ? null : Number(row.score_percent),
      gradedExposures: Number(row.graded_exposures ?? 0),
      correctFirstTry: Number(row.correct_first ?? 0),
      finalCorrect: Number(row.final_correct ?? 0),
    }));
  }

  async recipientActivities(assignmentId: number, recipientId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.mechanic,
        COUNT(*) graded_exposures,
        SUM(q.first_attempt_correct=1) correct_first,
        SUM(q.final_correct=1) final_correct,
        SUM(q.retry_count) retry_count
       FROM learning_attempts a
       JOIN learning_attempt_questions q ON q.attempt_id=a.id AND q.graded=1
       WHERE a.assignment_id=? AND a.recipient_id=?
       GROUP BY q.mechanic ORDER BY q.mechanic`,
      [assignmentId, recipientId],
    );
    return rows.map((row) => ({
      mechanic: String(row.mechanic),
      gradedExposures: Number(row.graded_exposures),
      correctFirstTry: Number(row.correct_first ?? 0),
      finalCorrect: Number(row.final_correct ?? 0),
      retryCount: Number(row.retry_count ?? 0),
    }));
  }

  async reviewCandidateItemIds(
    assignmentId: number,
    recipientIds: number[],
  ): Promise<number[]> {
    const placeholders = recipientIds.map(() => "?").join(",");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT q.assignment_item_id
       FROM learning_attempts a
       JOIN learning_attempt_questions q ON q.attempt_id=a.id AND q.graded=1
       WHERE a.assignment_id=? AND a.recipient_id IN (${placeholders})
       GROUP BY q.assignment_item_id
       HAVING SUM(q.final_correct=1)<COUNT(*)
         OR SUM(a.status='ABANDONED')>0`,
      [assignmentId, ...recipientIds],
    );
    return rows.map((row) => Number(row.assignment_item_id));
  }

  paginateRecipients(rows: AssignmentRecipientResult[], query: ResultQuery) {
    let filtered = rows.filter((row) =>
      (!query.search || row.studentName.toLocaleLowerCase("vi").includes(query.search.toLocaleLowerCase("vi")))
      && (!query.status || row.status === query.status));
    const sign = query.direction === "ASC" ? 1 : -1;
    filtered = filtered.sort((a, b) => {
      if (query.sort === "LAST_ACTIVITY")
        return sign * String(a.lastActivityAt ?? "").localeCompare(String(b.lastActivityAt ?? ""));
      if (query.sort === "COMPLETED_AT")
        return sign * String(a.completedAt ?? "").localeCompare(String(b.completedAt ?? ""));
      if (query.sort === "LATEST_SCORE")
        return sign * ((a.latestScore ?? -1) - (b.latestScore ?? -1));
      if (query.sort === "FIRST_TRY")
        return sign * ((a.firstTryPercent ?? -1) - (b.firstTryPercent ?? -1));
      if (query.sort === "MASTERY")
        return sign * (a.needsReviewWords - b.needsReviewWords);
      return sign * a.studentName.localeCompare(b.studentName, "vi");
    });
    return this.page(filtered, query);
  }

  paginateVocabulary(rows: AssignmentVocabularyResult[], query: ResultQuery) {
    let filtered = rows.filter((row) =>
      (!query.search || `${row.word} ${row.meaningVi}`.toLocaleLowerCase("vi")
        .includes(query.search.toLocaleLowerCase("vi")))
      && (!query.mastery || row.mastery === query.mastery));
    const sign = query.direction === "ASC" ? 1 : -1;
    filtered = filtered.sort((a, b) => query.sort === "FIRST_TRY"
      ? sign * ((a.evidence.firstTryPercent ?? -1) - (b.evidence.firstTryPercent ?? -1))
      : query.sort === "MASTERY"
        ? sign * a.mastery.localeCompare(b.mastery)
        : sign * a.word.localeCompare(b.word));
    return this.page(filtered, query);
  }

  private page<T>(rows: T[], query: Pick<ResultQuery, "page" | "pageSize">) {
    return {
      items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
