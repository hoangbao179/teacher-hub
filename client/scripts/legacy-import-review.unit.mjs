import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import test from "node:test";
import {
  getEquivalentImportRows,
  initialLegacyImportDraft,
  isLegacyImportRowVisible,
  legacyImportDecisionKey,
  legacyImportEditableFields,
  mergeLegacyImportDecisionsAfterConfirmation,
} from "../src/features/legacy-import-review.ts";

function row(overrides = {}) {
  return {
    id: "learning-4",
    rowType: "LESSON",
    sourceSheet: "Quá trình học tập",
    sourceRow: 4,
    rawValues: { date: "2026-01-01", studentName: "Học sinh Mẫu" },
    normalizedValues: { date: "2026-01-01", attendance: "PRESENT", attendanceReason: "UNCLEAR_MARKER" },
    issueCodes: ["ATTENDANCE_AMBIGUOUS"],
    status: "NEEDS_REVIEW",
    supportedActions: ["SET_ATTENDANCE", "SKIP"],
    ...overrides,
  };
}

test("attendance bulk matches lessons on different dates but not a different business reason", () => {
  const current = row();
  const otherDate = row({ id: "learning-9", sourceRow: 9,
    rawValues: { date: "2026-02-01", studentName: "Học sinh Mẫu" },
    normalizedValues: { date: "2026-02-01", attendance: "PRESENT", content: "Nội dung khác",
      attendanceReason: "UNCLEAR_MARKER" } });
  const otherReason = row({ id: "learning-14", sourceRow: 14,
    normalizedValues: { date: "2026-03-01", attendance: "PRESENT", attendanceReason: "MISSING_MARKER" } });
  assert.deepEqual(getEquivalentImportRows(current, [current, otherDate, otherReason], initialLegacyImportDraft(current))
    .map((item) => item.id), ["learning-4", "learning-9"]);
});

test("a single equivalent row yields no bulk action target", () => {
  const current = row();
  assert.equal(getEquivalentImportRows(current, [current], initialLegacyImportDraft(current)).length, 1);
});

test("canceling bulk confirmation does not change any decision", () => {
  const current = {};
  const next = [{ sourceSheet: "Quá trình học tập", sourceRow: 4,
    issueCode: "ATTENDANCE_AMBIGUOUS", action: "SET_ATTENDANCE", resolvedValue: "PRESENT" }];
  const result = mergeLegacyImportDecisionsAfterConfirmation(current, next, () => false);
  assert.equal(result.applied, false);
  assert.equal(result.decisions, current);
  assert.deepEqual(result.decisions, {});
});

test("suggested resolution initializes the editable draft before normalized fallback", () => {
  const correction = row({ issueCodes: ["DATE_CORRECTION"], supportedActions: ["EDIT_ROW"],
    normalizedValues: { date: "2025-11-14" },
    suggestedResolution: { sourceSheet: "Quá trình học tập", sourceRow: 4, issueCode: "DATE_CORRECTION",
      action: "EDIT_ROW", resolvedValue: { date: "2025-11-15" } } });
  assert.equal(initialLegacyImportDraft(correction).date, "2025-11-15");
});

test("editable fields follow the issue action instead of exposing unrelated date and time inputs", () => {
  assert.deepEqual(legacyImportEditableFields(row()), {
    date: false, time: false, attendance: true, lessonContent: false, timeMappingReadOnly: false,
  });
  assert.deepEqual(legacyImportEditableFields(row({ issueCodes: ["INVALID_DATE"],
    normalizedValues: { date: null, timeMappingId: "time-workbook-2" } })), {
    date: true, time: false, attendance: false, lessonContent: false, timeMappingReadOnly: true,
  });
});

test("only-needs-review filter hides resolved lesson and time-mapping cards", () => {
  const lesson = row();
  const mapping = row({ id: "time-1", rowType: "TIME_MAPPING", sourceSheet: "Khung giờ", sourceRow: 1,
    issueCodes: ["TIME_MAPPING_REQUIRED"], supportedActions: ["CONFIRM_TIME_MAPPING"],
    normalizedValues: { mappingId: "time-1", startTime: "20:00", endTime: "22:00" } });
  const decisions = {
    [legacyImportDecisionKey(lesson.sourceSheet, lesson.sourceRow, "ATTENDANCE_AMBIGUOUS")]: {
      sourceSheet: lesson.sourceSheet, sourceRow: lesson.sourceRow, issueCode: "ATTENDANCE_AMBIGUOUS",
      action: "SET_ATTENDANCE", resolvedValue: "PRESENT",
    },
    [legacyImportDecisionKey(mapping.sourceSheet, mapping.sourceRow, "TIME_MAPPING_REQUIRED")]: {
      sourceSheet: mapping.sourceSheet, sourceRow: mapping.sourceRow, issueCode: "TIME_MAPPING_REQUIRED",
      action: "CONFIRM_TIME_MAPPING", resolvedValue: { mappingId: "time-1", startTime: "20:00", endTime: "22:00" },
    },
  };
  assert.equal(isLegacyImportRowVisible(lesson, true, decisions), false);
  assert.equal(isLegacyImportRowVisible(mapping, true, decisions), false);
  assert.equal(isLegacyImportRowVisible(mapping, false, decisions), true);
});

test("tuition-only review copy describes valid lessons awaiting comments", async () => {
  const source = await readFile(new URL("../src/pages/LegacyImportPage.tsx", import.meta.url), "utf8");
  assert.match(source, /Buổi đã có học phí nhưng chưa có nhận xét/);
  assert.match(source, /Tạo \$\{String\(row\.rawValues\.affectedLessonCount\)\} buổi học/);
  assert.doesNotMatch(source, /sau đợt đã thanh toán và sẽ lưu là miễn phí/);
  assert.doesNotMatch(source, /lesson tối giản/);
});
