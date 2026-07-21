import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type {
  MarkTuitionPaidRequest,
  PageResult,
  TuitionCycleDetail,
  TuitionCycleListItem,
  TuitionCycleListQuery,
  TuitionSummary,
  TuitionSummaryQuery,
  CreateAdvanceReceiptRequest,
  TuitionReceipt,
  SettleIncompleteCycleRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import {
  compareBillableAttendance,
  crossesPaidBoundary,
  groupIntoTuitionCycles,
  type BillableAttendanceOrder,
} from "../domain/lesson-domain";
import { TuitionPolicyRepository } from "./tuition-policy.repository";
import { AuditRepository } from "./audit.repository";

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

export interface LockedTuitionCycle {
  id: number;
  status: "ACCUMULATING" | "PAYMENT_DUE" | "PAID" | "INCOMPLETE" | "CANCELLED";
  itemCount: number;
  packagePriceSnapshot: number;
  paidAmount: number | null;
  paidAt: string | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | null;
  paymentNote: string | null;
}

export class TuitionRepository {
  constructor(private readonly policies = new TuitionPolicyRepository(), private readonly audit = new AuditRepository()) {}

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
      `SELECT e.id,e.student_id,e.status,s.full_name student_name
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
      `UPDATE tuition_receipts tr JOIN tuition_receipt_allocations tra ON tra.receipt_id=tr.id
       JOIN tuition_cycles tc ON tc.id=tra.tuition_cycle_id
       SET tr.status=IF(tr.status='TRANSFERRED','TRANSFERRED','AVAILABLE')
       WHERE tc.enrollment_id=? AND tc.status<>'PAID'`, [enrollmentId],
    );
    await connection.execute(
      `DELETE tra FROM tuition_receipt_allocations tra JOIN tuition_cycles tc ON tc.id=tra.tuition_cycle_id
       WHERE tc.enrollment_id=? AND tc.status<>'PAID'`, [enrollmentId],
    );
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
      const status = due
        ? "PAYMENT_DUE"
        : enrollments[0].status === "ENDED" ? "INCOMPLETE" : "ACCUMULATING";
      const [created] = await connection.execute<ResultSetHeader>(
        `INSERT INTO tuition_cycles
          (enrollment_id,cycle_number,target_session_count,package_price_snapshot,status,started_at,reached_target_at)
         VALUES (?,?,8,?,?,?,?)`,
        [enrollmentId, maxPaidNumber + groupIndex + 1, firstPolicy.packagePrice,
          status, first.sessionDate,
          due ? group[group.length - 1].sessionDate : null],
      );
      createdCycleIds.push(created.insertId);
      if (due) paymentDueCycleIds.push(created.insertId);
      for (const [sequence, attendance] of group.entries())
        await connection.execute(
          "INSERT INTO tuition_cycle_sessions(tuition_cycle_id,attendance_id,sequence_number) VALUES (?,?,?)",
          [created.insertId, attendance.attendanceId, sequence + 1],
        );
      await this.allocateAdvanceReceipt(connection, enrollmentId, created.insertId, firstPolicy.packagePrice, due);
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

  async list(query: Required<Pick<TuitionCycleListQuery, "page" | "pageSize" | "sort">> & TuitionCycleListQuery): Promise<PageResult<TuitionCycleListItem>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.status) { conditions.push("tc.status=?"); params.push(query.status); }
    if (query.classId) { conditions.push("e.class_id=?"); params.push(query.classId); }
    if (query.studentId) { conditions.push("e.student_id=?"); params.push(query.studentId); }
    if (query.enrollmentId) { conditions.push("tc.enrollment_id=?"); params.push(query.enrollmentId); }
    if (query.search) {
      conditions.push("(s.full_name LIKE ? OR s.nickname LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    const lifecycleDate = "COALESCE(DATE(tc.paid_at),tc.reached_target_at,tc.started_at)";
    if (query.from) { conditions.push(`${lifecycleDate}>=?`); params.push(query.from); }
    if (query.to) { conditions.push(`${lifecycleDate}<=?`); params.push(query.to); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM tuition_cycles tc
       JOIN class_enrollments e ON e.id=tc.enrollment_id
       JOIN students s ON s.id=e.student_id ${where}`,
      params,
    );
    const order = query.sort === "STUDENT_NAME"
      ? "s.full_name ASC,tc.cycle_number DESC,tc.id DESC"
      : query.sort === "NEWEST"
        ? `${lifecycleDate} DESC,tc.id DESC`
        : "CASE WHEN tc.status='PAYMENT_DUE' THEN 0 ELSE 1 END,tc.reached_target_at ASC,tc.id ASC";
    const offset = (query.page - 1) * query.pageSize;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tc.*,e.student_id,e.class_id,s.full_name student_name,s.nickname student_nickname,
        c.name class_name,COALESCE(items.item_count,0) item_count,
        active.progress active_progress,COALESCE(receipts.receipt_count,0) receipt_count
       FROM tuition_cycles tc
       JOIN class_enrollments e ON e.id=tc.enrollment_id
       JOIN students s ON s.id=e.student_id
       JOIN classes c ON c.id=e.class_id
       LEFT JOIN (
         SELECT tuition_cycle_id,COUNT(*) item_count
         FROM tuition_cycle_sessions GROUP BY tuition_cycle_id
       ) items ON items.tuition_cycle_id=tc.id
       LEFT JOIN (
         SELECT ac.enrollment_id,COUNT(acs.id) progress
         FROM tuition_cycles ac
         LEFT JOIN tuition_cycle_sessions acs ON acs.tuition_cycle_id=ac.id
         WHERE ac.status='ACCUMULATING'
         GROUP BY ac.id,ac.enrollment_id
       ) active ON active.enrollment_id=tc.enrollment_id
       LEFT JOIN (SELECT tuition_cycle_id,COUNT(*) receipt_count FROM tuition_receipt_allocations GROUP BY tuition_cycle_id)
         receipts ON receipts.tuition_cycle_id=tc.id
       ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, query.pageSize, offset],
    );
    return {
      items: rows.map(mapListRow),
      total: Number(countRows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findDetail(id: number): Promise<TuitionCycleDetail | null> {
    const [baseRows] = await pool.query<RowDataPacket[]>(
      `SELECT tc.*,e.student_id,e.class_id,s.full_name student_name,s.nickname student_nickname,
        c.name class_name,COALESCE(items.item_count,0) item_count,
        active.progress active_progress,COALESCE(receipts.receipt_count,0) receipt_count
       FROM tuition_cycles tc
       JOIN class_enrollments e ON e.id=tc.enrollment_id
       JOIN students s ON s.id=e.student_id
       JOIN classes c ON c.id=e.class_id
       LEFT JOIN (
         SELECT tuition_cycle_id,COUNT(*) item_count
         FROM tuition_cycle_sessions GROUP BY tuition_cycle_id
       ) items ON items.tuition_cycle_id=tc.id
       LEFT JOIN (
         SELECT ac.enrollment_id,COUNT(acs.id) progress
         FROM tuition_cycles ac
         LEFT JOIN tuition_cycle_sessions acs ON acs.tuition_cycle_id=ac.id
         WHERE ac.status='ACCUMULATING'
         GROUP BY ac.id,ac.enrollment_id
       ) active ON active.enrollment_id=tc.enrollment_id
       LEFT JOIN (SELECT tuition_cycle_id,COUNT(*) receipt_count FROM tuition_receipt_allocations GROUP BY tuition_cycle_id)
         receipts ON receipts.tuition_cycle_id=tc.id
       WHERE tc.id=?`, [id],
    );
    if (!baseRows[0]) return null;
    const base = mapListRow(baseRows[0]);
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT tcs.sequence_number,la.id attendance_id,la.attendance_status,l.id lesson_id,l.session_date,
       TIME_FORMAT(l.scheduled_start_time,'%H:%i') scheduled_start,TIME_FORMAT(l.scheduled_end_time,'%H:%i') scheduled_end,
       TIME_FORMAT(l.actual_start_time,'%H:%i') actual_start,TIME_FORMAT(l.actual_end_time,'%H:%i') actual_end,
       l.actual_duration_minutes,l.lesson_type
      FROM tuition_cycle_sessions tcs JOIN lesson_attendances la ON la.id=tcs.attendance_id
      JOIN lesson_sessions l ON l.id=la.lesson_session_id WHERE tcs.tuition_cycle_id=? ORDER BY tcs.sequence_number
    `,
      [id],
    );
    return {
      ...base,
      paidAmount: baseRows[0].paid_amount == null ? null : Number(baseRows[0].paid_amount),
      paymentMethod: baseRows[0].payment_method ?? null,
      paymentNote: baseRows[0].payment_note == null ? null : String(baseRows[0].payment_note),
      settledAt: baseRows[0].settled_at == null ? null : String(baseRows[0].settled_at),
      settlementMethod: baseRows[0].settlement_method ?? null,
      settlementReason: baseRows[0].settlement_reason == null ? null : String(baseRows[0].settlement_reason),
      settlementNote: baseRows[0].settlement_note == null ? null : String(baseRows[0].settlement_note),
      items: rows.map((row) => ({
        sequenceNumber: Number(row.sequence_number),
        attendanceId: Number(row.attendance_id),
        lessonId: Number(row.lesson_id),
        sessionDate: String(row.session_date).slice(0, 10),
        scheduledStartTime: String(row.scheduled_start),
        scheduledEndTime: String(row.scheduled_end),
        actualStartTime: row.actual_start ? String(row.actual_start) : null,
        actualEndTime: row.actual_end ? String(row.actual_end) : null,
        actualDurationMinutes: row.actual_duration_minutes == null ? null : Number(row.actual_duration_minutes),
        lessonType: row.lesson_type,
        attendanceStatus: row.attendance_status,
      })),
    };
  }

  async summary(query: TuitionSummaryQuery): Promise<TuitionSummary> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(status='PAYMENT_DUE') payment_due_count,
        COALESCE(SUM(CASE WHEN status='PAYMENT_DUE' THEN package_price_snapshot ELSE 0 END),0) total_unpaid_amount,
        COUNT(DISTINCT CASE WHEN status='ACCUMULATING' THEN enrollment_id END) accumulating_enrollment_count,
        SUM(status='PAID' AND (? IS NULL OR DATE(paid_at)>=?) AND (? IS NULL OR DATE(paid_at)<=?)) paid_cycle_count,
        SUM(status='INCOMPLETE' AND settlement_status='OPEN') open_incomplete_count
       FROM tuition_cycles`,
      [query.from ?? null, query.from ?? null, query.to ?? null, query.to ?? null],
    );
    return {
      paymentDueCount: Number(rows[0]?.payment_due_count ?? 0),
      totalUnpaidAmount: Number(rows[0]?.total_unpaid_amount ?? 0),
      accumulatingEnrollmentCount: Number(rows[0]?.accumulating_enrollment_count ?? 0),
      paidCycleCount: Number(rows[0]?.paid_cycle_count ?? 0),
      openIncompleteCount: Number(rows[0]?.open_incomplete_count ?? 0),
      from: query.from ?? null,
      to: query.to ?? null,
    };
  }

  async lockForPayment(connection: PoolConnection, id: number): Promise<LockedTuitionCycle | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id,status,package_price_snapshot,paid_amount,
        DATE_FORMAT(paid_at,'%Y-%m-%d') paid_at,payment_method,payment_note
       FROM tuition_cycles WHERE id=? FOR UPDATE`, [id],
    );
    if (!rows[0]) return null;
    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM tuition_cycle_sessions WHERE tuition_cycle_id=? ORDER BY sequence_number FOR UPDATE",
      [id],
    );
    return {
      id: Number(rows[0].id),
      status: rows[0].status,
      itemCount: items.length,
      packagePriceSnapshot: Number(rows[0].package_price_snapshot),
      paidAmount: rows[0].paid_amount == null ? null : Number(rows[0].paid_amount),
      paidAt: rows[0].paid_at == null ? null : String(rows[0].paid_at),
      paymentMethod: rows[0].payment_method ?? null,
      paymentNote: rows[0].payment_note == null ? null : String(rows[0].payment_note),
    };
  }

  async updatePayment(connection: PoolConnection, id: number, input: MarkTuitionPaidRequest): Promise<void> {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE tuition_cycles
       SET status='PAID',paid_amount=?,paid_at=?,payment_method=?,payment_note=?
       WHERE id=? AND status='PAYMENT_DUE'`,
      [input.paidAmount, `${input.paidAt} 00:00:00`, input.paymentMethod,
        input.paymentNote?.trim() || null, id],
    );
    if (result.affectedRows !== 1)
      throw new AppError(409, "CYCLE_STATE_CHANGED", "Chu kỳ đã thay đổi. Hãy tải lại dữ liệu.");
  }

  async markAccumulatingIncomplete(connection: PoolConnection, enrollmentId: number): Promise<void> {
    await connection.query(
      "SELECT id FROM tuition_cycles WHERE enrollment_id=? ORDER BY cycle_number FOR UPDATE",
      [enrollmentId],
    );
    await connection.execute(
      "UPDATE tuition_cycles SET status='INCOMPLETE' WHERE enrollment_id=? AND status='ACCUMULATING'",
      [enrollmentId],
    );
  }

  async lockEnrollmentForReceipt(connection: PoolConnection, enrollmentId: number): Promise<RowDataPacket | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM class_enrollments WHERE id=? FOR UPDATE", [enrollmentId],
    );
    return rows[0] ?? null;
  }

  async createAdvanceReceipt(
    connection: PoolConnection,
    enrollmentId: number,
    input: CreateAdvanceReceiptRequest,
    packagePrice: number,
    actorUserId?: number,
  ): Promise<number> {
    const [created] = await connection.execute<ResultSetHeader>(
      `INSERT INTO tuition_receipts
        (enrollment_id,receipt_type,amount,package_price_snapshot,received_at,payment_method,note,created_by)
       VALUES (?,'ADVANCE',?,?,?,?,?,?)`,
      [enrollmentId, input.amount, packagePrice, input.receivedAt, input.paymentMethod,
        input.note?.trim() || null, actorUserId ?? null],
    );
    const [cycles] = await connection.query<RowDataPacket[]>(
      "SELECT id,package_price_snapshot FROM tuition_cycles WHERE enrollment_id=? AND status='ACCUMULATING' ORDER BY cycle_number DESC LIMIT 1 FOR UPDATE",
      [enrollmentId],
    );
    if (cycles[0] && Number(cycles[0].package_price_snapshot) === packagePrice) {
      await connection.execute(
        "INSERT INTO tuition_receipt_allocations(receipt_id,tuition_cycle_id,allocated_amount) VALUES (?,?,?)",
        [created.insertId, cycles[0].id, input.amount],
      );
      await connection.execute("UPDATE tuition_receipts SET status='ALLOCATED' WHERE id=?", [created.insertId]);
    }
    return created.insertId;
  }

  async findReceipt(id: number): Promise<TuitionReceipt | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tr.*,tra.tuition_cycle_id FROM tuition_receipts tr
       LEFT JOIN tuition_receipt_allocations tra ON tra.receipt_id=tr.id WHERE tr.id=?`, [id],
    );
    return rows[0] ? mapReceipt(rows[0]) : null;
  }

  async listReceipts(enrollmentId: number): Promise<TuitionReceipt[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tr.*,tra.tuition_cycle_id FROM tuition_receipts tr
       LEFT JOIN tuition_receipt_allocations tra ON tra.receipt_id=tr.id
       WHERE tr.enrollment_id=? ORDER BY tr.received_at DESC,tr.id DESC`, [enrollmentId],
    );
    return rows.map(mapReceipt);
  }

  async settleIncomplete(
    connection: PoolConnection,
    cycleId: number,
    input: SettleIncompleteCycleRequest,
    actorUserId?: number,
  ): Promise<RowDataPacket | null> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM tuition_cycles WHERE id=? FOR UPDATE", [cycleId],
    );
    const cycle = rows[0];
    if (!cycle) return null;
    if (cycle.status !== "INCOMPLETE" || cycle.settlement_status !== "OPEN")
      throw new AppError(409, "INCOMPLETE_SETTLEMENT_CONFLICT", "Đợt dở dang không còn ở trạng thái chờ xử lý.");
    if (input.type === "SETTLE")
      await connection.execute(
        `UPDATE tuition_cycles SET settlement_status='SETTLED',settled_amount=?,settled_at=NOW(),
          settlement_method=?,settlement_reason=?,settlement_note=?,settled_by=? WHERE id=?`,
        [input.amount, input.method, input.reason.trim(), input.note?.trim() || null, actorUserId ?? null, cycleId],
      );
    else await connection.execute(
      `UPDATE tuition_cycles SET settlement_status='WAIVED',settled_at=NOW(),settlement_reason=?,
        settlement_note=?,settled_by=? WHERE id=?`,
      [input.reason.trim(), input.note?.trim() || null, actorUserId ?? null, cycleId],
    );
    return cycle;
  }

  private async allocateAdvanceReceipt(
    connection: PoolConnection,
    enrollmentId: number,
    cycleId: number,
    packagePrice: number,
    complete: boolean,
  ): Promise<void> {
    const [receipts] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM tuition_receipts WHERE enrollment_id=? AND status IN ('AVAILABLE','TRANSFERRED')
       AND amount=? ORDER BY received_at,id LIMIT 1 FOR UPDATE`, [enrollmentId, packagePrice],
    );
    const receipt = receipts[0];
    if (!receipt) return;
    await connection.execute(
      "INSERT INTO tuition_receipt_allocations(receipt_id,tuition_cycle_id,allocated_amount) VALUES (?,?,?)",
      [receipt.id, cycleId, packagePrice],
    );
    await connection.execute("UPDATE tuition_receipts SET status='ALLOCATED' WHERE id=?", [receipt.id]);
    await this.audit.record(connection, { action: "TUITION_ADVANCE_ALLOCATED", entityType: "TUITION_RECEIPT",
      entityId: Number(receipt.id), newValues: { enrollmentId, tuitionCycleId: cycleId, complete } });
    if (complete) {
      await connection.execute(
        `UPDATE tuition_cycles SET status='PAID',paid_amount=?,paid_at=CONCAT(?,' 00:00:00'),
          payment_method=?,payment_note=CONCAT('Thu trước #',?) WHERE id=? AND status='PAYMENT_DUE'`,
        [packagePrice, receipt.received_at, receipt.payment_method, receipt.id, cycleId],
      );
      await this.audit.record(connection, { action: "TUITION_CYCLE_MARKED_PAID", entityType: "TUITION_CYCLE",
        entityId: cycleId, newValues: { source: "ADVANCE_RECEIPT", receiptId: Number(receipt.id), amount: packagePrice } });
    }
  }
}

function mapListRow(row: RowDataPacket): TuitionCycleListItem {
  const status = row.status as TuitionCycleListItem["status"];
  const itemCount = Number(row.item_count ?? 0);
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    cycleNumber: Number(row.cycle_number),
    status,
    studentId: Number(row.student_id),
    studentName: String(row.student_name),
    studentNickname: row.student_nickname == null ? null : String(row.student_nickname),
    classId: Number(row.class_id),
    className: String(row.class_name),
    packagePriceSnapshot: Number(row.package_price_snapshot),
    itemCount,
    targetCount: 8,
    progress: itemCount,
    startedAt: row.started_at ? String(row.started_at).slice(0, 10) : null,
    reachedTargetAt: row.reached_target_at ? String(row.reached_target_at).slice(0, 10) : null,
    paidAt: row.paid_at ? String(row.paid_at).slice(0, 10) : null,
    activeNextCycleProgress: status === "ACCUMULATING" || row.active_progress == null
      ? null : Number(row.active_progress),
    settlementStatus: row.settlement_status ?? "OPEN",
    settledAmount: row.settled_amount == null ? null : Number(row.settled_amount),
    hasAdvanceReceipt: Number(row.receipt_count ?? 0) > 0,
  };
}

function mapReceipt(row: RowDataPacket): TuitionReceipt {
  return { id: Number(row.id), enrollmentId: Number(row.enrollment_id), receiptType: "ADVANCE",
    amount: Number(row.amount), packagePriceSnapshot: Number(row.package_price_snapshot),
    receivedAt: String(row.received_at).slice(0, 10), paymentMethod: row.payment_method,
    status: row.status, note: row.note == null ? null : String(row.note),
    tuitionCycleId: row.tuition_cycle_id == null ? null : Number(row.tuition_cycle_id) };
}
