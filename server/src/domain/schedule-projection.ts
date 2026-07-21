import type {
  LessonStatus,
  ScheduleOccurrence,
} from "@teacher/shared";
import { addDays, weekdayIso } from "../utils/date";

export interface RecurringProjectionInput {
  recurringScheduleId: number;
  classId: number;
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  activePeriods?: Array<{ activeFrom: string; activeTo: string | null }>;
}

export interface ProjectionExceptionInput {
  id: number;
  type: "SKIPPED" | "RESCHEDULED";
  replacementDate: string | null;
  replacementStartTime: string | null;
  replacementEndTime: string | null;
  reason?: string | null;
}

export interface ProjectionLessonInput {
  id: number;
  status: LessonStatus;
}

export function occurrenceKey(classId: number, recurringScheduleId: number, date: string): string {
  return `${classId}:${recurringScheduleId}:${date}`;
}

export function replacementOccurrenceKey(originalKey: string): string {
  return `${originalKey}:R`;
}

export function parseOccurrenceKey(key: string): {
  classId: number;
  recurringScheduleId: number;
  occurrenceDate: string;
  replacement: boolean;
} | null {
  const match = /^(\d+):(\d+):(\d{4}-\d{2}-\d{2})(:R)?$/.exec(key);
  if (!match || !isCalendarDate(match[3])) return null;
  return {
    classId: Number(match[1]),
    recurringScheduleId: Number(match[2]),
    occurrenceDate: match[3],
    replacement: Boolean(match[4]),
  };
}

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function expandRecurringSchedules(
  schedules: RecurringProjectionInput[],
  from: string,
  to: string,
): ScheduleOccurrence[] {
  const results = new Map<string, ScheduleOccurrence>();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayIso(date);
    for (const schedule of schedules) {
      if (schedule.dayOfWeek !== weekday || date < schedule.effectiveFrom ||
          (schedule.effectiveTo != null && date > schedule.effectiveTo) ||
          (schedule.activePeriods && !schedule.activePeriods.some((period) =>
            period.activeFrom <= date && (period.activeTo == null || period.activeTo >= date)))) continue;
      const key = occurrenceKey(schedule.classId, schedule.recurringScheduleId, date);
      results.set(key, {
        key,
        originalKey: key,
        occurrenceDate: date,
        originalOccurrenceDate: date,
        recurringScheduleId: schedule.recurringScheduleId,
        classId: schedule.classId,
        className: schedule.className,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        projectionSource: "RECURRING",
        state: "UNRECORDED",
        linkedLessonId: null,
        linkedLessonStatus: null,
        exceptionId: null,
        replacementDate: null,
        replacementStartTime: null,
        replacementEndTime: null,
        conflicts: [],
        skipReason: null,
      });
    }
  }
  return [...results.values()].sort(compareOccurrences);
}

export function reconcileOccurrence(
  occurrence: ScheduleOccurrence,
  exception: ProjectionExceptionInput | null,
  lesson: ProjectionLessonInput | null,
): ScheduleOccurrence[] {
  if (exception?.type === "SKIPPED")
    return [{ ...occurrence, state: "SKIPPED", exceptionId: exception.id,
      skipReason: exception.reason ?? null, linkedLessonId: lesson?.id ?? null,
      linkedLessonStatus: lesson?.status ?? null }];
  if (exception?.type === "RESCHEDULED") {
    const original = {
      ...occurrence,
      state: "RESCHEDULED" as const,
      exceptionId: exception.id,
      replacementDate: exception.replacementDate,
      replacementStartTime: exception.replacementStartTime,
      replacementEndTime: exception.replacementEndTime,
    };
    if (!exception.replacementDate || !exception.replacementStartTime || !exception.replacementEndTime)
      return [original];
    const replacement: ScheduleOccurrence = {
      ...original,
      key: replacementOccurrenceKey(occurrence.key),
      occurrenceDate: exception.replacementDate,
      scheduledStartTime: exception.replacementStartTime,
      scheduledEndTime: exception.replacementEndTime,
      projectionSource: "RESCHEDULED",
      state: lesson ? "RECORDED" : "UNRECORDED",
      linkedLessonId: lesson?.id ?? null,
      linkedLessonStatus: lesson?.status ?? null,
    };
    return [original, replacement];
  }
  if (lesson && lesson.status !== "CANCELLED")
    return [{ ...occurrence, state: "RECORDED", linkedLessonId: lesson.id, linkedLessonStatus: lesson.status }];
  return [occurrence];
}

export function timeRangesOverlap(
  firstDate: string,
  firstStart: string,
  firstEnd: string,
  secondDate: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstDate === secondDate && firstStart < secondEnd && secondStart < firstEnd;
}

export function compareOccurrences(a: ScheduleOccurrence, b: ScheduleOccurrence): number {
  return a.occurrenceDate.localeCompare(b.occurrenceDate) ||
    a.scheduledStartTime.localeCompare(b.scheduledStartTime) ||
    a.key.localeCompare(b.key);
}
