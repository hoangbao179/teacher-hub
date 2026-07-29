import type {
  LegacyImportDecisionAction,
  LegacyImportIssueCode,
  LegacyImportPreview,
  LegacyImportRowDecision,
  LegacyImportRowPreview,
} from "@teacher/shared";
import { AppError } from "../errors/app-error";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function rowKey(sourceSheet: string, sourceRow: number): string {
  return `${sourceSheet}\u0000${sourceRow}`;
}

function decisionKey(decision: LegacyImportRowDecision): string {
  return `${rowKey(decision.sourceSheet, decision.sourceRow)}\u0000${decision.issueCode}`;
}

function invalid(message: string): never {
  throw new AppError(400, "LEGACY_DECISIONS_INVALID", message);
}

function actionAllowedForIssue(issue: LegacyImportIssueCode, action: LegacyImportDecisionAction): boolean {
  if (action === "SKIP") return issue !== "ACADEMIC_PERIOD_MAPPING_REQUIRED";
  const allowed: Record<LegacyImportIssueCode, LegacyImportDecisionAction[]> = {
    INVALID_DATE: ["EDIT_ROW"], INVALID_TIME: ["EDIT_ROW"], DATE_CORRECTION: ["EDIT_ROW"], STUDENT_MISMATCH: ["CONFIRM_STUDENT"],
    ATTENDANCE_AMBIGUOUS: ["SET_ATTENDANCE"], DUPLICATE_ROW: ["CREATE_LESSON", "MATCH_EXISTING_LESSON"],
    TUITION_ROW_UNMATCHED: [], ACADEMIC_PERIOD_MAPPING_REQUIRED: ["MAP_ACADEMIC_PERIOD"],
    PAYMENT_REVIEW_REQUIRED: ["CONFIRM_PAYMENT"], NEAR_LESSON_MATCH: ["MATCH_EXISTING_LESSON", "CREATE_LESSON"],
    LESSON_CONTENT_CONFLICT: ["KEEP_EXISTING_LESSON", "USE_IMPORTED_LESSON", "EDIT_LESSON_CONTENT"],
    TIME_MAPPING_REQUIRED: ["CONFIRM_TIME_MAPPING"],
    TUITION_DATE_CORRECTION: ["EDIT_ROW"],
    TUITION_ONLY_GROUP: ["CREATE_MINIMAL_LEGACY_LESSONS"],
    PAYMENT_BLOCK_REVIEW_REQUIRED: ["CONFIRM_PAYMENT", "EXCLUDE_FINANCE_BLOCK"],
  };
  return allowed[issue].includes(action);
}

function validateDecisionPayload(decision: LegacyImportRowDecision, studentId: number): void {
  if (decision.action === "EDIT_ROW") {
    const value = decision.resolvedValue;
    if (!Object.keys(value).length) invalid("Quyết định sửa dòng phải có giá trị mới.");
    if (value.date && !datePattern.test(value.date)) invalid("Ngày đã sửa không hợp lệ.");
    if (value.startTime && !timePattern.test(value.startTime)) invalid("Giờ bắt đầu đã sửa không hợp lệ.");
    if (value.endTime && !timePattern.test(value.endTime)) invalid("Giờ kết thúc đã sửa không hợp lệ.");
    if (value.startTime && value.endTime && value.endTime <= value.startTime)
      invalid("Giờ kết thúc phải sau giờ bắt đầu.");
  } else if (decision.action === "SET_ATTENDANCE") {
    if (!(["PRESENT", "ABSENT", "FREE"] as string[]).includes(decision.resolvedValue))
      invalid("Trạng thái điểm danh đã chọn không hợp lệ.");
  } else if (decision.action === "CONFIRM_STUDENT") {
    if (decision.resolvedValue.studentId !== studentId) invalid("Xác nhận học sinh không khớp hồ sơ đang import.");
  } else if (decision.action === "MAP_ACADEMIC_PERIOD") {
    if (!Number.isInteger(decision.resolvedValue.gradeLevel) || decision.resolvedValue.gradeLevel < 1 ||
        decision.resolvedValue.gradeLevel > 9) invalid("Khối phải từ 1 đến 9.");
    const mapping = decision.resolvedValue.classMapping;
    if ((mapping.type === "EXISTING_CLASS" || mapping.type === "CURRENT_CLASS") &&
        (!Number.isInteger(mapping.classId) || mapping.classId < 1)) invalid("Mapping lớp không hợp lệ.");
    if (mapping.type === "CREATE_CLOSED_CLASS" && !mapping.proposedName.trim()) invalid("Tên lớp lịch sử là bắt buộc.");
  } else if (decision.action === "MATCH_EXISTING_LESSON") {
    if (!Number.isInteger(decision.lessonId) || (decision.lessonId ?? 0) < 1) invalid("Lesson ghép không hợp lệ.");
  } else if (decision.action === "SKIP") {
    if (decision.reason === "OTHER" && !decision.otherReason?.trim()) invalid("Lý do khác là bắt buộc khi bỏ qua.");
  } else if (decision.action === "CONFIRM_PAYMENT" && decision.resolvedValue === "UNDETERMINED")
    invalid("Sự kiện thanh toán phải có quyết định rõ ràng trước khi Apply.");
  if (decision.action === "CONFIRM_TIME_MAPPING") {
    if (!decision.resolvedValue.mappingId || !timePattern.test(decision.resolvedValue.startTime) ||
        !timePattern.test(decision.resolvedValue.endTime) || decision.resolvedValue.endTime <= decision.resolvedValue.startTime)
      invalid("Khung giờ xác nhận không hợp lệ.");
  }
  if (decision.action === "CREATE_MINIMAL_LEGACY_LESSONS") {
    if (!decision.resolvedValue.groupId || !decision.resolvedValue.tuitionSourceRows.length ||
        decision.resolvedValue.tuitionSourceRows.some((row) => !Number.isInteger(row) || row < 1))
      invalid("Nhóm lesson tối giản không hợp lệ.");
  }
  if (decision.action === "EXCLUDE_FINANCE_BLOCK" && !decision.resolvedValue.blockId)
    invalid("Mã block học phí không hợp lệ.");
}

