import type {
  MarkTuitionPaidRequest,
  MarkTuitionPaidResult,
  TuitionCycleListQuery,
  TuitionCycleSort,
  TuitionCycleStatus,
  TuitionSummaryQuery,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { decideTuitionPayment } from "../domain/tuition-payment";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "../repositories/audit.repository";
import { TuitionRepository } from "../repositories/tuition.repository";

const listStatuses = new Set<TuitionCycleStatus>([
  "ACCUMULATING", "PAYMENT_DUE", "PAID", "INCOMPLETE",
]);
const sorts = new Set<TuitionCycleSort>(["OLDEST_DUE", "NEWEST", "STUDENT_NAME"]);

export class TuitionService {
  constructor(
    private readonly repository: TuitionRepository,
    private readonly audit = new AuditRepository(),
  ) {}

  list(input: TuitionCycleListQuery) {
    const query = this.normalizeListQuery(input);
    return this.repository.list(query);
  }

  summary(input: TuitionSummaryQuery) {
    const query = this.normalizeSummaryQuery(input);
    return this.repository.summary(query);
  }

  async detail(id: number) {
    this.validateId(id);
    const item = await this.repository.findDetail(id);
    if (!item)
      throw new AppError(404, "CYCLE_NOT_FOUND", "Không tìm thấy chu kỳ học phí.");
    return item;
  }

  async markPaid(
    id: number,
    input: MarkTuitionPaidRequest,
    actorUserId?: number,
  ): Promise<MarkTuitionPaidResult> {
    this.validateId(id);
    this.validatePayment(input);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const cycle = await this.repository.lockForPayment(connection, id);
      if (!cycle)
        throw new AppError(404, "CYCLE_NOT_FOUND", "Không tìm thấy chu kỳ học phí.");
      const decision = decideTuitionPayment(cycle, input);
      if (decision === "IDEMPOTENT") {
        await connection.commit();
        return {
          cycleId: id,
          status: "PAID",
          paidAmount: cycle.paidAmount!,
          paidAt: cycle.paidAt!,
          paymentMethod: cycle.paymentMethod!,
          paymentNote: cycle.paymentNote,
          idempotent: true,
        };
      }
      if (decision === "CONFLICT")
        throw new AppError(409, "PAYMENT_CONFLICT", "Chu kỳ đã được thanh toán với thông tin khác.");
      if (decision === "NOT_DUE")
        throw new AppError(409, "CYCLE_NOT_DUE", "Chỉ chu kỳ cần thu mới được đánh dấu đã thu.");
      if (decision === "INVALID_ITEM_COUNT")
        throw new AppError(409, "CYCLE_ITEM_COUNT_INVALID", "Chu kỳ cần có đúng 8 buổi trước khi thanh toán.");
      if (decision === "INVALID_AMOUNT")
        throw new AppError(400, "FULL_PAYMENT_REQUIRED", "V1 chỉ hỗ trợ thanh toán toàn bộ đúng giá snapshot.");

      await this.repository.updatePayment(connection, id, input);
      await this.audit.record(connection, {
        actorUserId,
        action: "TUITION_CYCLE_MARKED_PAID",
        entityType: "TUITION_CYCLE",
        entityId: id,
        previousValues: {
          status: cycle.status,
          paidAmount: cycle.paidAmount,
          paidAt: cycle.paidAt,
          paymentMethod: cycle.paymentMethod,
          paymentNote: cycle.paymentNote,
        },
        newValues: {
          status: "PAID",
          paidAmount: input.paidAmount,
          paidAt: input.paidAt,
          paymentMethod: input.paymentMethod,
          paymentNote: input.paymentNote?.trim() || null,
        },
      });
      await connection.commit();
      return {
        cycleId: id,
        status: "PAID",
        paidAmount: input.paidAmount,
        paidAt: input.paidAt,
        paymentMethod: input.paymentMethod,
        paymentNote: input.paymentNote?.trim() || null,
        idempotent: false,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private normalizeListQuery(input: TuitionCycleListQuery) {
    if (input.status && !listStatuses.has(input.status))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái chu kỳ không hợp lệ.");
    if (input.sort && !sorts.has(input.sort))
      throw new AppError(400, "VALIDATION_ERROR", "Kiểu sắp xếp không hợp lệ.");
    for (const value of [input.classId, input.studentId, input.enrollmentId])
      if (value != null) this.validateId(value);
    this.validateDateRange(input.from, input.to);
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Phân trang không hợp lệ.");
    const search = input.search?.trim();
    if (search && search.length > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Từ khóa tìm kiếm tối đa 100 ký tự.");
    return {
      ...input,
      search: search || undefined,
      sort: input.sort ?? "OLDEST_DUE" as const,
      page,
      pageSize,
    };
  }

  private normalizeSummaryQuery(input: TuitionSummaryQuery): TuitionSummaryQuery {
    this.validateDateRange(input.from, input.to);
    return input;
  }

  private validatePayment(input: MarkTuitionPaidRequest): void {
    if (!Number.isInteger(input.paidAmount) || input.paidAmount <= 0)
      throw new AppError(400, "VALIDATION_ERROR", "Số tiền phải là số nguyên VND lớn hơn 0.");
    if (!this.isDate(input.paidAt))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày thanh toán không hợp lệ.");
    if (input.paymentMethod !== "CASH" && input.paymentMethod !== "BANK_TRANSFER")
      throw new AppError(400, "VALIDATION_ERROR", "Hình thức thanh toán không hợp lệ.");
    if (input.paymentNote != null && input.paymentNote.length > 1000)
      throw new AppError(400, "VALIDATION_ERROR", "Ghi chú thanh toán tối đa 1000 ký tự.");
  }

  private validateDateRange(from?: string, to?: string): void {
    if (from && !this.isDate(from))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ.");
    if (to && !this.isDate(to))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày kết thúc không hợp lệ.");
    if (from && to && from > to)
      throw new AppError(400, "VALIDATION_ERROR", "Khoảng ngày không hợp lệ.");
  }

  private isDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }
}
