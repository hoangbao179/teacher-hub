import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { TuitionCycleDetail, TuitionCycleListItem } from "@teacher/shared";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import {
  compareBillableAttendance,
  crossesPaidBoundary,
  groupIntoTuitionCycles,
  type BillableAttendanceOrder,
} from "../domain/lesson-domain";
import { TuitionPolicyRepository } from "./tuition-policy.repository";

interface RecalculationAttendance extends BillableAttendanceOrder {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  status: "PRESENT" | "ABSENT" | "FREE";
  excluded: boolean;
  paidCycleId: number | null;
}

export interface TuitionRecalculationResult {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  previousProgress: number;
  newProgress: number;
  createdCycleIds: number[];
  paymentDueCycleIds: number[];
}

export class TuitionRepository {
  constructor(private readonly policies = new TuitionPolicyRepository()) {}

  async lessonTouchesPaidCycle(connection: PoolConnection, lessonId: number): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT tcs.id FROM tuition_cycle_sessions tcs
       JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id AND tc.status='PAID'
       JOIN lesson_attendances a ON a.id=tcs.attendance_id
       WHERE a.lesson_session_id=? LIMIT 1 FOR UPDATE`, [lessonId],
    );
    return Boolean(rows[0]);
  }

  async attendanceTouchesPaidCycle(
    connection: PoolConnection,
    lessonId: number,
    enrollmentIds: number[],
  ): Promise<boolean> {
    if (!enrollmentIds.length) return false;
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT tcs.id FROM tuition_cycle_sessions tcs
       JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id AND tc.status='PAID'
       JOIN lesson_attendances a ON a.id=tcs.attendance_id
       WHERE a.lesson_session_id=? AND a.enrollment_id IN (${enrollmentIds.map(() => "?").join(",")})
       LIMIT 1 FOR UPDATE`, [lessonId, ...enrollmentIds],
    );
    return Boolean(rows[0]);
  }

  async detachMutableLessonAttendances(connection: PoolConnection, lessonId: number): Promise<void> {
    await connection.execute(
      `DELETE tcs FROM tuition_cycle_sessions tcs
       JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id AND tc.status<>'PAID'
       JOIN lesson_attendances a ON a.id=tcs.attendance_id
       WHERE a.lesson_session_id=?`, [lessonId],
    );
  }

  async recalculateEnrollment(
    connection: PoolConnection,
    enrollmentId: number,
  ): Promise<TuitionRecalculationResult> {
    const [enrollments] = await connection.query<RowDataPacket[]>(
      `SELECT e.id,e.student_id,s.full_name student_name
       FROM class_enrollments e JOIN students s ON s.id=e.student_id
       WHERE e.id=? FOR UPDATE`, [enrollmentId],
    );
    if (!enrollments[0]) throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh.");
    const [cycles] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM tuition_cycles WHERE enrollment_id=? ORDER BY cycle_number FOR UPDATE", [enrollmentId],
    );
    const previousProgress = await this.accumulatingProgress(connection, enrollmentId);
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id attendance_id,a.attendance_status,a.excluded_from_tuition,
        l.id lesson_id,l.session_date,
        TIME_FORMAT(l.actual_start_time,'%H:%i') actual_start,
        TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start,
        paid.id paid_cycle_id
       FROM lesson_attendances a
       JOIN lesson_sessions l ON l.id=a.lesson_session_id AND l.status='COMPLETED'
       LEFT JOIN tuition_cycle_sessions paid_item ON paid_item.attendance_id=a.id
       LEFT JOIN tuition_cycles paid ON paid.id=paid_item.tuition_cycle_id AND paid.status='PAID'
       WHERE a.enrollment_id=? FOR UPDATE`, [enrollmentId],
    );
    const all: RecalculationAttendance[] = rows.map((row) => ({
      enrollmentId,
      studentId: Number(enrollments[0].student_id),
      studentName: String(enrollments[0].student_name),
      attendanceId: Number(row.attendance_id),
      lessonId: Number(row.lesson_id),
      sessionDate: row.session_date instanceof Date ? row.session_date.toISOString().slice(0, 10) : String(row.session_date).slice(0, 10),
      actualStartTime: row.actual_start == null ? null : String(row.actual_start),
      scheduledStartTime: String(row.scheduled_start),
      status: row.attendance_status,
      excluded: Boolean(row.excluded_from_tuition),
      paidCycleId: row.paid_cycle_id == null ? null : Number(row.paid_cycle_id),
    }));
    const paidItems: RecalculationAttendance[] = [];
    const mutableBillable: RecalculationAttendance[] = [];
    for (const attendance of all) {
      const policy = await this.policies.resolve(connection, enrollmentId, attendance.sessionDate, true);
      const billable = attendance.status === "PRESENT" && policy.mode !== "FREE" && !attendance.excluded;
      if (attendance.paidCycleId != null) {
        if (!billable)
          throw new AppError(409, "PAID_CYCLE_CONFLICT", "Chỉnh sửa sẽ thay đổi attendance thuộc chu kỳ đã thu.");
        paidItems.push(attendance);
      } else {
        await connection.execute("UPDATE lesson_attendances SET counts_for_tuition=? WHERE id=?", [billable, attendance.attendanceId]);
        if (billable) mutableBillable.push(attendance);
      }
    }
    mutableBillable.sort(compareBillableAttendance);
    if (crossesPaidBoundary(paidItems, mutableBillable))
      throw new AppError(409, "PAID_CYCLE_CONFLICT", "Attendance lịch sử nằm trước ranh giới chu kỳ đã thu; cần flow mở khóa riêng.");

    await connection.execute(
      `DELETE tcs FROM tuition_cycle_sessions tcs
       JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id
       WHERE tc.enrollment_id=? AND tc.status<>'PAID'`, [enrollmentId],
    );
    await connection.execute("DELETE FROM tuition_cycles WHERE enrollment_id=? AND status<>'PAID'", [enrollmentId]);
    const maxPaidNumber = cycles.filter((cycle) => cycle.status === "PAID")
      .reduce((maximum, cycle) => Math.max(maximum, Number(cycle.cycle_number)), 0);
    const groups = groupIntoTuitionCycles(mutableBillable);
    const createdCycleIds: number[] = [];
    const paymentDueCycleIds: number[] = [];
    for (const [groupIndex, group] of groups.entries()) {
      const first = group[0];
      const firstPolicy = await this.policies.resolve(connection, enrollmentId, first.sessionDate, true);
      if (firstPolicy.packagePrice == null)
        throw new AppError(409, "TUITION_POLICY_NOT_FOUND", "Chu kỳ tính phí không có giá hiệu lực.");
      const due = group.length === 8;
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO tuition_cycles
          (enrollment_id,cycle_number,target_session_count,package_price_snapshot,status,started_at,reached_target_at)
         VALUES (?,?,8,?,?,?,?)`,
        [enrollmentId, maxPaidNumber + groupIndex + 1, firstPolicy.packagePrice,
          due ? "PAYMENT_DUE" : "ACCUMULATING", first.sessionDate,
          due ? group[group.length - 1].sessionDate : null],
      );
      createdCycleIds.push(created.insertId);
      if (due) paymentDueCycleIds.push(created.insertId);
      for (const [sequence, attendance] of group.entries())
        await connection.execute(
          "INSERT INTO tuition_cycle_sessions(tuition_cycle_id,attendance_id,sequence_number) VALUES (?,?,?)",
          [created.insertId, attendance.attendanceId, sequence + 1],
        );
    }
    return {
      enrollmentId,
      studentId: Number(enrollments[0].student_id),
      studentName: String(enrollments[0].student_name),
      previousProgress,
      newProgress: groups.at(-1)?.length ?? 0,
      createdCycleIds,
      paymentDueCycleIds,
    };
  }
  async addBillableAttendance(
    connection: PoolConnection,
    enrollmentId: number,
    attendanceId: number,
    sessionDate: string,
    packagePrice: number,
  ): Promise<{ cycleId: number; becameDue: boolean; createdCycle: boolean; progress: number }> {
    const [cycles] = await connection.query<RowDataPacket[]>(
      `
      SELECT * FROM tuition_cycles WHERE enrollment_id=? AND status='ACCUMULATING' ORDER BY cycle_number DESC LIMIT 1 FOR UPDATE
    `,
      [enrollmentId],
    );
    let cycleId: number;
    let createdCycle = false;
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
      createdCycle = true;
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
    return { cycleId, becameDue, createdCycle, progress: nextSequence };
  }

  async accumulatingProgress(connection: PoolConnection, enrollmentId: number): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(tcs.id) progress FROM tuition_cycles tc
       LEFT JOIN tuition_cycle_sessions tcs ON tcs.tuition_cycle_id=tc.id
       WHERE tc.enrollment_id=? AND tc.status='ACCUMULATING' GROUP BY tc.id
       ORDER BY tc.cycle_number DESC LIMIT 1 FOR UPDATE`,
      [enrollmentId],
    );
    return Number(rows[0]?.progress ?? 0);
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
