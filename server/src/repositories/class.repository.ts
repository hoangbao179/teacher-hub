import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type {
  ClassDetail,
  ClassListItem,
  CreateClassRequest,
  UpdateClassRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { AuditRepository } from "./audit.repository";
import { TuitionPolicyRepository } from "./tuition-policy.repository";
import { todayInHoChiMinh } from "../utils/date";

interface ClassRow extends RowDataPacket {
  id: number;
  name: string;
  class_type: ClassListItem["type"];
  subject: string | null;
  status: ClassListItem["status"];
  default_package_price: number;
  default_duration_minutes: number;
  start_date: string;
  expected_end_date: string | null;
  closed_at: string | null;
  note: string | null;
  active_student_count: number;
  payment_due_count: number;
}

function mapList(row: ClassRow): ClassListItem {
  return {
    id: row.id,
    name: row.name,
    type: row.class_type,
    subject: row.subject,
    status: row.status,
    defaultPackagePrice: Number(row.default_package_price),
    defaultDurationMinutes: Number(row.default_duration_minutes),
    activeStudentCount: Number(row.active_student_count),
    paymentDueCount: Number(row.payment_due_count),
  };
}

export class ClassRepository {
  constructor(
    private readonly audit = new AuditRepository(),
    private readonly policies = new TuitionPolicyRepository(),
  ) {}
  async list(): Promise<ClassListItem[]> {
    const [rows] = await pool.query<ClassRow[]>(`
      SELECT c.*,
        COUNT(DISTINCT CASE WHEN e.status='ACTIVE' THEN e.id END) AS active_student_count,
        COUNT(DISTINCT CASE WHEN tc.status='PAYMENT_DUE' THEN tc.id END) AS payment_due_count
      FROM classes c
      LEFT JOIN class_enrollments e ON e.class_id = c.id
      LEFT JOIN tuition_cycles tc ON tc.enrollment_id = e.id
      GROUP BY c.id
      ORDER BY FIELD(c.status,'ACTIVE','PAUSED','CLOSED'), c.name
    `);
    return rows.map(mapList);
  }

  async findDetail(id: number): Promise<ClassDetail | null> {
    const [classes] = await pool.query<ClassRow[]>(
      `
      SELECT c.*,
        COUNT(DISTINCT CASE WHEN e.status='ACTIVE' THEN e.id END) AS active_student_count,
        COUNT(DISTINCT CASE WHEN tc.status='PAYMENT_DUE' THEN tc.id END) AS payment_due_count
      FROM classes c
      LEFT JOIN class_enrollments e ON e.class_id = c.id
      LEFT JOIN tuition_cycles tc ON tc.enrollment_id = e.id
      WHERE c.id = ? GROUP BY c.id
    `,
      [id],
    );
    const row = classes[0];
    if (!row) return null;

    const [schedules] = await pool.query<RowDataPacket[]>(
      'SELECT id, day_of_week, TIME_FORMAT(start_time, "%H:%i") start_time, TIME_FORMAT(end_time, "%H:%i") end_time FROM recurring_schedules WHERE class_id=? AND effective_to IS NULL ORDER BY day_of_week,start_time',
      [id],
    );
    const [students] = await pool.query<RowDataPacket[]>(
      `
      SELECT e.id enrollment_id, s.id student_id, s.full_name, s.nickname, e.tuition_mode,
        (SELECT COUNT(*) FROM tuition_cycle_sessions tcs JOIN tuition_cycles tc2 ON tc2.id=tcs.tuition_cycle_id WHERE tc2.enrollment_id=e.id AND tc2.status='ACCUMULATING') current_progress,
        EXISTS(SELECT 1 FROM tuition_cycles due WHERE due.enrollment_id=e.id AND due.status='PAYMENT_DUE') has_payment_due
      FROM class_enrollments e JOIN students s ON s.id=e.student_id
      WHERE e.class_id=? AND e.status='ACTIVE' ORDER BY s.full_name
    `,
      [id],
    );

    return {
      ...mapList(row),
      startDate: String(row.start_date).slice(0, 10),
      expectedEndDate: row.expected_end_date
        ? String(row.expected_end_date).slice(0, 10)
        : null,
      closedAt: row.closed_at,
      note: row.note,
      schedules: schedules.map((item) => ({
        id: Number(item.id),
        dayOfWeek: Number(item.day_of_week) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        startTime: String(item.start_time),
        endTime: String(item.end_time),
      })),
      students: students.map((item) => ({
        enrollmentId: Number(item.enrollment_id),
        studentId: Number(item.student_id),
        fullName: String(item.full_name),
        nickname: item.nickname ? String(item.nickname) : null,
        tuitionMode: item.tuition_mode,
        currentProgress:
          item.current_progress == null ? null : Number(item.current_progress),
        hasPaymentDue: Boolean(item.has_payment_due),
      })),
    };
  }

  async create(input: CreateClassRequest, actorUserId?: number): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO classes(name,class_type,subject,default_package_price,default_duration_minutes,start_date,expected_end_date,status,note,closed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `,
        [
          input.name,
          input.type,
          input.subject ?? null,
          input.defaultPackagePrice,
          input.defaultDurationMinutes,
          input.startDate,
          input.expectedEndDate ?? null,
          input.status ?? "ACTIVE",
          input.note ?? null,
          input.status === "CLOSED" ? new Date() : null,
        ],
      );
      await this.audit.record(connection, {
        actorUserId, action: "CLASS_CREATED", entityType: "CLASS",
        entityId: result.insertId, newValues: input,
      });
      await this.policies.createInitialClassPolicy(
        connection,
        result.insertId,
        input.defaultPackagePrice,
        input.startDate,
        actorUserId,
      );
      for (const schedule of input.schedules) {
        const [scheduleResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from) VALUES (?,?,?,?,?)",
          [
            result.insertId,
            schedule.dayOfWeek,
            schedule.startTime,
            schedule.endTime,
            input.startDate,
          ],
        );
        await this.audit.record(connection, {
          actorUserId, action: "RECURRING_SCHEDULE_CREATED", entityType: "RECURRING_SCHEDULE",
          entityId: scheduleResult.insertId, newValues: { classId: result.insertId, ...schedule },
        });
      }
      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, input: UpdateClassRequest, actorUserId?: number): Promise<"UPDATED" | "NOT_FOUND" | "ONE_TO_ONE_CONFLICT" | "INVALID_TRANSITION"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM classes WHERE id=? FOR UPDATE",
        [id],
      );
      if (!existing[0]) {
        await connection.rollback();
        return "NOT_FOUND";
      }
      if (existing[0].status === "CLOSED" && input.status !== "CLOSED") {
        await connection.rollback();
        return "INVALID_TRANSITION";
      }
      if (input.type === "ONE_TO_ONE") {
        const [counts] = await connection.query<RowDataPacket[]>(
          "SELECT COUNT(*) count FROM class_enrollments WHERE class_id=? AND status='ACTIVE' FOR UPDATE",
          [id],
        );
        if (Number(counts[0]?.count ?? 0) > 1) {
          await connection.rollback();
          return "ONE_TO_ONE_CONFLICT";
        }
      }
      await connection.execute<ResultSetHeader>(
        `UPDATE classes SET name=?,class_type=?,subject=?,default_package_price=?,
          default_duration_minutes=?,start_date=?,expected_end_date=?,status=?,note=?,
          closed_at=CASE WHEN ?='CLOSED' THEN COALESCE(closed_at,NOW()) ELSE NULL END
         WHERE id=?`,
        [
          input.name,
          input.type,
          input.subject ?? null,
          input.defaultPackagePrice,
          input.defaultDurationMinutes,
          input.startDate,
          input.expectedEndDate ?? null,
          input.status,
          input.note ?? null,
          input.status,
          id,
        ],
      );
      if (Number(existing[0].default_package_price) !== input.defaultPackagePrice) {
        await this.policies.replaceClassPolicy(
          connection,
          id,
          input.defaultPackagePrice,
          todayInHoChiMinh(),
          actorUserId,
        );
      }
      await this.audit.record(connection, {
        actorUserId, action: "CLASS_UPDATED", entityType: "CLASS", entityId: id,
        previousValues: existing[0], newValues: input,
      });
      if (existing[0].status !== input.status) {
        const statusAction = input.status === "PAUSED" ? "CLASS_PAUSED" : input.status === "ACTIVE" ? "CLASS_RESUMED" : "CLASS_CLOSED";
        await this.audit.record(connection, {
          actorUserId, action: statusAction, entityType: "CLASS", entityId: id,
          previousValues: { status: existing[0].status }, newValues: { status: input.status },
        });
      }
      const [oldSchedules] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM recurring_schedules WHERE class_id=? AND effective_to IS NULL FOR UPDATE",
        [id],
      );
      await connection.execute(
        "DELETE FROM recurring_schedules WHERE class_id=? AND effective_from>=CURDATE()",
        [id],
      );
      await connection.execute(
        "UPDATE recurring_schedules SET effective_to=DATE_SUB(CURDATE(),INTERVAL 1 DAY) WHERE class_id=? AND effective_to IS NULL AND effective_from<CURDATE()",
        [id],
      );
      for (const [index, oldSchedule] of oldSchedules.entries()) {
        const replacement = input.schedules[index];
        await this.audit.record(connection, {
          actorUserId,
          action: replacement ? "RECURRING_SCHEDULE_UPDATED" : "RECURRING_SCHEDULE_DELETED",
          entityType: "RECURRING_SCHEDULE", entityId: Number(oldSchedule.id),
          previousValues: oldSchedule,
          newValues: replacement ? { classId: id, ...replacement } : undefined,
        });
      }
      for (const schedule of input.schedules) {
        const [scheduleResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from) VALUES (?,?,?,?,GREATEST(?,CURDATE()))",
          [id, schedule.dayOfWeek, schedule.startTime, schedule.endTime, input.startDate],
        );
        await this.audit.record(connection, {
          actorUserId, action: "RECURRING_SCHEDULE_CREATED", entityType: "RECURRING_SCHEDULE",
          entityId: scheduleResult.insertId, newValues: { classId: id, ...schedule },
        });
      }
      await connection.commit();
      return "UPDATED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async setStatus(id: number, status: "ACTIVE" | "PAUSED" | "CLOSED", actorUserId?: number): Promise<"UPDATED" | "NOT_FOUND" | "INVALID_TRANSITION"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM classes WHERE id=? FOR UPDATE", [id]);
      const previous = rows[0];
      if (!previous) { await connection.rollback(); return "NOT_FOUND"; }
      const allowed = (status === "PAUSED" && previous.status === "ACTIVE") ||
        (status === "ACTIVE" && previous.status === "PAUSED") ||
        (status === "CLOSED" && ["ACTIVE", "PAUSED"].includes(String(previous.status)));
      if (!allowed) { await connection.rollback(); return "INVALID_TRANSITION"; }
      await connection.execute(
        `UPDATE classes SET status=?,closed_at=CASE WHEN ?='CLOSED' THEN COALESCE(closed_at,NOW()) ELSE NULL END WHERE id=?`,
        [status, status, id],
      );
      const action = status === "PAUSED" ? "CLASS_PAUSED" : status === "ACTIVE" ? "CLASS_RESUMED" : "CLASS_CLOSED";
      await this.audit.record(connection, {
        actorUserId, action, entityType: "CLASS", entityId: id,
        previousValues: { status: previous.status }, newValues: { status },
      });
      await connection.commit();
      return "UPDATED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  async countActiveEnrollment(
    connection: PoolConnection,
    studentId: number,
  ): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) count FROM class_enrollments WHERE student_id=? AND status='ACTIVE' FOR UPDATE",
      [studentId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
