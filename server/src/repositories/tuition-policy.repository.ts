import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { TuitionMode } from "@teacher/shared";
import { AppError } from "../errors/app-error";

export interface ResolvedTuitionPolicy {
  enrollmentId: number;
  mode: TuitionMode;
  packagePrice: number | null;
  enrollmentPolicyId: number;
  classPolicyId: number | null;
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function dateOnly(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export class TuitionPolicyRepository {
  async resolve(
    connection: PoolConnection,
    enrollmentId: number,
    date: string,
    lock = false,
  ): Promise<ResolvedTuitionPolicy> {
    const lockClause = lock ? " FOR UPDATE" : "";
    const [enrollmentRows] = await connection.query<RowDataPacket[]>(
      `SELECT ep.id,e.class_id,ep.tuition_mode,ep.custom_package_price
       FROM enrollment_tuition_policies ep
       JOIN class_enrollments e ON e.id=ep.enrollment_id
       WHERE ep.enrollment_id=? AND ep.effective_from<=?
         AND (ep.effective_to IS NULL OR ep.effective_to>=?)
       ORDER BY ep.effective_from DESC LIMIT 1${lockClause}`,
      [enrollmentId, date, date],
    );
    const policy = enrollmentRows[0];
    if (!policy)
      throw new AppError(409, "TUITION_POLICY_NOT_FOUND", "Không tìm thấy chính sách học phí tại ngày học.");
    if (policy.tuition_mode === "FREE") {
      return {
        enrollmentId,
        mode: "FREE",
        packagePrice: null,
        enrollmentPolicyId: Number(policy.id),
        classPolicyId: null,
      };
    }
    if (policy.tuition_mode === "CUSTOM") {
      return {
        enrollmentId,
        mode: "CUSTOM",
        packagePrice: Number(policy.custom_package_price),
        enrollmentPolicyId: Number(policy.id),
        classPolicyId: null,
      };
    }
    const [classRows] = await connection.query<RowDataPacket[]>(
      `SELECT id,package_price FROM class_tuition_policies
       WHERE class_id=? AND effective_from<=?
         AND (effective_to IS NULL OR effective_to>=?)
       ORDER BY effective_from DESC LIMIT 1${lockClause}`,
      [policy.class_id, date, date],
    );
    if (!classRows[0])
      throw new AppError(409, "TUITION_POLICY_NOT_FOUND", "Không tìm thấy giá mặc định của lớp tại ngày học.");
    return {
      enrollmentId,
      mode: "CLASS_DEFAULT",
      packagePrice: Number(classRows[0].package_price),
      enrollmentPolicyId: Number(policy.id),
      classPolicyId: Number(classRows[0].id),
    };
  }

  async createInitialClassPolicy(
    connection: PoolConnection,
    classId: number,
    packagePrice: number,
    effectiveFrom: string,
    actorUserId?: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO class_tuition_policies
       (class_id,package_price,effective_from,created_by) VALUES (?,?,?,?)`,
      [classId, packagePrice, effectiveFrom, actorUserId ?? null],
    );
    return result.insertId;
  }

  async replaceClassPolicy(
    connection: PoolConnection,
    classId: number,
    packagePrice: number,
    effectiveFrom: string,
    actorUserId?: number,
  ): Promise<void> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM class_tuition_policies WHERE class_id=? ORDER BY effective_from FOR UPDATE",
      [classId],
    );
    const sameDay = rows.find((row) => dateOnly(row.effective_from) === effectiveFrom);
    if (sameDay) {
      await connection.execute(
        "UPDATE class_tuition_policies SET package_price=?,created_by=? WHERE id=?",
        [packagePrice, actorUserId ?? null, sameDay.id],
      );
      return;
    }
    const previous = [...rows].reverse().find((row) => dateOnly(row.effective_from) < effectiveFrom);
    const next = rows.find((row) => dateOnly(row.effective_from) > effectiveFrom);
    if (previous && (previous.effective_to == null || dateOnly(previous.effective_to) >= effectiveFrom))
      await connection.execute("UPDATE class_tuition_policies SET effective_to=? WHERE id=?", [previousDate(effectiveFrom), previous.id]);
    await connection.execute(
      `INSERT INTO class_tuition_policies
       (class_id,package_price,effective_from,effective_to,created_by) VALUES (?,?,?,?,?)`,
      [classId, packagePrice, effectiveFrom, next ? previousDate(dateOnly(next.effective_from)) : null, actorUserId ?? null],
    );
  }

  async createInitialEnrollmentPolicy(
    connection: PoolConnection,
    enrollmentId: number,
    mode: TuitionMode,
    customPackagePrice: number | null,
    effectiveFrom: string,
    actorUserId?: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO enrollment_tuition_policies
       (enrollment_id,tuition_mode,custom_package_price,effective_from,created_by)
       VALUES (?,?,?,?,?)`,
      [enrollmentId, mode, mode === "CUSTOM" ? customPackagePrice : null, effectiveFrom, actorUserId ?? null],
    );
    return result.insertId;
  }

  async replaceEnrollmentPolicy(
    connection: PoolConnection,
    enrollmentId: number,
    mode: TuitionMode,
    customPackagePrice: number | null,
    effectiveFrom: string,
    actorUserId?: number,
  ): Promise<void> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM enrollment_tuition_policies WHERE enrollment_id=? ORDER BY effective_from FOR UPDATE",
      [enrollmentId],
    );
    const sameDay = rows.find((row) => dateOnly(row.effective_from) === effectiveFrom);
    if (sameDay) {
      await connection.execute(
        "UPDATE enrollment_tuition_policies SET tuition_mode=?,custom_package_price=?,created_by=? WHERE id=?",
        [mode, mode === "CUSTOM" ? customPackagePrice : null, actorUserId ?? null, sameDay.id],
      );
      return;
    }
    const previous = [...rows].reverse().find((row) => dateOnly(row.effective_from) < effectiveFrom);
    const next = rows.find((row) => dateOnly(row.effective_from) > effectiveFrom);
    if (previous && (previous.effective_to == null || dateOnly(previous.effective_to) >= effectiveFrom))
      await connection.execute("UPDATE enrollment_tuition_policies SET effective_to=? WHERE id=?", [previousDate(effectiveFrom), previous.id]);
    await connection.execute(
      `INSERT INTO enrollment_tuition_policies
       (enrollment_id,tuition_mode,custom_package_price,effective_from,effective_to,created_by)
       VALUES (?,?,?,?,?,?)`,
      [enrollmentId, mode, mode === "CUSTOM" ? customPackagePrice : null, effectiveFrom,
        next ? previousDate(dateOnly(next.effective_from)) : null, actorUserId ?? null],
    );
  }
}
