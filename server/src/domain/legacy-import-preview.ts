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

function schoolPeriod(date: string): { start: string; end: string; schoolYear: string } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= 6 ? year : year - 1;
  return { start: `${startYear}-06-01`, end: `${startYear + 1}-05-31`, schoolYear: `${startYear}-${startYear + 1}` };
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
  if (lesson.reconciliationStatus === "LEARNING_ONLY_NEEDS_REVIEW") issues.push("ATTENDANCE_AMBIGUOUS");
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
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const grouped = new Map<string, { start: string; end: string; schoolYear: string; count: number }>();
    for (const lesson of result.lessons) {
      if (!lesson.normalizedDate) continue;
      const period = schoolPeriod(lesson.normalizedDate);
      grouped.set(period.start, { ...period, count: (grouped.get(period.start)?.count ?? 0) + 1 });
    }
    for (const group of result.minimalLessonGroups) {
      for (const date of [group.fromDate, group.toDate]) {
        const period = schoolPeriod(date);
        if (!grouped.has(period.start)) grouped.set(period.start, { ...period, count: 0 });
      }
    }
    const academicPeriods: LegacyAcademicPeriodPreview[] = [...grouped.values()].sort((a, b) => a.start.localeCompare(b.start)).map((period) => {
      const current = period.start <= today && period.end >= today && student.classId != null && student.className != null;
      return {
        id: `period-${period.start}`,
        fromDate: period.start,
        toDate: period.end >= today ? null : period.end,
        schoolYear: period.schoolYear,
        gradeLevel: null,
        proposedClassMapping: current
          ? { type: "CURRENT_CLASS" as const, classId: student.classId!, className: student.className! }
          : { type: "CREATE_CLOSED_CLASS" as const, proposedName: `Lớp lịch sử ${period.schoolYear}` },
        lessonCount: period.count,
      };
    });
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
          ...(lesson.attendanceStatus === "FREE" ? { legacyReason: "LEGACY_POST_PAID_FREE" } : {}) },
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
    const tuitionGroupRows: LegacyImportRowPreview[] = result.minimalLessonGroups.map((group, index) => ({
      id: group.id, rowType: "TUITION_GROUP", sourceSheet: "Nhóm học phí", sourceRow: index + 1,
      rawValues: { affectedLessonCount: group.lessonCount, fromDate: group.fromDate, toDate: group.toDate },
      normalizedValues: { groupId: group.id, tuitionSourceRows: group.tuitionSourceRows.join(",") },
      issueCodes: ["TUITION_ONLY_GROUP"], status: "NEEDS_REVIEW",
      supportedActions: ["CREATE_MINIMAL_LEGACY_LESSONS", "SKIP"],
    }));
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
    const timeMappingRows: LegacyImportRowPreview[] = result.timeMappings.map((mapping, index) => ({
      id: mapping.id, rowType: "TIME_MAPPING", sourceSheet: "Khung giờ", sourceRow: index + 1,
      rawValues: { rawTime: mapping.rawValues.join(" · "), periodId: mapping.periodId,
        affectedLessonCount: mapping.lessonSourceRows.length + mapping.tuitionSourceRows.length, reason: mapping.reason },
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
        "Khối lớp không được suy từ tên file. Hãy xác nhận khối cho từng năm học.",
        "PAID chỉ xác nhận đợt học phí đã thu; workbook lịch sử không cung cấp ngày hoặc phương thức thanh toán.",
      ],
    };
  }
}
