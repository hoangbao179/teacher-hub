import type {
  LegacyAcademicPeriodDecision,
  LegacyClassMapping,
  LegacyImportApplyResult,
  LegacyImportLessonMatchDecision,
  LegacyImportPaymentDecision,
  LegacyImportPreview,
  LegacyImportRowDecision,
} from "@teacher/shared";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import type { ResolvedLegacyImportRow } from "../domain/legacy-import-decisions";
import { lessonTimes } from "../domain/legacy-reconciliation-engine";
import { AuditRepository } from "./audit.repository";

interface ApplyInput {
  studentId: number;
  actorUserId: number;
  filename: string;
  fileSize: number;
  sha256: string;
  preview: LegacyImportPreview;
  rows: ResolvedLegacyImportRow[];
}

interface ApplyCounts {
  lessons: number;
  matchedLessons: number;
  attendances: number;
  classes: number;
  enrollments: number;
  cycles: number;
}

interface PeriodRuntime {
  id: string;
  fromDate: string;
  toDate: string | null;
  mapping: LegacyClassMapping;
  gradeLevel: number;
  dataFromDate: string;
  dataToDate: string;
  classId?: number;
  enrollmentId?: number;
}

function dateOnly(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function minutesBetween(start: string, end: string): number {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

function isBillable(status: string): boolean {
  return status === "PRESENT";
}

function serialized(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export class LegacyImportRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async enrichPreview(preview: LegacyImportPreview): Promise<LegacyImportPreview> {
    const periodClass = new Map(preview.academicPeriods.map((period) => [period.id,
      period.proposedClassMapping.type === "CREATE_CLOSED_CLASS" ? null : period.proposedClassMapping.classId]));
    const periodForDate = (date: string) => preview.academicPeriods.find((period) =>
      period.fromDate <= date && (period.toDate == null || period.toDate >= date));
    const rows = await Promise.all(preview.rows.map(async (row) => {
      if (row.rowType !== "LESSON" || typeof row.normalizedValues.date !== "string" ||
          typeof row.normalizedValues.startTime !== "string" || typeof row.normalizedValues.endTime !== "string") return row;
      const period = periodForDate(row.normalizedValues.date);
      const classId = period ? periodClass.get(period.id) : null;
      if (!classId) return row;
      const [exact] = await pool.query<RowDataPacket[]>(
        `SELECT l.id,l.content,l.homework,a.id attendance_id
         FROM lesson_sessions l
         LEFT JOIN lesson_session_participants p ON p.lesson_session_id=l.id
         LEFT JOIN class_enrollments e ON e.id=p.enrollment_id AND e.student_id=?
         LEFT JOIN lesson_attendances a ON a.participant_id=p.id AND e.id IS NOT NULL
         WHERE l.class_id=? AND l.session_date=? AND l.scheduled_start_time=? AND l.scheduled_end_time=?
           AND l.status='COMPLETED'
         ORDER BY l.id LIMIT 1`,
        [preview.student.id, classId, row.normalizedValues.date, row.normalizedValues.startTime, row.normalizedValues.endTime],
      );
      const issueCodes = [...row.issueCodes];
      const supportedActions = [...row.supportedActions];
      const normalizedValues = { ...row.normalizedValues };
      if (exact[0]) {
        normalizedValues.existingLessonId = Number(exact[0].id);
        if (exact[0].attendance_id != null && !issueCodes.includes("DUPLICATE_ROW")) {
          issueCodes.push("DUPLICATE_ROW");
          supportedActions.push("SKIP");
        }
        const contentConflict = (String(exact[0].content ?? "").trim() !== String(row.normalizedValues.content ?? "").trim()) ||
          (String(exact[0].homework ?? "").trim() !== String(row.normalizedValues.homework ?? "").trim());
        if (contentConflict) {
          issueCodes.push("LESSON_CONTENT_CONFLICT");
          supportedActions.push("KEEP_EXISTING_LESSON", "USE_IMPORTED_LESSON", "EDIT_LESSON_CONTENT");
        }
      } else {
        const [near] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM lesson_sessions
           WHERE class_id=? AND session_date=? AND status='COMPLETED'
             AND ABS(TIME_TO_SEC(TIMEDIFF(scheduled_start_time,?)))<=1800
           ORDER BY ABS(TIME_TO_SEC(TIMEDIFF(scheduled_start_time,?))),id LIMIT 1`,
          [classId, row.normalizedValues.date, row.normalizedValues.startTime, row.normalizedValues.startTime],
        );
        if (near[0]) {
          normalizedValues.nearLessonId = Number(near[0].id);
          issueCodes.push("NEAR_LESSON_MATCH");
          supportedActions.push("MATCH_EXISTING_LESSON", "CREATE_LESSON", "SKIP");
        }
      }
      const status = issueCodes.length
        ? issueCodes.some((issue) => issue === "INVALID_DATE" || issue === "INVALID_TIME" || issue === "STUDENT_MISMATCH")
          ? "BLOCKED" as const : "NEEDS_REVIEW" as const
        : "VALID" as const;
      return { ...row, normalizedValues, issueCodes: [...new Set(issueCodes)],
        supportedActions: [...new Set(supportedActions)], status };
    }));
    const summary = { ...preview.summary,
      validRowCount: rows.filter((row) => row.status === "VALID").length,
      needsReviewRowCount: rows.filter((row) => row.status === "NEEDS_REVIEW").length,
      blockedRowCount: rows.filter((row) => row.status === "BLOCKED").length,
      unresolvedIssueCount: rows.filter((row) => row.status === "NEEDS_REVIEW" || row.status === "BLOCKED").length,
    };
    return { ...preview, rows, summary };
  }

  async apply(input: ApplyInput): Promise<LegacyImportApplyResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [studentRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM students WHERE id=? FOR UPDATE", [input.studentId],
      );
      if (!studentRows[0]) throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
      const existing = await this.findExisting(connection, input.studentId, input.sha256);
      if (existing) {
        await connection.commit();
        return this.mapExisting(existing, true);
      }
      const accepted = input.rows.filter((row) => row.rowType === "LESSON" && row.status !== "SKIPPED").length;
      const resolved = input.rows.filter((row) => row.status === "RESOLVED").length;
      const skipped = input.rows.filter((row) => row.status === "SKIPPED").length;
      const [createdImport] = await connection.execute<ResultSetHeader>(
        `INSERT INTO legacy_imports
          (student_id,original_filename,file_size,sha256,status,total_row_count,accepted_row_count,
           resolved_row_count,skipped_row_count,applied_by_user_id)
         VALUES (?,?,?,?,'APPLYING',?,?,?,?,?)`,
        [input.studentId, input.filename, input.fileSize, input.sha256, input.rows.length,
          accepted, resolved, skipped, input.actorUserId],
      );
      const importId = createdImport.insertId;
      const counts: ApplyCounts = { lessons: 0, matchedLessons: 0, attendances: 0, classes: 0, enrollments: 0, cycles: 0 };
      const periods = this.periodRuntimes(input.preview, input.rows);
      const lessonRows = input.rows.filter((row) => row.rowType === "LESSON" && row.status !== "SKIPPED");
      const acceptedDates = this.appliedDates(input.preview, input.rows);
      for (const period of periods)
        if (acceptedDates.some((date) => period.fromDate <= date && (period.toDate == null || period.toDate >= date)))
          await this.ensurePeriodClass(connection, period, input.actorUserId, counts);
      const attendanceBySource = new Map<string, number>();
      for (const row of lessonRows) {
        const date = String(row.normalizedValues.date ?? "");
        const start = String(row.normalizedValues.startTime ?? "");
        const end = String(row.normalizedValues.endTime ?? "");
        const period = periods.find((item) => item.fromDate <= date && (item.toDate == null || item.toDate >= date));
        if (!period?.classId) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Chưa map lớp cho dòng ${row.sourceRow}.`);
        const enrollmentId = await this.ensureEnrollment(connection, period, input.studentId, input.actorUserId, counts);
        const lessonPreview = input.preview.lessons.find((lesson) => lesson.sourceRow === row.sourceRow);
        if (!lessonPreview) throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Dòng lesson không còn trong workbook.");
        const lessonId = await this.ensureLesson(connection, period.classId, row, lessonPreview, input.actorUserId, counts);
        const attendanceId = await this.ensureAttendance(connection, lessonId, enrollmentId, input.studentId,
          input.preview.student.fullName, row, input.actorUserId, counts);
        await connection.execute(
          `INSERT INTO legacy_import_lesson_links
            (legacy_import_id,source_sheet,source_row,lesson_id,attendance_id) VALUES (?,?,?,?,?)`,
          [importId, row.sourceSheet, row.sourceRow, lessonId, attendanceId],
        );
        attendanceBySource.set(`LESSON:${row.sourceRow}`, attendanceId);
        if (lessonPreview.matchedTuitionSourceRow != null)
          attendanceBySource.set(`TUITION:${lessonPreview.matchedTuitionSourceRow}`, attendanceId);
      }
      await this.createMinimalLessons(connection, importId, input, periods, attendanceBySource, counts);
      counts.cycles = await this.applyTuitionCyclePlans(connection, input.studentId, input.preview, input.rows, attendanceBySource);
      await this.writeRowAudits(connection, importId, input.rows, input.actorUserId);
      await this.audit.record(connection, { actorUserId: input.actorUserId, action: "LEGACY_IMPORT_APPLIED",
        entityType: "LEGACY_IMPORT", entityId: importId,
        newValues: { studentId: input.studentId, sha256: input.sha256, accepted, resolved, skipped, ...counts } });
      await connection.execute(
        `UPDATE legacy_imports SET status='APPLIED',imported_lesson_count=?,imported_attendance_count=?,
          imported_class_count=?,imported_enrollment_count=?,imported_tuition_cycle_count=?,applied_at=NOW()
         WHERE id=?`,
        [counts.lessons, counts.attendances, counts.classes, counts.enrollments, counts.cycles, importId],
      );
      await connection.commit();
      return { importId, idempotent: false, acceptedRowCount: accepted, resolvedRowCount: resolved,
        skippedRowCount: skipped, importedLessonCount: counts.lessons, matchedLessonCount: counts.matchedLessons,
        importedAttendanceCount: counts.attendances, importedClassCount: counts.classes,
        importedEnrollmentCount: counts.enrollments, importedTuitionCycleCount: counts.cycles };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        const existing = await this.findExistingOutsideTransaction(input.studentId, input.sha256);
        if (existing) return this.mapExisting(existing, true);
      }
      throw error;
    } finally { connection.release(); }
  }

  private periodRuntimes(preview: LegacyImportPreview, rows: ResolvedLegacyImportRow[]): PeriodRuntime[] {
    const appliedDates = this.appliedDates(preview, rows);
    return preview.academicPeriods.map((period, index) => {
      const row = rows.find((item) => item.rowType === "ACADEMIC_PERIOD" && item.sourceRow === index + 1);
      const decision = row?.decisions.find((item): item is LegacyAcademicPeriodDecision => item.action === "MAP_ACADEMIC_PERIOD");
      if (!decision) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Giai đoạn ${period.schoolYear} chưa được map.`);
      if (decision.resolvedValue.periodId !== period.id)
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Mã giai đoạn không khớp preview.");
      const ownsEntireWorkbook = preview.academicPeriods.length === 1;
      const dates = (ownsEntireWorkbook ? appliedDates : appliedDates.filter((date) =>
        period.fromDate <= date && (period.toDate == null || period.toDate >= date))).sort();
      const runtimeFromDate = ownsEntireWorkbook && dates[0] && dates[0] < period.fromDate ? dates[0] : period.fromDate;
      const runtimeToDate = ownsEntireWorkbook && period.toDate != null && dates.at(-1) && dates.at(-1)! > period.toDate
        ? dates.at(-1)! : period.toDate;
      return { id: period.id, fromDate: runtimeFromDate, toDate: runtimeToDate,
        dataFromDate: dates[0] ?? period.fromDate, dataToDate: dates.at(-1) ?? period.toDate ?? period.fromDate,
        mapping: decision.resolvedValue.classMapping, gradeLevel: decision.resolvedValue.gradeLevel };
    });
  }

  private appliedDates(preview: LegacyImportPreview, rows: ResolvedLegacyImportRow[]): string[] {
    const lessonDates = rows.filter((row) => row.rowType === "LESSON" && row.status !== "SKIPPED")
      .map((row) => String(row.normalizedValues.date ?? "")).filter(Boolean);
    const correctedTuitionDates = new Map(rows.filter((row) => row.rowType === "TUITION" && row.status !== "SKIPPED")
      .map((row) => [row.sourceRow, String(row.normalizedValues.date ?? "")]));
    const minimalDates = rows.filter((row) => row.rowType === "TUITION_GROUP" && row.status !== "SKIPPED")
      .flatMap((row) => {
        const decision = row.decisions.find((item) => item.action === "CREATE_MINIMAL_LEGACY_LESSONS");
        if (!decision) return [];
        return decision.resolvedValue.tuitionSourceRows.map((sourceRow) => {
          const tuition = preview.tuitionRows.find((item) => item.sourceRow === sourceRow);
          return correctedTuitionDates.get(sourceRow) || tuition?.suggestedDate || tuition?.date || "";
        }).filter(Boolean);
      });
    return [...new Set([...lessonDates, ...minimalDates])].sort();
  }

  private async ensurePeriodClass(
    connection: PoolConnection, period: PeriodRuntime, actorUserId: number, counts: ApplyCounts,
  ): Promise<void> {
    if (period.mapping.type !== "CREATE_CLOSED_CLASS") {
      const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM classes WHERE id=? FOR UPDATE", [period.mapping.classId]);
      if (!rows[0]) throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Lớp đã map không còn tồn tại.");
      period.classId = period.mapping.classId;
      return;
    }
    const [defaults] = await connection.query<RowDataPacket[]>(
      `SELECT default_package_price,default_duration_minutes,subject FROM classes
       ORDER BY status='ACTIVE' DESC,id LIMIT 1 FOR UPDATE`,
    );
    if (!defaults[0]) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", "Cần có ít nhất một lớp làm chính sách học phí mẫu.");
    const endDate = period.dataToDate;
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO classes
        (name,class_type,subject,default_package_price,default_duration_minutes,start_date,expected_end_date,status,closed_at,note)
       VALUES (?,'ONE_TO_ONE',?,?,?,?,?,'CLOSED',CONCAT(?,' 23:59:59'),'Tạo từ import Excel lịch sử')`,
      [`${period.mapping.proposedName} · Khối ${period.gradeLevel}`, defaults[0].subject ?? null,
        Number(defaults[0].default_package_price), Number(defaults[0].default_duration_minutes), period.dataFromDate, endDate, endDate],
    );
    period.classId = created.insertId;
    counts.classes += 1;
    await connection.execute(
      "INSERT INTO class_tuition_policies(class_id,package_price,effective_from,effective_to,created_by) VALUES (?,?,?,?,?)",
      [created.insertId, Number(defaults[0].default_package_price), period.dataFromDate, endDate, actorUserId],
    );
    await connection.execute(
      "INSERT INTO class_active_periods(class_id,active_from,active_to,created_by) VALUES (?,?,?,?)",
      [created.insertId, period.dataFromDate, endDate, actorUserId],
    );
    await this.audit.record(connection, { actorUserId, action: "CLASS_CREATED", entityType: "CLASS",
      entityId: created.insertId, newValues: { source: "LEGACY_IMPORT", status: "CLOSED", gradeLevel: period.gradeLevel } });
  }

  private async ensureEnrollment(
    connection: PoolConnection, period: PeriodRuntime, studentId: number, actorUserId: number, counts: ApplyCounts,
  ): Promise<number> {
    if (period.enrollmentId) return period.enrollmentId;
    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM class_enrollments
       WHERE student_id=? AND class_id=? AND joined_at<=? AND (ended_at IS NULL OR ended_at>=?)
       ORDER BY status='ACTIVE' DESC,id LIMIT 1 FOR UPDATE`,
      [studentId, period.classId!, period.dataFromDate, period.dataToDate],
    );
    if (existing[0]) { period.enrollmentId = Number(existing[0].id); return period.enrollmentId; }
    const endDate = period.dataToDate;
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO class_enrollments
        (class_id,student_id,joined_at,ended_at,tuition_mode,tuition_effective_from,status,end_reason,note)
       VALUES (?,?,?,?,'CLASS_DEFAULT',?,'ENDED','Import lịch sử','Tạo từ import Excel lịch sử')`,
      [period.classId!, studentId, period.dataFromDate, endDate, period.dataFromDate],
    );
    period.enrollmentId = created.insertId;
    counts.enrollments += 1;
    await connection.execute(
      `INSERT INTO enrollment_tuition_policies
        (enrollment_id,tuition_mode,custom_package_price,effective_from,effective_to,created_by)
       VALUES (?,'CLASS_DEFAULT',NULL,?,?,?)`,
      [created.insertId, period.dataFromDate, endDate, actorUserId],
    );
    await connection.execute(
      "INSERT INTO enrollment_active_periods(enrollment_id,active_from,active_to,created_by) VALUES (?,?,?,?)",
      [created.insertId, period.dataFromDate, endDate, actorUserId],
    );
    await this.audit.record(connection, { actorUserId, action: "ENROLLMENT_CREATED", entityType: "ENROLLMENT",
      entityId: created.insertId, newValues: { source: "LEGACY_IMPORT", classId: period.classId, studentId } });
    return created.insertId;
  }

  private async ensureLesson(
    connection: PoolConnection,
    classId: number,
    row: ResolvedLegacyImportRow,
    lesson: LegacyImportPreview["lessons"][number],
    actorUserId: number,
    counts: ApplyCounts,
  ): Promise<number> {
    const date = String(row.normalizedValues.date);
    const start = String(row.normalizedValues.startTime);
    const end = String(row.normalizedValues.endTime);
    await connection.query("SELECT id FROM classes WHERE id=? FOR UPDATE", [classId]);
    const explicitMatch = row.decisions.find((item): item is LegacyImportLessonMatchDecision => item.action === "MATCH_EXISTING_LESSON");
    let existing: RowDataPacket | undefined;
    if (explicitMatch?.lessonId) {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM lesson_sessions WHERE id=? AND class_id=? AND status='COMPLETED' FOR UPDATE",
        [explicitMatch.lessonId, classId],
      );
      existing = rows[0];
      if (!existing) throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Lesson được chọn không hợp lệ.");
    } else {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM lesson_sessions WHERE class_id=? AND session_date=?
         AND scheduled_start_time=? AND scheduled_end_time=? AND status='COMPLETED'
         ORDER BY id LIMIT 1 FOR UPDATE`,
        [classId, date, start, end],
      );
      existing = rows[0];
    }
    if (existing) {
      counts.matchedLessons += 1;
      const contentDecision = row.decisions.find((item) => ["KEEP_EXISTING_LESSON", "USE_IMPORTED_LESSON", "EDIT_LESSON_CONTENT"].includes(item.action)) as LegacyImportLessonMatchDecision | undefined;
      const hasContentConflict = String(existing.content ?? "").trim() !== String(lesson.content ?? "").trim() ||
        String(existing.homework ?? "").trim() !== String(lesson.homework ?? "").trim();
      if (hasContentConflict && !contentDecision)
        throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Nội dung lesson dòng ${row.sourceRow} đang xung đột và chưa được quyết định.`);
      if (contentDecision?.action === "USE_IMPORTED_LESSON") {
        await connection.execute("UPDATE lesson_sessions SET content=?,homework=? WHERE id=?",
          [lesson.content, lesson.homework, Number(existing.id)]);
      } else if (contentDecision?.action === "EDIT_LESSON_CONTENT") {
        await connection.execute("UPDATE lesson_sessions SET content=?,homework=? WHERE id=?",
          [contentDecision.resolvedValue?.content ?? null, contentDecision.resolvedValue?.homework ?? null, Number(existing.id)]);
      }
      return Number(existing.id);
    }
    const duration = minutesBetween(start, end);
    if (duration <= 0) throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Thời gian lesson không hợp lệ.");
    const [classRows] = await connection.query<RowDataPacket[]>(
      "SELECT name,class_type,subject FROM classes WHERE id=?", [classId],
    );
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO lesson_sessions
        (class_id,class_name_snapshot,class_type_snapshot,subject_snapshot,session_date,
         scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,actual_duration_minutes,
         lesson_type,status,content,homework,note,completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'REGULAR','COMPLETED',?,?,?,NOW())`,
      [classId, classRows[0].name, classRows[0].class_type, classRows[0].subject ?? null,
        date, start, end, start, end, duration, lesson.content, lesson.homework,
        row.sourceSheet === "Học phí" ? "Khôi phục từ lịch sử học phí" : null],
    );
    counts.lessons += 1;
    await this.audit.record(connection, { actorUserId, action: "LESSON_COMPLETED", entityType: "LESSON",
      entityId: created.insertId, newValues: { source: "LEGACY_IMPORT", classId, date, start, end } });
    return created.insertId;
  }

  private async ensureAttendance(
    connection: PoolConnection,
    lessonId: number,
    enrollmentId: number,
    studentId: number,
    studentName: string,
    row: ResolvedLegacyImportRow,
    actorUserId: number,
    counts: ApplyCounts,
  ): Promise<number> {
    const [participantRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM lesson_session_participants
       WHERE lesson_session_id=? AND enrollment_id=? FOR UPDATE`, [lessonId, enrollmentId],
    );
    let participantId = Number(participantRows[0]?.id ?? 0);
    if (!participantId) {
      const [student] = await connection.query<RowDataPacket[]>("SELECT nickname FROM students WHERE id=?", [studentId]);
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lesson_session_participants
          (lesson_session_id,enrollment_id,student_name_snapshot,student_nickname_snapshot,created_by)
         VALUES (?,?,?,?,?)`,
        [lessonId, enrollmentId, studentName, student[0]?.nickname ?? null, actorUserId],
      );
      participantId = created.insertId;
    }
    const [attendanceRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM lesson_attendances WHERE participant_id=? FOR UPDATE", [participantId],
    );
    if (attendanceRows[0])
      throw new AppError(409, "LEGACY_IMPORT_DUPLICATE", `Lesson dòng ${row.sourceRow} đã có điểm danh của học sinh.`);
    const status = String(row.normalizedValues.attendance);
    const billable = isBillable(status) && row.normalizedValues.countsForTuition !== false;
    const excluded = status === "FREE" || status === "PRESENT" && !billable;
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO lesson_attendances
        (lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition,excluded_from_tuition,student_note)
       VALUES (?,?,?,?,?,?,?)`,
      [lessonId, participantId, enrollmentId, status, billable, excluded, row.normalizedValues.studentNote ?? null],
    );
    counts.attendances += 1;
    return created.insertId;
  }

  private async createMinimalLessons(
    connection: PoolConnection, importId: number, input: ApplyInput, periods: PeriodRuntime[],
    attendanceBySource: Map<string, number>, counts: ApplyCounts,
  ): Promise<void> {
    const confirmedMappings = new Map(input.rows.flatMap((row) => row.decisions)
      .filter((decision) => decision.action === "CONFIRM_TIME_MAPPING")
      .map((decision) => [decision.resolvedValue.mappingId, decision.resolvedValue]));
    const correctedDates = new Map(input.rows.filter((row) => row.rowType === "TUITION" && row.status !== "SKIPPED")
      .map((row) => [row.sourceRow, String(row.normalizedValues.date ?? "")]));
    for (const groupRow of input.rows.filter((row) => row.rowType === "TUITION_GROUP" && row.status !== "SKIPPED")) {
      const decision = groupRow.decisions.find((item) => item.action === "CREATE_MINIMAL_LEGACY_LESSONS");
      if (!decision) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", "Nhóm lesson tối giản chưa được xác nhận.");
      const group = input.preview.minimalLessonGroups.find((item) => item.id === decision.resolvedValue.groupId);
      if (!group || serialized(group.tuitionSourceRows) !== serialized(decision.resolvedValue.tuitionSourceRows))
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Danh sách dòng học phí của nhóm đã thay đổi.");
      for (const sourceRow of group.tuitionSourceRows) {
        const tuition = input.preview.tuitionRows.find((row) => row.sourceRow === sourceRow && row.kind === "BILLABLE");
        if (!tuition?.date) throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Dòng học phí tối giản không còn tồn tại.");
        const date = correctedDates.get(sourceRow) || tuition.suggestedDate || tuition.date;
        const mapping = input.preview.timeMappings.find((item) => item.tuitionSourceRows.includes(sourceRow));
        const confirmed = mapping ? confirmedMappings.get(mapping.id) : null;
        const parsedTime = lessonTimes(tuition.time);
        const start = confirmed?.startTime ?? parsedTime.start;
        const end = confirmed?.endTime ?? parsedTime.end;
        if (!start || !end) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Nhóm lesson tối giản còn thiếu giờ ở dòng ${sourceRow}.`);
        const period = periods.find((item) => item.fromDate <= date && (item.toDate == null || item.toDate >= date));
        if (!period?.classId) throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Chưa map lớp cho dòng học phí ${sourceRow}.`);
        const enrollmentId = await this.ensureEnrollment(connection, period, input.studentId, input.actorUserId, counts);
        const synthetic = {
          id: `tuition-${sourceRow}`, rowType: "LESSON" as const, sourceSheet: "Học phí", sourceRow,
          rawValues: { date: tuition.date, time: tuition.time }, normalizedValues: { date, startTime: start, endTime: end,
            attendance: "PRESENT", content: null, homework: null, studentNote: null }, issueCodes: [], status: "RESOLVED" as const,
          supportedActions: [], decisions: [],
        } satisfies ResolvedLegacyImportRow;
        const lessonPreview: LegacyImportPreview["lessons"][number] = {
          id: synthetic.id, originalDate: tuition.date, normalizedDate: date, scheduledStartTime: start, scheduledEndTime: end,
          dateResolution: "EXACT", suggestedDate: null, teacher: null, studentName: input.preview.student.fullName,
          nickname: null, content: null, homework: null, classwork: null, note: null, attendanceStatus: "PRESENT",
          billingType: "BILLABLE", sourceSheet: "Quá trình học tập", sourceRow,
          reconciliationStatus: "MATCHED", matchedTuitionSourceRow: sourceRow, rawTime: tuition.time,
          timeMappingId: mapping?.id ?? null,
        };
        const lessonId = await this.ensureLesson(connection, period.classId, synthetic, lessonPreview, input.actorUserId, counts);
        const attendanceId = await this.ensureAttendance(connection, lessonId, enrollmentId, input.studentId,
          input.preview.student.fullName, synthetic, input.actorUserId, counts);
        await connection.execute(
          `INSERT INTO legacy_import_lesson_links
            (legacy_import_id,source_sheet,source_row,lesson_id,attendance_id) VALUES (?,?,?,?,?)`,
          [importId, "Học phí", sourceRow, lessonId, attendanceId],
        );
        attendanceBySource.set(`TUITION:${sourceRow}`, attendanceId);
      }
    }
  }

  private async applyTuitionCyclePlans(
    connection: PoolConnection, studentId: number, preview: LegacyImportPreview, rows: ResolvedLegacyImportRow[],
    attendanceBySource: Map<string, number>,
  ): Promise<number> {
    const paymentByBlock = new Map(rows.filter((row) => row.rowType === "PAYMENT" && row.status !== "SKIPPED")
      .map((row) => [String(row.normalizedValues.blockId), row.decisions.find((item): item is LegacyImportPaymentDecision =>
        item.action === "CONFIRM_PAYMENT")]));
    const [active] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM class_enrollments WHERE student_id=? AND status='ACTIVE' LIMIT 1", [studentId]);
    const claimed = new Set<number>();
    const skippedTuitionRows = new Set(rows.filter((row) => row.rowType === "TUITION_GROUP" && row.status === "SKIPPED")
      .flatMap((row) => {
        const groupId = String(row.normalizedValues.groupId ?? "");
        return preview.minimalLessonGroups.find((group) => group.id === groupId)?.tuitionSourceRows ?? [];
      }));
    let createdCount = 0;
    for (const plan of preview.tuitionCyclePlans) {
      const payment = paymentByBlock.get(plan.blockId);
      if (payment?.resolvedValue === "EXCLUDE_FINANCE") {
        const excludedIds = [...plan.lessonSourceRows.map((row) => attendanceBySource.get(`LESSON:${row}`)),
          ...plan.tuitionSourceRows.map((row) => attendanceBySource.get(`TUITION:${row}`))]
          .filter((id): id is number => Boolean(id));
        if (excludedIds.length) await connection.execute(
          `UPDATE lesson_attendances SET excluded_from_tuition=1 WHERE id IN (${excludedIds.map(() => "?").join(",")})`,
          excludedIds,
        );
        continue;
      }
      let paymentState = plan.paymentState;
      if (paymentState === "NEEDS_REVIEW") {
        if (!payment || payment.resolvedValue === "UNDETERMINED")
          throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Block ${plan.blockId} chưa có quyết định học phí.`);
        if (payment.resolvedValue === "PAID_UNDATED") paymentState = "PAID_CLEAR";
        else if (payment.resolvedValue === "UNPAID") paymentState = "UNPAID";
        else continue;
      }
      const sourceKeys = [...plan.lessonSourceRows
        .filter((sourceRow) => !rows.some((row) => row.rowType === "LESSON" && row.sourceRow === sourceRow && row.status === "SKIPPED"))
        .map((row) => `LESSON:${row}`), ...plan.tuitionSourceRows.filter((row) => !skippedTuitionRows.has(row))
          .map((row) => `TUITION:${row}`)];
      if (!sourceKeys.length) continue;
      const ids = sourceKeys.map((key) => attendanceBySource.get(key));
      if (ids.some((id) => !id))
        throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Source row trong plan ${plan.blockId} không còn tồn tại sau resolution.`);
      const attendanceIds = ids as number[];
      if (attendanceIds.some((id) => claimed.has(id)))
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Một attendance xuất hiện trong nhiều cycle plan.");
      attendanceIds.forEach((id) => claimed.add(id));
      const placeholders = attendanceIds.map(() => "?").join(",");
      const [items] = await connection.query<RowDataPacket[]>(
        `SELECT a.id attendance_id,a.enrollment_id,a.attendance_status,a.counts_for_tuition,a.excluded_from_tuition,
          l.session_date FROM lesson_attendances a JOIN lesson_sessions l ON l.id=a.lesson_session_id
         WHERE a.id IN (${placeholders}) ORDER BY FIELD(a.id,${placeholders}) FOR UPDATE`,
        [...attendanceIds, ...attendanceIds]);
      if (items.length !== attendanceIds.length || items.some((item) => item.attendance_status !== "PRESENT" ||
          !Number(item.counts_for_tuition) || Number(item.excluded_from_tuition)))
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "FREE/ABSENT/OFF không được nằm trong cycle plan.");
      const full = items.length === 8;
      if (paymentState === "PAID_CLEAR" && !full)
        throw new AppError(400, "LEGACY_DECISIONS_INVALID", "Cycle PAID legacy phải có đúng 8 attendance tính phí.");
      if (!full && plan.paymentState === "NEEDS_REVIEW") continue;
      const anchorEnrollment = Number(items[0].enrollment_id);
      const firstDate = dateOnly(items[0].session_date);
      const [numberRows] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(cycle_number),0)+1 next_number FROM tuition_cycles WHERE enrollment_id=? FOR UPDATE", [anchorEnrollment]);
      const [policyRows] = await connection.query<RowDataPacket[]>(
        `SELECT ep.tuition_mode,COALESCE(ep.custom_package_price,cp.package_price,c.default_package_price) package_price
         FROM class_enrollments e JOIN classes c ON c.id=e.class_id
         JOIN enrollment_tuition_policies ep ON ep.enrollment_id=e.id AND ep.effective_from<=?
           AND (ep.effective_to IS NULL OR ep.effective_to>=?)
         LEFT JOIN class_tuition_policies cp ON cp.class_id=e.class_id AND cp.effective_from<=?
           AND (cp.effective_to IS NULL OR cp.effective_to>=?)
         WHERE e.id=? ORDER BY ep.effective_from DESC,cp.effective_from DESC LIMIT 1`,
        [firstDate, firstDate, firstDate, firstDate, anchorEnrollment]);
      const price = Number(policyRows[0]?.package_price ?? 0);
      if (!price || policyRows[0]?.tuition_mode === "FREE")
        throw new AppError(409, "TUITION_POLICY_NOT_FOUND", "Không tìm thấy chính sách học phí cho dữ liệu lịch sử.");
      const status = paymentState === "PAID_CLEAR" ? "PAID" : full ? "PAYMENT_DUE" : active[0] ? "ACCUMULATING" : "INCOMPLETE";
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO tuition_cycles
          (enrollment_id,cycle_number,target_session_count,package_price_snapshot,status,started_at,reached_target_at,
           paid_at,paid_amount,payment_method,payment_note)
         VALUES (?,?,8,?,?,?,?,NULL,NULL,NULL,?)`,
        [anchorEnrollment, Number(numberRows[0].next_number), price, status, firstDate,
          full ? dateOnly(items.at(-1)!.session_date) : null,
          paymentState === "PAID_CLEAR" ? "Đã thanh toán theo workbook lịch sử; không rõ ngày thanh toán" : null]);
      for (const [index, item] of items.entries()) await connection.execute(
        "INSERT INTO tuition_cycle_sessions(tuition_cycle_id,attendance_id,sequence_number) VALUES (?,?,?)",
        [created.insertId, Number(item.attendance_id), index + 1]);
      createdCount += 1;
    }
    return createdCount;
  }

  private async writeRowAudits(
    connection: PoolConnection, importId: number, rows: ResolvedLegacyImportRow[], actorUserId: number,
  ): Promise<void> {
    for (const row of rows) {
      const issues = row.issueCodes.length ? row.issueCodes : ["NONE"];
      for (const issueCode of issues) {
        const decision = row.decisions.find((item) => item.issueCode === issueCode) ?? row.decisions[0];
        const skipReason = decision?.action === "SKIP"
          ? decision.reason === "OTHER" ? decision.otherReason ?? null : decision.reason : null;
        await connection.execute(
          `INSERT INTO legacy_import_row_audits
            (legacy_import_id,source_sheet,source_row,row_status,issue_code,resolution_action,
             raw_snapshot_json,normalized_snapshot_json,skip_reason,resolved_by_user_id,resolved_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [importId, row.sourceSheet, row.sourceRow, row.status, issueCode, decision?.action ?? null,
            serialized(row.rawValues), serialized(row.normalizedValues), skipReason,
            decision ? actorUserId : null, decision ? new Date() : null],
        );
      }
    }
  }

  private async findExisting(connection: PoolConnection, studentId: number, sha256: string): Promise<RowDataPacket | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM legacy_imports WHERE student_id=? AND sha256=? FOR UPDATE", [studentId, sha256],
    );
    return rows[0] ?? null;
  }

  private async findExistingOutsideTransaction(studentId: number, sha256: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM legacy_imports WHERE student_id=? AND sha256=? AND status='APPLIED'", [studentId, sha256],
    );
    return rows[0] ?? null;
  }

  private mapExisting(row: RowDataPacket, idempotent: boolean): LegacyImportApplyResult {
    if (row.status !== "APPLIED") throw new AppError(409, "LEGACY_IMPORT_DUPLICATE", "File đang được apply bởi request khác.");
    return { importId: Number(row.id), idempotent, acceptedRowCount: Number(row.accepted_row_count),
      resolvedRowCount: Number(row.resolved_row_count), skippedRowCount: Number(row.skipped_row_count),
      importedLessonCount: Number(row.imported_lesson_count), matchedLessonCount: 0,
      importedAttendanceCount: Number(row.imported_attendance_count), importedClassCount: Number(row.imported_class_count),
      importedEnrollmentCount: Number(row.imported_enrollment_count), importedTuitionCycleCount: Number(row.imported_tuition_cycle_count) };
  }
}
