import assert from "node:assert/strict";
import test from "node:test";
import { teacherHubFormattingCleanup, templateSheetReconciliationRequests } from "./google-sheets.client";

test("template reconciliation renames learning history and removes obsolete visible sheets", () => {
  assert.deepEqual(templateSheetReconciliationRequests(
    { "Tổng quan": 1, "Nhật ký học tập": 2, "Học phí": 3, "Ôn từ vựng": 4, _TeacherHub: 5 },
    ["Quá trình học tập", "Học phí", "_TeacherHub"],
    ["Tổng quan", "Nhật ký học tập", "Ôn từ vựng"],
    { "Nhật ký học tập": "Quá trình học tập" },
  ), [
    { updateSheetProperties: { properties: { sheetId: 2, title: "Quá trình học tập" }, fields: "title" } },
    { deleteSheet: { sheetId: 1 } },
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