export interface ResolvedLegacyImportRow extends LegacyImportRowPreview {
  status: "VALID" | "RESOLVED" | "SKIPPED";
  decisions: LegacyImportRowDecision[];
}

export function resolveLegacyImportDecisions(
  preview: LegacyImportPreview,
  decisions: LegacyImportRowDecision[],
): ResolvedLegacyImportRow[] {
  if (!Array.isArray(decisions)) invalid("Danh sách quyết định không hợp lệ.");
  const rows = new Map(preview.rows.map((row) => [rowKey(row.sourceSheet, row.sourceRow), row]));
  const byIssue = new Map<string, LegacyImportRowDecision>();
  for (const decision of decisions) {
    if (!decision || typeof decision.sourceSheet !== "string" || !Number.isInteger(decision.sourceRow))
      invalid("Định danh dòng quyết định không hợp lệ.");
    const key = decisionKey(decision);
    if (byIssue.has(key)) invalid("Một vấn đề của dòng chỉ được có một quyết định.");
    const row = rows.get(rowKey(decision.sourceSheet, decision.sourceRow));
    if (!row || !row.issueCodes.includes(decision.issueCode)) invalid("Quyết định không thuộc vấn đề của dòng preview.");
    if (decision.action === "SKIP" && decision.issueCode === "TUITION_ONLY_GROUP" &&
        row.normalizedValues.requiresPaidCyclePreservation === true)
      invalid("Nhóm buổi thuộc chu kỳ đã thanh toán phải được import thành lesson tối giản.");
    if (!row.supportedActions.includes(decision.action) || !actionAllowedForIssue(decision.issueCode, decision.action))
      invalid("Thao tác không được hỗ trợ cho vấn đề của dòng này.");
    if (decision.action === "CONFIRM_TIME_MAPPING" && decision.resolvedValue.mappingId !== row.normalizedValues.mappingId)
      invalid("Mã mapping khung giờ không khớp preview.");
    if (decision.action === "CREATE_MINIMAL_LEGACY_LESSONS" &&
        decision.resolvedValue.groupId !== row.normalizedValues.groupId)
      invalid("Mã nhóm lesson tối giản không khớp preview.");
    if (decision.action === "EXCLUDE_FINANCE_BLOCK" &&
        decision.resolvedValue.blockId !== row.normalizedValues.blockId)
      invalid("Mã block học phí không khớp preview.");
    if (decision.action === "CONFIRM_PAYMENT" && typeof row.normalizedValues.resolutionOptions === "string" &&
        !row.normalizedValues.resolutionOptions.split(",").includes(decision.resolvedValue))
      invalid("Trạng thái học phí không thuộc lựa chọn được backend hỗ trợ.");
    validateDecisionPayload(decision, preview.student.id);
    byIssue.set(key, decision);
  }

  const resolved = preview.rows.map((row): ResolvedLegacyImportRow => {
    if (!row.issueCodes.length) return { ...row, status: "VALID", decisions: [] };
    const rowDecisions = row.issueCodes.map((issue) => byIssue.get(`${rowKey(row.sourceSheet, row.sourceRow)}\u0000${issue}`))
      .filter((item): item is LegacyImportRowDecision => Boolean(item));
    const skip = rowDecisions.find((item) => item.action === "SKIP");
    if (skip) return { ...row, status: "SKIPPED", decisions: [skip] };
    if (rowDecisions.length !== row.issueCodes.length)
      throw new AppError(409, "LEGACY_ROWS_UNRESOLVED", `Dòng ${row.sourceRow} vẫn còn vấn đề chưa xử lý.`);
    let normalizedValues = { ...row.normalizedValues };
    for (const decision of rowDecisions) {
      if (decision.action === "EDIT_ROW") normalizedValues = { ...normalizedValues, ...decision.resolvedValue };
      if (decision.action === "SET_ATTENDANCE") normalizedValues.attendance = decision.resolvedValue;
    }
    return { ...row, normalizedValues, status: "RESOLVED", decisions: rowDecisions };
  });
  const confirmedMappings = new Map(decisions.filter((decision) => decision.action === "CONFIRM_TIME_MAPPING")
    .map((decision) => [decision.resolvedValue.mappingId, decision.resolvedValue]));
  return resolved.map((row) => {
    if (row.rowType !== "LESSON" || typeof row.normalizedValues.timeMappingId !== "string") return row;
    const mapping = confirmedMappings.get(row.normalizedValues.timeMappingId);
    return mapping ? { ...row, normalizedValues: { ...row.normalizedValues,
      startTime: mapping.startTime, endTime: mapping.endTime } } : row;
  });
}

