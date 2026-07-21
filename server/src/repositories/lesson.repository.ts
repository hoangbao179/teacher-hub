import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type {
  AttendanceStatus,
  CreateLessonRequest,
  LessonDetail,
  LessonParticipantDetail,
  LessonSummary,
  LessonType,
  UpdateLessonRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { TuitionPolicyRepository } from "./tuition-policy.repository";

export interface LessonRow extends RowDataPacket {
  id: number;
  class_id: number;
  class_name: string;
  session_date: Date | string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  actual_duration_minutes: number | null;
  lesson_type: LessonType;
  status: LessonSummary["status"];
  content: string | null;
  homework: string | null;
  note: string | null;
  completed_at: Date | string | null;
}

export interface ParticipantRow extends RowDataPacket {
  participant_id: number;
  enrollment_id: number;
  student_id: number;
  student_name: string;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function dateTime(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw))
    return `${raw.replace(" ", "T")}+07:00`;
  return raw;
}

function mapSummary(row: LessonRow): LessonSummary {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    className: String(row.class_name),
    sessionDate: dateOnly(row.session_date),
    scheduledStartTime: String(row.scheduled_start),
    scheduledEndTime: String(row.scheduled_end),
    actualStartTime: row.actual_start == null ? null : String(row.actual_start),
    actualEndTime: row.actual_end == null ? null : String(row.actual_end),
    actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
    lessonType: row.lesson_type,
    status: row.status,
    completedAt: dateTime(row.completed_at),
  };
}

const lessonSelect = `
  SELECT l.*,c.name class_name,
    TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start,
    TIME_FORMAT(l.scheduled_end_time,'%H:%i') scheduled_end,
    TIME_FORMAT(l.actual_start_time,'%H:%i') actual_start,
    TIME_FORMAT(l.actual_end_time,'%H:%i') actual_end
  FROM lesson_sessions l JOIN classes c ON c.id=l.class_id`;

export class LessonRepository {
  constructor(private readonly policies = new TuitionPolicyRepository()) {}

