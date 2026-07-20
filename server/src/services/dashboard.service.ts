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
    const [tuitionSummary, unrecorded, todaySchedule] = await Promise.all([
      this.tuition.summary({}),
      this.schedules.listUnrecorded(
        addDays(today, -14),
        today,
      ),
      this.schedules.week(today, today),
    ]);
    return {
      paymentDueCount: tuitionSummary.paymentDueCount,
      totalUnpaidAmount: tuitionSummary.totalUnpaidAmount,
      accumulatingStudentCount: tuitionSummary.accumulatingEnrollmentCount,
      paidCycleCount: tuitionSummary.paidCycleCount,
      unrecordedCount: unrecorded.length,
      recentUnrecordedSessions: unrecorded.slice(-5).reverse(),
      todaySchedule,
    };
  }
}
