import type { ChangeEnrollmentStatusRequest, ChangeTuitionModeRequest, CreateEnrollmentRequest, EndEnrollmentRequest, TransferEnrollmentRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { EnrollmentRepository, type EnrollmentWriteResult } from "../repositories/enrollment.repository";

export class EnrollmentService {
  constructor(private readonly repository: EnrollmentRepository) {}

  async create(classId: number, input: CreateEnrollmentRequest, actorUserId?: number) {
    this.validateIdentity(classId, input.studentId);
    this.validateTuition(input.tuitionMode, input.customPackagePrice);
    this.validateDate(input.joinedAt, "Ngày vào học");
    return this.unwrap(await this.repository.create(classId, input, actorUserId));
  }

  async pause(id: number, input: ChangeEnrollmentStatusRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateDate(input.effectiveDate, "Ngày hiệu lực");
    this.unwrap(await this.repository.setStatus(id, "PAUSED", input.effectiveDate, undefined, input.reason, actorUserId));
  }

  async resume(id: number, input: ChangeEnrollmentStatusRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateDate(input.effectiveDate, "Ngày hiệu lực");
    this.unwrap(await this.repository.setStatus(id, "ACTIVE", input.effectiveDate, undefined, input.reason, actorUserId));
  }

  async end(id: number, input: EndEnrollmentRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateDate(input.endedAt, "Ngày kết thúc");
    this.validateClosure(input.incompleteCycleAction, input.advanceReceiptAction, false);
    const hasFinancialChoice = input.incompleteCycleAction != null || input.advanceReceiptAction != null || input.note != null;
    const result = hasFinancialChoice
      ? await this.repository.setStatus(id, "ENDED", input.endedAt, input.endedAt, input.reason, actorUserId, input)
      : await this.repository.setStatus(id, "ENDED", input.endedAt, input.endedAt, input.reason, actorUserId);
    this.unwrap(result);
  }

  async transfer(id: number, input: TransferEnrollmentRequest, actorUserId?: number) {
    this.validateId(id); this.validateId(input.targetClassId);
    this.validateDate(input.effectiveDate, "Ngày chuyển lớp");
    this.validateTuition(input.tuitionMode, input.customPackagePrice);
    if (!input.reason?.trim() || input.reason.trim().length > 255)
      throw new AppError(400, "VALIDATION_ERROR", "Lý do chuyển lớp là bắt buộc và tối đa 255 ký tự.");
    this.validateClosure(input.incompleteCycleAction, input.advanceReceiptAction, true);
    try { return await this.repository.transfer(id, input, actorUserId); }
    catch (error) {
      const code = (error as Error).message;
      const mapped: Record<string, [number, string, string]> = {
        ENROLLMENT_NOT_FOUND: [404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh đang hoạt động."],
        STUDENT_NOT_FOUND: [404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh."],
        CLASS_NOT_FOUND: [404, "CLASS_NOT_FOUND", "Không tìm thấy lớp đích."],
        CLASS_CLOSED: [409, "CLASS_CLOSED", "Lớp đích đã đóng."],
        CLASS_PAUSED: [409, "CLASS_PAUSED", "Lớp đích đang tạm dừng."],
        CLASS_INACTIVE_DATE: [409, "CLASS_INACTIVE_DATE", "Lớp đích không hoạt động tại ngày chuyển."],
        ONE_TO_ONE_LIMIT: [409, "ONE_TO_ONE_LIMIT", "Lớp 1 kèm 1 đã có học sinh."],
        TRANSFER_SAME_CLASS: [409, "TRANSFER_SAME_CLASS", "Lớp đích phải khác lớp hiện tại."],
        INVALID_TRANSFER_DATE: [400, "INVALID_TRANSFER_DATE", "Ngày chuyển phải sau ngày bắt đầu ghi danh cũ."],
        INCOMPLETE_CYCLE_NOT_FOUND: [409, "INCOMPLETE_CYCLE_NOT_FOUND", "Không có đợt dở dang để xử lý."],
      };
      if (mapped[code]) throw new AppError(...mapped[code]);
      throw error;
    }
  }

  async changeTuitionMode(id: number, input: ChangeTuitionModeRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateTuition(input.tuitionMode, input.customPackagePrice);
    this.validateDate(input.effectiveFrom, "Ngày áp dụng");
    if (!(await this.repository.changeTuitionMode(id, input, actorUserId)))
      throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh đang hoạt động.");
  }

  private validateTuition(mode: string, customPrice?: number) {
    if (!(["CLASS_DEFAULT", "CUSTOM", "FREE"] as const).includes(mode as never))
      throw new AppError(400, "VALIDATION_ERROR", "Chế độ học phí không hợp lệ.");
    if (mode === "CUSTOM" && (!Number.isInteger(customPrice) || (customPrice ?? 0) <= 0))
      throw new AppError(400, "CUSTOM_PRICE_REQUIRED", "Giá riêng nguyên VND lớn hơn 0 là bắt buộc.");
    if (mode !== "CUSTOM" && customPrice != null)
      throw new AppError(400, mode === "FREE" ? "FREE_CUSTOM_PRICE" : "CLASS_DEFAULT_CUSTOM_PRICE", "Chỉ chế độ giá riêng mới được có giá riêng.");
  }

  private validateIdentity(classId: number, studentId: number) {
    this.validateId(classId);
    this.validateId(studentId);
  }
  private validateClosure(incomplete?: EndEnrollmentRequest["incompleteCycleAction"], receipt?: { type: string }, transferring = false) {
    if (incomplete?.type === "SETTLE" && (!Number.isInteger(incomplete.amount) || incomplete.amount < 0 ||
        !["CASH", "BANK_TRANSFER"].includes(incomplete.method)))
      throw new AppError(400, "VALIDATION_ERROR", "Thông tin chốt đợt dở dang không hợp lệ.");
    if (incomplete?.type === "WAIVE" && !incomplete.reason?.trim())
      throw new AppError(400, "VALIDATION_ERROR", "Cần nhập lý do miễn đợt dở dang.");
    if (receipt && !["NONE", "REFUND", "APPLY_TO_OLD_SETTLEMENT", "TRANSFER_TO_NEW_ENROLLMENT"].includes(receipt.type))
      throw new AppError(400, "VALIDATION_ERROR", "Cách xử lý khoản thu trước không hợp lệ.");
    if (!transferring && receipt?.type === "TRANSFER_TO_NEW_ENROLLMENT")
      throw new AppError(400, "VALIDATION_ERROR", "Chỉ thao tác chuyển lớp mới được chuyển khoản thu trước sang ghi danh mới.");
  }
  private validateId(id: number) {
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }
  private validateDate(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  }
  private unwrap(result: EnrollmentWriteResult): number {
    if (result.kind === "OK") return result.id;
    const errors = {
      CLASS_NOT_FOUND: [404, "CLASS_NOT_FOUND", "Không tìm thấy lớp."],
      STUDENT_NOT_FOUND: [404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh."],
      ENROLLMENT_NOT_FOUND: [404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh."],
      CLASS_CLOSED: [409, "CLASS_CLOSED", "Lớp đã đóng không thể nhận học sinh."],
      CLASS_PAUSED: [409, "CLASS_PAUSED", "Lớp đang tạm dừng không thể nhận hoặc mở lại ghi danh."],
      STUDENT_ACTIVE_ENROLLMENT: [409, "STUDENT_ACTIVE_ENROLLMENT", "Học sinh đã có một ghi danh đang hoạt động."],
      ONE_TO_ONE_LIMIT: [409, "ONE_TO_ONE_LIMIT", "Lớp 1 kèm 1 đã có học sinh đang học."],
      INVALID_TRANSITION: [409, "INVALID_ENROLLMENT_TRANSITION", "Chuyển trạng thái ghi danh không hợp lệ."],
    } as const;
    const [status, code, message] = errors[result.kind];
    throw new AppError(status, code, message);
  }
}
