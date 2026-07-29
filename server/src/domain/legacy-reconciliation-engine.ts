import type {
  LegacyLearningLessonPreview,
  LegacyMinimalLessonGroupPreview,
  LegacyPaymentEventPreview,
  LegacyTimeMappingPreview,
  LegacyTuitionBlockPreview,
  LegacyTuitionCyclePlan,
  LegacyTuitionCyclePreview,
  LegacyTuitionRowPreview,
} from "@teacher/shared";
import type { ParsedLegacyTuitionRow, ParsedLegacyWorkbook } from "./legacy-workbook-parser";

function daysBetween(left: string, right: string): number {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

function periodId(date: string): string {
  const year = Number(date.slice(0, 4));
  return `period-${Number(date.slice(5, 7)) >= 6 ? year : year - 1}-06-01`;
}

interface AnalyzedTime { start: string; end: string; needsConfirmation: boolean }
interface TuitionTime { start: string | null; end: string | null; mappingId: string | null }

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
  const needsConfirmation = !startMeridiem && !endMeridiem && startHour >= 1 && startHour <= 7;
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

function nextYear(date: string): string | null {
  const year = Number(date.slice(0, 4)) + 1;
  const candidate = `${year}${date.slice(4)}`;
  return Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? null : candidate;
}

function nextMonthSameDay(date: string): string | null {
  const source = new Date(`${date}T00:00:00Z`);
  const day = source.getUTCDate();
  const candidate = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, day));
  return candidate.getUTCDate() === day ? candidate.toISOString().slice(0, 10) : null;
}

function sequenceDateCorrections(parsed: ParsedLegacyWorkbook): Map<number, string> {
  const corrections = new Map<number, string>();
  for (const block of parsed.tuitionBlocks) {
    const rows = block.tuitionSourceRows.map((sourceRow) => parsed.tuitionRows.find((row) => row.sourceRow === sourceRow)!)
      .filter(Boolean);
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (daysBetween(current.date, previous.date) > -180) continue;
      const proposed = nextYear(current.date);
      const next = rows[index + 1];
      if (proposed && proposed >= previous.date && (!next || proposed <= next.date)) corrections.set(current.sourceRow, proposed);
    }
  }
  return corrections;
}

export interface LegacyReconciliationResult {
  lessons: LegacyLearningLessonPreview[];
  tuitionRows: LegacyTuitionRowPreview[];
  tuitionBlocks: LegacyTuitionBlockPreview[];
  paymentEvents: LegacyPaymentEventPreview[];
  tuitionCycles: LegacyTuitionCyclePreview[];
  tuitionCyclePlans: LegacyTuitionCyclePlan[];
  minimalLessonGroups: LegacyMinimalLessonGroupPreview[];
  timeMappings: LegacyTimeMappingPreview[];
}

