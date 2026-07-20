import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { StudentReportExportQuery } from "@teacher/shared";
import { pool } from "../db/pool";
import { AuditRepository } from "./audit.repository";

export interface StudentReportStudent {
  id: number;
  fullName: string;
  nickname: string | null;
  parentName: string | null;
  parentPhone: string | null;
  currentClassName: string | null;
}

export interface StudentLearningReportRow {
  attendanceId: number;
  lessonId: number;
  sessionDate: string;
  classId: number;
  className: string;
  lessonType: "REGULAR" | "MAKEUP" | "EXTRA";
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  attendanceStatus: "PRESENT" | "ABSENT" | "FREE";
  countsForTuition: boolean;
  content: string | null;
  homework: string | null;
  studentNote: string | null;
  lessonNote: string | null;
}

export interface StudentTuitionReportRow {
  cycleId: number;
  enrollmentId: number;
  cycleNumber: number;
  cycleStatus: "ACCUMULATING" | "PAYMENT_DUE" | "PAID" | "INCOMPLETE";
  classId: number;
  className: string;
  startedAt: string | null;
  reachedTargetAt: string | null;
  packagePriceSnapshot: number;
  paidAt: string | null;
  paidAmount: number | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | null;
  paymentNote: string | null;
  cycleItemCount: number;
  sequenceNumber: number;
  sessionDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
}

function dateText(value: unknown): string | null {
  return value == null ? null : String(value).slice(0, 10);
}

function timeText(value: unknown): string | null {
  return value == null ? null : String(value).slice(0, 5);
}

function reportFilters(query: StudentReportExportQuery, alias: string): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query.classId != null) { clauses.push(`${alias}.class_id=?`); params.push(query.classId); }
  if (query.fromDate) { clauses.push(`${alias}.session_date>=?`); params.push(query.fromDate); }
  if (query.toDate) { clauses.push(`${alias}.session_date<=?`); params.push(query.toDate); }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

