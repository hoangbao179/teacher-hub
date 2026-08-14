import type {
  ClassListItem,
  LegacyAcademicPeriodPreview,
  LegacyClassCandidate,
  LegacyImportPreview as LegacyImportPreviewContract,
  LegacyImportIssueCode,
  LegacyImportRowPreview,
  StudentDetail,
} from "@teacher/shared";
import type { LegacyReconciliationResult } from "./legacy-reconciliation-engine";

function gradeFromWorkbookName(name: string): number | null {
  const match = name.match(/(?:grade|khối|lớp)\s*[-_. ]*([1-9])\b/i);
  return match ? Number(match[1]) : null;
}

export interface LegacyPreviewFile { name: string; size: number; sha256: string }

function comparableName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function lessonIssues(
  lesson: LegacyReconciliationResult["lessons"][number],
  student: StudentDetail,
): LegacyImportIssueCode[] {
  const issues: LegacyImportIssueCode[] = [];
  if (!lesson.normalizedDate) issues.push("INVALID_DATE");
  if ((!lesson.scheduledStartTime || !lesson.scheduledEndTime) && !lesson.timeMappingId) issues.push("INVALID_TIME");
  if (lesson.reconciliationStatus === "DUPLICATE_SUSPECTED") issues.push("DUPLICATE_ROW");
  if (lesson.reconciliationStatus === "DATE_CORRECTION_SUGGESTED" && lesson.suggestedDate) issues.push("DATE_CORRECTION");
  if (lesson.studentName && comparableName(lesson.studentName) !== comparableName(student.fullName))
    issues.push("STUDENT_MISMATCH");
  return issues;
}

function lifecycleStatus(issues: LegacyImportIssueCode[]): LegacyImportRowPreview["status"] {
  if (!issues.length) return "VALID";
  return issues.some((issue) => issue === "INVALID_DATE" || issue === "INVALID_TIME" || issue === "STUDENT_MISMATCH")
    ? "BLOCKED" : "NEEDS_REVIEW";
}

