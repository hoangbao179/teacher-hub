import { ScheduleRepository } from "../repositories/schedule.repository";
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
}