export function validateLegacyBulkDecision(
  rows: LegacyImportRowPreview[],
  issueCode: LegacyImportIssueCode,
  action: LegacyImportDecisionAction,
): void {
  if (!rows.length) invalid("Bulk decision phải có ít nhất một dòng.");
  const issueRows = rows.filter((row) => row.issueCodes.includes(issueCode));
  if (issueRows.length !== rows.length || rows.some((row) => !row.supportedActions.includes(action)))
    invalid("Bulk decision chỉ áp dụng cho cùng vấn đề và thao tác hợp lệ.");
  if (rows.length === 1) return;
  if (issueCode === "INVALID_DATE" || issueCode === "DATE_CORRECTION" || issueCode === "TUITION_DATE_CORRECTION")
    invalid("Các vấn đề ngày phải được xác nhận riêng theo đề xuất của từng dòng.");
  const first = issueRows[0];
  const same = (left: unknown, right: unknown) => String(left ?? "").trim().toLocaleLowerCase("vi") ===
    String(right ?? "").trim().toLocaleLowerCase("vi");
  const financialIssues: LegacyImportIssueCode[] = ["TUITION_ROW_UNMATCHED", "TUITION_ONLY_GROUP",
    "PAYMENT_REVIEW_REQUIRED", "PAYMENT_BLOCK_REVIEW_REQUIRED"];
  const equivalent = (row: LegacyImportRowPreview): boolean => {
    if (issueCode === "ATTENDANCE_AMBIGUOUS")
      return same(row.normalizedValues.attendanceReason ?? row.normalizedValues.legacyReason,
        first.normalizedValues.attendanceReason ?? first.normalizedValues.legacyReason);
    if (issueCode === "STUDENT_MISMATCH") return same(row.rawValues.studentName, first.rawValues.studentName);
    if (issueCode === "INVALID_TIME" || issueCode === "TIME_MAPPING_REQUIRED") {
      const sameMapping = Boolean(first.normalizedValues.mappingId) &&
        same(row.normalizedValues.mappingId, first.normalizedValues.mappingId);
      const sameRaw = same(row.rawValues.rawTime ?? row.rawValues.time, first.rawValues.rawTime ?? first.rawValues.time);
      return (sameMapping || sameRaw) && same(row.normalizedValues.startTime, first.normalizedValues.startTime) &&
        same(row.normalizedValues.endTime, first.normalizedValues.endTime);
    }
    if (financialIssues.includes(issueCode)) {
      const firstGroup = first.normalizedValues.blockId ?? first.normalizedValues.groupId;
      return Boolean(firstGroup) && same(row.normalizedValues.blockId ?? row.normalizedValues.groupId, firstGroup);
    }
    return false;
  };
  if (issueRows.some((row) => !equivalent(row)))
    invalid("Các dòng bulk không cùng trường hợp nghiệp vụ.");
}
