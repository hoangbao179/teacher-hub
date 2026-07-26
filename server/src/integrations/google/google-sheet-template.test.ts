import assert from "node:assert/strict";
import test from "node:test";
import { GoogleSheetTemplateService, safeGoogleCell } from "./google-sheet-template.service";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const snapshot: StudentGoogleSheetSnapshot = {
  student: { id: 7, fullName: "=Tên thử", currentClass: "Lớp 6", currentGrade: "Khối 6", currentAcademicYear: "2026–2027" },
  overview: { currentProgress: 8, attendanceRate: 50, latestLesson: "2026-07-20", tuitionStatus: "Cần thu",
    latestComment: "+nhận xét", latestHomework: "@bài tập", teacher: "Cô Vy" },
  learning: [
    { lessonId: 10, academicYear: "2026–2027", grade: "Khối 6", className: "Lớp 6", date: "2026-07-20", time: "18:00–19:30",
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

test("template renders five sheets, parent-safe absence and protected technical metadata", () => {
  const plan = new GoogleSheetTemplateService().build(snapshot, "sheet-1",
    { "Tổng quan": 1, "Nhật ký học tập": 2, "Học phí": 3, "Ôn từ vựng": 4, _TeacherHub: 5 },
    { templateVersion: "v2", generatedAt: "2026-07-26T00:00:00Z" });
  assert.equal(plan.values.length, 5);
  const learning = plan.values.find((item) => item.range?.includes("Nhật ký"))!.values!;
  assert.equal(learning[1][11], "");
  assert.equal(learning[1][9], "'-nội dung");
  const tuition = plan.values.find((item) => item.range?.includes("Học phí"))!.values!;
  assert.equal(tuition[1][1], "Chu kỳ 1 · 8/8");
  assert.equal(tuition[1][7], 2);
  assert.ok(plan.requests.some((item) => item.addProtectedRange?.protectedRange?.range?.sheetId === 5));
  assert.ok(plan.requests.some((item) => item.updateSheetProperties?.properties?.hidden === true));
});
