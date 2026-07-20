import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { CreateLessonRequest, LessonSummary } from "@teacher/shared";
import { pool } from "../db/pool";

export interface EnrollmentBillingContext extends RowDataPacket {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  tuition_mode: "CLASS_DEFAULT" | "CUSTOM" | "FREE";
  effective_price: number;
}

export class LessonRepository {
  async create(input: CreateLessonRequest): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO lesson_sessions(class_id,session_date,scheduled_start_time,scheduled_end_time,lesson_type,note)
      VALUES (?,?,?,?,?,?)
    `,
      [
        input.classId,
        input.sessionDate,
        input.scheduledStartTime,
        input.scheduledEndTime,
        input.lessonType,
        input.note ?? null,
      ],
    );
    return result.insertId;
  }

  async findForUpdate(
    connection: PoolConnection,
    lessonId: number,
  ): Promise<RowDataPacket | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM lesson_sessions WHERE id=? FOR UPDATE",
      [lessonId],
    );
    return rows[0] ?? null;
  }

  async listByClass(classId: number): Promise<LessonSummary[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT l.*, c.name class_name,
        TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start,
        TIME_FORMAT(l.scheduled_end_time,'%H:%i') scheduled_end,
        TIME_FORMAT(l.actual_start_time,'%H:%i') actual_start,
        TIME_FORMAT(l.actual_end_time,'%H:%i') actual_end
      FROM lesson_sessions l JOIN classes c ON c.id=l.class_id
      WHERE l.class_id=? ORDER BY l.session_date DESC,l.scheduled_start_time DESC LIMIT 100
    `,
      [classId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      classId: Number(row.class_id),
      className: String(row.class_name),
      sessionDate: String(row.session_date).slice(0, 10),
      scheduledStartTime: String(row.scheduled_start),
      scheduledEndTime: String(row.scheduled_end),
      actualStartTime: row.actual_start ? String(row.actual_start) : null,
      actualEndTime: row.actual_end ? String(row.actual_end) : null,
      actualDurationMinutes:
        row.actual_duration_minutes == null
          ? null
          : Number(row.actual_duration_minutes),
      lessonType: row.lesson_type,
      status: row.status,
    }));
  }

  async getActiveEnrollmentContexts(
    connection: PoolConnection,
    classId: number,
  ): Promise<EnrollmentBillingContext[]> {
    const [rows] = await connection.query<EnrollmentBillingContext[]>(
      `
      SELECT e.id enrollment_id,s.id student_id,s.full_name student_name,e.tuition_mode,
        CASE WHEN e.tuition_mode='CUSTOM' THEN e.custom_package_price ELSE c.default_package_price END effective_price
      FROM class_enrollments e JOIN students s ON s.id=e.student_id JOIN classes c ON c.id=e.class_id
      WHERE e.class_id=? AND e.status='ACTIVE' ORDER BY s.full_name FOR UPDATE
    `,
      [classId],
    );
    return rows;
  }

  async complete(
    connection: PoolConnection,
    lessonId: number,
    actualStart: string,
    actualEnd: string,
    duration: number,
    content: string | null,
    homework: string | null,
    note: string | null,
  ): Promise<void> {
    await connection.query(
      `
      UPDATE lesson_sessions SET actual_start_time=?,actual_end_time=?,actual_duration_minutes=?,content=?,homework=?,note=?,status='COMPLETED',completed_at=NOW()
      WHERE id=?
    `,
      [actualStart, actualEnd, duration, content, homework, note, lessonId],
    );
  }

  async insertAttendance(
    connection: PoolConnection,
    lessonId: number,
    enrollmentId: number,
    status: string,
    countsForTuition: boolean,
    studentNote: string | null,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO lesson_attendances(lesson_session_id,enrollment_id,attendance_status,counts_for_tuition,student_note)
      VALUES (?,?,?,?,?)
    `,
      [lessonId, enrollmentId, status, countsForTuition, studentNote],
    );
    return result.insertId;
  }
}