export class LegacyImportPreview {
  build(student: StudentDetail, classes: ClassListItem[], file: LegacyPreviewFile, result: LegacyReconciliationResult): LegacyImportPreviewContract {
    const dates = [...result.lessons.map((lesson) => lesson.normalizedDate).filter((date): date is string => Boolean(date)),
      ...result.minimalLessonGroups.flatMap((group) => [group.fromDate, group.toDate])].sort();
    const fromDate = dates[0];
    const toDate = dates.at(-1);
    const gradeLevel = gradeFromWorkbookName(file.name);
    const currentClass = classes.find((item) => item.id === student.classId);
    const defaultClassMapping = currentClass
      ? { type: "CURRENT_CLASS" as const, classId: currentClass.id, className: currentClass.name }
      : { type: "CREATE_CLOSED_CLASS" as const, proposedName: gradeLevel
        ? `Lớp lịch sử Grade ${gradeLevel}` : "Lớp lịch sử từ workbook" };
    const academicPeriods: LegacyAcademicPeriodPreview[] = fromDate && toDate ? [{
      id: "period-workbook",
      fromDate,
      toDate,
      schoolYear: fromDate.slice(0, 4) === toDate.slice(0, 4)
        ? fromDate.slice(0, 4) : `${fromDate.slice(0, 4)}-${toDate.slice(0, 4)}`,
      gradeLevel,
      proposedClassMapping: defaultClassMapping,
      lessonCount: result.lessons.length + result.minimalLessonGroups.reduce((total, group) => total + group.lessonCount, 0),
    }] : [];
    const classCandidates: LegacyClassCandidate[] = classes.map((item) => ({
      id: item.id, name: item.name, status: item.status, isCurrent: item.id === student.classId,
    }));
    const lessonRows: LegacyImportRowPreview[] = result.lessons.map((lesson) => {
      const issueCodes = lessonIssues(lesson, student);
      const supportedActions = [...new Set(issueCodes.flatMap((issue) => {
        if (issue === "INVALID_DATE" || issue === "INVALID_TIME" || issue === "DATE_CORRECTION") return ["EDIT_ROW" as const, "SKIP" as const];
        if (issue === "STUDENT_MISMATCH") return ["CONFIRM_STUDENT" as const, "SKIP" as const];
        if (issue === "ATTENDANCE_AMBIGUOUS") return ["SET_ATTENDANCE" as const, "SKIP" as const];
        if (issue === "DUPLICATE_ROW") return ["CREATE_LESSON" as const, "SKIP" as const];
        return ["SKIP" as const];
      }))];
      return {
        id: lesson.id, rowType: "LESSON", sourceSheet: lesson.sourceSheet, sourceRow: lesson.sourceRow,
        rawValues: { date: lesson.originalDate, studentName: lesson.studentName, attendance: lesson.attendanceStatus,
          content: lesson.content, homework: lesson.homework, studentNote: lesson.note, time: lesson.rawTime },
        normalizedValues: { date: lesson.normalizedDate, startTime: lesson.scheduledStartTime,
          endTime: lesson.scheduledEndTime, attendance: lesson.attendanceStatus, content: lesson.content,
          homework: lesson.homework, studentNote: lesson.note, timeMappingId: lesson.timeMappingId,
          countsForTuition: lesson.billingType === "BILLABLE",
          ...(lesson.reconciliationStatus === "LEARNING_ONLY_PRESENT" || lesson.reconciliationStatus === "LEARNING_ONLY_ABSENT"
            ? { reconciliationNote: "Không có dữ liệu học phí đối chiếu" } : {}) },
        issueCodes, status: lifecycleStatus(issueCodes), supportedActions,
        ...(lesson.suggestedDate && issueCodes.includes("DATE_CORRECTION") ? { suggestedResolution: {
          sourceSheet: lesson.sourceSheet, sourceRow: lesson.sourceRow, issueCode: "DATE_CORRECTION" as const,
          action: "EDIT_ROW" as const, resolvedValue: { date: lesson.suggestedDate },
        } } : {}),
      };
    });
    const tuitionPreviewRows: LegacyImportRowPreview[] = result.tuitionRows
      .filter((row) => Boolean(row.suggestedDate))
      .map((row) => ({
        id: row.id, rowType: "TUITION", sourceSheet: row.sourceSheet, sourceRow: row.sourceRow,
        rawValues: { date: row.date, time: row.time, kind: row.kind },
        normalizedValues: { date: row.suggestedDate, blockId: row.blockId },
        issueCodes: ["TUITION_DATE_CORRECTION"], status: "NEEDS_REVIEW",
        supportedActions: ["EDIT_ROW"],
        suggestedResolution: { sourceSheet: row.sourceSheet, sourceRow: row.sourceRow,
          issueCode: "TUITION_DATE_CORRECTION", action: "EDIT_ROW", resolvedValue: { date: row.suggestedDate! } },
      }));
    const paidClearTuitionRows = new Set(result.tuitionCyclePlans
      .filter((plan) => plan.paymentState === "PAID_CLEAR")
      .flatMap((plan) => plan.tuitionSourceRows));
    const tuitionGroupRows: LegacyImportRowPreview[] = result.minimalLessonGroups.map((group, index) => {
      const paidLessonCount = group.tuitionSourceRows.filter((sourceRow) => paidClearTuitionRows.has(sourceRow)).length;
      return {
        id: group.id, rowType: "TUITION_GROUP", sourceSheet: "Nhóm học phí", sourceRow: index + 1,
        rawValues: { affectedLessonCount: group.lessonCount, paidLessonCount,
          fromDate: group.fromDate, toDate: group.toDate },
        normalizedValues: { groupId: group.id, tuitionSourceRows: group.tuitionSourceRows.join(","),
          requiresPaidCyclePreservation: paidLessonCount > 0 },
        issueCodes: ["TUITION_ONLY_GROUP"], status: "NEEDS_REVIEW",
        supportedActions: paidLessonCount > 0
          ? ["CREATE_MINIMAL_LEGACY_LESSONS"] : ["CREATE_MINIMAL_LEGACY_LESSONS", "SKIP"],
        suggestedResolution: { sourceSheet: "Nhóm học phí", sourceRow: index + 1,
          issueCode: "TUITION_ONLY_GROUP", action: "CREATE_MINIMAL_LEGACY_LESSONS",
          resolvedValue: { groupId: group.id, tuitionSourceRows: group.tuitionSourceRows } },
      };
    });
    const paymentRows: LegacyImportRowPreview[] = result.paymentEvents.filter((event) => event.requiresReview).map((event) => ({
      id: event.id, rowType: "PAYMENT", sourceSheet: "Học phí", sourceRow: event.sourceRow,
      rawValues: { date: event.date, billableCount: event.billableCount, reviewKind: event.kind },
      normalizedValues: { date: event.date, blockId: event.blockId, paymentResolution: event.recommendedResolution,
        resolutionOptions: event.resolutionOptions.join(",") },
      issueCodes: ["PAYMENT_BLOCK_REVIEW_REQUIRED"], status: "NEEDS_REVIEW",
      supportedActions: ["CONFIRM_PAYMENT"],
    }));
    const periodRows: LegacyImportRowPreview[] = academicPeriods.map((period, index) => ({
      id: period.id, rowType: "ACADEMIC_PERIOD", sourceSheet: "Giai đoạn học", sourceRow: index + 1,
      rawValues: { fromDate: period.fromDate, toDate: period.toDate, schoolYear: period.schoolYear },
      normalizedValues: { fromDate: period.fromDate, toDate: period.toDate, schoolYear: period.schoolYear,
        gradeLevel: period.gradeLevel },
      issueCodes: ["ACADEMIC_PERIOD_MAPPING_REQUIRED"], status: "NEEDS_REVIEW",
      supportedActions: ["MAP_ACADEMIC_PERIOD"],
    }));
    const matchedTuitionSourceRows = new Set(result.lessons.map((lesson) => lesson.matchedTuitionSourceRow)
      .filter((sourceRow): sourceRow is number => sourceRow != null));
    const timeMappingRows: LegacyImportRowPreview[] = result.timeMappings.map((mapping, index) => ({
      id: mapping.id, rowType: "TIME_MAPPING", sourceSheet: "Khung giờ", sourceRow: index + 1,
      rawValues: { rawTime: mapping.rawValues.join(" · "), periodId: mapping.periodId,
        affectedLessonCount: new Set(mapping.lessonSourceRows).size + mapping.tuitionSourceRows
          .filter((sourceRow) => !matchedTuitionSourceRows.has(sourceRow)).length,
        affectedTuitionRowCount: new Set(mapping.tuitionSourceRows).size, reason: mapping.reason },
      normalizedValues: { mappingId: mapping.id, startTime: mapping.proposedStartTime,
        endTime: mapping.proposedEndTime },
      issueCodes: ["TIME_MAPPING_REQUIRED"], status: "NEEDS_REVIEW",
      supportedActions: ["CONFIRM_TIME_MAPPING"],
    }));
    const rows = [...lessonRows, ...tuitionPreviewRows, ...tuitionGroupRows, ...paymentRows, ...periodRows, ...timeMappingRows];
    const unresolvedIssueCount = rows.filter((row) => row.status === "NEEDS_REVIEW" || row.status === "BLOCKED").length;
    const hasAdvancePayment = result.paymentEvents.some((event) => event.recommendedResolution === "CURRENT_CYCLE_ADVANCE")
      ? true : result.paymentEvents.some((event) => event.requiresReview) ? null : false;
    return {
      mode: "PREVIEW_ONLY",
      student: { id: student.id, fullName: student.fullName, currentClassId: student.classId, currentClassName: student.className },
      file,
      lessons: result.lessons,
      tuitionRows: result.tuitionRows,
      tuitionBlocks: result.tuitionBlocks,
      paymentEvents: result.paymentEvents,
      tuitionCycles: result.tuitionCycles,
      tuitionCyclePlans: result.tuitionCyclePlans,
      minimalLessonGroups: result.minimalLessonGroups,
      timeMappings: result.timeMappings,
      academicPeriods,
      classCandidates,
      rows,
      summary: {
        totalLessons: result.lessons.length,
        presentLessons: result.lessons.filter((item) => item.attendanceStatus === "PRESENT").length,
        absentLessons: result.lessons.filter((item) => item.attendanceStatus === "ABSENT").length,
        academicPeriodCount: academicPeriods.length,
        completedCycleCount: result.tuitionCycles.filter((item) => item.state === "COMPLETE").length,
        paidCycleCount: result.tuitionCycles.filter((item) => item.paymentState === "PAID_CLEAR").length,
        freeLessonCount: result.lessons.filter((item) => item.attendanceStatus === "FREE").length,
        currentCycleProgress: [...result.tuitionCycles].reverse().find((item) => item.state === "CURRENT")?.itemCount ?? 0,
        hasAdvancePayment,
        unresolvedIssueCount,
        validRowCount: rows.filter((row) => row.status === "VALID").length,
        needsReviewRowCount: rows.filter((row) => row.status === "NEEDS_REVIEW").length,
        blockedRowCount: rows.filter((row) => row.status === "BLOCKED").length,
        resolvedRowCount: 0,
        skippedRowCount: 0,
        expectedLessonCount: lessonRows.length,
        expectedTuitionCycleCount: result.tuitionCycles.length,
      },
      warnings: [
        "Đây chỉ là bản xem trước; hệ thống chưa ghi lesson, lớp, ghi danh hoặc học phí.",
        "Mỗi workbook mặc định thuộc một ngữ cảnh lớp lịch sử; hãy xác nhận mapping trước khi import.",
        "PAID chỉ xác nhận đợt học phí đã thu; workbook lịch sử không cung cấp ngày hoặc phương thức thanh toán.",
      ],
    };
  }
}
