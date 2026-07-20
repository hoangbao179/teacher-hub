import type { DashboardResponse } from "@teacher/shared";
import { ClassRepository } from "../repositories/class.repository";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { addDays, todayInHoChiMinh, weekdayIso } from "../utils/date";

export class DashboardService {
  constructor(
    private readonly classes: ClassRepository,
    private readonly tuition: TuitionRepository,
    private readonly schedules: ScheduleRepository,
  ) {}
  async get(): Promise<DashboardResponse> {
    const [allClasses, cycles, unrecorded] = await Promise.all([
      this.classes.list(),
      this.tuition.list(),
      this.schedules.listUnrecorded(
        addDays(todayInHoChiMinh(), -14),
        todayInHoChiMinh(),
      ),
    ]);
    const todayDay = weekdayIso(todayInHoChiMinh());
    const todayDetails = await Promise.all(
      allClasses
        .filter((item) => item.status === "ACTIVE")
        .map((item) => this.classes.findDetail(item.id)),
    );
    const todayClassIds = new Set(
      todayDetails
        .filter(Boolean)
        .filter((item) =>
          item!.schedules.some((schedule) => schedule.dayOfWeek === todayDay),
        )
        .map((item) => item!.id),
    );
    return {
      paymentDueCount: cycles.filter((item) => item.status === "PAYMENT_DUE")
        .length,
      accumulatingStudentCount: cycles.filter(
        (item) => item.status === "ACCUMULATING",
      ).length,
      paidCycleCount: cycles.filter((item) => item.status === "PAID").length,
      todayClasses: allClasses.filter((item) => todayClassIds.has(item.id)),
      recentUnrecordedSessions: unrecorded.slice(-5).reverse(),
    };
  }
}
