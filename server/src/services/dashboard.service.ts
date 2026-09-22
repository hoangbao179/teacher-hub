import type { DashboardResponse } from "@teacher/shared";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { addDays, todayInHoChiMinh } from "../utils/date";

export class DashboardService {
  constructor(
    private readonly tuition: TuitionRepository,
    private readonly schedules: ScheduleRepository,
  ) {}
  async get(): Promise<DashboardResponse> {
    const today = todayInHoChiMinh();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const [tuitionSummary, unrecorded, todaySchedule, outstandingMakeupStudentCount] = await Promise.all([
      this.tuition.monthlyBoard({ year, month }),
      this.schedules.listUnrecorded(
        addDays(today, -14),
        today,
      ),
      this.schedules.week(today, today),
      this.schedules.outstandingMakeupStudentCount(),
    ]);
    return {
      monthlyTuitionUnpaidCount: tuitionSummary.unpaidCount,
      unrecordedCount: unrecorded.length,
      outstandingMakeupStudentCount,
      recentUnrecordedSessions: unrecorded.slice(-5).reverse(),
      todaySchedule,
    };
  }
}
