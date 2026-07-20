import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { TuitionCycleDetail, TuitionCycleListItem } from "@teacher/shared";
import { pool } from "../db/pool";

export class TuitionRepository {
  async addBillableAttendance(
    connection: PoolConnection,
    enrollmentId: number,
    attendanceId: number,
    sessionDate: string,
    packagePrice: number,
  ): Promise<{ cycleId: number; becameDue: boolean }> {
    const [cycles] = await connection.query<RowDataPacket[]>(
      `
      SELECT * FROM tuition_cycles WHERE enrollment_id=? AND status='ACCUMULATING' ORDER BY cycle_number DESC LIMIT 1 FOR UPDATE
    `,
      [enrollmentId],
    );
    let cycleId: number;
    if (!cycles[0]) {
      const [numbers] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(MAX(cycle_number),0)+1 next_number FROM tuition_cycles WHERE enrollment_id=? FOR UPDATE",
        [enrollmentId],
      );
      const [created] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO tuition_cycles(enrollment_id,cycle_number,package_price_snapshot,started_at)
        VALUES (?,?,?,?)
      `,
        [
          enrollmentId,
          Number(numbers[0].next_number),
          packagePrice,
          sessionDate,
        ],
      );
      cycleId = created.insertId;
    } else {
      cycleId = Number(cycles[0].id);
    }

    const [countRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) count FROM tuition_cycle_sessions WHERE tuition_cycle_id=? FOR UPDATE",
      [cycleId],
    );
    const nextSequence = Number(countRows[0].count) + 1;
    if (nextSequence > 8)
      throw new Error("Chu kỳ tích lũy không hợp lệ: đã vượt quá 8 buổi.");
    await connection.execute(
      "INSERT INTO tuition_cycle_sessions(tuition_cycle_id,attendance_id,sequence_number) VALUES (?,?,?)",
      [cycleId, attendanceId, nextSequence],
    );
    const becameDue = nextSequence === 8;
    if (becameDue) {
      await connection.query(
        "UPDATE tuition_cycles SET status='PAYMENT_DUE',reached_target_at=? WHERE id=?",
        [sessionDate, cycleId],
      );
    }
    return { cycleId, becameDue };
  }

  async list(status?: string): Promise<TuitionCycleListItem[]> {
    const params: unknown[] = [];
    const where = status ? "WHERE tc.status=?" : "";
    if (status) params.push(status);
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT tc.*,e.student_id,e.class_id,s.full_name student_name,c.name class_name,COUNT(tcs.id) progress
      FROM tuition_cycles tc JOIN class_enrollments e ON e.id=tc.enrollment_id
      JOIN students s ON s.id=e.student_id JOIN classes c ON c.id=e.class_id
      LEFT JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id
      ${where} GROUP BY tc.id ORDER BY FIELD(tc.status,'PAYMENT_DUE','ACCUMULATING','PAID','INCOMPLETE','CANCELLED'),tc.updated_at DESC
    `,
      params,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      cycleNumber: Number(row.cycle_number),
      status: row.status,
      studentId: Number(row.student_id),
      studentName: String(row.student_name),
      classId: Number(row.class_id),
      className: String(row.class_name),
      packagePriceSnapshot: Number(row.package_price_snapshot),
      progress: Number(row.progress),
      startedAt: row.started_at ? String(row.started_at).slice(0, 10) : null,
      reachedTargetAt: row.reached_target_at
        ? String(row.reached_target_at).slice(0, 10)
        : null,
      paidAt: row.paid_at ? String(row.paid_at) : null,
    }));
  }

  async findDetail(id: number): Promise<TuitionCycleDetail | null> {
    const list = await this.list();
    const base = list.find((item) => item.id === id);
    if (!base) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT tcs.sequence_number,la.id attendance_id,l.session_date,
       TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start,TIME_FORMAT(l.scheduled_end_time,'%H:%i') scheduled_end,
       TIME_FORMAT(l.actual_start_time,'%H:%i') actual_start,TIME_FORMAT(l.actual_end_time,'%H:%i') actual_end
      FROM tuition_cycle_sessions tcs JOIN lesson_attendances la ON la.id=tcs.attendance_id
      JOIN lesson_sessions l ON l.id=la.lesson_session_id WHERE tcs.tuition_cycle_id=? ORDER BY tcs.sequence_number
    `,
      [id],
    );
    return {
      ...base,
      items: rows.map((row) => ({
        sequenceNumber: Number(row.sequence_number),
        attendanceId: Number(row.attendance_id),
        sessionDate: String(row.session_date).slice(0, 10),
        scheduledStartTime: String(row.scheduled_start),
        scheduledEndTime: String(row.scheduled_end),
        actualStartTime: row.actual_start ? String(row.actual_start) : null,
        actualEndTime: row.actual_end ? String(row.actual_end) : null,
      })),
    };
  }

  async markPaid(
    id: number,
    amount: number,
    paidAt: string,
    method: string,
    note: string | null,
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE tuition_cycles SET status='PAID',paid_amount=?,paid_at=?,payment_method=?,payment_note=?
      WHERE id=? AND status='PAYMENT_DUE'
    `,
      [amount, paidAt, method, note, id],
    );
    return result.affectedRows === 1;
  }
}
