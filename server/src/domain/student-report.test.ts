import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildStudentWorkbook, safeSpreadsheetText, safeStudentReportFilename } from "./student-report";
import type { StudentLearningReportRow, StudentTuitionReportRow } from "../repositories/student-report.repository";

function learning(overrides: Partial<StudentLearningReportRow> = {}): StudentLearningReportRow {
  return {
    attendanceId: 1, lessonId: 1, sessionDate: "2026-07-01", classId: 1,
    className: "Lớp Toán", lessonType: "REGULAR", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", actualStartTime: "18:05", actualEndTime: "19:45",
    actualDurationMinutes: 100, attendanceStatus: "PRESENT", countsForTuition: true,
    content: "Phân số", homework: "Bài 1", studentNote: "Tiến bộ", lessonNote: "",
    ...overrides,
  };
}

function tuition(overrides: Partial<StudentTuitionReportRow> = {}): StudentTuitionReportRow {
  return {
    cycleId: 1, enrollmentId: 1, cycleNumber: 1, cycleStatus: "PAID", classId: 1,
    className: "Lớp Toán", startedAt: "2026-07-01", reachedTargetAt: "2026-07-08",
    packagePriceSnapshot: 2_400_000, paidAt: "2026-07-09", paidAmount: 2_400_000,
    paymentMethod: "BANK_TRANSFER", paymentNote: "Đã nhận", cycleItemCount: 8,
    sequenceNumber: 1, sessionDate: "2026-07-01", scheduledStartTime: "18:00",
    scheduledEndTime: "19:30", actualStartTime: "18:05", actualEndTime: "19:45",
    actualDurationMinutes: 100, ...overrides,
  };
}

test("spreadsheet text and filename neutralize formulas and unsafe path characters", () => {
  for (const value of ["=SUM(A1:A2)", "+cmd", "-2+3", "@IMPORT"]) assert.equal(safeSpreadsheetText(value), `'${value}`);
  assert.equal(safeSpreadsheetText("Nội dung bình thường"), "Nội dung bình thường");
  assert.equal(safeStudentReportFilename("Nguyễn / Văn: An\r\n.xlsx", "2026-07-21"), "Bao-cao-Nguyen-Van-An-xlsx-20260721.xlsx");
});

test("workbook is chronological, localized, snapshot-based and formula-free", async () => {
  const learningRows = [
    learning({ attendanceId: 3, lessonId: 3, sessionDate: "2026-07-03", attendanceStatus: "FREE", content: "@không chạy" }),
    learning({ attendanceId: 2, lessonId: 2, sessionDate: "2026-07-02", attendanceStatus: "ABSENT", actualStartTime: null, actualEndTime: null, actualDurationMinutes: null }),
    learning({ attendanceId: 1, lessonId: 1, sessionDate: "2026-07-01", attendanceStatus: "PRESENT", content: "=1+1" }),
  ];
  const tuitionRows = Array.from({ length: 8 }, (_, index) => tuition({ sequenceNumber: 8 - index, sessionDate: `2026-07-${String(8 - index).padStart(2, "0")}` }));
  const bytes = await buildStudentWorkbook({
    student: { id: 1, fullName: "Nguyễn Văn An", nickname: "An", parentName: null, parentPhone: null, currentClassName: "Lớp Toán" },
    learningRows, tuitionRows, query: {}, generatedAt: "2026-07-21T00:00:00.000Z",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Quá trình học tập", "Học phí", "Tổng hợp"]);

  const history = workbook.getWorksheet("Quá trình học tập")!;
  assert.deepEqual([history.getCell("I2").value, history.getCell("I3").value, history.getCell("I4").value], ["Có mặt", "Nghỉ", "Miễn phí"]);
  assert.equal(history.getCell("J2").value, "'=1+1");
  assert.equal(history.getCell("J4").value, "'@không chạy");
  assert.equal(history.views[0].state, "frozen");
  assert.ok(history.autoFilter);

  const fees = workbook.getWorksheet("Học phí")!;
  assert.equal(fees.rowCount, 9);
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => fees.getCell(`O${index + 2}`).value), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(fees.getCell("F2").value, 2_400_000);
  assert.equal(fees.getCell("F2").numFmt, '#,##0 "₫"');
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
    assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
  }));
});
