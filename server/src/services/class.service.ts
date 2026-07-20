import type { CreateClassRequest, UpdateClassRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { ClassRepository } from "../repositories/class.repository";

export class ClassService {
  constructor(private readonly repository: ClassRepository) {}
  list() {
    return this.repository.list();
  }
  async detail(id: number) {
    const item = await this.repository.findDetail(id);
    if (!item)
      throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    return item;
  }
  async create(input: CreateClassRequest) {
    this.validate(input);
    return this.repository.create({ ...input, name: input.name.trim() });
  }

  async update(id: number, input: UpdateClassRequest) {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã lớp không hợp lệ.");
    this.validate(input);
    const result = await this.repository.update(id, {
      ...input,
      name: input.name.trim(),
    });
    if (result === "NOT_FOUND")
      throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    if (result === "ONE_TO_ONE_CONFLICT")
      throw new AppError(409, "ONE_TO_ONE_LIMIT", "Lớp 1 kèm 1 chỉ có thể có một học sinh đang học.");
    if (result === "INVALID_TRANSITION")
      throw new AppError(409, "INVALID_CLASS_TRANSITION", "Không thể mở lại lớp đã đóng.");
  }

  async setStatus(id: number, status: "ACTIVE" | "PAUSED" | "CLOSED") {
    const result = await this.repository.setStatus(id, status);
    if (result === "NOT_FOUND")
      throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    if (result === "INVALID_TRANSITION")
      throw new AppError(409, "INVALID_CLASS_TRANSITION", "Chuyển trạng thái lớp không hợp lệ.");
  }

  private validate(input: CreateClassRequest | UpdateClassRequest) {
    if (!input.name?.trim())
      throw new AppError(400, "VALIDATION_ERROR", "Tên lớp là bắt buộc.");
    if (!(["ONE_TO_ONE", "GROUP"] as const).includes(input.type))
      throw new AppError(400, "VALIDATION_ERROR", "Loại lớp không hợp lệ.");
    if ("status" in input && input.status && !(["ACTIVE", "PAUSED", "CLOSED"] as const).includes(input.status))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái lớp không hợp lệ.");
    if (
      !Number.isInteger(input.defaultPackagePrice) ||
      input.defaultPackagePrice < 0
    )
      throw new AppError(400, "VALIDATION_ERROR", "Giá gói không hợp lệ.");
    if (!Number.isInteger(input.defaultDurationMinutes) || input.defaultDurationMinutes < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Thời lượng không hợp lệ.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ.");
    if (!Array.isArray(input.schedules))
      throw new AppError(400, "VALIDATION_ERROR", "Lịch lặp không hợp lệ.");
    const seen = new Set<string>();
    for (const schedule of input.schedules) {
      const key = `${schedule.dayOfWeek}:${schedule.startTime}`;
      if (!Number.isInteger(schedule.dayOfWeek) || schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7 ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.startTime) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.endTime) ||
          schedule.endTime <= schedule.startTime || seen.has(key))
        throw new AppError(400, "VALIDATION_ERROR", "Lịch lặp không hợp lệ.");
      seen.add(key);
    }
  }
}
