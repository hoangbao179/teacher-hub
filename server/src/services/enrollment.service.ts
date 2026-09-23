import type { ChangeEnrollmentStatusRequest, ChangeTuitionExemptionRequest, CreateEnrollmentRequest, EndEnrollmentRequest, TransferEnrollmentRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { EnrollmentRepository, type EnrollmentWriteResult } from "../repositories/enrollment.repository";

export class EnrollmentService {
  constructor(private readonly repository: EnrollmentRepository) {}

  async create(classId: number, input: CreateEnrollmentRequest, actorUserId?: number) {
    this.validateIdentity(classId, input.studentId);
    this.validateExemption(input.tuitionExempt);
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
    this.unwrap(await this.repository.setStatus(id, "ENDED", input.endedAt, input.endedAt, input.reason, actorUserId));
  }

  async transfer(id: number, input: TransferEnrollmentRequest, actorUserId?: number) {
    this.validateId(id); this.validateId(input.targetClassId);
    this.validateDate(input.effectiveDate, "Ngày chuyển lớp");
    this.validateExemption(input.tuitionExempt);
    if (!input.reason?.trim() || input.reason.trim().length > 255)
      throw new AppError(400, "VALIDATION_ERROR", "Lý do chuyển lớp là bắt buộc và tối đa 255 ký tự.");
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
      };
      if (mapped[code]) throw new AppError(...mapped[code]);
      throw error;
    }
  }

  async changeTuitionExemption(id: number, input: ChangeTuitionExemptionRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateExemption(input.tuitionExempt);
    if (!(await this.repository.changeTuitionExemption(id, input, actorUserId)))
      throw new AppError(404, "ENROLLMENT_NOT_FOUND", "Không tìm thấy ghi danh đang hoạt động.");
  }

  private validateExemption(value?: boolean) {
    if (value != null && typeof value !== "boolean")
      throw new AppError(400, "VALIDATION_ERROR", "Cờ miễn học phí không hợp lệ.");
  }

  private validateIdentity(classId: number, studentId: number) {
    this.validateId(classId);
    this.validateId(studentId);
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
