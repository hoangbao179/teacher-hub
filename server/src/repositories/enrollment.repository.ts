import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  ChangeTuitionModeRequest,
  CreateEnrollmentRequest,
  EnrollmentStatus,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { AuditRepository } from "./audit.repository";
import { TuitionPolicyRepository } from "./tuition-policy.repository";
import { TuitionRepository } from "./tuition.repository";
import { addDays } from "../utils/date";

export type EnrollmentWriteResult =
  | { kind: "OK"; id: number }
  | { kind: "CLASS_NOT_FOUND" | "STUDENT_NOT_FOUND" | "ENROLLMENT_NOT_FOUND" }
  | { kind: "CLASS_CLOSED" | "CLASS_PAUSED" | "STUDENT_ACTIVE_ENROLLMENT" | "ONE_TO_ONE_LIMIT" }
  | { kind: "INVALID_TRANSITION" };

export class EnrollmentRepository {
  constructor(
    private readonly audit = new AuditRepository(),
    private readonly policies = new TuitionPolicyRepository(),
    private readonly tuition = new TuitionRepository(),
  ) {}

  async create(classId: number, input: CreateEnrollmentRequest, actorUserId?: number): Promise<EnrollmentWriteResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [classes] = await connection.query<RowDataPacket[]>(
        "SELECT id,class_type,status FROM classes WHERE id=? FOR UPDATE",
        [classId],
      );
      if (!classes[0]) return await this.rollback(connection, { kind: "CLASS_NOT_FOUND" });
      if (classes[0].status === "CLOSED") return await this.rollback(connection, { kind: "CLASS_CLOSED" });
      if (classes[0].status === "PAUSED") return await this.rollback(connection, { kind: "CLASS_PAUSED" });
      const [students] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM students WHERE id=? FOR UPDATE",
        [input.studentId],
      );
      if (!students[0]) return await this.rollback(connection, { kind: "STUDENT_NOT_FOUND" });
      const [studentActive] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM class_enrollments WHERE student_id=? AND status='ACTIVE' FOR UPDATE",
        [input.studentId],
      );
      if (studentActive.length) return await this.rollback(connection, { kind: "STUDENT_ACTIVE_ENROLLMENT" });
      if (classes[0].class_type === "ONE_TO_ONE") {
        const [classActive] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM class_enrollments WHERE class_id=? AND status='ACTIVE' FOR UPDATE",
          [classId],
        );
        if (classActive.length) return await this.rollback(connection, { kind: "ONE_TO_ONE_LIMIT" });
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO class_enrollments
          (class_id,student_id,joined_at,tuition_mode,custom_package_price,tuition_effective_from,note)
         VALUES (?,?,?,?,?,?,?)`,
        [classId, input.studentId, input.joinedAt, input.tuitionMode,
          input.tuitionMode === "CUSTOM" ? (input.customPackagePrice ?? null) : null,
          input.joinedAt, input.note ?? null],
      );
      await this.policies.createInitialEnrollmentPolicy(
        connection,
        result.insertId,
        input.tuitionMode,
        input.tuitionMode === "CUSTOM" ? (input.customPackagePrice ?? null) : null,
        input.joinedAt,
        actorUserId,
      );
      await connection.execute(
        "INSERT INTO enrollment_active_periods(enrollment_id,active_from,created_by) VALUES (?,?,?)",
        [result.insertId, input.joinedAt, actorUserId ?? null],
      );
      await this.audit.record(connection, {
        actorUserId, action: "ENROLLMENT_CREATED", entityType: "ENROLLMENT",
        entityId: result.insertId, newValues: { classId, ...input },
      });
      await connection.commit();
      return { kind: "OK", id: result.insertId };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string; message?: string }).code === "ER_DUP_ENTRY" &&
          (error as { message?: string }).message?.includes("uq_enrollments_one_active_per_student")) {
        return { kind: "STUDENT_ACTIVE_ENROLLMENT" };
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async setStatus(
    id: number,
    status: EnrollmentStatus,
    effectiveDate: string,
    endedAt?: string,
    reason?: string,
    actorUserId?: number,
  ): Promise<EnrollmentWriteResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id,class_id,student_id,status FROM class_enrollments WHERE id=? FOR UPDATE",
        [id],
      );
      const enrollment = rows[0];
      if (!enrollment) return await this.rollback(connection, { kind: "ENROLLMENT_NOT_FOUND" });
      const allowed = (status === "PAUSED" && enrollment.status === "ACTIVE") ||
        (status === "ACTIVE" && enrollment.status === "PAUSED") ||
        (status === "ENDED" && (enrollment.status === "ACTIVE" || enrollment.status === "PAUSED"));
      if (!allowed) return await this.rollback(connection, { kind: "INVALID_TRANSITION" });
      if (status === "ACTIVE") {
        const [classes] = await connection.query<RowDataPacket[]>(
          "SELECT id,class_type,status FROM classes WHERE id=? FOR UPDATE",
          [enrollment.class_id],
        );
        if (classes[0]?.status === "CLOSED") return await this.rollback(connection, { kind: "CLASS_CLOSED" });
        if (classes[0]?.status === "PAUSED") return await this.rollback(connection, { kind: "CLASS_PAUSED" });
        const [studentActive] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM class_enrollments WHERE student_id=? AND status='ACTIVE' AND id<>? FOR UPDATE",
          [enrollment.student_id, id],
        );
        if (studentActive.length) return await this.rollback(connection, { kind: "STUDENT_ACTIVE_ENROLLMENT" });
        if (classes[0]?.class_type === "ONE_TO_ONE") {
          const [classActive] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM class_enrollments WHERE class_id=? AND status='ACTIVE' AND id<>? FOR UPDATE",
            [enrollment.class_id, id],
          );
          if (classActive.length) return await this.rollback(connection, { kind: "ONE_TO_ONE_LIMIT" });
        }
      }
      const [periodRows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM enrollment_active_periods WHERE enrollment_id=? ORDER BY active_from DESC FOR UPDATE", [id],
      );
      const openPeriod = periodRows.find((row) => row.active_to == null);
      if (status === "ACTIVE") {
        const overlaps = periodRows.some((row) => String(row.active_from).slice(0, 10) <= effectiveDate &&
          (row.active_to == null || String(row.active_to).slice(0, 10) >= effectiveDate));
        if (overlaps) return await this.rollback(connection, { kind: "INVALID_TRANSITION" });
        await connection.execute(
          "INSERT INTO enrollment_active_periods(enrollment_id,active_from,created_by) VALUES (?,?,?)",
          [id, effectiveDate, actorUserId ?? null],
        );
      } else if (openPeriod) {
        const activeTo = status === "ENDED" ? (endedAt ?? effectiveDate) : addDays(effectiveDate, -1);
        const activeFrom = String(openPeriod.active_from).slice(0, 10);
        if (status === "PAUSED" && effectiveDate === activeFrom)
          await connection.execute("DELETE FROM enrollment_active_periods WHERE id=?", [openPeriod.id]);
        else if (activeTo < activeFrom)
          return await this.rollback(connection, { kind: "INVALID_TRANSITION" });
        else
          await connection.execute(
            "UPDATE enrollment_active_periods SET active_to=? WHERE id=?", [activeTo, openPeriod.id],
          );
      }
      await connection.execute(
        `UPDATE class_enrollments SET status=?,ended_at=?,end_reason=? WHERE id=?`,
        [status, status === "ENDED" ? (endedAt ?? null) : null, status === "ENDED" ? (reason ?? null) : null, id],
      );
      if (status === "ENDED")
        await this.tuition.markAccumulatingIncomplete(connection, id);
      const action = status === "PAUSED" ? "ENROLLMENT_PAUSED" : status === "ACTIVE" ? "ENROLLMENT_RESUMED" : "ENROLLMENT_ENDED";
      await this.audit.record(connection, {
        actorUserId, action, entityType: "ENROLLMENT", entityId: id,
        previousValues: { status: enrollment.status },
        newValues: { status, effectiveDate, endedAt: status === "ENDED" ? endedAt : undefined }, reason,
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

  async changeTuitionMode(id: number, input: ChangeTuitionModeRequest, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM class_enrollments WHERE id=? AND status<>'ENDED' FOR UPDATE", [id],
      );
      if (!rows[0]) { await connection.rollback(); return false; }
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE class_enrollments SET tuition_mode=?,custom_package_price=?,tuition_effective_from=? WHERE id=?`,
        [input.tuitionMode, input.tuitionMode === "CUSTOM" ? (input.customPackagePrice ?? null) : null,
          input.effectiveFrom, id],
      );
      await this.policies.replaceEnrollmentPolicy(
        connection,
        id,
        input.tuitionMode,
        input.tuitionMode === "CUSTOM" ? (input.customPackagePrice ?? null) : null,
        input.effectiveFrom,
        actorUserId,
      );
      await this.audit.record(connection, {
        actorUserId, action: "TUITION_MODE_CHANGED", entityType: "ENROLLMENT", entityId: id,
        previousValues: { tuitionMode: rows[0].tuition_mode, customPackagePrice: rows[0].custom_package_price, effectiveFrom: rows[0].tuition_effective_from },
        newValues: input, reason: input.reason,
      });
      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private async rollback<T extends EnrollmentWriteResult>(connection: { rollback(): Promise<void> }, result: T): Promise<T> {
    await connection.rollback();
    return result;
  }
}
