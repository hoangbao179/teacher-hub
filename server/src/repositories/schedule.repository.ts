import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  CreateRecurringScheduleRequest,
  EndRecurringScheduleRequest,
  RescheduleOccurrenceRequest,
  ScheduleConflictWarning,
  ScheduleOccurrence,
  SkipOccurrenceRequest,
  TeacherBusySlot,
  TeacherBusySlotInput,
  TemporaryReschedulePreviewItem,
  BulkTemporaryRescheduleRequest,
  OutstandingMakeupItem,
  UnrecordedSession,
  WeekScheduleResponse,
} from "@teacher/shared";
import { pool } from "../db/pool";
import {
  compareOccurrences,
  expandRecurringSchedules,
  occurrenceKey,
  parseOccurrenceKey,
  reconcileOccurrence,
  replacementOccurrenceKey,
  timeRangesOverlap,
  type ProjectionExceptionInput,
  type ProjectionLessonInput,
  type RecurringProjectionInput,
} from "../domain/schedule-projection";
import { AppError } from "../errors/app-error";
import { addDays, weekdayIso } from "../utils/date";
import { AuditRepository } from "./audit.repository";

interface ExceptionWriteResult {
  id: number;
  idempotent: boolean;
}

interface LessonEvent {
  id: number;
  sourceKey: string | null;
  classId: number;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  lessonType: "REGULAR" | "MAKEUP" | "EXTRA";
}

