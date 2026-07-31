import type { TeacherBusySlotInput } from "@teacher/shared";

export const TEACHER_BUSY_SLOT_TITLE_MAX_LENGTH = 160;

export function buildTeacherBusySlotTitle(input: TeacherBusySlotInput): string {
  const manualTitle = clean(input.title);
  if (manualTitle) return truncate(manualTitle);

  const organizationName = clean(input.organizationName);
  const scheduleLabel = firstScheduleLabel(input);
  if (organizationName && scheduleLabel) return truncate(`${organizationName} · ${scheduleLabel}`);
  if (organizationName) return truncate(`Lịch dạy tại ${organizationName}`);
  return "Lịch dạy ngoài";
}

function firstScheduleLabel(input: TeacherBusySlotInput): string | null {
  if (input.recurrenceType === "ONCE") {
    const date = formatDate(input.specificDate);
    const time = formatTime(input.startTime);
    return date && time ? `${date} ${time}` : null;
  }

  const first = [...input.schedules].sort(
    (left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime),
  )[0];
  if (!first) return null;
  const time = formatTime(first.startTime);
  if (!time) return null;
  return `${first.dayOfWeek === 7 ? "Chủ nhật" : `Thứ ${first.dayOfWeek + 1}`} ${time}`;
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string | null | undefined): string | null {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

function formatTime(value: string | null | undefined): string | null {
  const match = clean(value).match(/^([01]\d|2[0-3]):([0-5]\d)(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function truncate(value: string): string {
  return Array.from(value).slice(0, TEACHER_BUSY_SLOT_TITLE_MAX_LENGTH).join("").trimEnd();
}
