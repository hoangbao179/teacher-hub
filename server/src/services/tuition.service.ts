import type { MarkTuitionPaidRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { TuitionRepository } from "../repositories/tuition.repository";

export class TuitionService {
  constructor(private readonly repository: TuitionRepository) {}
  list(status?: string) {
    return this.repository.list(status);
  }
  async detail(id: number) {
    const item = await this.repository.findDetail(id);
    if (!item)
      throw new AppError(
        404,
        "CYCLE_NOT_FOUND",
        "Không tìm thấy chu kỳ học phí.",
      );
    return item;
  }
  async markPaid(id: number, input: MarkTuitionPaidRequest) {
    const cycle = await this.detail(id);
    if (cycle.status !== "PAYMENT_DUE")
      throw new AppError(
        409,
        "CYCLE_NOT_DUE",
        "Chỉ chu kỳ cần thu mới được đánh dấu đã thu.",
      );
    if (input.paidAmount !== cycle.packagePriceSnapshot)
      throw new AppError(
        400,
        "FULL_PAYMENT_REQUIRED",
        "V1 chỉ hỗ trợ thanh toán toàn bộ đúng giá chu kỳ.",
      );
    const updated = await this.repository.markPaid(
      id,
      input.paidAmount,
      input.paidAt,
      input.paymentMethod,
      input.paymentNote?.trim() || null,
    );
    if (!updated)
      throw new AppError(
        409,
        "CYCLE_STATE_CHANGED",
        "Chu kỳ đã thay đổi. Hãy tải lại dữ liệu.",
      );
  }
}
