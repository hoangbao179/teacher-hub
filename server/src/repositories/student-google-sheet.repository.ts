import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { StudentGoogleSheetInfo } from "@teacher/shared";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import type { StudentGoogleSheetSnapshot } from "../integrations/google/google-integration.types";
import { vocabularyMastery } from "../domain/vocabulary-mastery";
import { AuditRepository } from "./audit.repository";

interface ClaimInput { studentId: number; legacyImportId?: number; fileName: string; rootFolderId: string; templateVersion: string }
export interface SheetClaim { sheet: StudentGoogleSheetInfo; owner: boolean; sourceImportSha256: string | null }

function dateTime(value: unknown): string | null { return value == null ? null : String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "+07:00"); }
function mapSheet(row: RowDataPacket): StudentGoogleSheetInfo {
  const generationStartedAt = dateTime(row.generation_started_at);
  const canRetryGeneration = row.status === "GENERATION_ERROR" || (
    row.status === "CREATING" &&
    generationStartedAt != null &&
    Date.now() - new Date(generationStartedAt).getTime() >= 10 * 60_000
  );
  return { id: Number(row.id), studentId: Number(row.student_id), legacyImportId: row.legacy_import_id == null ? null : Number(row.legacy_import_id),
    fileName: String(row.file_name), webViewUrl: row.web_view_url == null ? null : String(row.web_view_url),
    templateVersion: String(row.template_version), status: row.status, sharingStatus: row.sharing_status,
    lastGeneratedAt: dateTime(row.last_generated_at), lastSyncedAt: dateTime(row.last_synced_at),
    lastSyncError: row.last_sync_error == null ? null : String(row.last_sync_error),
    generationStartedAt, canRetryGeneration, createdAt: dateTime(row.created_at)! };
}

export function academicYear(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return month >= 6 ? `${year}–${year + 1}` : `${year - 1}–${year}`;
}
export function gradeFromClassName(name: string): string {
  const match = name.match(/(?:khối|lớp)\s*([1-9])(?!\d)/i);
  return match ? `Khối ${match[1]}` : "—";
}

