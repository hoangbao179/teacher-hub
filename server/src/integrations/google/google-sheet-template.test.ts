import assert from "node:assert/strict";
import test from "node:test";
import { GoogleSheetTemplateService, safeGoogleCell } from "./google-sheet-template.service";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const snapshot: StudentGoogleSheetSnapshot = {
  student: { id: 7, fullName: "=Tên thử", currentClass: "Lớp 6", currentGrade: "Khối 6", currentAcademicYear: "2026–2027" },
  overview: { currentProgress: 8, attendanceRate: 50, latestLesson: "2026-07-20", tuitionStatus: "Cần thu",
    latestComment: "+nhận xét", latestHomework: "@bài tập", teacher: "Cô Vy" },
  learning: [
    { lessonId: 10, academicYear: "2026–2027", grade: "Khối 6", className: "Lớp 6", date: "2026-07-20",
      lessonType: "REGULAR", scheduledStartTime: "18:00", scheduledEndTime: "19:30",
      attendance: "ABSENT", billable: false, cycleId: null, cycleSequence: null, content: "-nội dung", homework: "=homework",
      generalComment: "Không được hiện", studentComment: "Nghỉ có phép", updatedAt: "2026-07-20T20:00:00+07:00" },
  ],
  tuition: [{ cycleId: 3, cycleNumber: 1, academicYear: "2026–2027", className: "Lớp 5 → Lớp 6", fromDate: "2026-06-01",
    toDate: "2026-07-20", billableCount: 8, absentCount: 2, totalLessonCount: 10, packagePrice: 2000000,
    status: "PAYMENT_DUE", paidAt: "", paymentMethod: "", startedAt: "2026-06-01", reachedTargetAt: "2026-07-20",
    sessions: [
      { sequenceNumber: 2, sessionDate: "2026-06-08", scheduledStartTime: "18:00", scheduledEndTime: "19:30" },
      { sequenceNumber: 1, sessionDate: "2026-06-01", scheduledStartTime: "18:00", scheduledEndTime: "19:30" },
    ] }],
  vocabularyAttempts: [],
};

test("formula-like Google cell text is escaped", () => {
  for (const prefix of ["=", "+", "-", "@"]) assert.equal(safeGoogleCell(`${prefix}value`), `'${prefix}value`);
});

test("template renders only the two visible Excel-equivalent sheets and protects technical metadata", () => {
  const template = new GoogleSheetTemplateService("123456789012");
  const plan = template.build(snapshot, "sheet-1",
    { "Quá trình học tập": 2, "Học phí": 3, _TeacherHub: 5 },
    { templateVersion: "v4", generatedAt: "2026-07-26T00:00:00Z" });
  assert.equal(plan.values.length, 3);
  assert.deepEqual(template.sheetNames, ["Quá trình học tập", "Học phí", "_TeacherHub"]);
  assert.deepEqual(template.obsoleteSheetNames, ["Tổng quan", "Nhật ký học tập", "Ôn từ vựng"]);
  assert.deepEqual(template.renamedSheetNames, { "Nhật ký học tập": "Quá trình học tập" });
  assert.deepEqual(plan.clearRanges, ["'Quá trình học tập'!A:N", "'Học phí'!A:M"]);
  assert.ok(!plan.values.some((item) => item.range?.includes("Tổng quan") || item.range?.includes("Ôn từ vựng")));
  const learning = plan.values.find((item) => item.range?.includes("Quá trình"))!.values!;
  assert.deepEqual(learning[0], ["Teacher Hub Lesson ID", "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu",
    "Giờ dự kiến kết thúc", "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh"]);
  assert.equal(learning[1].length, 10);
  assert.equal(learning[1][3], "Buổi thường");
  assert.equal(learning[1][7], "'-nội dung");
  assert.equal(learning[1][9], "Nghỉ có phép");
  assert.ok(!learning[1].includes("Không được hiện"));
  const tuition = plan.values.find((item) => item.range?.includes("Học phí"))!.values!;
  assert.deepEqual(tuition[0], ["Số chu kỳ", "Ngày bắt đầu", "Ngày đủ 8 buổi", "Ngày học", "Giờ dự kiến", "Số tài khoản (VietinBank)"]);
  assert.deepEqual(tuition[1], [1, "01/06/2026", "20/07/2026", "01/06/2026", "18:00 – 19:30", "123456789012"]);
  assert.deepEqual(tuition[2], ["", "", "", "08/06/2026", "18:00 – 19:30", ""]);
  assert.equal(plan.values.find((item) => item.range?.includes("Học phí"))!.range, "'Học phí'!A1:F");
  assert.ok(!plan.requests.some((item) => item.setBasicFilter));
  assert.equal(plan.requests.filter((item) => item.clearBasicFilter).length, 2);
  const header = plan.requests.find((item) => item.repeatCell?.range?.sheetId === 2
    && item.repeatCell.range.startRowIndex === 0)!;
  assert.deepEqual(header.repeatCell?.cell?.userEnteredFormat?.backgroundColor,
    { red: 217 / 255, green: 234 / 255, blue: 247 / 255 });
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 2
    && item.updateDimensionProperties.range.startIndex === 7 && item.updateDimensionProperties.properties?.pixelSize === 300));
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 2
    && item.updateDimensionProperties.range.startIndex === 9 && item.updateDimensionProperties.properties?.pixelSize === 200));
  assert.ok(plan.requests.some((item) => item.addProtectedRange?.protectedRange?.range?.sheetId === 5));
  assert.ok(plan.requests.some((item) => item.updateSheetProperties?.properties?.hidden === true));
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 3
    && item.updateDimensionProperties.range.startIndex === 0
    && item.updateDimensionProperties.properties?.hiddenByUser === false));
  assert.ok(plan.requests.some((item) => item.repeatCell?.range?.sheetId === 3
    && item.repeatCell.range.startColumnIndex === 6 && item.repeatCell.range.endColumnIndex === 13
    && item.repeatCell.fields === "userEnteredFormat"));
});
