import type {
  ClassListItem,
  LegacyAcademicPeriodPreview,
  LegacyClassCandidate,
  LegacyImportPreview as LegacyImportPreviewContract,
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

export class LegacyImportPreview {
  build(student: StudentDetail, classes: ClassListItem[], file: LegacyPreviewFile, result: LegacyReconciliationResult): LegacyImportPreviewContract {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const grouped = new Map<string, { start: string; end: string; schoolYear: string; count: number }>();
    for (const lesson of result.lessons) {
      if (!lesson.normalizedDate) continue;
      const period = schoolPeriod(lesson.normalizedDate);
      grouped.set(period.start, { ...period, count: (grouped.get(period.start)?.count ?? 0) + 1 });
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
    const unresolvedIssueCount = result.lessons.filter((item) => item.reconciliationStatus !== "MATCHED" && item.reconciliationStatus !== "LEARNING_ONLY_ABSENT").length
      + result.tuitionRows.filter((item) => item.reconciliationStatus !== "MATCHED").length
      + result.paymentEvents.filter((item) => item.requiresReview).length
      + academicPeriods.filter((item) => item.gradeLevel == null).length;
    const hasAdvancePayment = result.paymentEvents.some((event) => event.recommendedResolution === "CURRENT_CYCLE_ADVANCE")
      ? true : result.paymentEvents.some((event) => event.requiresReview) ? null : false;
    return {
      mode: "PREVIEW_ONLY",
      student: { id: student.id, fullName: student.fullName, currentClassId: student.classId, currentClassName: student.className },
      file,
      lessons: result.lessons,
      tuitionRows: result.tuitionRows,
      paymentEvents: result.paymentEvents,
      tuitionCycles: result.tuitionCycles,
      academicPeriods,
      classCandidates,
      summary: {
        totalLessons: result.lessons.length,
        presentLessons: result.lessons.filter((item) => item.attendanceStatus === "PRESENT").length,
        absentLessons: result.lessons.filter((item) => item.attendanceStatus === "ABSENT").length,
        academicPeriodCount: academicPeriods.length,
        completedCycleCount: result.tuitionCycles.filter((item) => item.state === "COMPLETE").length,
        paidCycleCount: result.tuitionCycles.filter((item) => item.paymentState === "PAID_CLEAR").length,
        currentCycleProgress: [...result.tuitionCycles].reverse().find((item) => item.state === "CURRENT")?.itemCount ?? 0,
        hasAdvancePayment,
        unresolvedIssueCount,
      },
      warnings: [
        "Đây chỉ là bản xem trước; hệ thống chưa ghi lesson, lớp, ghi danh hoặc học phí.",
        "Khối lớp không được suy từ tên file. Hãy xác nhận khối cho từng năm học.",
        "PAID là sự kiện thanh toán và không tự động được dùng làm ranh giới chu kỳ.",
      ],
    };
  }
}
