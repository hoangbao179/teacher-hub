import type {
  MarkMonthlyTuitionPaidRequest,
  MarkMonthlyTuitionPaidResult,
  MonthlyTuitionBoard,
  MonthlyTuitionQuery,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { validateTuitionMonth } from "../domain/monthly-tuition";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "../repositories/audit.repository";
import { TuitionRepository } from "../repositories/tuition.repository";

export class TuitionService {
  constructor(private readonly repository: TuitionRepository, private readonly audit = new AuditRepository()) {}

  monthlyBoard(input: MonthlyTuitionQuery): Promise<MonthlyTuitionBoard> {
    const { year, month } = validateTuitionMonth(Number(input.year), Number(input.month));
    if (input.classId != null) this.validateId(input.classId);
    const search = input.search?.trim();
    if (search && search.length > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Từ khóa tìm kiếm tối đa 100 ký tự.");
    return this.repository.monthlyBoard({ year, month, classId: input.classId, search: search || undefined });
  }

  async markMonthlyPaid(enrollmentId: number, year: number, month: number,
    input: MarkMonthlyTuitionPaidRequest, actorUserId?: number): Promise<MarkMonthlyTuitionPaidResult> {
    this.validateId(enrollmentId);
    validateTuitionMonth(year, month);
    if (!input || !this.isDate(input.paidAt))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày thu học phí không hợp lệ.");
    if (input.amount != null && (!Number.isInteger(input.amount) || input.amount < 0))
      throw new AppError(400, "VALIDATION_ERROR", "Số tiền phải là số nguyên VND không âm.");
    if (input.note != null && input.note.length > 1000)
      throw new AppError(400, "VALIDATION_ERROR", "Ghi chú tối đa 1000 ký tự.");
    const normalized = { amount: input.amount ?? null, paidAt: input.paidAt, note: input.note?.trim() || null };
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const existing = await this.repository.lockMonthlyPayment(connection, enrollmentId, year, month);
      if (existing) {
        const same = Number(existing.amount ?? 0) === Number(normalized.amount ?? 0) &&
          (existing.amount == null) === (normalized.amount == null) &&
          String(existing.paid_at).slice(0, 10) === normalized.paidAt &&
          (existing.note == null ? null : String(existing.note)) === normalized.note;
        if (!same) throw new AppError(409, "MONTHLY_TUITION_PAID_IMMUTABLE", "Học phí tháng đã thu và không thể thay đổi.");
        await connection.commit();
        return { payment: await this.findMonthlyRow(enrollmentId, year, month), idempotent: true };
      }
      const paymentId = await this.repository.createMonthlyPayment(connection, enrollmentId, year, month, normalized);
      await this.audit.record(connection, { actorUserId, action: "MONTHLY_TUITION_MARKED_PAID", entityType: "MONTHLY_TUITION",
        entityId: paymentId, newValues: { enrollmentId, year, month, status: "PAID", ...normalized } });
      await connection.commit();
      return { payment: await this.findMonthlyRow(enrollmentId, year, month), idempotent: false };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  private async findMonthlyRow(enrollmentId: number, year: number, month: number) {
    const row = (await this.repository.monthlyBoard({ year, month })).rows.find((item) => item.enrollmentId === enrollmentId);
    if (!row) throw new AppError(404, "MONTHLY_TUITION_NOT_FOUND", "Không tìm thấy học phí tháng.");
    return row;
  }
  private isDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }
}
