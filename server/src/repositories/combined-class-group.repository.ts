import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  CombinedClassGroup,
  CombinedClassGroupMutationRequest,
  EndCombinedClassGroupRequest,
  RescheduleOccurrenceRequest,
  SkipOccurrenceRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { parseCombinedOccurrenceKey } from "../domain/combined-class-group-projection";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "./audit.repository";

type MutationResult =
  | { kind: "OK"; id: number }
  | { kind: "NOT_FOUND" | "CLASS_NOT_ACTIVE" | "MEMBERSHIP_CONFLICT" | "SCHEDULE_CONFLICT" | "HISTORY_CONFLICT" };

export interface CombinedOccurrenceDefinition {
  occurrenceId: number;
  groupId: number;
  groupName: string;
  scheduleId: number;
  occurrenceDate: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: "DRAFT" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
  replacement: boolean;
  memberClasses: Array<{ id: number; name: string }>;
  idempotent: boolean;
}

interface PersistedCombinedOccurrence {
  id: number;
  status: "DRAFT" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
  replacement_date: string | null;
  replacement_start_time: string | null;
  replacement_end_time: string | null;
}

export class CombinedClassGroupRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async list(): Promise<CombinedClassGroup[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id,name,
        CASE WHEN status='ENDED' OR (effective_to IS NOT NULL AND effective_to<CURDATE())
          THEN 'ENDED' ELSE 'ACTIVE' END status,
        DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from,
        DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to,created_at,updated_at
       FROM combined_class_groups
       ORDER BY FIELD(status,'ACTIVE','ENDED'),effective_from DESC,id DESC`,
    );
    return this.hydrate(rows);
  }

  async find(id: number): Promise<CombinedClassGroup | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id,name,
        CASE WHEN status='ENDED' OR (effective_to IS NOT NULL AND effective_to<CURDATE())
          THEN 'ENDED' ELSE 'ACTIVE' END status,
        DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from,
        DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to,created_at,updated_at
       FROM combined_class_groups WHERE id=?`,
      [id],
    );
    return (await this.hydrate(rows))[0] ?? null;
  }

  async create(
    input: CombinedClassGroupMutationRequest,
    actorUserId?: number,
  ): Promise<MutationResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const conflict = await this.validateReferencesAndConflicts(connection, input);
      if (conflict) {
        await connection.rollback();
        return { kind: conflict };
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO combined_class_groups
          (name,status,effective_from,effective_to,created_by)
         VALUES (?,'ACTIVE',?,?,?)`,
        [input.name.trim(), input.effectiveFrom, input.effectiveTo ?? null, actorUserId ?? null],
      );
      await this.replaceMembersAndSchedules(connection, result.insertId, input);
      await this.audit.record(connection, {
        actorUserId,
        action: "COMBINED_CLASS_GROUP_CREATED",
        entityType: "COMBINED_CLASS_GROUP",
        entityId: result.insertId,
        newValues: input,
      });
      await connection.commit();
      return { kind: "OK", id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(
    id: number,
    input: CombinedClassGroupMutationRequest,
    actorUserId?: number,
  ): Promise<MutationResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [groups] = await connection.query<RowDataPacket[]>(
        `SELECT *,DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from_text,
          DATE_FORMAT(effective_to,'%Y-%m-%d') effective_to_text
         FROM combined_class_groups WHERE id=? FOR UPDATE`,
        [id],
      );
      const existing = groups[0];
      if (!existing) {
        await connection.rollback();
        return { kind: "NOT_FOUND" };
      }
      const conflict = await this.validateReferencesAndConflicts(connection, input, id);
      if (conflict) {
        await connection.rollback();
        return { kind: conflict };
      }
      const [memberRows] = await connection.query<RowDataPacket[]>(
        "SELECT class_id FROM combined_class_group_classes WHERE group_id=? ORDER BY class_id",
        [id],
      );
      const [scheduleRows] = await connection.query<RowDataPacket[]>(
        `SELECT day_of_week,TIME_FORMAT(start_time,'%H:%i') start_time,
          TIME_FORMAT(end_time,'%H:%i') end_time
         FROM combined_class_group_schedules WHERE group_id=?
         ORDER BY day_of_week,start_time,end_time`,
        [id],
      );
      const [historyRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) count,MAX(DATE_FORMAT(occurrence_date,'%Y-%m-%d')) latest
         FROM combined_teaching_occurrences WHERE group_id=?`,
        [id],
      );
      const hasHistory = Number(historyRows[0]?.count ?? 0) > 0;
      const existingClassIds = memberRows.map((row) => Number(row.class_id));
      const nextClassIds = [...input.classIds].sort((a, b) => a - b);
      const existingSchedules = scheduleRows.map((row) =>
        `${row.day_of_week}:${row.start_time}:${row.end_time}`);
      const nextSchedules = [...input.schedules]
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
        .map((item) => `${item.dayOfWeek}:${item.startTime}:${item.endTime}`);
      const structuralChange =
        String(existing.effective_from_text) !== input.effectiveFrom ||
        JSON.stringify(existingClassIds) !== JSON.stringify(nextClassIds) ||
        JSON.stringify(existingSchedules) !== JSON.stringify(nextSchedules);
      const latest = historyRows[0]?.latest == null ? null : String(historyRows[0].latest);
      if (hasHistory && (structuralChange || (input.effectiveTo && latest && input.effectiveTo < latest))) {
        await connection.rollback();
        return { kind: "HISTORY_CONFLICT" };
      }
      await connection.execute(
        `UPDATE combined_class_groups
         SET name=?,effective_from=?,effective_to=?,
           status=CASE WHEN status='ENDED' THEN 'ENDED' ELSE 'ACTIVE' END
         WHERE id=?`,
        [input.name.trim(), input.effectiveFrom, input.effectiveTo ?? null, id],
      );
      if (!hasHistory) await this.replaceMembersAndSchedules(connection, id, input);
      await this.audit.record(connection, {
        actorUserId,
        action: "COMBINED_CLASS_GROUP_UPDATED",
        entityType: "COMBINED_CLASS_GROUP",
        entityId: id,
        previousValues: existing,
        newValues: input,
      });
      await connection.commit();
      return { kind: "OK", id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async end(
    id: number,
    input: EndCombinedClassGroupRequest,
    actorUserId?: number,
  ): Promise<MutationResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [groups] = await connection.query<RowDataPacket[]>(
        `SELECT *,DATE_FORMAT(effective_from,'%Y-%m-%d') effective_from_text
         FROM combined_class_groups WHERE id=? FOR UPDATE`,
        [id],
      );
      const existing = groups[0];
      if (!existing) {
        await connection.rollback();
        return { kind: "NOT_FOUND" };
      }
      const [history] = await connection.query<RowDataPacket[]>(
        "SELECT MAX(DATE_FORMAT(occurrence_date,'%Y-%m-%d')) latest FROM combined_teaching_occurrences WHERE group_id=?",
        [id],
      );
      const latest = history[0]?.latest == null ? null : String(history[0].latest);
      if (input.effectiveTo < String(existing.effective_from_text) ||
          (latest && input.effectiveTo < latest)) {
        await connection.rollback();
        return { kind: "HISTORY_CONFLICT" };
      }
      await connection.execute(
        "UPDATE combined_class_groups SET status='ENDED',effective_to=? WHERE id=?",
        [input.effectiveTo, id],
      );
      await this.audit.record(connection, {
        actorUserId,
        action: "COMBINED_CLASS_GROUP_ENDED",
        entityType: "COMBINED_CLASS_GROUP",
        entityId: id,
        previousValues: existing,
        newValues: input,
        reason: input.reason,
      });
      await connection.commit();
      return { kind: "OK", id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async ensureOccurrence(
    connection: PoolConnection,
    key: string,
    actorUserId?: number,
  ): Promise<CombinedOccurrenceDefinition> {
    const parsed = parseCombinedOccurrenceKey(key);
    if (!parsed) throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã ca học ghép không hợp lệ.");
    const definition = await this.definitionForUpdate(connection, parsed.groupId, parsed.scheduleId, parsed.occurrenceDate);
    if (!definition) throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Không tìm thấy ca học ghép dự kiến.");
    let persisted: PersistedCombinedOccurrence | null = definition.persisted;
    let idempotent = Boolean(persisted);
    if (!persisted) {
      if (parsed.replacement)
        throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Không tìm thấy ca học ghép thay thế.");
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO combined_teaching_occurrences
          (group_id,group_schedule_id,occurrence_date,scheduled_start_time,scheduled_end_time,status,created_by)
         VALUES (?,?,?,?,?,'DRAFT',?)`,
        [parsed.groupId, parsed.scheduleId, parsed.occurrenceDate,
          definition.startTime, definition.endTime, actorUserId ?? null],
      );
      persisted = {
        id: created.insertId,
        status: "DRAFT",
        replacement_date: null,
        replacement_start_time: null,
        replacement_end_time: null,
      };
      idempotent = false;
    }
    if (persisted.status === "SKIPPED")
      throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Ca học ghép đã được cho nghỉ.");
    if (persisted.status === "RESCHEDULED" && !parsed.replacement)
      throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Ca học ghép đã được đổi lịch.");
    if (parsed.replacement && persisted.status !== "RESCHEDULED")
      throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Ca học ghép không có lịch thay thế.");
    if (!persisted)
      throw new AppError(500, "COMBINED_OCCURRENCE_WRITE_FAILED", "Không thể tạo ca học ghép.");
    const sessionDate = parsed.replacement ? String(persisted.replacement_date) : parsed.occurrenceDate;
    const startTime = parsed.replacement
      ? String(persisted.replacement_start_time).slice(0, 5)
      : definition.startTime;
    const endTime = parsed.replacement
      ? String(persisted.replacement_end_time).slice(0, 5)
      : definition.endTime;
    return {
      occurrenceId: Number(persisted.id),
      groupId: parsed.groupId,
      groupName: definition.groupName,
      scheduleId: parsed.scheduleId,
      occurrenceDate: parsed.occurrenceDate,
      sessionDate,
      startTime,
      endTime,
      status: persisted.status,
      replacement: parsed.replacement,
      memberClasses: definition.memberClasses,
      idempotent,
    };
  }

  async writeOccurrenceAction(
    key: string,
    type: "SKIPPED" | "RESCHEDULED",
    input: SkipOccurrenceRequest | RescheduleOccurrenceRequest,
    actorUserId?: number,
  ): Promise<{ id: number; idempotent: boolean }> {
    const parsed = parseCombinedOccurrenceKey(key);
    if (!parsed || parsed.replacement)
      throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã ca học ghép gốc không hợp lệ.");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const definition = await this.definitionForUpdate(
        connection,
        parsed.groupId,
        parsed.scheduleId,
        parsed.occurrenceDate,
      );
      if (!definition)
        throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Không tìm thấy ca học ghép dự kiến.");
      const persisted = definition.persisted;
      if (persisted) {
        const [children] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM lesson_sessions WHERE combined_teaching_occurrence_id=? FOR UPDATE",
          [persisted.id],
        );
        if (children.length)
          throw new AppError(409, "OCCURRENCE_RECORDED", "Ca học ghép đã có buổi học và không thể thay đổi lịch.");
        if (persisted.status === type) {
          await connection.commit();
          return { id: Number(persisted.id), idempotent: true };
        }
        throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Ca học ghép đã được xử lý.");
      }
      const reschedule = type === "RESCHEDULED" ? input as RescheduleOccurrenceRequest : null;
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO combined_teaching_occurrences
          (group_id,group_schedule_id,occurrence_date,scheduled_start_time,scheduled_end_time,status,
           replacement_date,replacement_start_time,replacement_end_time,reason,note,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          parsed.groupId,
          parsed.scheduleId,
          parsed.occurrenceDate,
          definition.startTime,
          definition.endTime,
          type,
          reschedule?.replacementDate ?? null,
          reschedule?.replacementStartTime ?? null,
          reschedule?.replacementEndTime ?? null,
          input.reason.trim(),
          input.note?.trim() || null,
          actorUserId ?? null,
        ],
      );
      await this.audit.record(connection, {
        actorUserId,
        action: type === "SKIPPED"
          ? "COMBINED_OCCURRENCE_SKIPPED"
          : "COMBINED_OCCURRENCE_RESCHEDULED",
        entityType: "COMBINED_TEACHING_OCCURRENCE",
        entityId: created.insertId,
        newValues: { key, ...input },
      });
      await connection.commit();
      return { id: created.insertId, idempotent: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async occurrenceHeader(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT o.id,o.group_id,g.name group_name,o.group_schedule_id,
        DATE_FORMAT(o.occurrence_date,'%Y-%m-%d') occurrence_date,
        TIME_FORMAT(o.scheduled_start_time,'%H:%i') scheduled_start_time,
        TIME_FORMAT(o.scheduled_end_time,'%H:%i') scheduled_end_time,o.status,
        DATE_FORMAT(o.replacement_date,'%Y-%m-%d') replacement_date,
        TIME_FORMAT(o.replacement_start_time,'%H:%i') replacement_start_time,
        TIME_FORMAT(o.replacement_end_time,'%H:%i') replacement_end_time
       FROM combined_teaching_occurrences o
       JOIN combined_class_groups g ON g.id=o.group_id
       WHERE o.id=?`,
      [id],
    );
    return rows[0] ?? null;
  }

  async childLessons(id: number): Promise<Array<{ lessonId: number; classId: number; className: string }>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.id lesson_id,l.class_id,COALESCE(l.class_name_snapshot,c.name) class_name
       FROM lesson_sessions l JOIN classes c ON c.id=l.class_id
       WHERE l.combined_teaching_occurrence_id=? ORDER BY class_name,l.id`,
      [id],
    );
    return rows.map((row) => ({
      lessonId: Number(row.lesson_id),
      classId: Number(row.class_id),
      className: String(row.class_name),
    }));
  }

  async childLessonIdsForUpdate(connection: PoolConnection, id: number): Promise<number[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM lesson_sessions WHERE combined_teaching_occurrence_id=? ORDER BY id FOR UPDATE",
      [id],
    );
    return rows.map((row) => Number(row.id));
  }

  async childLessonParticipantsForUpdate(
    connection: PoolConnection,
    id: number,
  ): Promise<Array<{ lessonId: number; enrollmentId: number }>> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT l.id lesson_id,p.enrollment_id
       FROM lesson_sessions l
       JOIN lesson_session_participants p ON p.lesson_session_id=l.id
       WHERE l.combined_teaching_occurrence_id=?
       ORDER BY l.id,p.id FOR UPDATE`,
      [id],
    );
    return rows.map((row) => ({
      lessonId: Number(row.lesson_id),
      enrollmentId: Number(row.enrollment_id),
    }));
  }

  async markOccurrenceCompleted(connection: PoolConnection, id: number): Promise<void> {
    await connection.execute(
      "UPDATE combined_teaching_occurrences SET status='COMPLETED' WHERE id=?",
      [id],
    );
  }

  private async hydrate(rows: RowDataPacket[]): Promise<CombinedClassGroup[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => Number(row.id));
    const placeholders = ids.map(() => "?").join(",");
    const [members] = await pool.query<RowDataPacket[]>(
      `SELECT gc.group_id,c.id,c.name
       FROM combined_class_group_classes gc JOIN classes c ON c.id=gc.class_id
       WHERE gc.group_id IN (${placeholders}) ORDER BY c.name,c.id`,
      ids,
    );
    const [schedules] = await pool.query<RowDataPacket[]>(
      `SELECT id,group_id,day_of_week,TIME_FORMAT(start_time,'%H:%i') start_time,
        TIME_FORMAT(end_time,'%H:%i') end_time
       FROM combined_class_group_schedules WHERE group_id IN (${placeholders})
       ORDER BY day_of_week,start_time`,
      ids,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      status: row.status,
      effectiveFrom: String(row.effective_from),
      effectiveTo: row.effective_to == null ? null : String(row.effective_to),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      classes: members.filter((item) => Number(item.group_id) === Number(row.id))
        .map((item) => ({ id: Number(item.id), name: String(item.name) })),
      schedules: schedules.filter((item) => Number(item.group_id) === Number(row.id))
        .map((item) => ({
          id: Number(item.id),
          dayOfWeek: Number(item.day_of_week) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          startTime: String(item.start_time),
          endTime: String(item.end_time),
        })),
    }));
  }

  private async replaceMembersAndSchedules(
    connection: PoolConnection,
    id: number,
    input: CombinedClassGroupMutationRequest,
  ): Promise<void> {
    await connection.execute("DELETE FROM combined_class_group_classes WHERE group_id=?", [id]);
    await connection.execute("DELETE FROM combined_class_group_schedules WHERE group_id=?", [id]);
    for (const classId of input.classIds)
      await connection.execute(
        "INSERT INTO combined_class_group_classes(group_id,class_id) VALUES (?,?)",
        [id, classId],
      );
    for (const schedule of input.schedules)
      await connection.execute(
        `INSERT INTO combined_class_group_schedules(group_id,day_of_week,start_time,end_time)
         VALUES (?,?,?,?)`,
        [id, schedule.dayOfWeek, schedule.startTime, schedule.endTime],
      );
  }

  private async validateReferencesAndConflicts(
    connection: PoolConnection,
    input: CombinedClassGroupMutationRequest,
    excludeId?: number,
  ): Promise<Exclude<MutationResult["kind"], "OK" | "NOT_FOUND" | "HISTORY_CONFLICT"> | null> {
    const placeholders = input.classIds.map(() => "?").join(",");
    const [classes] = await connection.query<RowDataPacket[]>(
      `SELECT id,status FROM classes WHERE id IN (${placeholders}) FOR UPDATE`,
      input.classIds,
    );
    if (classes.length !== input.classIds.length || classes.some((row) => row.status !== "ACTIVE"))
      return "CLASS_NOT_ACTIVE";
    const overlapParams: unknown[] = [
      ...input.classIds,
      input.effectiveTo ?? "9999-12-31",
      input.effectiveFrom,
    ];
    let exclude = "";
    if (excludeId) {
      exclude = " AND g.id<>?";
      overlapParams.push(excludeId);
    }
    const [memberships] = await connection.query<RowDataPacket[]>(
      `SELECT g.id FROM combined_class_groups g
       JOIN combined_class_group_classes gc ON gc.group_id=g.id
       WHERE gc.class_id IN (${placeholders})
         AND g.effective_from<=? AND (g.effective_to IS NULL OR g.effective_to>=?)${exclude}
       LIMIT 1 FOR UPDATE`,
      overlapParams,
    );
    if (memberships.length) return "MEMBERSHIP_CONFLICT";
    for (const schedule of input.schedules) {
      const params: unknown[] = [
        input.effectiveTo ?? "9999-12-31",
        input.effectiveFrom,
        schedule.dayOfWeek,
        schedule.endTime,
        schedule.startTime,
      ];
      let scheduleExclude = "";
      if (excludeId) {
        scheduleExclude = " AND g.id<>?";
        params.push(excludeId);
      }
      const [conflicts] = await connection.query<RowDataPacket[]>(
        `SELECT s.id FROM combined_class_group_schedules s
         JOIN combined_class_groups g ON g.id=s.group_id
         WHERE g.effective_from<=? AND (g.effective_to IS NULL OR g.effective_to>=?)
           AND s.day_of_week=? AND s.start_time<? AND ?<s.end_time${scheduleExclude}
         LIMIT 1 FOR UPDATE`,
        params,
      );
      if (conflicts.length) return "SCHEDULE_CONFLICT";
    }
    return null;
  }

  private async definitionForUpdate(
    connection: PoolConnection,
    groupId: number,
    scheduleId: number,
    date: string,
  ): Promise<{
    groupName: string;
    startTime: string;
    endTime: string;
    memberClasses: Array<{ id: number; name: string }>;
    persisted: PersistedCombinedOccurrence | null;
  } | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT g.name,TIME_FORMAT(s.start_time,'%H:%i') start_time,
        TIME_FORMAT(s.end_time,'%H:%i') end_time
       FROM combined_class_groups g
       JOIN combined_class_group_schedules s ON s.group_id=g.id
       WHERE g.id=? AND s.id=? AND g.effective_from<=?
         AND (g.effective_to IS NULL OR g.effective_to>=?)
         AND s.day_of_week=WEEKDAY(?)+1
       FOR UPDATE`,
      [groupId, scheduleId, date, date, date],
    );
    if (!rows[0]) return null;
    const [members] = await connection.query<RowDataPacket[]>(
      `SELECT c.id,c.name FROM combined_class_group_classes gc
       JOIN classes c ON c.id=gc.class_id WHERE gc.group_id=? ORDER BY c.name,c.id FOR UPDATE`,
      [groupId],
    );
    const [occurrences] = await connection.query<RowDataPacket[]>(
      `SELECT *,DATE_FORMAT(replacement_date,'%Y-%m-%d') replacement_date,
        TIME_FORMAT(replacement_start_time,'%H:%i') replacement_start_time,
        TIME_FORMAT(replacement_end_time,'%H:%i') replacement_end_time
       FROM combined_teaching_occurrences
       WHERE group_schedule_id=? AND occurrence_date=? FOR UPDATE`,
      [scheduleId, date],
    );
    return {
      groupName: String(rows[0].name),
      startTime: String(rows[0].start_time),
      endTime: String(rows[0].end_time),
      memberClasses: members.map((row) => ({ id: Number(row.id), name: String(row.name) })),
      persisted: occurrences[0] ? {
        id: Number(occurrences[0].id),
        status: occurrences[0].status,
        replacement_date: occurrences[0].replacement_date == null
          ? null
          : String(occurrences[0].replacement_date),
        replacement_start_time: occurrences[0].replacement_start_time == null
          ? null
          : String(occurrences[0].replacement_start_time),
        replacement_end_time: occurrences[0].replacement_end_time == null
          ? null
          : String(occurrences[0].replacement_end_time),
      } : null,
    };
  }
}
