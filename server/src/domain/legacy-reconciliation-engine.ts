import type {
  LegacyLearningLessonPreview,
  LegacyPaymentEventPreview,
  LegacyTuitionCyclePreview,
  LegacyTuitionRowPreview,
} from "@teacher/shared";
import type { ParsedLegacyWorkbook } from "./legacy-workbook-parser";

function daysBetween(left: string, right: string): number {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

export interface LegacyReconciliationResult {
  lessons: LegacyLearningLessonPreview[];
  tuitionRows: LegacyTuitionRowPreview[];
  paymentEvents: LegacyPaymentEventPreview[];
  tuitionCycles: LegacyTuitionCyclePreview[];
}

export class LegacyReconciliationEngine {
  reconcile(parsed: ParsedLegacyWorkbook): LegacyReconciliationResult {
    const usedTuition = new Set<number>();
    const duplicateKeys = new Map<string, number[]>();
    for (const row of parsed.learningRows) {
      if (!row.normalizedDate) continue;
      const key = `${row.normalizedDate}|${row.studentName ?? ""}|${row.nickname ?? ""}`.toLocaleLowerCase("vi");
      duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), row.sourceRow]);
    }
    const duplicateRows = new Set([...duplicateKeys.values()].filter((rows) => rows.length > 1).flat());

    const lessons: LegacyLearningLessonPreview[] = parsed.learningRows.map((row) => {
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
          reconciliationStatus = row.absent ? "LEARNING_ONLY_NEEDS_REVIEW" : "MATCHED";
        } else if (row.absent) reconciliationStatus = "LEARNING_ONLY_ABSENT";
        else {
          const nearby = parsed.tuitionRows
            .filter((tuition) => !usedTuition.has(tuition.sourceRow) && Math.abs(daysBetween(tuition.date, row.normalizedDate!)) <= 3)
            .sort((a, b) => Math.abs(daysBetween(a.date, row.normalizedDate!)) - Math.abs(daysBetween(b.date, row.normalizedDate!)));
          if (nearby.length === 1 || (nearby.length > 1 && Math.abs(daysBetween(nearby[0].date, row.normalizedDate)) < Math.abs(daysBetween(nearby[1].date, row.normalizedDate)))) {
            suggestedDate = nearby[0].date;
            matchedTuitionSourceRow = nearby[0].sourceRow;
            usedTuition.add(nearby[0].sourceRow);
            reconciliationStatus = "DATE_CORRECTION_SUGGESTED";
          } else reconciliationStatus = "LEARNING_ONLY_NEEDS_REVIEW";
        }
      }
      return {
        id: `learning-${row.sourceRow}`,
        originalDate: row.originalDate,
        normalizedDate: row.normalizedDate,
        dateResolution: row.dateResolution,
        suggestedDate,
        teacher: row.teacher,
        studentName: row.studentName,
        nickname: row.nickname,
        content: row.content,
        homework: row.homework,
        classwork: row.classwork,
        note: row.note,
        attendanceStatus: row.absent ? "ABSENT" : "PRESENT",
        billingType: row.absent ? "NONE" : "BILLABLE",
        sourceSheet: "Quá trình học tập",
        sourceRow: row.sourceRow,
        reconciliationStatus,
        matchedTuitionSourceRow,
      };
    });
    const matchByTuitionRow = new Map(lessons.filter((lesson) => lesson.matchedTuitionSourceRow != null)
      .map((lesson) => [lesson.matchedTuitionSourceRow!, lesson.sourceRow]));
    const tuitionRows: LegacyTuitionRowPreview[] = parsed.tuitionRows.map((row) => ({
      id: `tuition-${row.sourceRow}`,
      date: row.date,
      time: row.time,
      paidMarker: row.paidMarker,
      sourceSheet: "Học phí",
      sourceRow: row.sourceRow,
      reconciliationStatus: usedTuition.has(row.sourceRow) ? "MATCHED" : "TUITION_ONLY_NEEDS_REVIEW",
      matchedLearningSourceRow: matchByTuitionRow.get(row.sourceRow) ?? null,
    }));

    const billable = lessons.filter((lesson) => lesson.attendanceStatus === "PRESENT" && lesson.billingType === "BILLABLE" && lesson.normalizedDate)
      .sort((a, b) => a.normalizedDate!.localeCompare(b.normalizedDate!) || a.sourceRow - b.sourceRow);
    const tuitionCycles: LegacyTuitionCyclePreview[] = [];
    for (let index = 0; index < billable.length; index += 8) {
      const items = billable.slice(index, index + 8);
      tuitionCycles.push({
        cycleNumber: tuitionCycles.length + 1,
        lessonSourceRows: items.map((item) => item.sourceRow),
        fromDate: items[0]?.normalizedDate ?? null,
        toDate: items.at(-1)?.normalizedDate ?? null,
        itemCount: items.length,
        state: items.length === 8 ? "COMPLETE" : "CURRENT",
        paymentState: "UNPAID",
      });
    }

    const clearlyPaidCycles = new Set<number>();
    const paymentEvents = parsed.paymentEvents.map((event, index): LegacyPaymentEventPreview => {
      const beforeOrOn = event.date ? billable.filter((lesson) => lesson.normalizedDate! <= event.date!).length : 0;
      const completedCycle = Math.floor(beforeOrOn / 8);
      const remainder = beforeOrOn % 8;
      const canClearlyPayPrevious = Boolean(event.date) && remainder === 0 && completedCycle > 0 && !clearlyPaidCycles.has(completedCycle);
      if (canClearlyPayPrevious) clearlyPaidCycles.add(completedCycle);
      const beforeFirstLesson = Boolean(event.date && billable[0]?.normalizedDate && event.date < billable[0].normalizedDate);
      return {
        id: `payment-${event.sourceRow}-${index}`,
        date: event.date,
        sourceRow: event.sourceRow,
        recommendedResolution: canClearlyPayPrevious ? "PREVIOUS_CYCLE" : beforeFirstLesson ? "CURRENT_CYCLE_ADVANCE" : "UNDETERMINED",
        resolutionOptions: ["PREVIOUS_CYCLE", "CURRENT_CYCLE_ADVANCE", "SETTLE_INCOMPLETE", "UNDETERMINED"],
        requiresReview: !canClearlyPayPrevious && !beforeFirstLesson,
      };
    });
    for (const cycle of tuitionCycles) if (clearlyPaidCycles.has(cycle.cycleNumber)) cycle.paymentState = "PAID_CLEAR";
    for (const event of paymentEvents.filter((item) => item.requiresReview)) {
      const candidate = event.date ? tuitionCycles.find((cycle) => cycle.fromDate && cycle.fromDate <= event.date! && (!cycle.toDate || cycle.toDate >= event.date!)) : undefined;
      if (candidate) candidate.paymentState = "NEEDS_REVIEW";
    }
    return { lessons, tuitionRows, paymentEvents, tuitionCycles };
  }
}
