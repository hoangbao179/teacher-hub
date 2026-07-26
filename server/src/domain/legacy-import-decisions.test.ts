import assert from "node:assert/strict";
import test from "node:test";
import type { LegacyImportPreview, LegacyImportRowDecision, LegacyImportRowPreview } from "@teacher/shared";
import { resolveLegacyImportDecisions, validateLegacyBulkDecision } from "./legacy-import-decisions";

function row(overrides: Partial<LegacyImportRowPreview> = {}): LegacyImportRowPreview {
  return {
    id: "learning-4", rowType: "LESSON", sourceSheet: "Quá trình học tập", sourceRow: 4,
    rawValues: { date: "không rõ" }, normalizedValues: { date: null, attendance: "PRESENT" },
    issueCodes: ["INVALID_DATE"], status: "BLOCKED", supportedActions: ["EDIT_ROW", "SKIP"],
    ...overrides,
  };
}

function preview(rows: LegacyImportRowPreview[]): LegacyImportPreview {
  return {
    mode: "PREVIEW_ONLY", student: { id: 7, fullName: "Học sinh Mẫu", currentClassId: 2, currentClassName: "Lớp 7" },
    file: { name: "history.xlsx", size: 100, sha256: "a".repeat(64) }, lessons: [], tuitionRows: [],
    paymentEvents: [], tuitionCycles: [], academicPeriods: [], classCandidates: [], rows,
    summary: { totalLessons: 0, presentLessons: 0, absentLessons: 0, academicPeriodCount: 0,
      completedCycleCount: 0, paidCycleCount: 0, currentCycleProgress: 0, hasAdvancePayment: false,
      unresolvedIssueCount: rows.length, validRowCount: 0, needsReviewRowCount: 0, blockedRowCount: rows.length,
      resolvedRowCount: 0, skippedRowCount: 0, expectedLessonCount: 0, expectedTuitionCycleCount: 0 },
    warnings: [],
  };
}

test("unresolved and invalid date decisions block Apply", () => {
  assert.throws(() => resolveLegacyImportDecisions(preview([row()]), []),
    (error: unknown) => (error as { code?: string }).code === "LEGACY_ROWS_UNRESOLVED");
  assert.throws(() => resolveLegacyImportDecisions(preview([row()]), [{ sourceSheet: "Quá trình học tập", sourceRow: 4,
    issueCode: "INVALID_DATE", action: "EDIT_ROW", resolvedValue: { date: "31/02/2025" } }]),
  (error: unknown) => (error as { code?: string }).code === "LEGACY_DECISIONS_INVALID");
});

test("a skipped row is excluded with a typed reason", () => {
  const decisions: LegacyImportRowDecision[] = [{ sourceSheet: "Quá trình học tập", sourceRow: 4,
    issueCode: "INVALID_DATE", action: "SKIP", reason: "UNIDENTIFIABLE_DATA" }];
  const resolved = resolveLegacyImportDecisions(preview([row()]), decisions);
  assert.equal(resolved[0].status, "SKIPPED");
  assert.equal(resolved[0].decisions[0].action, "SKIP");
});

test("attendance resolution rejects unsupported attendance states", () => {
  const attendanceRow = row({ issueCodes: ["ATTENDANCE_AMBIGUOUS"], status: "NEEDS_REVIEW",
    supportedActions: ["SET_ATTENDANCE", "SKIP"], normalizedValues: { date: "2025-06-01", attendance: "ABSENT" } });
  const unsupported = [{ sourceSheet: attendanceRow.sourceSheet,
    sourceRow: attendanceRow.sourceRow, issueCode: "ATTENDANCE_AMBIGUOUS", action: "SET_ATTENDANCE",
    resolvedValue: "UNSUPPORTED" }] as unknown as LegacyImportRowDecision[];
  assert.throws(() => resolveLegacyImportDecisions(preview([attendanceRow]), unsupported),
    (error: unknown) => (error as { code?: string }).code === "LEGACY_DECISIONS_INVALID");
});

test("duplicate decisions for one issue are rejected", () => {
  const decision = { sourceSheet: "Quá trình học tập", sourceRow: 4, issueCode: "INVALID_DATE" as const,
    action: "EDIT_ROW" as const, resolvedValue: { date: "2025-06-01" } };
  assert.throws(() => resolveLegacyImportDecisions(preview([row()]), [decision, decision]),
    (error: unknown) => (error as { code?: string }).code === "LEGACY_DECISIONS_INVALID");
});

test("bulk decisions require the same issue, normalized value and valid action", () => {
  const first = row({ id: "first", normalizedValues: { date: null } });
  const second = row({ id: "second", sourceRow: 9, normalizedValues: { date: null } });
  assert.doesNotThrow(() => validateLegacyBulkDecision([first, second], "INVALID_DATE", "EDIT_ROW"));
  assert.throws(() => validateLegacyBulkDecision([first, { ...second, normalizedValues: { date: "2025-01-01" } }],
    "INVALID_DATE", "EDIT_ROW"), (error: unknown) => (error as { code?: string }).code === "LEGACY_DECISIONS_INVALID");
});
