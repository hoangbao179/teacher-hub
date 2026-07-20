import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  ChangeTuitionModeRequest,
  CreateEnrollmentRequest,
  EnrollmentStatus,
} from "@teacher/shared";
import { pool } from "../db/pool";

export type EnrollmentWriteResult =
  | { kind: "OK"; id: number }
  | { kind: "CLASS_NOT_FOUND" | "STUDENT_NOT_FOUND" | "ENROLLMENT_NOT_FOUND" }
  | { kind: "CLASS_CLOSED" | "STUDENT_ACTIVE_ENROLLMENT" | "ONE_TO_ONE_LIMIT" }
  | { kind: "INVALID_TRANSITION" };

export class EnrollmentRepository {
  async create(classId: number, input: CreateEnrollmentRequest): Promise<EnrollmentWriteResult> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [classes] = await connection.query<RowDataPacket[]>(
        "SELECT id,class_type,status FROM classes WHERE id=? FOR UPDATE",
        [classId],
      );
      if (!classes[0]) return await this.rollback(connection, { kind: "CLASS_NOT_FOUND" });
      if (classes[0].status === "CLOSED") return await this.rollback(connection, { kind: "CLASS_CLOSED" });
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
      await connection.commit();
      return { kind: "OK", id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async setStatus(id: number, status: EnrollmentStatus, endedAt?: string, reason?: string): Promise<EnrollmentWriteResult> {
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
      await connection.execute(
        `UPDATE class_enrollments SET status=?,ended_at=?,end_reason=? WHERE id=?`,
        [status, status === "ENDED" ? (endedAt ?? null) : null, status === "ENDED" ? (reason ?? null) : null, id],
      );
      await connection.commit();
      return { kind: "OK", id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async changeTuitionMode(id: number, input: ChangeTuitionModeRequest): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE class_enrollments SET tuition_mode=?,custom_package_price=?,tuition_effective_from=? WHERE id=? AND status<>'ENDED'`,
      [input.tuitionMode, input.tuitionMode === "CUSTOM" ? (input.customPackagePrice ?? null) : null,
        input.effectiveFrom, id],
    );
    return result.affectedRows > 0;
  }

  private async rollback<T extends EnrollmentWriteResult>(connection: { rollback(): Promise<void> }, result: T): Promise<T> {
    await connection.rollback();
    return result;
  }
}
