import type { ScheduleOccurrence } from "@teacher/shared";
import { addDays, weekdayIso } from "../utils/date";
import { compareOccurrences, timeRangesOverlap } from "./schedule-projection";

export interface CombinedGroupProjectionInput {
  groupId: number;
  groupName: string;
  scheduleId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  memberClasses: Array<{ id: number; name: string }>;
  persistedByDate?: Record<string, {
    id: number;
    status: "DRAFT" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
    replacementDate: string | null;
    replacementStartTime: string | null;
    replacementEndTime: string | null;
    linkedLessonId: number | null;
  }>;
}

export function combinedOccurrenceKey(
  groupId: number,
  scheduleId: number,
  date: string,
  replacement = false,
): string {
  return `cg:${groupId}:${scheduleId}:${date}${replacement ? ":R" : ""}`;
}

export function parseCombinedOccurrenceKey(key: string): {
  groupId: number;
  scheduleId: number;
  occurrenceDate: string;
  replacement: boolean;
} | null {
  const match = /^cg:(\d+):(\d+):(\d{4}-\d{2}-\d{2})(:R)?$/.exec(key);
  if (!match || !isCalendarDate(match[3])) return null;
  return {
    groupId: Number(match[1]),
    scheduleId: Number(match[2]),
    occurrenceDate: match[3],
    replacement: Boolean(match[4]),
  };
}

export function expandCombinedGroupSchedules(
  schedules: CombinedGroupProjectionInput[],
  from: string,
  to: string,
): ScheduleOccurrence[] {
  const results: ScheduleOccurrence[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const schedule of schedules) {
      if (weekdayIso(date) !== schedule.dayOfWeek || date < schedule.effectiveFrom ||
          (schedule.effectiveTo && date > schedule.effectiveTo)) continue;
      const firstClass = schedule.memberClasses[0];
      const originalKey = combinedOccurrenceKey(schedule.groupId, schedule.scheduleId, date);
      const persisted = schedule.persistedByDate?.[date] ?? null;
      const common = {
        originalKey,
        originalOccurrenceDate: date,
        recurringScheduleId: 0,
        classId: firstClass?.id ?? 0,
        className: schedule.groupName,
        projectionSource: "RECURRING" as const,
        linkedLessonId: persisted?.linkedLessonId ?? null,
        linkedLessonStatus: null,
        exceptionId: null,
        replacementDate: persisted?.replacementDate ?? null,
        replacementStartTime: persisted?.replacementStartTime ?? null,
        replacementEndTime: persisted?.replacementEndTime ?? null,
        conflicts: [],
        skipReason: null,
        makeupRequired: false,
        replacementCancelled: false,
        combinedGroupId: schedule.groupId,
        combinedGroupName: schedule.groupName,
        combinedGroupScheduleId: schedule.scheduleId,
        memberClasses: schedule.memberClasses,
        combinedTeachingOccurrenceId: persisted?.id ?? null,
      };
      if (persisted?.status === "RESCHEDULED") {
        results.push({
          ...common,
          key: originalKey,
          occurrenceDate: date,
          scheduledStartTime: schedule.startTime,
          scheduledEndTime: schedule.endTime,
          state: "RESCHEDULED",
        });
        if (persisted.replacementDate && persisted.replacementStartTime &&
            persisted.replacementEndTime) {
          results.push({
            ...common,
            key: combinedOccurrenceKey(schedule.groupId, schedule.scheduleId, date, true),
            occurrenceDate: persisted.replacementDate,
            scheduledStartTime: persisted.replacementStartTime,
            scheduledEndTime: persisted.replacementEndTime,
            projectionSource: "RESCHEDULED",
            state: persisted.linkedLessonId ? "RECORDED" : "UNRECORDED",
          });
        }
        continue;
      }
      results.push({
        ...common,
        key: originalKey,
        occurrenceDate: date,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        state: persisted?.status === "SKIPPED" ? "SKIPPED" :
          persisted?.id ? "RECORDED" : "UNRECORDED",
      });
    }
  }
  return results.sort(compareOccurrences);
}

export function suppressOverriddenClassOccurrences(
  classOccurrences: ScheduleOccurrence[],
  groupOccurrences: ScheduleOccurrence[],
): ScheduleOccurrence[] {
  return classOccurrences.filter((item) => !groupOccurrences.some((group) =>
    group.projectionSource === "RECURRING" &&
    group.memberClasses.some((member) => member.id === item.classId) &&
    item.originalOccurrenceDate === group.originalOccurrenceDate &&
    timeRangesOverlap(
      item.originalOccurrenceDate,
      item.scheduledStartTime,
      item.scheduledEndTime,
      group.originalOccurrenceDate,
      group.scheduledStartTime,
      group.scheduledEndTime,
    )));
}

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
