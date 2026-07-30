import ExcelJS from "exceljs";
import type { StudentReportExportQuery } from "@teacher/shared";
import type {
  StudentLearningReportRow,
  StudentReportStudent,
  StudentTuitionReportRow,
} from "../repositories/student-report.repository";

const attendanceLabels = { PRESENT: "Có mặt", ABSENT: "Nghỉ", FREE: "Miễn phí" } as const;
const lessonTypeLabels = { REGULAR: "Buổi thường", MAKEUP: "Buổi học bù", EXTRA: "Buổi học thêm" } as const;

export const studentTuitionSheetHeaders = [
  "Số chu kỳ",
  "Ngày bắt đầu",
  "Ngày đủ 8 buổi",
  "Ngày học",
  "Giờ dự kiến",
  "Số tài khoản (VietinBank)",
] as const;

export function safeSpreadsheetText(value: string | null | undefined): string {
  const text = value ?? "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function filenamePart(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80);
}

export function safeStudentReportFilename(studentName: string, className: string | null, generatedDate: string): string {
  const student = filenamePart(studentName) || "hoc-sinh";
  const classPart = filenamePart(className ?? "") || "Chua-xep-lop";
  return `Bao-cao-${student}-${classPart}-${generatedDate.replace(/-/g, "")}.xlsx`;
}

function excelDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function styleSheet(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const tableBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFB8CBD8" } },
    left: { style: "thin", color: { argb: "FFB8CBD8" } },
    bottom: { style: "thin", color: { argb: "FFB8CBD8" } },
    right: { style: "thin", color: { argb: "FFB8CBD8" } },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.height = 30;
  for (let column = 1; column <= columnCount; column += 1) {
    const cell = header.getCell(column);
    cell.font = { bold: true, color: { argb: "FF17324D" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
    cell.border = tableBorder;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      for (let column = 1; column <= columnCount; column += 1) {
        const cell = row.getCell(column);
        cell.alignment = { vertical: "top", wrapText: true };
        if (rowNumber % 2 === 0)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F8FC" } };
        cell.border = tableBorder;
      }
    }
  });
}

function mergeTuitionCycleCells(
  sheet: ExcelJS.Worksheet,
  rows: StudentTuitionReportRow[],
): void {
  let start = 0;
  while (start < rows.length) {
    let end = start;
    while (end + 1 < rows.length && rows[end + 1].cycleId === rows[start].cycleId) end += 1;
    if (end > start) {
      for (const key of ["cycle", "started", "reached", "accountNumber"]) {
        const column = sheet.getColumn(key).number;
        sheet.mergeCells(start + 2, column, end + 2, column);
        sheet.getCell(start + 2, column).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      }
    }
    start = end + 1;
  }
}

function highlightAbsentLearningRows(
  sheet: ExcelJS.Worksheet,
  rows: StudentLearningReportRow[],
  columnCount: number,
): void {
  rows.forEach((source, index) => {
    if (source.attendanceStatus !== "ABSENT") return;
    const row = sheet.getRow(index + 2);
    for (let column = 1; column <= columnCount; column += 1) {
      const cell = row.getCell(column);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDADA" } };
      cell.font = { ...cell.font, color: { argb: "FF8A1C1C" } };
    }
  });
}

export interface StudentWorkbookInput {
  student: StudentReportStudent;
  learningRows: StudentLearningReportRow[];
  tuitionRows: StudentTuitionReportRow[];
  query: StudentReportExportQuery;
  generatedAt: string;
  vietinBankAccountNumber: string;
}

export async function buildStudentWorkbook(input: StudentWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teacher Class Hub";
  workbook.created = new Date(input.generatedAt);
  workbook.modified = new Date(input.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = false;

  const learning = workbook.addWorksheet("Quá trình học tập", { properties: { defaultRowHeight: 20 } });
  learning.columns = [
    { header: "Ngày học", key: "date", width: 13 }, { header: "Lớp", key: "class", width: 14 },
    { header: "Loại buổi", key: "type", width: 18 }, { header: "Giờ dự kiến bắt đầu", key: "scheduledStart", width: 18 },
    { header: "Giờ dự kiến kết thúc", key: "scheduledEnd", width: 18 }, { header: "Trạng thái", key: "status", width: 14 },
    { header: "Nội dung buổi học", key: "content", width: 38 },
    { header: "Bài tập về nhà", key: "homework", width: 34 }, { header: "Nhận xét học sinh", key: "studentNote", width: 32 },
  ];
  const orderedLearningRows = [...input.learningRows].sort((left, right) =>
    left.sessionDate.localeCompare(right.sessionDate) ||
    (left.actualStartTime ?? left.scheduledStartTime).localeCompare(right.actualStartTime ?? right.scheduledStartTime) ||
    left.scheduledStartTime.localeCompare(right.scheduledStartTime) || left.lessonId - right.lessonId || left.attendanceId - right.attendanceId,
  );
  for (const row of orderedLearningRows) learning.addRow({
    date: excelDate(row.sessionDate), class: safeSpreadsheetText(row.className),
    type: lessonTypeLabels[row.lessonType], scheduledStart: row.scheduledStartTime,
    scheduledEnd: row.scheduledEndTime,
    status: attendanceLabels[row.attendanceStatus], content: safeSpreadsheetText(row.content),
    homework: safeSpreadsheetText(row.homework), studentNote: safeSpreadsheetText(row.studentNote),
  });
  learning.getColumn("date").numFmt = "dd/mm/yyyy";
  styleSheet(learning, 9);
  highlightAbsentLearningRows(learning, orderedLearningRows, 9);

  const tuition = workbook.addWorksheet("Học phí", { properties: { defaultRowHeight: 20 } });
  tuition.columns = [
    { header: studentTuitionSheetHeaders[0], key: "cycle", width: 12 },
    { header: studentTuitionSheetHeaders[1], key: "started", width: 14 },
    { header: studentTuitionSheetHeaders[2], key: "reached", width: 16 },
    { header: studentTuitionSheetHeaders[3], key: "date", width: 13 },
    { header: studentTuitionSheetHeaders[4], key: "scheduled", width: 20 },
    { header: studentTuitionSheetHeaders[5], key: "accountNumber", width: 26 },
  ];
  const orderedTuitionRows = [...input.tuitionRows].sort((left, right) =>
    left.cycleNumber - right.cycleNumber || left.cycleId - right.cycleId || left.sequenceNumber - right.sequenceNumber,
  );
  for (const row of orderedTuitionRows) tuition.addRow({
    cycle: row.cycleNumber,
    started: excelDate(row.startedAt), reached: excelDate(row.reachedTargetAt),
    date: excelDate(row.sessionDate), scheduled: `${row.scheduledStartTime} – ${row.scheduledEndTime}`,
    accountNumber: safeSpreadsheetText(input.vietinBankAccountNumber),
  });
  for (const key of ["started", "reached", "date"]) tuition.getColumn(key).numFmt = "dd/mm/yyyy";
  styleSheet(tuition, 6);
  mergeTuitionCycleCells(tuition, orderedTuitionRows);

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}
