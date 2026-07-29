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
      attendance: "ABSENT", billable: false, cycleSequence: null, content: "-nội dung", homework: "=homework",
      generalComment: "Không được hiện", studentComment: "Nghỉ có phép", updatedAt: "2026-07-20T20:00:00+07:00" },
  ],
  tuition: [{ cycleId: 3, cycleNumber: 1, academicYear: "2026–2027", className: "Lớp 5 → Lớp 6", fromDate: "2026-06-01",
    toDate: "2026-07-20", billableCount: 8, absentCount: 2, totalLessonCount: 10, packagePrice: 2000000,
    status: "PAYMENT_DUE", paidAt: "", paymentMethod: "" }],
  vocabularyAttempts: [],
};

test("formula-like Google cell text is escaped", () => {
  for (const prefix of ["=", "+", "-", "@"]) assert.equal(safeGoogleCell(`${prefix}value`), `'${prefix}value`);
});

test("template aligns learning log with Excel export and protects technical metadata", () => {
  const template = new GoogleSheetTemplateService();
  const plan = template.build(snapshot, "sheet-1",
    { "Nhật ký học tập": 2, "Học phí": 3, "Ôn từ vựng": 4, _TeacherHub: 5 },
    { templateVersion: "v3", generatedAt: "2026-07-26T00:00:00Z" });
  assert.equal(plan.values.length, 4);
  assert.deepEqual(template.sheetNames, ["Nhật ký học tập", "Học phí", "Ôn từ vựng", "_TeacherHub"]);
  assert.deepEqual(template.obsoleteSheetNames, ["Tổng quan"]);
  assert.deepEqual(plan.clearRanges, ["'Nhật ký học tập'!A:N"]);
  assert.ok(!plan.values.some((item) => item.range?.includes("Tổng quan")));
  const learning = plan.values.find((item) => item.range?.includes("Nhật ký"))!.values!;
  assert.deepEqual(learning[0], ["Teacher Hub Lesson ID", "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu",
    "Giờ dự kiến kết thúc", "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh"]);
  assert.equal(learning[1].length, 10);
  assert.equal(learning[1][3], "Buổi thường");
  assert.equal(learning[1][7], "'-nội dung");
  assert.equal(learning[1][9], "Nghỉ có phép");
  assert.ok(!learning[1].includes("Không được hiện"));
  const tuition = plan.values.find((item) => item.range?.includes("Học phí"))!.values!;
  assert.equal(tuition[1][1], "Chu kỳ 1 · 8/8");
  assert.equal(tuition[1][7], 2);
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 2
    && item.updateDimensionProperties.range.startIndex === 7 && item.updateDimensionProperties.properties?.pixelSize === 300));
  assert.ok(plan.requests.some((item) => item.updateDimensionProperties?.range?.sheetId === 2
    && item.updateDimensionProperties.range.startIndex === 9 && item.updateDimensionProperties.properties?.pixelSize === 200));
  assert.ok(plan.requests.some((item) => item.addProtectedRange?.protectedRange?.range?.sheetId === 5));
  assert.ok(plan.requests.some((item) => item.updateSheetProperties?.properties?.hidden === true));
});