export class StudentGoogleSheetRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async get(studentId: number): Promise<StudentGoogleSheetInfo | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM student_google_sheets WHERE student_id=? AND status<>'ARCHIVED'
       ORDER BY FIELD(status,'ACTIVE','CREATING','GENERATION_ERROR'),id DESC LIMIT 1`, [studentId]);
    return rows[0] ? mapSheet(rows[0]) : null;
  }

  async claim(input: ClaimInput, retry: boolean): Promise<SheetClaim> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [students] = await connection.query<RowDataPacket[]>("SELECT id FROM students WHERE id=? FOR UPDATE", [input.studentId]);
      if (!students[0]) throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
      let sha: string | null = null;
      if (input.legacyImportId != null) {
        const [imports] = await connection.query<RowDataPacket[]>(
          "SELECT sha256 FROM legacy_imports WHERE id=? AND student_id=? AND status='APPLIED' FOR UPDATE",
          [input.legacyImportId, input.studentId]);
        if (!imports[0]) throw new AppError(400, "LEGACY_IMPORT_INVALID", "Bản import không thuộc học sinh hoặc chưa Apply.");
        sha = String(imports[0].sha256);
      }
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM student_google_sheets WHERE student_id=? AND status IN ('ACTIVE','CREATING')
         ORDER BY id DESC LIMIT 1 FOR UPDATE`, [input.studentId]);
      if (existingRows[0]) {
        const existing = existingRows[0];
        const staleCreating = existing.status === "CREATING" && retry &&
          existing.generation_started_at != null &&
          new Date(existing.generation_started_at).getTime() <= Date.now() - 10 * 60_000;
        if (!staleCreating) {
          await connection.commit();
          return { sheet: mapSheet(existing), owner: false, sourceImportSha256: existing.source_import_sha256 ?? null };
        }
        await connection.execute(
          `UPDATE student_google_sheets
           SET generation_started_at=NOW(),last_sync_error=NULL,
             legacy_import_id=COALESCE(?,legacy_import_id),
             source_import_sha256=COALESCE(?,source_import_sha256)
           WHERE id=?`,
          [input.legacyImportId ?? null, sha, existing.id],
        );
        const [reclaimed] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM student_google_sheets WHERE id=?", [existing.id],
        );
        await connection.commit();
        return { sheet: mapSheet(reclaimed[0]), owner: true, sourceImportSha256: reclaimed[0].source_import_sha256 ?? null };
      }
      const [failedRows] = retry ? await connection.query<RowDataPacket[]>(
        "SELECT * FROM student_google_sheets WHERE student_id=? AND status='GENERATION_ERROR' ORDER BY id DESC LIMIT 1 FOR UPDATE", [input.studentId]) : [[]];
      let id: number;
      if (retry && failedRows[0]) {
        id = Number(failedRows[0].id);
        await connection.execute(
          `UPDATE student_google_sheets SET status='CREATING',generation_started_at=NOW(),last_sync_error=NULL,legacy_import_id=COALESCE(?,legacy_import_id),
           source_import_sha256=COALESCE(?,source_import_sha256) WHERE id=?`, [input.legacyImportId ?? null, sha, id]);
      } else {
        const [created] = await connection.execute<ResultSetHeader>(
          `INSERT INTO student_google_sheets
            (student_id,legacy_import_id,file_name,root_folder_id,template_version,status,source_import_sha256,generation_started_at)
           VALUES (?,?,?,?,?,'CREATING',?,NOW())`, [input.studentId, input.legacyImportId ?? null, input.fileName,
            input.rootFolderId, input.templateVersion, sha]);
        id = created.insertId;
      }
      const [claimed] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=?", [id]);
      await connection.commit();
      return { sheet: mapSheet(claimed[0]), owner: true, sourceImportSha256: sha };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async finalize(id: number, resource: { spreadsheetId: string; webViewUrl: string; name: string }, actorUserId: number): Promise<StudentGoogleSheetInfo> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=? FOR UPDATE", [id]);
      if (!rows[0] || rows[0].status !== "CREATING") throw new AppError(409, "GOOGLE_SHEET_STATE_CONFLICT", "Trạng thái Google Sheet đã thay đổi.");
      await connection.execute(
        `UPDATE student_google_sheets SET spreadsheet_id=?,web_view_url=?,file_name=?,status='ACTIVE',sharing_status='RESTRICTED',
         last_generated_at=NOW(),last_sync_error=NULL WHERE id=?`, [resource.spreadsheetId, resource.webViewUrl, resource.name, id]);
      await this.audit.record(connection, { actorUserId, action: "STUDENT_GOOGLE_SHEET_CREATED", entityType: "STUDENT_GOOGLE_SHEET", entityId: id,
        newValues: { studentId: Number(rows[0].student_id), status: "ACTIVE", templateVersion: rows[0].template_version } });
      const [updated] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=?", [id]);
      await connection.commit(); return mapSheet(updated[0]);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async fail(id: number, safeMessage: string, spreadsheetId?: string): Promise<void> {
    await pool.execute(
      `UPDATE student_google_sheets SET status='GENERATION_ERROR',last_sync_error=?,spreadsheet_id=COALESCE(?,spreadsheet_id)
       WHERE id=? AND status='CREATING'`, [safeMessage.slice(0, 500), spreadsheetId ?? null, id]);
  }

  async recordRegenerationError(id: number, safeMessage: string): Promise<void> {
    await pool.execute("UPDATE student_google_sheets SET last_sync_error=? WHERE id=? AND status='ACTIVE'",
      [safeMessage.slice(0, 500), id]);
  }

  async regenerated(id: number, actorUserId: number, templateVersion: string, fileName: string): Promise<StudentGoogleSheetInfo> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=? AND status='ACTIVE' FOR UPDATE", [id]);
      if (!rows[0]) throw new AppError(409, "GOOGLE_SHEET_STATE_CONFLICT", "Google Sheet không còn hoạt động.");
      await connection.execute(
        "UPDATE student_google_sheets SET template_version=?,file_name=?,last_generated_at=NOW(),last_sync_error=NULL WHERE id=?",
        [templateVersion, fileName, id],
      );
      await this.audit.record(connection, { actorUserId, action: "STUDENT_GOOGLE_SHEET_REGENERATED", entityType: "STUDENT_GOOGLE_SHEET", entityId: id,
        newValues: { studentId: Number(rows[0].student_id), spreadsheetId: String(rows[0].spreadsheet_id), templateVersion, fileName } });
      const [updated] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=?", [id]);
      await connection.commit(); return mapSheet(updated[0]);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async archive(studentId: number, actorUserId: number): Promise<StudentGoogleSheetInfo> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM student_google_sheets WHERE student_id=? AND status='ACTIVE' ORDER BY id DESC LIMIT 1 FOR UPDATE", [studentId]);
      if (!rows[0]) throw new AppError(404, "GOOGLE_SHEET_NOT_FOUND", "Học sinh chưa có Google Sheet đang hoạt động.");
      await connection.execute("UPDATE student_google_sheets SET status='ARCHIVED',archived_at=NOW() WHERE id=?", [rows[0].id]);
      await this.audit.record(connection, { actorUserId, action: "STUDENT_GOOGLE_SHEET_ARCHIVED", entityType: "STUDENT_GOOGLE_SHEET",
        entityId: Number(rows[0].id), newValues: { studentId, status: "ARCHIVED" } });
      const [updated] = await connection.query<RowDataPacket[]>("SELECT * FROM student_google_sheets WHERE id=?", [rows[0].id]);
      await connection.commit(); return mapSheet(updated[0]);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async snapshot(studentId: number): Promise<StudentGoogleSheetSnapshot> {
    const [students] = await pool.query<RowDataPacket[]>(
      `SELECT s.id,s.full_name,c.name class_name FROM students s
       LEFT JOIN class_enrollments e ON e.student_id=s.id AND e.status IN ('ACTIVE','PAUSED')
       LEFT JOIN classes c ON c.id=e.class_id WHERE s.id=? ORDER BY FIELD(e.status,'ACTIVE','PAUSED') LIMIT 1`, [studentId]);
    if (!students[0]) throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
    const [lessons] = await pool.query<RowDataPacket[]>(
      `SELECT l.id lesson_id,l.session_date,l.lesson_type,
        TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start_time,
        TIME_FORMAT(l.scheduled_end_time,'%H:%i') scheduled_end_time,
        COALESCE(l.class_name_snapshot,c.name) class_name,
        a.attendance_status,a.counts_for_tuition,l.content,l.homework,l.general_comment,a.student_note,l.updated_at,
        tcs.tuition_cycle_id,tcs.sequence_number
       FROM lesson_attendances a JOIN class_enrollments e ON e.id=a.enrollment_id AND e.student_id=?
       JOIN lesson_sessions l ON l.id=a.lesson_session_id AND l.status='COMPLETED' JOIN classes c ON c.id=l.class_id
       LEFT JOIN tuition_cycle_sessions tcs ON tcs.attendance_id=a.id
       ORDER BY l.session_date,COALESCE(l.actual_start_time,l.scheduled_start_time),l.id`, [studentId]);
    const [cycles] = await pool.query<RowDataPacket[]>(
      `SELECT tc.id,tc.cycle_number,tc.status,tc.started_at,COALESCE(tc.reached_target_at,
        (SELECT MAX(l2.session_date) FROM tuition_cycle_sessions t2 JOIN lesson_attendances a2 ON a2.id=t2.attendance_id
         JOIN lesson_sessions l2 ON l2.id=a2.lesson_session_id WHERE t2.tuition_cycle_id=tc.id)) to_date,
        tc.package_price_snapshot,tc.paid_at,tc.payment_method,
        (SELECT COUNT(*) FROM tuition_cycle_sessions items WHERE items.tuition_cycle_id=tc.id) billable_count,
        COALESCE((SELECT GROUP_CONCAT(DISTINCT COALESCE(l3.class_name_snapshot,c3.name) ORDER BY l3.session_date SEPARATOR ' → ')
          FROM tuition_cycle_sessions t3 JOIN lesson_attendances a3 ON a3.id=t3.attendance_id JOIN lesson_sessions l3 ON l3.id=a3.lesson_session_id
          JOIN classes c3 ON c3.id=l3.class_id WHERE t3.tuition_cycle_id=tc.id),c.name) class_names
       FROM tuition_cycles tc JOIN class_enrollments e ON e.id=tc.enrollment_id AND e.student_id=? JOIN classes c ON c.id=e.class_id
       WHERE tc.status<>'CANCELLED' ORDER BY tc.started_at,tc.id`, [studentId]);
    const [attemptRows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id,a.attempt_number,a.graded_question_count,
        a.correct_first_try_count,a.final_correct_count,a.score_percent,
        a.completed_at,a.updated_at,assignment.title,assignment.age_band,
        class.name class_name
       FROM learning_attempts a
       JOIN learning_assignment_recipients recipient
         ON recipient.id=a.recipient_id AND recipient.student_id=?
       JOIN learning_assignments assignment ON assignment.id=a.assignment_id
       LEFT JOIN classes class ON class.id=assignment.class_id
       WHERE a.status='COMPLETED'
       ORDER BY a.completed_at,a.id`,
      [studentId],
    );
    const [attemptWordRows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id attempt_id,item.id assignment_item_id,item.word,
        COUNT(*) exposures,
        SUM(question_item.first_attempt_correct=1) correct_first,
        SUM(question_item.final_correct=1) final_correct
       FROM learning_attempts a
       JOIN learning_assignment_recipients recipient
         ON recipient.id=a.recipient_id AND recipient.student_id=?
       JOIN learning_attempt_questions question
         ON question.attempt_id=a.id AND question.graded=1
       JOIN learning_attempt_question_items question_item
         ON question_item.question_id=question.id
       JOIN learning_assignment_items item
         ON item.id=question_item.assignment_item_id
       WHERE a.status='COMPLETED'
       GROUP BY a.id,item.id,item.word`,
      [studentId],
    );
    const learning = lessons.map((row) => ({ lessonId: Number(row.lesson_id), lessonType: row.lesson_type,
      scheduledStartTime: String(row.scheduled_start_time), scheduledEndTime: String(row.scheduled_end_time),
      academicYear: academicYear(String(row.session_date).slice(0, 10)),
      grade: gradeFromClassName(String(row.class_name)), className: String(row.class_name), date: String(row.session_date).slice(0, 10),
      attendance: row.attendance_status, billable: Boolean(row.counts_for_tuition),
      cycleId: row.tuition_cycle_id == null ? null : Number(row.tuition_cycle_id),
      cycleSequence: row.sequence_number == null ? null : Number(row.sequence_number), content: String(row.content ?? ""),
      homework: String(row.homework ?? ""),
      generalComment: row.attendance_status === "ABSENT" ? "" : String(row.general_comment ?? ""),
      studentComment: String(row.student_note ?? ""), updatedAt: dateTime(row.updated_at)! }));
    const cycleStartIndexes = cycles.map((cycle) =>
      learning.findIndex((row) => row.cycleId === Number(cycle.id)));
    const tuition = cycles.map((cycle, index) => {
      const startIndex = cycleStartIndexes[index];
      const nextStartIndex = cycleStartIndexes.slice(index + 1).find((value) => value >= 0) ?? learning.length;
      const inRange = startIndex >= 0 ? learning.slice(startIndex, nextStartIndex) : [];
      const fromDate = inRange[0]?.date ?? String(cycle.started_at ?? "").slice(0, 10);
      const toDate = inRange.at(-1)?.date ?? String(cycle.to_date ?? fromDate).slice(0, 10);
      return { cycleId: Number(cycle.id), cycleNumber: index + 1, academicYear: fromDate ? academicYear(fromDate) : "—",
        className: String(cycle.class_names), fromDate, toDate, billableCount: Number(cycle.billable_count),
        absentCount: inRange.filter((row) => row.attendance === "ABSENT").length, totalLessonCount: inRange.length,
        packagePrice: Number(cycle.package_price_snapshot), status: cycle.status, paidAt: String(cycle.paid_at ?? "").slice(0, 10),
        paymentMethod: cycle.payment_method ?? "" };
    });
    const currentClass = String(students[0].class_name ?? "—");
    const ageBandLabels: Record<string, string> = {
      PRESCHOOL_G1: "Mầm non – Lớp 1",
      G2_G3: "Lớp 2–3",
      G4_G5: "Lớp 4–5",
      G6_G9: "Lớp 6–9",
    };
    const vocabularyAttempts = attemptRows.map((attempt) => {
      const words = attemptWordRows
        .filter((row) => Number(row.attempt_id) === Number(attempt.id))
        .map((row) => ({
          word: String(row.word),
          mastery: vocabularyMastery({
            gradedExposures: Number(row.exposures),
            correctFirstTry: Number(row.correct_first),
            finalCorrect: Number(row.final_correct),
            abandonedExposures: 0,
          }).status,
        }));
      const reviewWords = words
        .filter((word) => word.mastery === "NEEDS_REVIEW")
        .map((word) => word.word);
      return {
        attemptId: Number(attempt.id),
        completedAt: dateTime(attempt.completed_at)!,
        assignmentTitle: String(attempt.title),
        className: String(attempt.class_name ?? currentClass),
        ageBand: ageBandLabels[String(attempt.age_band)] ?? String(attempt.age_band),
        attemptNumber: Number(attempt.attempt_number),
        scoredQuestionCount: Number(attempt.graded_question_count),
        correctFirstTry: Number(attempt.correct_first_try_count),
        finalCorrect: Number(attempt.final_correct_count),
        scorePercent: attempt.score_percent == null ? null : Number(attempt.score_percent),
        masteredWords: words.filter((word) => word.mastery === "MASTERED").length,
        learningWords: words.filter((word) => word.mastery === "LEARNING").length,
        needsReviewWords: reviewWords.length,
        reviewWordList: reviewWords.join(", "),
        status: "Đã hoàn thành",
        updatedAt: dateTime(attempt.updated_at)!,
      };
    });
    const present = learning.filter((row) => row.attendance === "PRESENT" || row.attendance === "FREE").length;
    const latest = learning.at(-1);
    const currentCycle = tuition.at(-1);
    const tuitionStatus = tuition.some((row) => row.status === "PAYMENT_DUE") ? "Cần thu" : tuition.at(-1)?.status === "PAID" ? "Đã thu" : "Đang tích lũy";
    return { student: { id: Number(students[0].id), fullName: String(students[0].full_name), currentClass,
      currentGrade: gradeFromClassName(currentClass), currentAcademicYear: academicYear(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })) },
      overview: { currentProgress: currentCycle?.billableCount ?? 0, attendanceRate: learning.length ? Math.round(present * 100 / learning.length) : 0,
        latestLesson: latest?.date ?? "—", tuitionStatus,
        latestComment: latest?.attendance === "ABSENT"
          ? latest?.studentComment ?? ""
          : latest?.studentComment || latest?.generalComment || "",
        latestHomework: latest?.homework ?? "", teacher: "Cô Vy" },
      learning,
      tuition,
      vocabularyAttempts,
    };
  }
}
