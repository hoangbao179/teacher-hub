import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CreateRecurringScheduleRequest, UnrecordedSession, WeekScheduleResponse } from "@teacher/shared";
import { pool } from "../db/pool";
import { addDays, weekdayIso } from "../utils/date";
import { AuditRepository } from "./audit.repository";

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

  async update(id: number, input: CreateRecurringScheduleRequest, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM recurring_schedules WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return false; }
      await connection.execute("UPDATE recurring_schedules SET day_of_week=?,start_time=?,end_time=?,effective_from=?,effective_to=? WHERE id=?", [input.dayOfWeek, input.startTime, input.endTime, input.effectiveFrom, input.effectiveTo ?? null, id]);
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_UPDATED", entityType: "RECURRING_SCHEDULE", entityId: id, previousValues: rows[0], newValues: input });
      await connection.commit(); return true;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async remove(id: number, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM recurring_schedules WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return false; }
      await connection.execute("DELETE FROM recurring_schedules WHERE id=?", [id]);
      await this.audit.record(connection, { actorUserId, action: "RECURRING_SCHEDULE_DELETED", entityType: "RECURRING_SCHEDULE", entityId: id, previousValues: rows[0] });
      await connection.commit(); return true;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async listUnrecorded(from: string, to: string): Promise<UnrecordedSession[]> {
    const [schedules] = await pool.query<RowDataPacket[]>(
      `
      SELECT rs.*,c.name class_name,c.status class_status,TIME_FORMAT(rs.start_time,'%H:%i') start_text,TIME_FORMAT(rs.end_time,'%H:%i') end_text
      FROM recurring_schedules rs JOIN classes c ON c.id=rs.class_id WHERE c.status='ACTIVE' AND rs.effective_from<=? AND (rs.effective_to IS NULL OR rs.effective_to>=?)
    `,
      [to, from],
    );
    const [exceptions] = await pool.query<RowDataPacket[]>(
      "SELECT class_id,original_date,exception_type FROM schedule_exceptions WHERE original_date BETWEEN ? AND ?",
      [from, to],
    );
    const exceptionSet = new Set(
      exceptions.map(
        (row) => `${row.class_id}:${String(row.original_date).slice(0, 10)}`,
      ),
    );
    const [recorded] = await pool.query<RowDataPacket[]>(
      "SELECT class_id,session_date FROM lesson_sessions WHERE session_date BETWEEN ? AND ? AND status IN ('DRAFT','COMPLETED','CANCELLED')",
      [from, to],
    );
    const recordedSet = new Set(
      recorded.map(
        (row) => `${row.class_id}:${String(row.session_date).slice(0, 10)}`,
      ),
    );
    const result: UnrecordedSession[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const day = weekdayIso(date);
      for (const row of schedules) {
        const effectiveFrom = String(row.effective_from).slice(0, 10);
        const effectiveTo = row.effective_to
          ? String(row.effective_to).slice(0, 10)
          : null;
        if (
          Number(row.day_of_week) !== day ||
          date < effectiveFrom ||
          (effectiveTo && date > effectiveTo)
        )
          continue;
        const key = `${row.class_id}:${date}`;
        if (exceptionSet.has(key) || recordedSet.has(key)) continue;
        result.push({
          classId: Number(row.class_id),
          className: String(row.class_name),
          expectedDate: date,
          scheduledStartTime: String(row.start_text),
          scheduledEndTime: String(row.end_text),
        });
      }
    }
    return result.sort(
      (a, b) =>
        a.expectedDate.localeCompare(b.expectedDate) ||
        a.scheduledStartTime.localeCompare(b.scheduledStartTime),
    );
  }

  async week(from: string, to: string): Promise<WeekScheduleResponse> {
    const [classSchedules] = await pool.query<RowDataPacket[]>(`
      SELECT rs.class_id,c.name class_name,rs.day_of_week,TIME_FORMAT(rs.start_time,'%H:%i') start_text,TIME_FORMAT(rs.end_time,'%H:%i') end_text
      FROM recurring_schedules rs JOIN classes c ON c.id=rs.class_id
      WHERE c.status='ACTIVE' AND rs.effective_from<=? AND (rs.effective_to IS NULL OR rs.effective_to>=?)
      ORDER BY rs.day_of_week,rs.start_time
    `, [to, from]);
    const [busy] = await pool.query<RowDataPacket[]>(
      `
      SELECT id,title,day_of_week,specific_date,TIME_FORMAT(start_time,'%H:%i') start_text,TIME_FORMAT(end_time,'%H:%i') end_text,location
      FROM teacher_busy_slots WHERE (recurrence_type='WEEKLY') OR (specific_date BETWEEN ? AND ?) ORDER BY COALESCE(specific_date,'9999-12-31'),day_of_week,start_time
    `,
      [from, to],
    );
    return {
      from,
      to,
      classSchedules: classSchedules.map((row) => ({
        classId: Number(row.class_id),
        className: String(row.class_name),
        dayOfWeek: Number(row.day_of_week),
        startTime: String(row.start_text),
        endTime: String(row.end_text),
      })),
      busySlots: busy.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        dayOfWeek: row.day_of_week == null ? null : Number(row.day_of_week),
        specificDate: row.specific_date
          ? String(row.specific_date).slice(0, 10)
          : null,
        startTime: String(row.start_text),
        endTime: String(row.end_text),
        location: row.location ? String(row.location) : null,
      })),
    };
  }
}
