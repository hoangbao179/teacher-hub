import { ScheduleRepository } from "../repositories/schedule.repository";
import type { CreateRecurringScheduleRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { addDays, todayInHoChiMinh } from "../utils/date";

export class ScheduleService {
  constructor(private readonly repository: ScheduleRepository) {}
  unrecorded(days = 14) {
    const to = todayInHoChiMinh();
    return this.repository.listUnrecorded(
      addDays(to, -Math.max(1, Math.min(days, 60))),
      to,
    );
  }
  week(from?: string) {
    const start = from ?? todayInHoChiMinh();
    return this.repository.week(start, addDays(start, 6));
  }
  async create(classId: number, input: CreateRecurringScheduleRequest, actorUserId?: number) {
    this.validate(input);
    const result = await this.repository.create(classId, input, actorUserId);
    if (result === "CLASS_NOT_FOUND") throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    if (result === "CLASS_CLOSED") throw new AppError(409, "CLASS_CLOSED", "Không thể thêm lịch cho lớp đã đóng.");
    return result;
  }
  async update(id: number, input: CreateRecurringScheduleRequest, actorUserId?: number) {
    this.validate(input);
    if (!(await this.repository.update(id, input, actorUserId))) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch lặp.");
  }
  async remove(id: number, actorUserId?: number) {
    if (!(await this.repository.remove(id, actorUserId))) throw new AppError(404, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch lặp.");
  }
  private validate(input: CreateRecurringScheduleRequest) {
    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 1 || input.dayOfWeek > 7 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime) ||
      input.endTime <= input.startTime || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
      throw new AppError(400, "VALIDATION_ERROR", "Lịch lặp không hợp lệ.");
    }
  }
}