  async create(connection: PoolConnection, input: CreateLessonRequest, sourceOccurrenceKey?: string): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO lesson_sessions
        (class_id,source_occurrence_key,session_date,scheduled_start_time,scheduled_end_time,lesson_type,note)
       VALUES (?,?,?,?,?,?,?)`,
      [input.classId, sourceOccurrenceKey ?? null, input.sessionDate, input.scheduledStartTime, input.scheduledEndTime,
        input.lessonType, input.note?.trim() || null],
    );
    return result.insertId;
  }

  async findByOccurrenceKeyForUpdate(connection: PoolConnection, key: string): Promise<LessonRow | null> {
    const [rows] = await connection.query<LessonRow[]>(
      `${lessonSelect} WHERE l.source_occurrence_key=? FOR UPDATE`, [key],
    );
    return rows[0] ?? null;
  }

  async classExistsForUpdate(connection: PoolConnection, classId: number): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM classes WHERE id=? FOR UPDATE", [classId]);
    return Boolean(rows[0]);
  }

  async findForUpdate(connection: PoolConnection, lessonId: number): Promise<LessonRow | null> {
    const [rows] = await connection.query<LessonRow[]>(`${lessonSelect} WHERE l.id=? FOR UPDATE`, [lessonId]);
    return rows[0] ?? null;
  }

  async findDetail(lessonId: number): Promise<LessonDetail | null> {
    const connection = await pool.getConnection();
    try {
      const [lessons] = await connection.query<LessonRow[]>(`${lessonSelect} WHERE l.id=?`, [lessonId]);
      const lesson = lessons[0];
      if (!lesson) return null;
      const sessionDate = dateOnly(lesson.session_date);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT p.id participant_id,p.enrollment_id,s.id student_id,s.full_name student_name,
          a.attendance_status,a.student_note,
          (SELECT COUNT(*) FROM tuition_cycle_sessions tcs
            JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id
            WHERE tc.enrollment_id=p.enrollment_id AND tc.status='ACCUMULATING') current_progress
         FROM lesson_session_participants p
         JOIN class_enrollments e ON e.id=p.enrollment_id
         JOIN students s ON s.id=e.student_id
         LEFT JOIN lesson_attendances a ON a.participant_id=p.id
         WHERE p.lesson_session_id=? ORDER BY s.full_name,p.id`,
        [lessonId],
      );
      const participants: LessonParticipantDetail[] = [];
      for (const row of rows) {
        const policy = await this.policies.resolve(connection, Number(row.enrollment_id), sessionDate);
        participants.push({
          participantId: Number(row.participant_id),
          enrollmentId: Number(row.enrollment_id),
          studentId: Number(row.student_id),
          studentName: String(row.student_name),
          tuitionMode: policy.mode,
          effectivePackagePrice: policy.packagePrice,
          currentProgress: policy.mode === "FREE" ? null : Number(row.current_progress ?? 0),
          attendance: row.attendance_status ? {
            status: row.attendance_status,
            studentNote: row.student_note == null ? null : String(row.student_note),
          } : null,
        });
      }
      return {
        ...mapSummary(lesson),
        content: lesson.content == null ? null : String(lesson.content),
        homework: lesson.homework == null ? null : String(lesson.homework),
        note: lesson.note == null ? null : String(lesson.note),
        participants,
      };
    } finally {
      connection.release();
    }
  }

  async listByClass(classId: number): Promise<LessonSummary[]> {
    const [rows] = await pool.query<LessonRow[]>(
      `${lessonSelect} WHERE l.class_id=?
       ORDER BY l.session_date DESC,l.scheduled_start_time DESC LIMIT 100`,
      [classId],
    );
    return rows.map(mapSummary);
  }

  async eligibleEnrollmentIds(
    connection: PoolConnection,
    classId: number,
    sessionDate: string,
  ): Promise<number[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM class_enrollments
       WHERE class_id=? AND joined_at<=? AND (ended_at IS NULL OR ended_at>=?)
       ORDER BY id FOR UPDATE`,
      [classId, sessionDate, sessionDate],
    );
    return rows.map((row) => Number(row.id));
  }

  async snapshotParticipants(
    connection: PoolConnection,
    lessonId: number,
    classId: number,
    sessionDate: string,
    selectedEnrollmentIds: number[] | null,
    actorUserId?: number,
  ): Promise<number[]> {
    const eligible = await this.eligibleEnrollmentIds(connection, classId, sessionDate);
    const selected = selectedEnrollmentIds ?? eligible;
    const eligibleSet = new Set(eligible);
    if (selected.some((id) => !eligibleSet.has(id))) return [];
    for (const enrollmentId of selected) {
      await connection.execute(
        `INSERT INTO lesson_session_participants
          (lesson_session_id,enrollment_id,created_by) VALUES (?,?,?)`,
        [lessonId, enrollmentId, actorUserId ?? null],
      );
    }
    return selected;
  }

  async replaceParticipants(
    connection: PoolConnection,
    lessonId: number,
    classId: number,
    sessionDate: string,
    selectedEnrollmentIds: number[] | null,
    actorUserId?: number,
  ): Promise<number[]> {
    await connection.execute(
      `DELETE a FROM lesson_attendances a
       JOIN lesson_session_participants p ON p.id=a.participant_id
       WHERE p.lesson_session_id=?`, [lessonId],
    );
    await connection.execute("DELETE FROM lesson_session_participants WHERE lesson_session_id=?", [lessonId]);
    return this.snapshotParticipants(connection, lessonId, classId, sessionDate, selectedEnrollmentIds, actorUserId);
  }

  async participantRowsForUpdate(connection: PoolConnection, lessonId: number): Promise<ParticipantRow[]> {
    const [rows] = await connection.query<ParticipantRow[]>(
      `SELECT p.id participant_id,p.enrollment_id,s.id student_id,s.full_name student_name
       FROM lesson_session_participants p
       JOIN class_enrollments e ON e.id=p.enrollment_id
       JOIN students s ON s.id=e.student_id
       WHERE p.lesson_session_id=? ORDER BY p.id FOR UPDATE`,
      [lessonId],
    );
    return rows;
  }

  async updateInfo(connection: PoolConnection, lessonId: number, input: Required<Pick<UpdateLessonRequest,
    "classId" | "sessionDate" | "scheduledStartTime" | "scheduledEndTime" | "lessonType">> &
    Pick<UpdateLessonRequest, "actualStartTime" | "actualEndTime" | "note">,
  ): Promise<void> {
    await connection.execute(
      `UPDATE lesson_sessions SET class_id=?,session_date=?,scheduled_start_time=?,scheduled_end_time=?,
        actual_start_time=?,actual_end_time=?,actual_duration_minutes=NULL,lesson_type=?,note=? WHERE id=?`,
      [input.classId, input.sessionDate, input.scheduledStartTime, input.scheduledEndTime,
        input.actualStartTime ?? null, input.actualEndTime ?? null, input.lessonType,
        input.note?.trim() || null, lessonId],
    );
  }

  async updateCompletedInfo(
    connection: PoolConnection,
    lessonId: number,
    sessionDate: string,
    scheduledStartTime: string,
    scheduledEndTime: string,
    actualStartTime: string,
    actualEndTime: string,
    duration: number,
    note: string | null,
  ): Promise<void> {
    await connection.execute(
      `UPDATE lesson_sessions SET session_date=?,scheduled_start_time=?,scheduled_end_time=?,
        actual_start_time=?,actual_end_time=?,actual_duration_minutes=?,note=?
       WHERE id=? AND status='COMPLETED'`,
      [sessionDate, scheduledStartTime, scheduledEndTime, actualStartTime, actualEndTime, duration, note, lessonId],
    );
  }

  async updateContent(
    connection: PoolConnection,
    lessonId: number,
    content: string | null,
    homework: string | null,
    note: string | null,
  ): Promise<void> {
    await connection.execute(
      "UPDATE lesson_sessions SET content=?,homework=?,note=? WHERE id=?",
      [content, homework, note, lessonId],
    );
  }

  async upsertAttendance(
    connection: PoolConnection,
    lessonId: number,
    participantId: number,
    enrollmentId: number,
    status: AttendanceStatus,
    countsForTuition: boolean,
    studentNote: string | null,
  ): Promise<number> {
    await connection.execute(
      `INSERT INTO lesson_attendances
        (lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition,student_note)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE attendance_status=VALUES(attendance_status),
         counts_for_tuition=VALUES(counts_for_tuition),student_note=VALUES(student_note)`,
      [lessonId, participantId, enrollmentId, status, countsForTuition, studentNote],
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM lesson_attendances WHERE participant_id=? FOR UPDATE", [participantId],
    );
    return Number(rows[0].id);
  }

  async markCompleted(
    connection: PoolConnection,
    lessonId: number,
    actualStart: string,
    actualEnd: string,
    duration: number,
    content: string | null,
    homework: string | null,
    note: string | null,
  ): Promise<void> {
    await connection.execute(
      `UPDATE lesson_sessions SET actual_start_time=?,actual_end_time=?,actual_duration_minutes=?,
        content=?,homework=?,note=?,status='COMPLETED',completed_at=NOW() WHERE id=? AND status='DRAFT'`,
      [actualStart, actualEnd, duration, content, homework, note, lessonId],
    );
  }

  async cancel(connection: PoolConnection, lessonId: number): Promise<void> {
    await connection.execute(
      "UPDATE lesson_sessions SET status='CANCELLED' WHERE id=? AND status='DRAFT'", [lessonId],
    );
  }
}