interface BusyOccurrence {
  id: number;
  slotType: TeacherBusySlot["slotType"];
  organizationType: TeacherBusySlot["organizationType"];
  organizationName: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

export class ScheduleRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async create(classId: number, input: CreateRecurringScheduleRequest, actorUserId?: number): Promise<"CLASS_NOT_FOUND" | "CLASS_CLOSED" | number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [classes] = await connection.query<RowDataPacket[]>("SELECT status FROM classes WHERE id=? FOR UPDATE", [classId]);
      if (!classes[0]) { await connection.rollback(); return "CLASS_NOT_FOUND"; }
      if (classes[0].status === "CLOSED") { await connection.rollback(); return "CLASS_CLOSED"; }
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from,effective_to) VALUES (?,?,?,?,?,?)",
        [classId, input.dayOfWeek, input.startTime, input.endTime, input.effectiveFrom, input.effectiveTo ?? null],
      );
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_CREATED", entityType: "RECURRING_SCHEDULE", entityId: result.insertId, newValues: { classId, ...input } });
      await connection.commit(); return result.insertId;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async update(id: number, input: CreateRecurringScheduleRequest, actorUserId?: number): Promise<"UPDATED" | "NOT_FOUND" | "INVALID_EFFECTIVE_DATE"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM recurring_schedules WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return "NOT_FOUND"; }
      if (input.effectiveFrom <= dateOnly(rows[0].effective_from)) {
        await connection.rollback(); return "INVALID_EFFECTIVE_DATE";
      }
      await connection.execute(
        "UPDATE recurring_schedules SET effective_to=DATE_SUB(?,INTERVAL 1 DAY) WHERE id=?",
        [input.effectiveFrom, id],
      );
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from,effective_to)
         VALUES (?,?,?,?,?,?)`,
        [rows[0].class_id, input.dayOfWeek, input.startTime, input.endTime,
          input.effectiveFrom, input.effectiveTo ?? null],
      );
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_VERSION_ENDED", entityType: "RECURRING_SCHEDULE", entityId: id, previousValues: rows[0], newValues: { effectiveTo: addDays(input.effectiveFrom, -1) } });
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_CREATED", entityType: "RECURRING_SCHEDULE", entityId: created.insertId, newValues: { ...input, previousVersionId: id } });
      await connection.commit(); return "UPDATED";
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async remove(id: number, input: EndRecurringScheduleRequest, actorUserId?: number): Promise<"UPDATED" | "NOT_FOUND" | "INVALID_EFFECTIVE_DATE"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM recurring_schedules WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return "NOT_FOUND"; }
      if (input.effectiveDate <= dateOnly(rows[0].effective_from)) {
        await connection.rollback(); return "INVALID_EFFECTIVE_DATE";
      }
      await connection.execute(
        "UPDATE recurring_schedules SET effective_to=DATE_SUB(?,INTERVAL 1 DAY) WHERE id=?",
        [input.effectiveDate, id],
      );
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_ENDED", entityType: "RECURRING_SCHEDULE", entityId: id, previousValues: rows[0], newValues: { effectiveTo: addDays(input.effectiveDate, -1) }, reason: input.reason });
      await connection.commit(); return "UPDATED";
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async listOccurrences(from: string, to: string, classId?: number): Promise<ScheduleOccurrence[]> {
    return this.listOccurrencesCore(from, to, classId, true);
  }

  async resolveOccurrence(key: string): Promise<ScheduleOccurrence | null> {
    const parsed = parseOccurrenceKey(key);
    if (!parsed) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rs.id recurring_schedule_id,rs.class_id,c.name class_name,
        rs.day_of_week,DATE_FORMAT(rs.effective_from,'%Y-%m-%d') effective_from,
        DATE_FORMAT(rs.effective_to,'%Y-%m-%d') effective_to,
        TIME_FORMAT(rs.start_time,'%H:%i') start_time,TIME_FORMAT(rs.end_time,'%H:%i') end_time
       FROM recurring_schedules rs JOIN classes c ON c.id=rs.class_id
       WHERE rs.id=? AND rs.class_id=?
         AND EXISTS (SELECT 1 FROM class_active_periods ap WHERE ap.class_id=rs.class_id
           AND ap.active_from<=? AND (ap.active_to IS NULL OR ap.active_to>=?))`,
      [parsed.recurringScheduleId, parsed.classId, parsed.occurrenceDate, parsed.occurrenceDate],
    );
    const row = rows[0];
    if (!row || Number(row.day_of_week) !== weekdayIso(parsed.occurrenceDate) ||
        parsed.occurrenceDate < String(row.effective_from) ||
        (row.effective_to && parsed.occurrenceDate > String(row.effective_to))) return null;
    const base = expandRecurringSchedules([mapSchedule(row)], parsed.occurrenceDate, parsed.occurrenceDate)[0];
    if (!base) return null;
    const exception = await this.findException(parsed.recurringScheduleId, parsed.occurrenceDate);
    const targetKey = parsed.replacement ? replacementOccurrenceKey(base.key) : base.key;
    const lesson = await this.findLessonByOccurrenceKey(targetKey);
    return reconcileOccurrence(base, exception, lesson).find((item) => item.key === key) ?? null;
  }

  async createException(
    key: string,
    type: "SKIPPED" | "RESCHEDULED",
    input: SkipOccurrenceRequest | RescheduleOccurrenceRequest,
    actorUserId?: number,
  ): Promise<ExceptionWriteResult> {
    const parsed = parseOccurrenceKey(key);
    if (!parsed)
      throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Chỉ occurrence gốc mới có thể nghỉ hoặc đổi lịch.");
    if (parsed.replacement) {
      if (type !== "SKIPPED")
        throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Lịch thay thế chỉ có thể được đánh dấu nghỉ.");
      return this.cancelReplacement(key, input as SkipOccurrenceRequest, actorUserId);
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [schedules] = await connection.query<RowDataPacket[]>(
        `SELECT rs.* FROM recurring_schedules rs
         WHERE rs.id=? AND rs.class_id=?
           AND EXISTS (SELECT 1 FROM class_active_periods ap WHERE ap.class_id=rs.class_id
             AND ap.active_from<=? AND (ap.active_to IS NULL OR ap.active_to>=?)) FOR UPDATE`,
        [parsed.recurringScheduleId, parsed.classId, parsed.occurrenceDate, parsed.occurrenceDate],
      );
      const schedule = schedules[0];
      if (!schedule || Number(schedule.day_of_week) !== weekdayIso(parsed.occurrenceDate) ||
          parsed.occurrenceDate < dateOnly(schedule.effective_from) ||
          (schedule.effective_to && parsed.occurrenceDate > dateOnly(schedule.effective_to)))
        throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Không tìm thấy occurrence dự kiến.");
      const [existingRows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM schedule_exceptions WHERE recurring_schedule_id=? AND original_date=? FOR UPDATE",
        [parsed.recurringScheduleId, parsed.occurrenceDate],
      );
      const existing = existingRows[0];
      const replacement = type === "RESCHEDULED" ? input as RescheduleOccurrenceRequest : null;
      const normalized = {
        type,
        reason: input.reason.trim(),
        note: input.note?.trim() || null,
        replacementDate: replacement?.replacementDate ?? null,
        replacementStartTime: replacement?.replacementStartTime ?? null,
        replacementEndTime: replacement?.replacementEndTime ?? null,
        makeupRequired: !("makeupRequired" in input) || input.makeupRequired !== false,
      };
      if (existing) {
        const identical = existing.exception_type === normalized.type &&
          nullableDate(existing.replacement_date) === normalized.replacementDate &&
          nullableTime(existing.replacement_start_time) === normalized.replacementStartTime &&
          nullableTime(existing.replacement_end_time) === normalized.replacementEndTime &&
          String(existing.reason ?? "") === normalized.reason &&
          (existing.note == null ? null : String(existing.note)) === normalized.note &&
          Boolean(existing.makeup_required) === normalized.makeupRequired;
        if (!identical)
          throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Occurrence đã có thao tác nghỉ hoặc đổi lịch khác.");
        if (type === "SKIPPED")
          await this.ensureMakeupEntitlements(connection, key, parsed.classId, parsed.occurrenceDate,
            normalized.makeupRequired ? "OPEN" : "WAIVED", normalized.reason, actorUserId);
        await connection.commit();
        return { id: Number(existing.id), idempotent: true };
      }
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO schedule_exceptions
          (class_id,recurring_schedule_id,original_date,original_start_time,original_end_time,
           exception_type,replacement_date,replacement_start_time,replacement_end_time,reason,note,makeup_required,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [parsed.classId, parsed.recurringScheduleId, parsed.occurrenceDate, schedule.start_time, schedule.end_time,
          type, normalized.replacementDate, normalized.replacementStartTime, normalized.replacementEndTime,
          normalized.reason, normalized.note, normalized.makeupRequired, actorUserId ?? null],
      );
      if (type === "SKIPPED")
        await this.ensureMakeupEntitlements(connection, key, parsed.classId, parsed.occurrenceDate,
          normalized.makeupRequired ? "OPEN" : "WAIVED", normalized.reason, actorUserId);
      if (type === "SKIPPED") await this.audit.record(connection, { actorUserId,
        action: normalized.makeupRequired ? "MAKEUP_ENTITLEMENT_OPENED" : "MAKEUP_ENTITLEMENT_WAIVED",
        entityType: "SCHEDULE_EXCEPTION", entityId: created.insertId,
        newValues: { sourceOccurrenceKey: key }, reason: normalized.reason });
      await this.audit.record(connection, {
        actorUserId,
        action: type === "SKIPPED" ? "SCHEDULE_OCCURRENCE_SKIPPED" : "SCHEDULE_OCCURRENCE_RESCHEDULED",
        entityType: "SCHEDULE_EXCEPTION",
        entityId: created.insertId,
        newValues: { occurrenceKey: key, ...normalized },
        reason: normalized.reason,
      });
      await connection.commit();
      return { id: created.insertId, idempotent: false };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private async cancelReplacement(
    replacementKey: string,
    input: SkipOccurrenceRequest,
    actorUserId?: number,
  ): Promise<ExceptionWriteResult> {
    const parsed = parseOccurrenceKey(replacementKey)!;
    const canonicalKey = occurrenceKey(parsed.classId, parsed.recurringScheduleId, parsed.occurrenceDate);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM schedule_exceptions
         WHERE recurring_schedule_id=? AND class_id=? AND original_date=? FOR UPDATE`,
        [parsed.recurringScheduleId, parsed.classId, parsed.occurrenceDate],
      );
      const exception = rows[0];
      if (!exception || exception.exception_type !== "RESCHEDULED")
        throw new AppError(409, "REPLACEMENT_NOT_FOUND", "Không tìm thấy lịch thay thế đang hoạt động.");
      const [lessons] = await connection.query<RowDataPacket[]>(
        "SELECT id,status FROM lesson_sessions WHERE source_occurrence_key=? FOR UPDATE", [replacementKey],
      );
      if (lessons.some((lesson) => lesson.status !== "CANCELLED"))
        throw new AppError(409, "OCCURRENCE_RECORDED", "Lịch thay thế đã có buổi học và không thể đánh dấu nghỉ trực tiếp.");
      const makeupRequired = input.makeupRequired !== false;
      if (exception.replacement_cancelled_at) {
        const identical = String(exception.replacement_cancel_reason ?? "") === input.reason.trim() &&
          (exception.replacement_cancel_note == null ? null : String(exception.replacement_cancel_note)) === (input.note?.trim() || null) &&
          Boolean(exception.makeup_required) === makeupRequired;
        if (!identical) throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Lịch thay thế đã được đánh dấu nghỉ với thông tin khác.");
        await connection.commit();
        return { id: Number(exception.id), idempotent: true };
      }
      await connection.execute(
        `UPDATE schedule_exceptions SET replacement_cancelled_at=NOW(),replacement_cancelled_by=?,
          replacement_cancel_reason=?,replacement_cancel_note=?,makeup_required=? WHERE id=?`,
        [actorUserId ?? null, input.reason.trim(), input.note?.trim() || null, makeupRequired, exception.id],
      );
      await this.ensureMakeupEntitlements(connection, canonicalKey, parsed.classId, parsed.occurrenceDate,
        makeupRequired ? "OPEN" : "WAIVED", input.reason.trim(), actorUserId);
      await this.audit.record(connection, { actorUserId,
        action: makeupRequired ? "MAKEUP_ENTITLEMENT_OPENED" : "MAKEUP_ENTITLEMENT_WAIVED",
        entityType: "SCHEDULE_EXCEPTION", entityId: Number(exception.id),
        newValues: { sourceOccurrenceKey: canonicalKey }, reason: input.reason.trim() });
      await this.audit.record(connection, { actorUserId, action: "SCHEDULE_REPLACEMENT_SKIPPED",
        entityType: "SCHEDULE_EXCEPTION", entityId: Number(exception.id), reason: input.reason.trim(),
        newValues: { occurrenceKey: replacementKey, canonicalKey, makeupRequired } });
      await connection.commit();
      return { id: Number(exception.id), idempotent: false };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private async ensureMakeupEntitlements(
    connection: PoolConnection,
    sourceKey: string,
    classId: number,
    originalDate: string,
    status: "OPEN" | "WAIVED",
    reason: string,
    actorUserId?: number,
  ): Promise<void> {
    const [cancelledDrafts] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM lesson_sessions WHERE source_occurrence_key IN (?,?) AND status='CANCELLED'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`, [sourceKey, replacementOccurrenceKey(sourceKey)],
    );
    const lessonId = cancelledDrafts[0]?.id;
    const [participants] = lessonId
      ? await connection.query<RowDataPacket[]>(
          `SELECT p.enrollment_id,COALESCE(p.student_name_snapshot,s.full_name) student_name,
            COALESCE(p.student_nickname_snapshot,s.nickname) student_nickname
           FROM lesson_session_participants p JOIN class_enrollments e ON e.id=p.enrollment_id
           JOIN students s ON s.id=e.student_id WHERE p.lesson_session_id=? FOR UPDATE`, [lessonId])
      : await connection.query<RowDataPacket[]>(
          `SELECT e.id enrollment_id,s.full_name student_name,s.nickname student_nickname
           FROM class_enrollments e JOIN students s ON s.id=e.student_id
           WHERE e.class_id=? AND e.joined_at<=? AND (e.ended_at IS NULL OR e.ended_at>=?)
             AND EXISTS (SELECT 1 FROM enrollment_active_periods ap WHERE ap.enrollment_id=e.id
               AND ap.active_from<=? AND (ap.active_to IS NULL OR ap.active_to>=?)) FOR UPDATE`,
          [classId, originalDate, originalDate, originalDate, originalDate]);
    for (const participant of participants) {
      await connection.execute(
        `INSERT INTO lesson_makeup_replacements
          (source_occurrence_key,enrollment_id,student_name_snapshot,student_nickname_snapshot,status,
           waived_at,waived_reason,created_by,updated_by)
         VALUES (?,?,?,?,?,IF(?='WAIVED',NOW(),NULL),IF(?='WAIVED',?,NULL),?,?)
         ON DUPLICATE KEY UPDATE
           status=IF(status IN ('FULFILLED','RESERVED'),status,VALUES(status)),
           waived_at=IF(status IN ('FULFILLED','RESERVED'),waived_at,VALUES(waived_at)),
           waived_reason=IF(status IN ('FULFILLED','RESERVED'),waived_reason,VALUES(waived_reason)),
           updated_by=VALUES(updated_by)`,
        [sourceKey, participant.enrollment_id, participant.student_name, participant.student_nickname,
          status, status, status, reason, actorUserId ?? null, actorUserId ?? null],
      );
    }
  }

  async detectConflicts(date: string, startTime: string, endTime: string, excludeOriginalKey?: string, excludeLessonId?: number): Promise<ScheduleConflictWarning[]> {
    const occurrences = await this.listOccurrencesCore(date, date, undefined, false);
    const lessons = await this.listLessonEvents(date, date);
    const busy = await this.expandBusyEvents(date, date);
    const warnings: ScheduleConflictWarning[] = [];
    for (const item of occurrences) {
      if (item.originalKey === excludeOriginalKey || item.state !== "UNRECORDED") continue;
      if (timeRangesOverlap(date, startTime, endTime, item.occurrenceDate, item.scheduledStartTime, item.scheduledEndTime))
        warnings.push({ kind: "PROJECTED_OCCURRENCE", id: null, occurrenceKey: item.key, title: item.className,
          date: item.occurrenceDate, startTime: item.scheduledStartTime, endTime: item.scheduledEndTime });
    }
    for (const item of lessons) {
      if (item.id === excludeLessonId || item.status === "CANCELLED" || (excludeOriginalKey != null &&
          (item.sourceKey === excludeOriginalKey || item.sourceKey === replacementOccurrenceKey(excludeOriginalKey)))) continue;
      if (timeRangesOverlap(date, startTime, endTime, item.date, item.startTime, item.endTime))
        warnings.push({ kind: "LESSON", id: item.id, occurrenceKey: item.sourceKey,
          title: `${item.className} · ${item.lessonType}`, date: item.date, startTime: item.startTime, endTime: item.endTime });
    }
    for (const item of busy) {
      if (timeRangesOverlap(date, startTime, endTime, item.date, item.startTime, item.endTime))
        warnings.push({ kind: "BUSY_SLOT", id: item.id, occurrenceKey: null, title: item.title,
          date: item.date, startTime: item.startTime, endTime: item.endTime });
    }
    return dedupeWarnings(warnings);
  }

  async applyTemporaryReschedules(
    input: BulkTemporaryRescheduleRequest,
    items: TemporaryReschedulePreviewItem[],
    actorUserId?: number,
  ): Promise<number[]> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const scheduleIds = input.mappings.map((mapping) => mapping.recurringScheduleId);
      const [schedules] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM recurring_schedules WHERE id IN (${scheduleIds.map(() => "?").join(",")}) AND class_id=? FOR UPDATE`,
        [...scheduleIds, input.classId],
      );
      if (schedules.length !== scheduleIds.length)
        throw new AppError(404, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch lặp nguồn.");
      const ids: number[] = [];
      for (const item of items) {
        const parsed = parseOccurrenceKey(item.originalOccurrenceKey);
        if (!parsed || !scheduleIds.includes(parsed.recurringScheduleId) || parsed.classId !== input.classId)
          throw new AppError(409, "TEMPORARY_RESCHEDULE_STALE", "Preview đổi lịch không còn hợp lệ.");
        const [existing] = await connection.query<RowDataPacket[]>(
          `SELECT se.id exception_id,l.id lesson_id FROM recurring_schedules rs
           LEFT JOIN schedule_exceptions se ON se.recurring_schedule_id=rs.id AND se.original_date=?
           LEFT JOIN lesson_sessions l ON l.source_occurrence_key IN (?,?)
           WHERE rs.id=? FOR UPDATE`,
          [item.originalDate, item.originalOccurrenceKey, replacementOccurrenceKey(item.originalOccurrenceKey), parsed.recurringScheduleId],
        );
        if (existing[0]?.exception_id || existing[0]?.lesson_id)
          throw new AppError(409, "TEMPORARY_RESCHEDULE_STALE", "Có occurrence đã được xử lý sau khi preview.");
        const [created] = await connection.execute<ResultSetHeader>(
          `INSERT INTO schedule_exceptions
            (class_id,recurring_schedule_id,original_date,original_start_time,original_end_time,
             exception_type,replacement_date,replacement_start_time,replacement_end_time,reason,note,created_by)
           VALUES (?,?,?,?,?,'RESCHEDULED',?,?,?,?,?,?)`,
          [input.classId, parsed.recurringScheduleId, item.originalDate, item.originalStartTime, item.originalEndTime,
            item.replacementDate, item.replacementStartTime, item.replacementEndTime,
            input.reason.trim(), input.note?.trim() || null, actorUserId ?? null],
        );
        ids.push(created.insertId);
        await this.audit.record(connection, {
          actorUserId, action: "SCHEDULE_OCCURRENCE_TEMPORARILY_RESCHEDULED",
          entityType: "SCHEDULE_EXCEPTION", entityId: created.insertId,
          newValues: item, reason: input.reason.trim(),
        });
      }
      await connection.commit();
      return ids;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  async listBusySlots(from: string, to: string): Promise<TeacherBusySlot[]> {
    const rows = await this.busyRows(from, to);
    return rows.map(mapBusySlot);
  }

  async listAllBusySlots(): Promise<TeacherBusySlot[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *,TIME_FORMAT(start_time,'%H:%i') start_text,TIME_FORMAT(end_time,'%H:%i') end_text,
        DATE_FORMAT(specific_date,'%Y-%m-%d') specific_date_text,
        DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from_text,
        DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to_text
       FROM teacher_busy_slots ORDER BY COALESCE(specific_date,effective_from),start_time`,
    );
    return rows.map(mapBusySlot);
  }

  async listOutstandingMakeups(): Promise<OutstandingMakeupItem[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT mr.source_occurrence_key,mr.enrollment_id,mr.student_name_snapshot,mr.student_nickname_snapshot,mr.status,
        se.class_id,c.name class_name,DATE_FORMAT(se.original_date,'%Y-%m-%d') original_date,
        TIME_FORMAT(se.original_start_time,'%H:%i') original_start_time,TIME_FORMAT(se.original_end_time,'%H:%i') original_end_time,
        DATE_FORMAT(se.replacement_date,'%Y-%m-%d') replacement_date,
        TIME_FORMAT(se.replacement_start_time,'%H:%i') replacement_start_time,
        TIME_FORMAT(se.replacement_end_time,'%H:%i') replacement_end_time,
        COALESCE(se.replacement_cancel_reason,se.reason) reason,
        DATE_FORMAT(COALESCE(se.replacement_cancelled_at,se.created_at),'%Y-%m-%d') skipped_at
       FROM lesson_makeup_replacements mr
       JOIN schedule_exceptions se
         ON CONCAT(se.class_id,':',se.recurring_schedule_id,':',DATE_FORMAT(se.original_date,'%Y-%m-%d'))=mr.source_occurrence_key
       JOIN classes c ON c.id=se.class_id
       ORDER BY se.original_date,mr.source_occurrence_key,mr.id`,
    );
    const grouped = new Map<string, OutstandingMakeupItem>();
    for (const row of rows) {
      let item = grouped.get(String(row.source_occurrence_key));
      if (!item) {
        item = { sourceOccurrenceKey: String(row.source_occurrence_key), classId: Number(row.class_id),
          className: String(row.class_name), originalDate: String(row.original_date),
          originalStartTime: String(row.original_start_time), originalEndTime: String(row.original_end_time),
          replacementDate: row.replacement_date == null ? null : String(row.replacement_date),
          replacementStartTime: row.replacement_start_time == null ? null : String(row.replacement_start_time),
          replacementEndTime: row.replacement_end_time == null ? null : String(row.replacement_end_time),
          reason: row.reason == null ? null : String(row.reason), skippedAt: String(row.skipped_at),
          openCount: 0, reservedCount: 0, fulfilledCount: 0, waivedCount: 0, participants: [] };
        grouped.set(item.sourceOccurrenceKey, item);
      }
      const status = row.status as "OPEN" | "RESERVED" | "FULFILLED" | "WAIVED";
      if (status === "OPEN") item.openCount++;
      else if (status === "RESERVED") item.reservedCount++;
      else if (status === "FULFILLED") item.fulfilledCount++;
      else item.waivedCount++;
      item.participants.push({ enrollmentId: Number(row.enrollment_id), studentName: String(row.student_name_snapshot),
        studentNickname: row.student_nickname_snapshot == null ? null : String(row.student_nickname_snapshot),
        alreadyReplaced: status !== "OPEN", entitlementStatus: status });
    }
    return [...grouped.values()].filter((item) => item.openCount + item.reservedCount > 0);
  }

  async outstandingMakeupStudentCount(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) total FROM lesson_makeup_replacements WHERE status='OPEN'",
    );
    return Number(rows[0]?.total ?? 0);
  }

  async createBusySlot(input: TeacherBusySlotInput, actorUserId?: number): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO teacher_busy_slots
          (slot_type,organization_type,organization_name,title,recurrence_type,day_of_week,specific_date,start_time,end_time,effective_from,effective_to,location,note,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, busyValues(input, actorUserId),
      );
      await this.audit.record(connection, { actorUserId, action: "TEACHER_BUSY_SLOT_CREATED", entityType: "TEACHER_BUSY_SLOT", entityId: created.insertId, newValues: input });
      await connection.commit(); return created.insertId;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async updateBusySlot(id: number, input: TeacherBusySlotInput, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM teacher_busy_slots WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return false; }
      await connection.execute(
        `UPDATE teacher_busy_slots SET slot_type=?,organization_type=?,organization_name=?,title=?,recurrence_type=?,day_of_week=?,specific_date=?,start_time=?,end_time=?,
          effective_from=?,effective_to=?,location=?,note=? WHERE id=?`, [...busyValues(input).slice(0, 13), id],
      );
      await this.audit.record(connection, { actorUserId, action: "TEACHER_BUSY_SLOT_UPDATED", entityType: "TEACHER_BUSY_SLOT", entityId: id, previousValues: rows[0], newValues: input });
      await connection.commit(); return true;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async deleteBusySlot(id: number, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM teacher_busy_slots WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return false; }
      await connection.execute("DELETE FROM teacher_busy_slots WHERE id=?", [id]);
      await this.audit.record(connection, { actorUserId, action: "TEACHER_BUSY_SLOT_DELETED", entityType: "TEACHER_BUSY_SLOT", entityId: id, previousValues: rows[0] });
      await connection.commit(); return true;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async findBusySlot(id: number): Promise<TeacherBusySlot | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *,TIME_FORMAT(start_time,'%H:%i') start_text,TIME_FORMAT(end_time,'%H:%i') end_text,
        DATE_FORMAT(specific_date,'%Y-%m-%d') specific_date_text,
        DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from_text,
        DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to_text
       FROM teacher_busy_slots WHERE id=?`, [id],
    );
    return rows[0] ? mapBusySlot(rows[0]) : null;
  }

  async listUnrecorded(from: string, to: string): Promise<UnrecordedSession[]> {
    const occurrences = await this.listOccurrences(from, to);
    return occurrences.filter((item) => item.state === "UNRECORDED").map((item) => ({
      occurrenceKey: item.key,
      recurringScheduleId: item.recurringScheduleId,
      classId: item.classId,
      className: item.className,
      expectedDate: item.occurrenceDate,
      scheduledStartTime: item.scheduledStartTime,
      scheduledEndTime: item.scheduledEndTime,
    }));
  }

  async week(from: string, to: string): Promise<WeekScheduleResponse> {
    const [schedules] = await pool.query<RowDataPacket[]>(
      `SELECT rs.class_id,c.name class_name,rs.day_of_week,
        TIME_FORMAT(rs.start_time,'%H:%i') start_text,TIME_FORMAT(rs.end_time,'%H:%i') end_text
       FROM recurring_schedules rs JOIN classes c ON c.id=rs.class_id
       WHERE rs.effective_from<=? AND (rs.effective_to IS NULL OR rs.effective_to>=?)
         AND EXISTS (SELECT 1 FROM class_active_periods ap WHERE ap.class_id=rs.class_id
           AND ap.active_from<=? AND (ap.active_to IS NULL OR ap.active_to>=?))
       ORDER BY rs.day_of_week,rs.start_time`, [to, from, to, from],
    );
    const busy = await this.listBusySlots(from, to);
    const lessons = await this.listLessonEvents(from, to);
    const busyOccurrences = await this.expandBusyEvents(from, to);
    return {
      from, to, occurrences: await this.listOccurrences(from, to),
      lessons,
      busyOccurrences,
      classSchedules: schedules.map((row) => ({ classId: Number(row.class_id), className: String(row.class_name),
        dayOfWeek: Number(row.day_of_week), startTime: String(row.start_text), endTime: String(row.end_text) })),
      busySlots: busy.map((row) => ({ id: row.id, slotType: row.slotType, organizationType: row.organizationType,
        organizationName: row.organizationName, title: row.title, dayOfWeek: row.dayOfWeek,
        specificDate: row.specificDate, startTime: row.startTime, endTime: row.endTime, location: row.location })),
    };
  }

  private async listOccurrencesCore(from: string, to: string, classId?: number, includeConflicts = false): Promise<ScheduleOccurrence[]> {
    const params: unknown[] = [from, to, from, to];
    const classFilter = classId ? " AND class_id=?" : "";
    if (classId) params.push(classId);
    const [exceptionRows] = await pool.query<RowDataPacket[]>(
      `SELECT *,DATE_FORMAT(original_date,'%Y-%m-%d') original_date_text,
        DATE_FORMAT(replacement_date,'%Y-%m-%d') replacement_date_text,
        TIME_FORMAT(replacement_start_time,'%H:%i') replacement_start_text,
        TIME_FORMAT(replacement_end_time,'%H:%i') replacement_end_text
       FROM schedule_exceptions
       WHERE ((original_date BETWEEN ? AND ?) OR (replacement_date BETWEEN ? AND ?))${classFilter}`, params,
    );
    const originalDates = exceptionRows.map((row) => String(row.original_date_text));
    const expansionFrom = originalDates.reduce((value, date) => date < value ? date : value, from);
    const expansionTo = originalDates.reduce((value, date) => date > value ? date : value, to);
    const scheduleParams: unknown[] = [expansionTo, expansionFrom];
    const scheduleClassFilter = classId ? " AND rs.class_id=?" : "";
    if (classId) scheduleParams.push(classId);
    const [scheduleRows] = await pool.query<RowDataPacket[]>(
      `SELECT rs.id recurring_schedule_id,rs.class_id,c.name class_name,rs.day_of_week,
        DATE_FORMAT(rs.effective_from,'%Y-%m-%d') effective_from,
        DATE_FORMAT(rs.effective_to,'%Y-%m-%d') effective_to,
        TIME_FORMAT(rs.start_time,'%H:%i') start_time,TIME_FORMAT(rs.end_time,'%H:%i') end_time
       FROM recurring_schedules rs JOIN classes c ON c.id=rs.class_id
       WHERE rs.effective_from<=? AND (rs.effective_to IS NULL OR rs.effective_to>=?)${scheduleClassFilter}`,
      scheduleParams,
    );
    const classIds = [...new Set(scheduleRows.map((row) => Number(row.class_id)))];
    const activeByClass = new Map<number, Array<{ activeFrom: string; activeTo: string | null }>>();
    if (classIds.length) {
      const placeholders = classIds.map(() => "?").join(",");
      const [activeRows] = await pool.query<RowDataPacket[]>(
        `SELECT class_id,DATE_FORMAT(active_from,'%Y-%m-%d') active_from,
          DATE_FORMAT(active_to,'%Y-%m-%d') active_to
         FROM class_active_periods WHERE class_id IN (${placeholders}) AND active_from<=?
           AND (active_to IS NULL OR active_to>=?)`,
        [...classIds, expansionTo, expansionFrom],
      );
      for (const row of activeRows) {
        const key = Number(row.class_id);
        activeByClass.set(key, [...(activeByClass.get(key) ?? []), {
          activeFrom: String(row.active_from), activeTo: row.active_to == null ? null : String(row.active_to),
        }]);
      }
    }
    const lessons = await this.listLessonEvents(expansionFrom, expansionTo, classId);
    const lessonByKey = new Map(lessons.filter((item) => item.sourceKey).map((item) => [item.sourceKey!, item]));
    const lessonBySlot = new Map(lessons.map((item) => [`${item.classId}:${item.date}:${item.startTime}:${item.endTime}`, item]));
    const exceptionMap = new Map<string, RowDataPacket>();
    for (const row of exceptionRows) {
      const scheduleId = row.recurring_schedule_id == null ? 0 : Number(row.recurring_schedule_id);
      exceptionMap.set(`${scheduleId}:${row.original_date_text}`, row);
      if (scheduleId === 0) exceptionMap.set(`class:${row.class_id}:${row.original_date_text}`, row);
    }
    const projected = expandRecurringSchedules(
      scheduleRows.map((row) => mapSchedule(row, activeByClass.get(Number(row.class_id)) ?? [])),
      expansionFrom, expansionTo,
    );
    const results: ScheduleOccurrence[] = [];
    for (const base of projected) {
      const exceptionRow = exceptionMap.get(`${base.recurringScheduleId}:${base.occurrenceDate}`) ??
        exceptionMap.get(`class:${base.classId}:${base.occurrenceDate}`);
      const exception = exceptionRow ? mapException(exceptionRow) : null;
      const targetDate = exception?.type === "RESCHEDULED" ? exception.replacementDate : base.occurrenceDate;
      const targetStart = exception?.type === "RESCHEDULED" ? exception.replacementStartTime : base.scheduledStartTime;
      const targetEnd = exception?.type === "RESCHEDULED" ? exception.replacementEndTime : base.scheduledEndTime;
      const targetKey = exception?.type === "RESCHEDULED" ? replacementOccurrenceKey(base.key) : base.key;
      const lessonEvent = lessonByKey.get(targetKey) ??
        (targetDate && targetStart && targetEnd ? lessonBySlot.get(`${base.classId}:${targetDate}:${targetStart}:${targetEnd}`) : undefined);
      const lesson: ProjectionLessonInput | null = lessonEvent ? { id: lessonEvent.id, status: lessonEvent.status } : null;
      results.push(...reconcileOccurrence(base, exception, lesson));
    }
    const filtered = results.filter((item) => item.occurrenceDate >= from && item.occurrenceDate <= to);
    if (includeConflicts) {
      const busy = await this.expandBusyEvents(from, to);
      for (const item of filtered) {
        if (item.state !== "UNRECORDED") continue;
        const warnings: ScheduleConflictWarning[] = [];
        for (const other of filtered) {
          if (other.key === item.key || other.originalKey === item.originalKey || other.state !== "UNRECORDED") continue;
          if (timeRangesOverlap(item.occurrenceDate, item.scheduledStartTime, item.scheduledEndTime,
              other.occurrenceDate, other.scheduledStartTime, other.scheduledEndTime))
            warnings.push({ kind: "PROJECTED_OCCURRENCE", id: null, occurrenceKey: other.key, title: other.className,
              date: other.occurrenceDate, startTime: other.scheduledStartTime, endTime: other.scheduledEndTime });
        }
        for (const event of lessons) {
          if (event.status === "CANCELLED" || event.sourceKey === item.key) continue;
          if (timeRangesOverlap(item.occurrenceDate, item.scheduledStartTime, item.scheduledEndTime,
              event.date, event.startTime, event.endTime))
            warnings.push({ kind: "LESSON", id: event.id, occurrenceKey: event.sourceKey,
              title: `${event.className} · ${event.lessonType}`, date: event.date, startTime: event.startTime, endTime: event.endTime });
        }
        for (const event of busy) {
          if (timeRangesOverlap(item.occurrenceDate, item.scheduledStartTime, item.scheduledEndTime,
              event.date, event.startTime, event.endTime))
            warnings.push({ kind: "BUSY_SLOT", id: event.id, occurrenceKey: null, title: event.title,
              date: event.date, startTime: event.startTime, endTime: event.endTime });
        }
        item.conflicts = dedupeWarnings(warnings);
      }
    }
    return filtered.sort(compareOccurrences);
  }

  private async findException(scheduleId: number, date: string): Promise<ProjectionExceptionInput | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id,exception_type,DATE_FORMAT(replacement_date,'%Y-%m-%d') replacement_date,
        TIME_FORMAT(replacement_start_time,'%H:%i') replacement_start_time,
        TIME_FORMAT(replacement_end_time,'%H:%i') replacement_end_time,reason,
        replacement_cancelled_at,replacement_cancel_reason,makeup_required
       FROM schedule_exceptions WHERE recurring_schedule_id=? AND original_date=?`, [scheduleId, date],
    );
    return rows[0] ? mapException(rows[0]) : null;
  }

  private async findLessonByOccurrenceKey(key: string): Promise<ProjectionLessonInput | null> {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id,status FROM lesson_sessions WHERE source_occurrence_key=?", [key]);
    return rows[0] ? { id: Number(rows[0].id), status: rows[0].status } : null;
  }

  private async listLessonEvents(from: string, to: string, classId?: number): Promise<LessonEvent[]> {
    const params: unknown[] = [from, to];
    const classFilter = classId ? " AND l.class_id=?" : "";
    if (classId) params.push(classId);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.id,l.source_occurrence_key,l.class_id,COALESCE(l.class_name_snapshot,c.name) class_name,
        DATE_FORMAT(l.session_date,'%Y-%m-%d') session_date,
        TIME_FORMAT(l.scheduled_start_time,'%H:%i') start_time,
        TIME_FORMAT(l.scheduled_end_time,'%H:%i') end_time,l.status,l.lesson_type
       FROM lesson_sessions l JOIN classes c ON c.id=l.class_id
       WHERE l.session_date BETWEEN ? AND ?${classFilter}`, params,
    );
    return rows.map((row) => ({ id: Number(row.id), sourceKey: row.source_occurrence_key == null ? null : String(row.source_occurrence_key),
      classId: Number(row.class_id), className: String(row.class_name), date: String(row.session_date),
      startTime: String(row.start_time), endTime: String(row.end_time), status: row.status, lessonType: row.lesson_type }));
  }

  private async busyRows(from: string, to: string): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *,TIME_FORMAT(start_time,'%H:%i') start_text,TIME_FORMAT(end_time,'%H:%i') end_text,
        DATE_FORMAT(specific_date,'%Y-%m-%d') specific_date_text,
        DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from_text,
        DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to_text
       FROM teacher_busy_slots
       WHERE (recurrence_type='ONCE' AND specific_date BETWEEN ? AND ?)
          OR (recurrence_type='WEEKLY' AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?))
       ORDER BY COALESCE(specific_date,effective_from),start_time`, [from, to, to, from],
    );
    return rows;
  }

  private async expandBusyEvents(from: string, to: string): Promise<BusyOccurrence[]> {
    const slots = (await this.busyRows(from, to)).map(mapBusySlot);
    const events: BusyOccurrence[] = [];
    for (const slot of slots) {
      if (slot.recurrenceType === "ONCE" && slot.specificDate)
        events.push({ id: slot.id, slotType: slot.slotType, organizationType: slot.organizationType, organizationName: slot.organizationName,
          title: slot.title, date: slot.specificDate, startTime: slot.startTime, endTime: slot.endTime, location: slot.location });
      if (slot.recurrenceType === "WEEKLY")
        for (let date = from; date <= to; date = addDays(date, 1))
          if (weekdayIso(date) === slot.dayOfWeek && date >= (slot.effectiveFrom ?? date) && (!slot.effectiveTo || date <= slot.effectiveTo))
            events.push({ id: slot.id, slotType: slot.slotType, organizationType: slot.organizationType, organizationName: slot.organizationName,
              title: slot.title, date, startTime: slot.startTime, endTime: slot.endTime, location: slot.location });
    }
    return events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id - b.id);
  }
}

function mapSchedule(row: RowDataPacket, activePeriods?: RecurringProjectionInput["activePeriods"]): RecurringProjectionInput {
  return { recurringScheduleId: Number(row.recurring_schedule_id), classId: Number(row.class_id), className: String(row.class_name),
    dayOfWeek: Number(row.day_of_week), startTime: String(row.start_time), endTime: String(row.end_time),
    effectiveFrom: String(row.effective_from), effectiveTo: row.effective_to == null ? null : String(row.effective_to), activePeriods };
}
function mapException(row: RowDataPacket): ProjectionExceptionInput {
  return { id: Number(row.id), type: row.exception_type,
    replacementDate: row.replacement_date_text ?? row.replacement_date ?? null,
    replacementStartTime: row.replacement_start_text ?? row.replacement_start_time ?? null,
    replacementEndTime: row.replacement_end_text ?? row.replacement_end_time ?? null,
    reason: row.reason == null ? null : String(row.reason),
    replacementCancelledAt: row.replacement_cancelled_at == null ? null : String(row.replacement_cancelled_at),
    replacementCancelReason: row.replacement_cancel_reason == null ? null : String(row.replacement_cancel_reason),
    makeupRequired: row.makeup_required == null ? true : Boolean(row.makeup_required) };
}
function mapBusySlot(row: RowDataPacket): TeacherBusySlot {
  return { id: Number(row.id), slotType: row.slot_type, organizationType: row.organization_type ?? null,
    organizationName: row.organization_name == null ? null : String(row.organization_name), title: String(row.title), recurrenceType: row.recurrence_type,
    dayOfWeek: row.day_of_week == null ? null : Number(row.day_of_week) as 1 | 2 | 3 | 4 | 5 | 6 | 7, specificDate: row.specific_date_text ?? null,
    startTime: String(row.start_text), endTime: String(row.end_text), effectiveFrom: row.effective_from_text ?? null,
    effectiveTo: row.effective_to_text ?? null, location: row.location == null ? null : String(row.location),
    note: row.note == null ? null : String(row.note), conflicts: [] };
}
function busyValues(input: TeacherBusySlotInput, actorUserId?: number): Array<string | number | null> {
  return [input.slotType, input.slotType === "EXTERNAL_CLASS" ? input.organizationType ?? null : null,
    input.slotType === "EXTERNAL_CLASS" ? input.organizationName?.trim() || null : null,
    input.title.trim(), input.recurrenceType, input.recurrenceType === "WEEKLY" ? input.dayOfWeek ?? null : null,
    input.recurrenceType === "ONCE" ? input.specificDate ?? null : null, input.startTime, input.endTime,
    input.recurrenceType === "WEEKLY" ? input.effectiveFrom ?? null : null,
    input.recurrenceType === "WEEKLY" ? input.effectiveTo ?? null : null,
    input.location?.trim() || null, input.note?.trim() || null, actorUserId ?? null];
}
function dateOnly(value: unknown): string { return String(value).slice(0, 10); }
function nullableDate(value: unknown): string | null { return value == null ? null : String(value).slice(0, 10); }
function nullableTime(value: unknown): string | null { return value == null ? null : String(value).slice(0, 5); }
function dedupeWarnings(items: ScheduleConflictWarning[]): ScheduleConflictWarning[] {
  return [...new Map(items.map((item) => [`${item.kind}:${item.id ?? item.occurrenceKey}:${item.date}:${item.startTime}`, item])).values()];
}
