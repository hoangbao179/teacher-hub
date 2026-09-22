import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildStudentWorkbook, safeSpreadsheetText, safeStudentReportFilename } from "./student-report";
import type { StudentLearningReportRow } from "../repositories/student-report.repository";

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

test("spreadsheet text and filename neutralize formulas and unsafe path characters", () => {
  for (const value of ["=SUM(A1:A2)", "+cmd", "-2+3", "@IMPORT"]) assert.equal(safeSpreadsheetText(value), `'${value}`);
  assert.equal(safeSpreadsheetText("Nội dung bình thường"), "Nội dung bình thường");
  assert.equal(safeStudentReportFilename("Nguyễn / Văn: An\r\n.xlsx", "Lớp 3A", "2026-07-21"),
    "Bao-cao-Nguyen-Van-An-xlsx-Lop-3A-20260721.xlsx");
});

test("workbook is chronological, localized, snapshot-based and formula-free", async () => {
  const learningRows = [
    learning({ attendanceId: 3, lessonId: 3, sessionDate: "2026-07-03", attendanceStatus: "PRESENT", content: "@không chạy" }),
    learning({ attendanceId: 2, lessonId: 2, sessionDate: "2026-07-02", attendanceStatus: "ABSENT", actualStartTime: null, actualEndTime: null, actualDurationMinutes: null, homework: null }),
    learning({ attendanceId: 1, lessonId: 1, sessionDate: "2026-07-01", attendanceStatus: "PRESENT", content: "=1+1" }),
  ];
  const bytes = await buildStudentWorkbook({
    student: { id: 1, fullName: "Nguyễn Văn An", nickname: "An", parentName: null, parentPhone: null, currentClassName: "Lớp Toán" },
    learningRows, query: {}, generatedAt: "2026-07-21T00:00:00.000Z",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Quá trình học tập"]);

  const history = workbook.getWorksheet("Quá trình học tập")!;
  const headerValues = history.getRow(1).values;
  assert.ok(Array.isArray(headerValues));
  assert.deepEqual(headerValues.slice(1), [
    "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu", "Giờ dự kiến kết thúc",
    "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh",
  ]);
  assert.equal(history.getColumn(2).width, 14);
  assert.deepEqual([history.getCell("F2").value, history.getCell("F3").value, history.getCell("F4").value], ["Có mặt", "Nghỉ", "Có mặt"]);
  assert.equal(history.getCell("G2").value, "'=1+1");
  assert.equal(history.getCell("G4").value, "'@không chạy");
  for (let column = 1; column <= 9; column += 1) {
    const absentFill = history.getRow(3).getCell(column).fill;
    assert.equal(absentFill.type === "pattern" ? absentFill.fgColor?.argb : undefined, "FFFFDADA");
  }
  assert.equal(history.columnCount, 9);
  const outsideTableFill = history.getCell("J3").fill;
  assert.notEqual(outsideTableFill?.type === "pattern" ? outsideTableFill.fgColor?.argb : undefined, "FFFFDADA");
  for (const address of ["J1", "J2", "J3"]) assert.notEqual(history.getCell(address).fill?.type, "pattern");
  for (let column = 1; column <= 9; column += 1) {
    assert.equal(history.getRow(1).getCell(column).fill.type, "pattern");
    assert.equal(history.getRow(2).getCell(column).fill.type, "pattern");
    assert.equal(history.getRow(3).getCell(column).fill.type, "pattern");
  }
  const headerFill = history.getCell("A1").fill;
  assert.equal(headerFill.type, "pattern");
  assert.equal(headerFill.type === "pattern" ? headerFill.fgColor?.argb : undefined, "FFD9EAF7");
  for (let row = 1; row <= history.rowCount; row += 1) {
    for (let column = 1; column <= 9; column += 1) {
      assert.equal(history.getRow(row).getCell(column).border.bottom?.style, "thin");
    }
  }
  assert.equal(history.views[0].state, "frozen");
  assert.equal(history.autoFilter, undefined);

  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
    assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
  }));
  for (const sheet of workbook.worksheets) assert.equal(sheet.autoFilter, undefined);
});
