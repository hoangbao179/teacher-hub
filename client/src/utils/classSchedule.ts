import type { RecurringScheduleInput, Weekday } from "@teacher/shared";

type ClassScheduleItem = Pick<RecurringScheduleInput, "dayOfWeek" | "startTime" | "endTime">;

const weekdayLabels: Record<Weekday, string> = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
};

export function formatClassScheduleItem(schedule: ClassScheduleItem): string {
  return `${weekdayLabels[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime}`;
}

export function formatClassSchedule(scheduleItems: readonly ClassScheduleItem[]): string {
  return [...scheduleItems]
    .sort((left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startTime.localeCompare(right.startTime) ||
      left.endTime.localeCompare(right.endTime))
    .map(formatClassScheduleItem)
    .join(", ");
}