export class LegacyReconciliationEngine {
  reconcile(parsed: ParsedLegacyWorkbook): LegacyReconciliationResult {
    const dateCorrections = sequenceDateCorrections(parsed);
    const effectiveDate = (row: ParsedLegacyTuitionRow) => dateCorrections.get(row.sourceRow) ?? row.date;
    const timeMappings: LegacyTimeMappingPreview[] = [];
    const mappingByKey = new Map<string, LegacyTimeMappingPreview>();
    const timeByTuitionRow = new Map<number, TuitionTime>();
    const validTimesByPeriod = new Map<string, Array<{ start: string; end: string }>>();
    for (const row of parsed.tuitionRows) {
      const analyzed = analyzedLessonTime(row.time);
      if (!analyzed) continue;
      const item = { start: analyzed.start, end: analyzed.end };
      const period = periodId(effectiveDate(row));
      validTimesByPeriod.set(period, [...(validTimesByPeriod.get(period) ?? []), item]);
    }
    const dominantTime = (date: string): { start: string; end: string } | null => {
      const counts = new Map<string, number>();
      for (const time of validTimesByPeriod.get(periodId(date)) ?? []) {
        const value = `${time.start}|${time.end}`;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      if (!ranked[0] || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
      const [start, end] = ranked[0][0].split("|");
      return { start, end };
    };
    const ensureMapping = (row: ParsedLegacyTuitionRow, proposed: { start: string; end: string } | null,
      reason: LegacyTimeMappingPreview["reason"]): string => {
      const groupKey = `${periodId(effectiveDate(row))}\u0000${proposed?.start ?? ""}\u0000${proposed?.end ?? ""}\u0000${reason}`;
      const existing = mappingByKey.get(groupKey);
      if (existing) {
        const raw = row.time?.trim() ?? "";
        if (!existing.rawValues.includes(raw)) existing.rawValues.push(raw);
        existing.tuitionSourceRows.push(row.sourceRow);
        return existing.id;
      }
      const mapping: LegacyTimeMappingPreview = {
        id: `time-${periodId(effectiveDate(row)).slice(7)}-${row.sourceRow}`,
        periodId: periodId(effectiveDate(row)), rawValues: [row.time?.trim() ?? ""],
        proposedStartTime: proposed?.start ?? null, proposedEndTime: proposed?.end ?? null,
        reason, lessonSourceRows: [], tuitionSourceRows: [row.sourceRow],
      };
      mappingByKey.set(groupKey, mapping);
      timeMappings.push(mapping);
      return mapping.id;
    };
    for (const row of parsed.tuitionRows) {
      const analyzed = analyzedLessonTime(row.time);
      if (analyzed) {
        const mappingId = analyzed.needsConfirmation ? ensureMapping(row, analyzed, "AMBIGUOUS_12H") : null;
        timeByTuitionRow.set(row.sourceRow, { start: analyzed.start, end: analyzed.end, mappingId });
      } else {
        const proposed = dominantTime(effectiveDate(row));
        timeByTuitionRow.set(row.sourceRow, { start: proposed?.start ?? null, end: proposed?.end ?? null,
          mappingId: ensureMapping(row, proposed, "TYPO_SUGGESTION") });
      }
    }

    const usedTuition = new Set<number>();
    const matchedTuition = new Map<number, ParsedLegacyTuitionRow>();
    const matchMode = new Map<number, "EXACT" | "CORRECT_LEARNING_DATE" | "CORRECT_TUITION_DATE" | "KEEP">();
    const normalizedLearning = parsed.learningRows.filter((row) => row.normalizedDate);

    // Phase 1 reserves every exact match before any nearby candidate can consume it.
    for (const row of normalizedLearning) {
      const exact = parsed.tuitionRows.find((tuition) => !usedTuition.has(tuition.sourceRow) && effectiveDate(tuition) === row.normalizedDate);
      if (!exact) continue;
      usedTuition.add(exact.sourceRow);
      matchedTuition.set(row.sourceRow, exact);
      matchMode.set(row.sourceRow, dateCorrections.has(exact.sourceRow) ? "CORRECT_TUITION_DATE" : "EXACT");
    }

    // Phase 2 keeps workbook order and date distance, after exact reservations are complete.
    const remainingLearning = normalizedLearning.filter((row) => !matchedTuition.has(row.sourceRow) && !row.absent);
    for (const [index, row] of remainingLearning.entries()) {
      const workbookIndex = parsed.learningRows.findIndex((item) => item.sourceRow === row.sourceRow);
      const previousLearningDate = parsed.learningRows[workbookIndex - 1]?.normalizedDate;
      const monthCorrection = previousLearningDate && previousLearningDate > row.normalizedDate!
        ? nextMonthSameDay(row.normalizedDate!) : null;
      const correctedCandidate = monthCorrection ? parsed.tuitionRows.find((tuition) =>
        !usedTuition.has(tuition.sourceRow) && effectiveDate(tuition) === monthCorrection) : null;
      if (correctedCandidate) {
        usedTuition.add(correctedCandidate.sourceRow);
        matchedTuition.set(row.sourceRow, correctedCandidate);
        matchMode.set(row.sourceRow, "CORRECT_LEARNING_DATE");
        continue;
      }
      const previousSource = remainingLearning[index - 1]?.sourceRow ?? -Infinity;
      const candidates = parsed.tuitionRows.filter((tuition) => !usedTuition.has(tuition.sourceRow) &&
        Math.abs(daysBetween(effectiveDate(tuition), row.normalizedDate!)) <= 3)
        .sort((left, right) => {
          const leftOrderPenalty = left.sourceRow < previousSource ? 20 : 0;
          const rightOrderPenalty = right.sourceRow < previousSource ? 20 : 0;
          return leftOrderPenalty + Math.abs(daysBetween(effectiveDate(left), row.normalizedDate!)) -
            rightOrderPenalty - Math.abs(daysBetween(effectiveDate(right), row.normalizedDate!)) || left.sourceRow - right.sourceRow;
        });
      const candidate = candidates[0];
      if (!candidate) continue;
      usedTuition.add(candidate.sourceRow);
      matchedTuition.set(row.sourceRow, candidate);
      const duplicateTuitionDate = parsed.tuitionRows.some((other) => other.sourceRow !== candidate.sourceRow &&
        effectiveDate(other) === effectiveDate(candidate) && usedTuition.has(other.sourceRow));
      matchMode.set(row.sourceRow, duplicateTuitionDate ? "CORRECT_TUITION_DATE" : "CORRECT_LEARNING_DATE");
    }

    const duplicateKeys = new Map<string, number[]>();
    for (const row of parsed.learningRows) {
      if (!row.normalizedDate) continue;
      const value = `${row.normalizedDate}|${row.studentName ?? ""}|${row.nickname ?? ""}`.toLocaleLowerCase("vi");
      duplicateKeys.set(value, [...(duplicateKeys.get(value) ?? []), row.sourceRow]);
    }
    const duplicateRows = new Set([...duplicateKeys.values()].filter((rows) => rows.length > 1).flat());
    const lessons: LegacyLearningLessonPreview[] = parsed.learningRows.map((row) => {
      const tuition = matchedTuition.get(row.sourceRow) ?? null;
      const mode = matchMode.get(row.sourceRow);
      const times = tuition ? timeByTuitionRow.get(tuition.sourceRow) : null;
      let reconciliationStatus: LegacyLearningLessonPreview["reconciliationStatus"] = "LEARNING_ONLY_NEEDS_REVIEW";
      if (!row.normalizedDate) reconciliationStatus = "UNRESOLVED_DATE";
      else if (duplicateRows.has(row.sourceRow)) reconciliationStatus = "DUPLICATE_SUSPECTED";
      else if (tuition) reconciliationStatus = mode === "CORRECT_LEARNING_DATE" || mode === "CORRECT_TUITION_DATE"
        ? "DATE_CORRECTION_SUGGESTED" : "MATCHED";
      else if (row.absent) reconciliationStatus = "LEARNING_ONLY_ABSENT";
      const attendanceStatus = row.absent || tuition?.kind === "ABSENT" || tuition?.kind === "OFF" ? "ABSENT"
        : tuition?.kind === "FREE" ? "FREE" : "PRESENT";
      return {
        id: `learning-${row.sourceRow}`, originalDate: row.originalDate, normalizedDate: row.normalizedDate,
        scheduledStartTime: times?.start ?? null, scheduledEndTime: times?.end ?? null,
        dateResolution: row.dateResolution,
        suggestedDate: mode === "CORRECT_LEARNING_DATE" && tuition ? effectiveDate(tuition) : null,
        teacher: row.teacher, studentName: row.studentName, nickname: row.nickname, content: row.content,
        homework: row.homework, classwork: row.classwork, note: row.note, attendanceStatus,
        billingType: attendanceStatus === "PRESENT" && tuition?.kind === "BILLABLE" ? "BILLABLE" : "NONE",
        sourceSheet: "Quá trình học tập", sourceRow: row.sourceRow, reconciliationStatus,
        matchedTuitionSourceRow: tuition?.sourceRow ?? null, rawTime: tuition?.time ?? null,
        timeMappingId: times?.mappingId ?? null,
      };
    });

    // Learning-only rows without time are grouped by academic period instead of becoming one blocked card per row.
    for (const lesson of lessons.filter((item) => !item.scheduledStartTime && item.normalizedDate)) {
      const proposed = dominantTime(lesson.normalizedDate!);
      const groupKey = `${periodId(lesson.normalizedDate!)}\u0000${proposed?.start ?? ""}\u0000${proposed?.end ?? ""}\u0000TYPO_SUGGESTION`;
      let mapping = timeMappings.find((item) => item.periodId === periodId(lesson.normalizedDate!) &&
        item.proposedStartTime === (proposed?.start ?? null) && item.proposedEndTime === (proposed?.end ?? null))
        ?? mappingByKey.get(groupKey);
      if (!mapping) {
        mapping = { id: `learning-time-${periodId(lesson.normalizedDate!).slice(7)}-${lesson.sourceRow}`,
          periodId: periodId(lesson.normalizedDate!), rawValues: [], proposedStartTime: proposed?.start ?? null,
          proposedEndTime: proposed?.end ?? null, reason: "TYPO_SUGGESTION", lessonSourceRows: [], tuitionSourceRows: [] };
        mappingByKey.set(groupKey, mapping); timeMappings.push(mapping);
      }
      mapping.lessonSourceRows.push(lesson.sourceRow);
      lesson.timeMappingId = mapping.id;
      if (proposed) {
        lesson.scheduledStartTime = proposed.start;
        lesson.scheduledEndTime = proposed.end;
      }
    }
    for (const mapping of timeMappings) {
      mapping.lessonSourceRows = [...new Set([...mapping.lessonSourceRows,
        ...lessons.filter((lesson) => lesson.timeMappingId === mapping.id).map((lesson) => lesson.sourceRow)])];
    }

    const matchByTuitionRow = new Map(lessons.filter((lesson) => lesson.matchedTuitionSourceRow != null)
      .map((lesson) => [lesson.matchedTuitionSourceRow!, lesson.sourceRow]));
    const clearPaidBlockIds = new Set(parsed.tuitionBlocks.filter((block) => {
      if (block.paidMarkerSourceRow == null || block.paidCandidateSourceRows.length !== 8) return false;
      return block.paidCandidateSourceRows.every((sourceRow) => {
        const tuition = parsed.tuitionRows.find((item) => item.sourceRow === sourceRow);
        const lesson = lessons.find((item) => item.matchedTuitionSourceRow === sourceRow);
        const time = tuition ? timeByTuitionRow.get(tuition.sourceRow) : null;
        return Boolean(tuition?.kind === "BILLABLE" &&
          (lesson?.normalizedDate && lesson.attendanceStatus === "PRESENT" || time?.mappingId || time?.start && time?.end));
      });
    }).map((block) => block.id));
    const clearPostPaidRows = new Set(parsed.tuitionBlocks.filter((block) => clearPaidBlockIds.has(block.id))
      .flatMap((block) => block.postPaidSourceRows));
    for (const lesson of lessons) if (lesson.matchedTuitionSourceRow && clearPostPaidRows.has(lesson.matchedTuitionSourceRow)) {
      lesson.attendanceStatus = "FREE"; lesson.billingType = "NONE";
    }

    const tuitionRows: LegacyTuitionRowPreview[] = parsed.tuitionRows.map((row) => ({
      id: `tuition-${row.sourceRow}`, date: row.date, suggestedDate: dateCorrections.get(row.sourceRow) ?? null,
      time: row.time, paidMarker: row.paidMarker, offMarker: row.offMarker, kind: row.kind,
      sourceSheet: "Học phí", sourceRow: row.sourceRow,
      reconciliationStatus: usedTuition.has(row.sourceRow) ? "MATCHED" : "TUITION_ONLY_NEEDS_REVIEW",
      matchedLearningSourceRow: matchByTuitionRow.get(row.sourceRow) ?? null,
      blockId: row.blockId, postPaidFree: clearPostPaidRows.has(row.sourceRow),
    }));
    const unmatchedBillable = tuitionRows.filter((row) => row.kind === "BILLABLE" && row.reconciliationStatus !== "MATCHED" &&
      !row.postPaidFree);
    const minimalLessonGroups: LegacyMinimalLessonGroupPreview[] = unmatchedBillable.length ? [{
      id: "tuition-only-billable", tuitionSourceRows: unmatchedBillable.map((row) => row.sourceRow),
      lessonCount: unmatchedBillable.length,
      fromDate: [...unmatchedBillable].sort((a, b) => a.date!.localeCompare(b.date!))[0].date!,
      toDate: [...unmatchedBillable].sort((a, b) => a.date!.localeCompare(b.date!)).at(-1)!.date!,
    }] : [];

    const tuitionCycles: LegacyTuitionCyclePreview[] = [];
    const tuitionCyclePlans: LegacyTuitionCyclePlan[] = [];
    const paymentEvents: LegacyPaymentEventPreview[] = [];
    for (const block of parsed.tuitionBlocks) {
      const billableRows = block.tuitionSourceRows.filter((sourceRow) => {
        const row = parsed.tuitionRows.find((item) => item.sourceRow === sourceRow);
        return row?.kind === "BILLABLE" && !clearPostPaidRows.has(sourceRow);
      });
      const cycleRows = clearPaidBlockIds.has(block.id) ? block.paidCandidateSourceRows : billableRows;
      for (let offset = 0; offset < cycleRows.length; offset += 8) {
        const sourceRows = cycleRows.slice(offset, offset + 8);
        const lessonSourceRows = sourceRows.map((sourceRow) => matchByTuitionRow.get(sourceRow)).filter((row): row is number => Boolean(row));
        const tuitionOnlyRows = sourceRows.filter((sourceRow) => !matchByTuitionRow.has(sourceRow));
        const paidClear = offset === 0 && sourceRows.length === 8 && clearPaidBlockIds.has(block.id);
        const needsReview = sourceRows.length === 8 && block.paidMarkerSourceRow == null ||
          block.paidMarkerSourceRow != null && !clearPaidBlockIds.has(block.id);
        const paymentState = paidClear ? "PAID_CLEAR" as const : needsReview ? "NEEDS_REVIEW" as const : "UNPAID" as const;
        const dates = sourceRows.map((sourceRow) => effectiveDate(parsed.tuitionRows.find((row) => row.sourceRow === sourceRow)!));
        tuitionCycles.push({ cycleNumber: tuitionCycles.length + 1, blockId: block.id, tuitionSourceRows: sourceRows,
          lessonSourceRows, fromDate: dates[0] ?? null, toDate: dates.at(-1) ?? null, itemCount: sourceRows.length,
          state: sourceRows.length === 8 ? "COMPLETE" : "CURRENT", paymentState });
        tuitionCyclePlans.push({ blockId: block.id, lessonSourceRows, tuitionSourceRows: tuitionOnlyRows,
          attendanceKind: "BILLABLE", paymentState });
      }
      if (block.paidMarkerSourceRow != null && !clearPaidBlockIds.has(block.id)) paymentEvents.push({
        id: `payment-${block.id}`, date: null, sourceRow: block.paidMarkerSourceRow,
        recommendedResolution: "UNDETERMINED", resolutionOptions: ["EXCLUDE_FINANCE"], requiresReview: true,
        blockId: block.id, kind: "INCOMPLETE_PAID_BLOCK", billableCount: billableRows.length,
      });
      else if (block.paidMarkerSourceRow == null && billableRows.length >= 8) paymentEvents.push({
        id: `payment-${block.id}`, date: null, sourceRow: block.sourceEndRow,
        recommendedResolution: "UNDETERMINED", resolutionOptions: ["PAID_UNDATED", "UNPAID", "EXCLUDE_FINANCE"],
        requiresReview: true, blockId: block.id, kind: "MISSING_PAYMENT_STATUS", billableCount: 8,
      });
    }
    return { lessons, tuitionRows, tuitionBlocks: parsed.tuitionBlocks, paymentEvents, tuitionCycles,
      tuitionCyclePlans, minimalLessonGroups, timeMappings: timeMappings.filter((mapping) =>
        mapping.lessonSourceRows.length > 0 || minimalLessonGroups.some((group) =>
          group.tuitionSourceRows.some((row) => mapping.tuitionSourceRows.includes(row)))) };
  }
}
