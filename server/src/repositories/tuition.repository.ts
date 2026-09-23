import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MonthlyTuitionBoard, MonthlyTuitionQuery, MonthlyTuitionRow } from "@teacher/shared";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";

export class TuitionRepository {
  async monthlyBoard(query: MonthlyTuitionQuery): Promise<MonthlyTuitionBoard> {
    const start = `${query.year}-${String(query.month).padStart(2, "0")}-01`;
    const nextMonth = query.month === 12
      ? `${query.year + 1}-01-01`
      : `${query.year}-${String(query.month + 1).padStart(2, "0")}-01`;
    const conditions = ["e.tuition_exempt=0", "e.joined_at<?", "(e.ended_at IS NULL OR e.ended_at>=?)"];
    const params: unknown[] = [query.year, query.month, start, nextMonth, query.year, query.month, nextMonth, start];
    if (query.classId != null) { conditions.push("e.class_id=?"); params.push(query.classId); }
    if (query.search) {
      conditions.push("(s.full_name LIKE ? OR s.nickname LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id payment_id,e.id enrollment_id,e.student_id,s.full_name student_name,
         s.nickname student_nickname,e.class_id,c.name class_name,? tuition_year,? tuition_month,
         SUM(CASE WHEN l.status='COMPLETED' AND a.attendance_status='PRESENT' THEN 1 ELSE 0 END) present_count,
         SUM(CASE WHEN l.status='COMPLETED' AND a.attendance_status='ABSENT' THEN 1 ELSE 0 END) absent_count,
         SUM(CASE WHEN l.status='COMPLETED' AND a.attendance_status IN ('PRESENT','ABSENT') THEN 1 ELSE 0 END) total_count,
         p.amount,p.paid_at,p.note
       FROM class_enrollments e
       JOIN students s ON s.id=e.student_id JOIN classes c ON c.id=e.class_id
       LEFT JOIN lesson_session_participants participant ON participant.enrollment_id=e.id
       LEFT JOIN lesson_sessions l ON l.id=participant.lesson_session_id AND l.session_date>=? AND l.session_date<?
       LEFT JOIN lesson_attendances a ON a.participant_id=participant.id
       LEFT JOIN monthly_tuition_payments p ON p.enrollment_id=e.id AND p.tuition_year=? AND p.tuition_month=?
       WHERE ${conditions.join(" AND ")}
       GROUP BY p.id,e.id,e.student_id,s.full_name,s.nickname,e.class_id,c.name,p.amount,p.paid_at,p.note
       ORDER BY s.full_name,c.name,e.id`, params);
    const boardRows = rows.map((row) => mapMonthlyRow(row, query.year, query.month));
    return { year: query.year, month: query.month, rows: boardRows,
      paidCount: boardRows.filter((row) => row.status === "PAID").length,
      unpaidCount: boardRows.filter((row) => row.status === "UNPAID").length };
  }

  async enrollmentActivePeriods(enrollmentIds: number[]): Promise<Map<number, Array<{ activeFrom: string; activeTo: string | null }>>> {
    const result = new Map<number, Array<{ activeFrom: string; activeTo: string | null }>>();
    if (!enrollmentIds.length) return result;
    const placeholders = enrollmentIds.map(() => "?").join(",");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT enrollment_id,DATE_FORMAT(active_from,'%Y-%m-%d') active_from,
        DATE_FORMAT(active_to,'%Y-%m-%d') active_to
       FROM enrollment_active_periods WHERE enrollment_id IN (${placeholders})`,
      enrollmentIds,
    );
    for (const row of rows) {
      const id = Number(row.enrollment_id);
      result.set(id, [...(result.get(id) ?? []), {
        activeFrom: String(row.active_from), activeTo: row.active_to == null ? null : String(row.active_to),
      }]);
    }
    return result;
  }

  async lockMonthlyPayment(connection: PoolConnection, enrollmentId: number, year: number, month: number): Promise<RowDataPacket | null> {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const [enrollments] = await connection.query<RowDataPacket[]>(
      "SELECT id,tuition_exempt,joined_at,ended_at FROM class_enrollments WHERE id=? FOR UPDATE", [enrollmentId]);
    if (!enrollments[0]) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh.");
    if (Boolean(enrollments[0].tuition_exempt))
      throw new AppError(409, "MONTHLY_TUITION_EXEMPT_ENROLLMENT", "Ghi danh miễn phí không có khoản thu theo tháng.");
    const joinedAt = String(enrollments[0].joined_at).slice(0, 10);
    const endedAt = enrollments[0].ended_at == null ? null : String(enrollments[0].ended_at).slice(0, 10);
    const [periods] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM enrollment_active_periods
       WHERE enrollment_id=? AND active_from<? AND (active_to IS NULL OR active_to>=?) FOR UPDATE`,
      [enrollmentId, nextMonth, start],
    );
    if (joinedAt >= nextMonth || (endedAt != null && endedAt < start) || !periods.length)
      throw new AppError(404, "MONTHLY_TUITION_NOT_FOUND", "Không tìm thấy học phí tháng.");
    const [payments] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM monthly_tuition_payments WHERE enrollment_id=? AND tuition_year=? AND tuition_month=? FOR UPDATE`,
      [enrollmentId, year, month]);
    return payments[0] ?? null;
  }

  async createMonthlyPayment(connection: PoolConnection, enrollmentId: number, year: number, month: number,
    input: { amount: number | null; paidAt: string; note: string | null }): Promise<number> {
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO monthly_tuition_payments(enrollment_id,tuition_year,tuition_month,amount,paid_at,note)
       VALUES (?,?,?,?,CONCAT(?,' 00:00:00'),?)`,
      [enrollmentId, year, month, input.amount, input.paidAt, input.note]);
    return created.insertId;
  }
}

function mapMonthlyRow(row: RowDataPacket, year: number, month: number): MonthlyTuitionRow {
  return {
    paymentId: row.payment_id == null ? null : Number(row.payment_id),
    enrollmentId: Number(row.enrollment_id), studentId: Number(row.student_id), studentName: String(row.student_name),
    studentNickname: row.student_nickname == null ? null : String(row.student_nickname),
    classId: Number(row.class_id), className: String(row.class_name), year, month,
    attendance: { present: Number(row.present_count ?? 0), absent: Number(row.absent_count ?? 0), total: Number(row.total_count ?? 0) },
    status: row.payment_id == null ? "UNPAID" : "PAID",
    amount: row.amount == null ? null : Number(row.amount),
    paidAt: row.paid_at == null ? null : String(row.paid_at).slice(0, 10),
    note: row.note == null ? null : String(row.note),
  };
}
