import type {
  LegacyLearningLessonPreview,
  LegacyPaymentEventPreview,
  LegacyTimeMappingPreview,
  LegacyTuitionCyclePreview,
  LegacyTuitionRowPreview,
} from "@teacher/shared";
import type { ParsedLegacyWorkbook } from "./legacy-workbook-parser";

function daysBetween(left: string, right: string): number {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

function periodId(date: string): string {
  const year = Number(date.slice(0, 4));
  return `period-${Number(date.slice(5, 7)) >= 6 ? year : year - 1}-06-01`;
}

interface AnalyzedTime {
  start: string;
  end: string;
  needsConfirmation: boolean;
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function analyzedLessonTime(value: string | null): AnalyzedTime | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})(?:h(\d{1,2})?|[:.](\d{1,2}))\s*(am|pm)?\s*[-\u2013\u2014]\s*(\d{1,2})(?:h(\d{1,2})?|[:.](\d{1,2}))\s*(am|pm)?$/i);
  if (!match) return null;
  if ((match[2]?.length === 1 && match[2] !== "0") || (match[6]?.length === 1 && match[6] !== "0")) return null;
  let startHour = Number(match[1]);
  const startMinute = Number(match[2] ?? match[3] ?? 0);
  let endHour = Number(match[5]);
  const endMinute = Number(match[6] ?? match[7] ?? 0);
  const startMeridiem = match[4]?.toLowerCase();
  const endMeridiem = match[8]?.toLowerCase();
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  if (startMeridiem) startHour = startHour % 12 + (startMeridiem === "pm" ? 12 : 0);
  if (endMeridiem) endHour = endHour % 12 + (endMeridiem === "pm" ? 12 : 0);
  const needsConfirmation = !startMeridiem && !endMeridiem && startHour >= 1 && startHour <= 6;
  if (needsConfirmation) {
    startHour += 12;
    if (endHour >= 1 && endHour <= 11) endHour += 12;
  }
  if (endHour * 60 + endMinute <= startHour * 60 + startMinute) return null;
  return { start: clock(startHour, startMinute), end: clock(endHour, endMinute), needsConfirmation };
}

export function lessonTimes(value: string | null): { start: string | null; end: string | null } {
  const result = analyzedLessonTime(value);
  return result ? { start: result.start, end: result.end } : { start: null, end: null };
}

function nextMonthSameDay(date: string): string | null {
  const source = new Date(`${date}T00:00:00Z`);
  const day = source.getUTCDate();
  const candidate = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, day));
  return candidate.getUTCDate() === day ? candidate.toISOString().slice(0, 10) : null;
}

export interface LegacyReconciliationResult {
  lessons: LegacyLearningLessonPreview[];
  tuitionRows: LegacyTuitionRowPreview[];
  paymentEvents: LegacyPaymentEventPreview[];
  tuitionCycles: LegacyTuitionCyclePreview[];
  timeMappings: LegacyTimeMappingPreview[];
}

interface TuitionTime {
  start: string | null;
  end: string | null;
  mappingId: string | null;
}

