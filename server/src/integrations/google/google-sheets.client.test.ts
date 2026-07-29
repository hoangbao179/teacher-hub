import assert from "node:assert/strict";
import test from "node:test";
import { teacherHubFormattingCleanup, templateSheetReconciliationRequests } from "./google-sheets.client";

test("template reconciliation adds missing sheets and removes obsolete overview", () => {
  assert.deepEqual(templateSheetReconciliationRequests(
    { "Tổng quan": 1, "Nhật ký học tập": 2, "Học phí": 3, _TeacherHub: 5 },
    ["Nhật ký học tập", "Học phí", "Ôn từ vựng", "_TeacherHub"],
    ["Tổng quan"],
  ), [
    { addSheet: { properties: { title: "Ôn từ vựng" } } },
    { deleteSheet: { sheetId: 1 } },
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
    { deleteConditionalFormatRule: { sheetId: 2, index: 0 } },
    { deleteProtectedRange: { protectedRangeId: 11 } },
  ]);
});