export class StudentReportRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async findStudent(studentId: number): Promise<StudentReportStudent | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id,s.full_name,s.nickname,s.parent_name,s.parent_phone,
        (SELECT c.name FROM class_enrollments e JOIN classes c ON c.id=e.class_id
         WHERE e.student_id=s.id AND e.status IN ('ACTIVE','PAUSED')
         ORDER BY FIELD(e.status,'ACTIVE','PAUSED'),e.id DESC LIMIT 1) current_class_name
       FROM students s WHERE s.id=? LIMIT 1`,
      [studentId],
    );
    const row = rows[0];
    return row ? {
      id: Number(row.id),
      fullName: String(row.full_name),
      nickname: row.nickname == null ? null : String(row.nickname),
      parentName: row.parent_name == null ? null : String(row.parent_name),
      parentPhone: row.parent_phone == null ? null : String(row.parent_phone),
      currentClassName: row.current_class_name == null ? null : String(row.current_class_name),
    } : null;
  }

  async studentHasClass(studentId: number, classId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM class_enrollments WHERE student_id=? AND class_id=? LIMIT 1",
      [studentId, classId],
    );
    return Boolean(rows[0]);
  }

  async learningRows(studentId: number, query: StudentReportExportQuery): Promise<StudentLearningReportRow[]> {
    const filters = reportFilters(query, "l");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id attendance_id,l.id lesson_id,l.session_date,l.class_id,c.name class_name,
        l.lesson_type,l.scheduled_start_time,l.scheduled_end_time,l.actual_start_time,
        l.actual_end_time,l.actual_duration_minutes,a.attendance_status,a.counts_for_tuition,
        l.content,l.homework,a.student_note,l.note lesson_note
       FROM lesson_attendances a
       JOIN class_enrollments e ON e.id=a.enrollment_id
       JOIN lesson_sessions l ON l.id=a.lesson_session_id AND l.status='COMPLETED'
       JOIN classes c ON c.id=l.class_id
       WHERE e.student_id=?${filters.sql}
       ORDER BY l.session_date,COALESCE(l.actual_start_time,l.scheduled_start_time),
        l.scheduled_start_time,l.id,a.id
       LIMIT 5001`,
      [studentId, ...filters.params],
    );
    return rows.map((row) => ({
      attendanceId: Number(row.attendance_id), lessonId: Number(row.lesson_id),
      sessionDate: dateText(row.session_date)!, classId: Number(row.class_id),
      className: String(row.class_name), lessonType: row.lesson_type,
      scheduledStartTime: timeText(row.scheduled_start_time)!,
      scheduledEndTime: timeText(row.scheduled_end_time)!,
      actualStartTime: timeText(row.actual_start_time), actualEndTime: timeText(row.actual_end_time),
      actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
      attendanceStatus: row.attendance_status, countsForTuition: Boolean(row.counts_for_tuition),
      content: row.content == null ? null : String(row.content),
      homework: row.homework == null ? null : String(row.homework),
      studentNote: row.student_note == null ? null : String(row.student_note),
      lessonNote: row.lesson_note == null ? null : String(row.lesson_note),
    }));
  }

  async tuitionRows(studentId: number, query: StudentReportExportQuery): Promise<StudentTuitionReportRow[]> {
    const filters = reportFilters(query, "l");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tc.id cycle_id,tc.enrollment_id,tc.cycle_number,tc.status cycle_status,
        e.class_id,c.name class_name,tc.started_at,tc.reached_target_at,
        tc.package_price_snapshot,tc.paid_at,tc.paid_amount,tc.payment_method,tc.payment_note,
        (SELECT COUNT(*) FROM tuition_cycle_sessions all_items WHERE all_items.tuition_cycle_id=tc.id) cycle_item_count,
        tcs.sequence_number,l.session_date,l.scheduled_start_time,l.scheduled_end_time,
        l.actual_start_time,l.actual_end_time,l.actual_duration_minutes
       FROM tuition_cycles tc
       JOIN class_enrollments e ON e.id=tc.enrollment_id
       JOIN classes c ON c.id=e.class_id
       JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id
       JOIN lesson_attendances a ON a.id=tcs.attendance_id
       JOIN lesson_sessions l ON l.id=a.lesson_session_id
       WHERE e.student_id=? AND tc.status<>'CANCELLED'${filters.sql}
       ORDER BY tc.cycle_number,tc.id,tcs.sequence_number
       LIMIT 5001`,
      [studentId, ...filters.params],
    );
    return rows.map((row) => ({
      cycleId: Number(row.cycle_id), enrollmentId: Number(row.enrollment_id),
      cycleNumber: Number(row.cycle_number), cycleStatus: row.cycle_status,
      classId: Number(row.class_id), className: String(row.class_name),
      startedAt: dateText(row.started_at), reachedTargetAt: dateText(row.reached_target_at),
      packagePriceSnapshot: Number(row.package_price_snapshot),
      paidAt: dateText(row.paid_at), paidAmount: row.paid_amount == null ? null : Number(row.paid_amount),
      paymentMethod: row.payment_method, paymentNote: row.payment_note == null ? null : String(row.payment_note),
      cycleItemCount: Number(row.cycle_item_count), sequenceNumber: Number(row.sequence_number),
      sessionDate: dateText(row.session_date)!, scheduledStartTime: timeText(row.scheduled_start_time)!,
      scheduledEndTime: timeText(row.scheduled_end_time)!, actualStartTime: timeText(row.actual_start_time),
      actualEndTime: timeText(row.actual_end_time),
      actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
    }));
  }

  async recordExport(studentId: number, actorUserId: number, query: StudentReportExportQuery): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.audit.record(connection, {
        actorUserId, action: "STUDENT_REPORT_EXPORTED", entityType: "STUDENT",
        entityId: studentId, newValues: { filters: query },
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
}