export class LegacyReconciliationEngine {
  reconcile(parsed: ParsedLegacyWorkbook): LegacyReconciliationResult {
    const timeMappings: LegacyTimeMappingPreview[] = [];
    const mappingByKey = new Map<string, LegacyTimeMappingPreview>();
    const timeByTuitionRow = new Map<number, TuitionTime>();
    const validTimesByPeriod = new Map<string, Array<{ start: string; end: string }>>();
    for (const row of parsed.tuitionRows) {
      const analyzed = analyzedLessonTime(row.time);
      if (!analyzed) continue;
      const item = { start: analyzed.start, end: analyzed.end };
      validTimesByPeriod.set(periodId(row.date), [...(validTimesByPeriod.get(periodId(row.date)) ?? []), item]);
    }
    const dominantTime = (date: string): { start: string; end: string } | null => {
      const counts = new Map<string, number>();
      for (const time of validTimesByPeriod.get(periodId(date)) ?? []) {
        const key = `${time.start}|${time.end}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      if (!ranked[0] || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
      const [start, end] = ranked[0][0].split("|");
      return { start, end };
    };
    const ensureMapping = (row: ParsedLegacyWorkbook["tuitionRows"][number], proposed: { start: string; end: string } | null,
      reason: LegacyTimeMappingPreview["reason"]): string => {
      const key = `${periodId(row.date)}\u0000${row.time?.trim() ?? ""}`;
      const existing = mappingByKey.get(key);
      if (existing) return existing.id;
      const mapping: LegacyTimeMappingPreview = {
        id: `time-${periodId(row.date).slice(7)}-${row.sourceRow}`,
        periodId: periodId(row.date), rawValue: row.time?.trim() ?? "",
        proposedStartTime: proposed?.start ?? null, proposedEndTime: proposed?.end ?? null,
        reason, lessonSourceRows: [],
      };
      mappingByKey.set(key, mapping);
      timeMappings.push(mapping);
      return mapping.id;
    };
    for (const row of parsed.tuitionRows) {
      const analyzed = analyzedLessonTime(row.time);
      if (analyzed) {
        const mappingId = analyzed.needsConfirmation
          ? ensureMapping(row, analyzed, "AMBIGUOUS_12H") : null;
        timeByTuitionRow.set(row.sourceRow, { start: analyzed.start, end: analyzed.end, mappingId });
      } else {
        const proposed = dominantTime(row.date);
        const mappingId = ensureMapping(row, proposed, "TYPO_SUGGESTION");
        timeByTuitionRow.set(row.sourceRow, { start: proposed?.start ?? null, end: proposed?.end ?? null, mappingId });
      }
    }

    const usedTuition = new Set<number>();
    const duplicateKeys = new Map<string, number[]>();
    for (const row of parsed.learningRows) {
      if (!row.normalizedDate) continue;
      const key = `${row.normalizedDate}|${row.studentName ?? ""}|${row.nickname ?? ""}`.toLocaleLowerCase("vi");
      duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), row.sourceRow]);
    }
    const duplicateRows = new Set([...duplicateKeys.values()].filter((rows) => rows.length > 1).flat());

    const lessons: LegacyLearningLessonPreview[] = parsed.learningRows.map((row, index) => {
      let reconciliationStatus: LegacyLearningLessonPreview["reconciliationStatus"];
      let matchedTuitionSourceRow: number | null = null;
      let suggestedDate: string | null = null;
      if (!row.normalizedDate) reconciliationStatus = "UNRESOLVED_DATE";
      else if (duplicateRows.has(row.sourceRow)) reconciliationStatus = "DUPLICATE_SUSPECTED";
      else {
        const exact = parsed.tuitionRows.find((tuition) => tuition.date === row.normalizedDate && !usedTuition.has(tuition.sourceRow));
        if (exact) {
          usedTuition.add(exact.sourceRow);
          matchedTuitionSourceRow = exact.sourceRow;
          reconciliationStatus = row.absent && !exact.offMarker ? "LEARNING_ONLY_NEEDS_REVIEW" : "MATCHED";
        } else if (row.absent) reconciliationStatus = "LEARNING_ONLY_ABSENT";
        else {
          const previousDate = parsed.learningRows[index - 1]?.normalizedDate;
          const correction = previousDate && previousDate > row.normalizedDate
            ? nextMonthSameDay(row.normalizedDate) : null;
          const nextMonth = correction ? parsed.tuitionRows.filter((tuition) =>
            tuition.date === correction && !usedTuition.has(tuition.sourceRow)) : [];
          const nearby = parsed.tuitionRows
            .filter((tuition) => !usedTuition.has(tuition.sourceRow) && Math.abs(daysBetween(tuition.date, row.normalizedDate!)) <= 3)
            .sort((a, b) => Math.abs(daysBetween(a.date, row.normalizedDate!)) - Math.abs(daysBetween(b.date, row.normalizedDate!)));
          const candidate = nextMonth.length === 1 ? nextMonth[0]
            : nearby.length === 1 || (nearby.length > 1 && Math.abs(daysBetween(nearby[0].date, row.normalizedDate)) < Math.abs(daysBetween(nearby[1].date, row.normalizedDate)))
              ? nearby[0] : null;
          if (candidate) {
            suggestedDate = candidate.date;
            matchedTuitionSourceRow = candidate.sourceRow;
            usedTuition.add(candidate.sourceRow);
            reconciliationStatus = "DATE_CORRECTION_SUGGESTED";
          } else reconciliationStatus = "LEARNING_ONLY_NEEDS_REVIEW";
        }
      }
      const matchedTuition = matchedTuitionSourceRow == null
        ? null : parsed.tuitionRows.find((item) => item.sourceRow === matchedTuitionSourceRow) ?? null;
      const times = matchedTuition ? timeByTuitionRow.get(matchedTuition.sourceRow) : null;
      return {
        id: `learning-${row.sourceRow}`, originalDate: row.originalDate, normalizedDate: row.normalizedDate,
        scheduledStartTime: times?.start ?? null, scheduledEndTime: times?.end ?? null,
        dateResolution: row.dateResolution, suggestedDate, teacher: row.teacher, studentName: row.studentName,
        nickname: row.nickname, content: row.content, homework: row.homework, classwork: row.classwork, note: row.note,
        attendanceStatus: row.absent ? "ABSENT" : "PRESENT", billingType: row.absent ? "NONE" : "BILLABLE",
        sourceSheet: "Quá trình học tập", sourceRow: row.sourceRow, reconciliationStatus,
        matchedTuitionSourceRow, rawTime: matchedTuition?.time ?? null, timeMappingId: times?.mappingId ?? null,
      };
    });

    for (const [index, lesson] of lessons.entries()) {
      if (lesson.attendanceStatus !== "ABSENT" || lesson.scheduledStartTime || !lesson.normalizedDate) continue;
      const samePeriod = (candidate: LegacyLearningLessonPreview) =>
        candidate.normalizedDate && periodId(candidate.normalizedDate) === periodId(lesson.normalizedDate!);
      const previous = [...lessons.slice(0, index)].reverse().find((candidate) => samePeriod(candidate) && candidate.scheduledStartTime);
      const next = lessons.slice(index + 1).find((candidate) => samePeriod(candidate) && candidate.scheduledStartTime);
      let inferred: { start: string; end: string; mappingId: string | null; rawTime: string | null } | null = null;
      if (previous?.scheduledStartTime && next?.scheduledStartTime && previous.scheduledStartTime === next.scheduledStartTime &&
          previous.scheduledEndTime === next.scheduledEndTime) {
        const mappingIds = [...new Set([previous.timeMappingId, next.timeMappingId].filter((id): id is string => Boolean(id)))];
        if (mappingIds.length <= 1) inferred = { start: previous.scheduledStartTime, end: previous.scheduledEndTime!,
          mappingId: mappingIds[0] ?? null, rawTime: previous.rawTime ?? next.rawTime };
      }
      if (!inferred) {
        const candidates = parsed.tuitionRows.filter((row) => periodId(row.date) === periodId(lesson.normalizedDate!))
          .sort((left, right) => Math.abs(daysBetween(left.date, lesson.normalizedDate!)) -
            Math.abs(daysBetween(right.date, lesson.normalizedDate!)) || left.sourceRow - right.sourceRow)
          .slice(0, 8)
          .map((row) => ({ row, time: timeByTuitionRow.get(row.sourceRow) }))
          .filter((item): item is { row: ParsedLegacyWorkbook["tuitionRows"][number]; time: TuitionTime & { start: string; end: string } } =>
            Boolean(item.time?.start && item.time?.end));
        const counts = new Map<string, typeof candidates>();
        for (const candidate of candidates) {
          const key = `${candidate.time.start}|${candidate.time.end}`;
          counts.set(key, [...(counts.get(key) ?? []), candidate]);
        }
        const ranked = [...counts.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
        if (ranked[0] && (!ranked[1] || ranked[0][1].length > ranked[1][1].length)) {
          const winner = ranked[0][1];
          const mappingIds = [...new Set(winner.map((item) => item.time.mappingId).filter((id): id is string => Boolean(id)))];
          if (mappingIds.length <= 1) inferred = { start: winner[0].time.start, end: winner[0].time.end,
            mappingId: mappingIds[0] ?? null, rawTime: winner[0].row.time };
        }
      }
      if (inferred) {
        lesson.scheduledStartTime = inferred.start;
        lesson.scheduledEndTime = inferred.end;
        lesson.timeMappingId = inferred.mappingId;
        lesson.rawTime = inferred.rawTime;
      }
    }
    for (const mapping of timeMappings) {
      mapping.lessonSourceRows = lessons.filter((lesson) => lesson.timeMappingId === mapping.id).map((lesson) => lesson.sourceRow);
    }

    const matchByTuitionRow = new Map(lessons.filter((lesson) => lesson.matchedTuitionSourceRow != null)
      .map((lesson) => [lesson.matchedTuitionSourceRow!, lesson.sourceRow]));
    const tuitionRows: LegacyTuitionRowPreview[] = parsed.tuitionRows.map((row) => ({
      id: `tuition-${row.sourceRow}`, date: row.date, time: row.time, paidMarker: row.paidMarker, offMarker: row.offMarker,
      sourceSheet: "Học phí", sourceRow: row.sourceRow,
      reconciliationStatus: usedTuition.has(row.sourceRow) ? "MATCHED" : "TUITION_ONLY_NEEDS_REVIEW",
      matchedLearningSourceRow: matchByTuitionRow.get(row.sourceRow) ?? null,
    }));

    const billable = lessons.filter((lesson) => lesson.attendanceStatus === "PRESENT" && lesson.billingType === "BILLABLE" && lesson.normalizedDate)
      .sort((a, b) => a.normalizedDate!.localeCompare(b.normalizedDate!) || a.sourceRow - b.sourceRow);
    const tuitionCycles: LegacyTuitionCyclePreview[] = [];
    for (let index = 0; index < billable.length; index += 8) {
      const items = billable.slice(index, index + 8);
      tuitionCycles.push({ cycleNumber: tuitionCycles.length + 1, lessonSourceRows: items.map((item) => item.sourceRow),
        fromDate: items[0]?.normalizedDate ?? null, toDate: items.at(-1)?.normalizedDate ?? null,
        itemCount: items.length, state: items.length === 8 ? "COMPLETE" : "CURRENT", paymentState: "UNPAID" });
    }

    const clearlyPaidCycles = new Set<number>();
    const paymentEvents = parsed.paymentEvents.map((event, index): LegacyPaymentEventPreview => {
      const beforeOrOn = event.date ? billable.filter((lesson) => lesson.normalizedDate! <= event.date!).length : 0;
      const completedCycle = Math.floor(beforeOrOn / 8);
      const remainder = beforeOrOn % 8;
      const canClearlyPayPrevious = Boolean(event.date) && remainder === 0 && completedCycle > 0 && !clearlyPaidCycles.has(completedCycle);
      if (canClearlyPayPrevious) clearlyPaidCycles.add(completedCycle);
      const beforeFirstLesson = Boolean(event.date && billable[0]?.normalizedDate && event.date < billable[0].normalizedDate);
      return { id: `payment-${event.sourceRow}-${index}`, date: event.date, sourceRow: event.sourceRow,
        recommendedResolution: canClearlyPayPrevious ? "PREVIOUS_CYCLE" : beforeFirstLesson ? "CURRENT_CYCLE_ADVANCE" : "UNDETERMINED",
        resolutionOptions: ["PREVIOUS_CYCLE", "CURRENT_CYCLE_ADVANCE", "SETTLE_INCOMPLETE", "UNDETERMINED"],
        requiresReview: !canClearlyPayPrevious && !beforeFirstLesson };
    });
    for (const cycle of tuitionCycles) if (clearlyPaidCycles.has(cycle.cycleNumber)) cycle.paymentState = "PAID_CLEAR";
    for (const event of paymentEvents.filter((item) => item.requiresReview)) {
      const candidate = event.date ? tuitionCycles.find((cycle) => cycle.fromDate && cycle.fromDate <= event.date! && (!cycle.toDate || cycle.toDate >= event.date!)) : undefined;
      if (candidate) candidate.paymentState = "NEEDS_REVIEW";
    }
    return { lessons, tuitionRows, paymentEvents, tuitionCycles,
      timeMappings: timeMappings.filter((mapping) => mapping.lessonSourceRows.length > 0) };
  }
}
