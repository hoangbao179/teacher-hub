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
    learning({ attendanceId: 2, lessonId: 2, sessionDate: "2026-07-02", attendanceStatus: "ABSENT", actualStartTime: null, actualEndTime: null, actualDurationMinutes: null, homework: null }),
    learning({ attendanceId: 1, lessonId: 1, sessionDate: "2026-07-01", attendanceStatus: "PRESENT", content: "=1+1" }),
  ];
  const tuitionRows = Array.from({ length: 8 }, (_, index) => tuition({ sequenceNumber: 8 - index, sessionDate: `2026-07-${String(8 - index).padStart(2, "0")}` }));
  const bytes = await buildStudentWorkbook({
    student: { id: 1, fullName: "Nguyễn Văn An", nickname: "An", parentName: null, parentPhone: null, currentClassName: "Lớp Toán" },
    learningRows, tuitionRows, query: {}, generatedAt: "2026-07-21T00:00:00.000Z",
    vietinBankAccountNumber: "123456789012",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Quá trình học tập", "Học phí"]);

  const history = workbook.getWorksheet("Quá trình học tập")!;
  const headerValues = history.getRow(1).values;
  assert.ok(Array.isArray(headerValues));
  assert.deepEqual(headerValues.slice(1), [
    "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu", "Giờ dự kiến kết thúc",
    "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh",
  ]);
  assert.equal(history.getColumn(2).width, 14);
  assert.deepEqual([history.getCell("F2").value, history.getCell("F3").value, history.getCell("F4").value], ["Có mặt", "Nghỉ", "Miễn phí"]);
  assert.equal(history.getCell("G2").value, "'=1+1");
  assert.equal(history.getCell("G4").value, "'@không chạy");
  for (let column = 1; column <= 9; column += 1) {
    const absentFill = history.getRow(3).getCell(column).fill;
    assert.equal(absentFill.type === "pattern" ? absentFill.fgColor?.argb : undefined, "FFFFDADA");
  }
  assert.equal(history.columnCount, 9);
  const outsideTableFill = history.getCell("J3").fill;
  assert.notEqual(outsideTableFill.type === "pattern" ? outsideTableFill.fgColor?.argb : undefined, "FFFFDADA");
  const headerFill = history.getCell("A1").fill;
  assert.equal(headerFill.type, "pattern");
  assert.equal(headerFill.type === "pattern" ? headerFill.fgColor?.argb : undefined, "FFD9EAF7");
  for (let row = 1; row <= history.rowCount; row += 1) {
    for (let column = 1; column <= 9; column += 1) {
      assert.equal(history.getRow(row).getCell(column).border.bottom?.style, "thin");
    }
  }
  assert.equal(history.views[0].state, "frozen");
  assert.ok(history.autoFilter);

  const fees = workbook.getWorksheet("Học phí")!;
  assert.equal(fees.rowCount, 9);
  const feeHeaders = fees.getRow(1).values;
  assert.ok(Array.isArray(feeHeaders));
  assert.deepEqual(feeHeaders.slice(1), [
    "Số chu kỳ", "Ngày bắt đầu", "Ngày đủ 8 buổi", "Ngày học", "Giờ dự kiến", "Số tài khoản (VietinBank)",
  ]);
  for (const range of ["A2:A9", "B2:B9", "C2:C9", "F2:F9"]) assert.ok(fees.getCell(range.split(":")[1]).isMerged);
  assert.equal(fees.getCell("A9").master.address, "A2");
  assert.equal(fees.getCell("B9").master.address, "B2");
  assert.equal(fees.getCell("C9").master.address, "C2");
  assert.equal(fees.getCell("F9").master.address, "F2");
  assert.equal(fees.getCell("F2").value, "123456789012");
  for (const address of ["A2", "B2", "C2", "F2"]) {
    assert.equal(fees.getCell(address).alignment.horizontal, "center");
    assert.equal(fees.getCell(address).alignment.vertical, "middle");
  }
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
    assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
  }));
});
