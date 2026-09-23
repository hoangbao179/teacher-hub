import assert from "node:assert/strict";
import test from "node:test";
import { GoogleSheetTemplateService, googleLearningRowValues, safeGoogleCell } from "./google-sheet-template.service";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const snapshot = {
  student: { id: 7, fullName: "=Tên thử", currentClass: "Lớp 6", currentGrade: "Khối 6", currentAcademicYear: "2026–2027" },
  learning: [
    { lessonId: 10, className: "Lớp 6", date: "2026-07-20", attendance: "ABSENT",
      content: "-Nội dung", generalComment: "Nhận xét chung", studentComment: "Nghỉ có phép" },
    { lessonId: 11, className: "Lớp 6", date: "2026-07-21", attendance: "PRESENT",
      content: "Unit 2", generalComment: "Tiến bộ tốt", studentComment: "" },
  ],
  vocabularyAttempts: [],
} as StudentGoogleSheetSnapshot;

test("formula-like Google cell text is escaped", () => {
  for (const prefix of ["=", "+", "-", "@"]) assert.equal(safeGoogleCell(`${prefix}value`), `'${prefix}value`);
});

test("learning rows show date, friendly attendance, teacher comment and content", () => {
  assert.deepEqual(googleLearningRowValues(snapshot.learning[0]), [10, "20/07/2026", "Vắng", "Nghỉ có phép", "'-Nội dung"]);
  assert.deepEqual(googleLearningRowValues(snapshot.learning[1]), [11, "21/07/2026", "Có mặt", "Tiến bộ tốt", "Unit 2"]);
});

test("template builds one mobile-readable learning log and hides technical metadata", () => {
  const template = new GoogleSheetTemplateService();
  const plan = template.build(snapshot, "sheet-1", { "Sổ theo dõi học tập": 2, _TeacherHub: 5 },
    { templateVersion: "v6", generatedAt: "2026-07-26T00:00:00Z", syncedAt: "2026-07-27T00:00:00Z" });

  assert.deepEqual(template.sheetNames, ["Sổ theo dõi học tập", "_TeacherHub"]);
  assert.ok(template.obsoleteSheetNames.includes("Học phí"));
  assert.equal(plan.values.length, 2);
  const learning = plan.values.find((item) => item.range?.includes("Sổ theo dõi"))!.values!;
  assert.deepEqual(learning.slice(0, 6), [
    ["SỔ THEO DÕI HỌC TẬP", "", "", "", ""],
    ["Học sinh", "'=Tên thử", "", "", ""],
    ["Lớp", "Lớp 6", "", "", ""],
    ["Cập nhật gần nhất", "27/07/2026 07:00", "", "", ""],
    ["", "", "", "", ""],
    ["Teacher Hub Lesson ID", "Ngày học", "Điểm danh", "Nhận xét của cô", "Nội dung"],
  ]);
  assert.equal(plan.values.find((item) => item.range?.includes("Sổ theo dõi"))!.range, "'Sổ theo dõi học tập'!A1:E");
  assert.deepEqual(plan.clearRanges, ["'Sổ theo dõi học tập'!A:E"]);
  assert.ok(plan.requests.some((item) => item.updateSheetProperties?.properties?.gridProperties?.frozenRowCount === 6));
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 2
    && item.updateDimensionProperties.range.startIndex === 0
    && item.updateDimensionProperties.properties?.hiddenByUser === true));
  assert.ok(plan.requests.some((item) => item.addConditionalFormatRule?.rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue === "Có mặt"));
  assert.ok(plan.requests.some((item) => item.addConditionalFormatRule?.rule?.ranges?.[0]?.endRowIndex == null));
  assert.ok(plan.requests.some((item) => item.addConditionalFormatRule?.rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue === "Vắng"));
  assert.ok(plan.requests.some((item) => item.updateSheetProperties?.properties?.hidden === true));
  assert.ok(plan.requests.some((item) => item.addProtectedRange?.protectedRange?.range?.sheetId === 5));
});
