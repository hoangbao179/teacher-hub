import assert from "node:assert/strict";
import test from "node:test";
import {
  learningRowSyncPlan,
  learningSyncTimestampValues,
  teacherHubFormattingCleanup,
  templateSheetReconciliationRequests,
} from "./google-sheets.client";

test("lesson sync updates an existing technical ID instead of appending a duplicate", () => {
  const values = [["Teacher Hub Lesson ID", "Ngày học"], [10, "20/07/2026"], [11, "21/07/2026"]];
  assert.deepEqual(learningRowSyncPlan(values, 11), { action: "UPDATE", rowNumber: 8 });
  assert.deepEqual(learningRowSyncPlan(values, 12), { action: "APPEND", rowNumber: 9 });
});

test("lesson sync updates visible and technical timestamps together", () => {
  assert.deepEqual(learningSyncTimestampValues("2026-07-27T08:30:00.000Z"), [
    { range: "'Sổ theo dõi học tập'!B4", values: [["27/07/2026 15:30"]] },
    { range: "'_TeacherHub'!B7", values: [["2026-07-27T08:30:00.000Z"]] },
  ]);
});

test("template reconciliation renames learning history and removes obsolete visible sheets", () => {
  assert.deepEqual(templateSheetReconciliationRequests(
    { "Tổng quan": 1, "Nhật ký học tập": 2, "Học phí": 3, "Ôn từ vựng": 4, _TeacherHub: 5 },
    ["Sổ theo dõi học tập", "_TeacherHub"],
    ["Tổng quan", "Nhật ký học tập", "Quá trình học tập", "Học phí", "Ôn từ vựng"],
    { "Nhật ký học tập": "Sổ theo dõi học tập", "Quá trình học tập": "Sổ theo dõi học tập" },
  ), [
    { updateSheetProperties: { properties: { sheetId: 2, title: "Sổ theo dõi học tập" }, fields: "title" } },
    { deleteSheet: { sheetId: 1 } },
    { deleteSheet: { sheetId: 3 } },
    { deleteSheet: { sheetId: 4 } },
  ]);
});

test("regenerate cleanup only removes Teacher Hub formatting and protection", () => {
  const cleanup = teacherHubFormattingCleanup([{
    properties: { sheetId: 2 },
    conditionalFormats: [
      {
        ranges: [{ sheetId: 2, startRowIndex: 1, endRowIndex: 20, startColumnIndex: 0, endColumnIndex: 14 }],
        booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=ISEVEN(ROW())" }] } },
      },
      {
        ranges: [{ sheetId: 2, startRowIndex: 6, endRowIndex: 20, startColumnIndex: 2, endColumnIndex: 3 }],
        booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Có mặt" }] } },
      },
      {
        ranges: [{ sheetId: 2, startRowIndex: 0, endRowIndex: 20, startColumnIndex: 2, endColumnIndex: 3 }],
        booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Tùy chỉnh" }] } },
      },
    ],
    protectedRanges: [
      { protectedRangeId: 11, description: "Teacher Hub metadata" },
      { protectedRangeId: 12, description: "Phụ huynh tự bảo vệ" },
    ],
  }]);
  assert.deepEqual(cleanup, [
    { deleteConditionalFormatRule: { sheetId: 2, index: 1 } },
    { deleteConditionalFormatRule: { sheetId: 2, index: 0 } },
    { deleteProtectedRange: { protectedRangeId: 11 } },
  ]);
});
