import ExcelJS from "exceljs";
import type { StudentReportExportQuery } from "@teacher/shared";
import type {
  StudentLearningReportRow,
  StudentReportStudent,
  StudentTuitionReportRow,
} from "../repositories/student-report.repository";

const attendanceLabels = { PRESENT: "Có mặt", ABSENT: "Nghỉ", FREE: "Miễn phí" } as const;
const lessonTypeLabels = { REGULAR: "Buổi thường", MAKEUP: "Buổi học bù", EXTRA: "Buổi học thêm" } as const;
const cycleStatusLabels = { ACCUMULATING: "Đang tích lũy", PAYMENT_DUE: "Cần thu", PAID: "Đã thu", INCOMPLETE: "Chưa hoàn thành" } as const;
const paymentLabels = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" } as const;

export function safeSpreadsheetText(value: string | null | undefined): string {
  const text = value ?? "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function safeStudentReportFilename(studentName: string, generatedDate: string): string {
  const slug = studentName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80) || "hoc-sinh";
  return `Bao-cao-${slug}-${generatedDate.replace(/-/g, "")}.xlsx`;
}

function excelDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function rangeText(query: StudentReportExportQuery): string {
  if (!query.fromDate && !query.toDate) return "Toàn bộ lịch sử";
  return `${query.fromDate ?? "đầu kỳ"} – ${query.toDate ?? "hiện tại"}`;
}

function styleSheet(sheet: ExcelJS.Worksheet, columnCount: number): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B35D5" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "top", wrapText: true };
      if (rowNumber % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F5FF" } };
    }
  });
}

export interface StudentWorkbookInput {
  student: StudentReportStudent;
  learningRows: StudentLearningReportRow[];
  tuitionRows: StudentTuitionReportRow[];
  query: StudentReportExportQuery;
  generatedAt: string;
}

export async function buildStudentWorkbook(input: StudentWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teacher Class Hub";
  workbook.created = new Date(input.generatedAt);
  workbook.modified = new Date(input.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = false;

  const learning = workbook.addWorksheet("Quá trình học tập", { properties: { defaultRowHeight: 20 } });
  learning.columns = [
    { header: "Ngày học", key: "date", width: 13 }, { header: "Lớp", key: "class", width: 24 },
    { header: "Loại buổi", key: "type", width: 18 }, { header: "Giờ dự kiến bắt đầu", key: "scheduledStart", width: 18 },
    { header: "Giờ dự kiến kết thúc", key: "scheduledEnd", width: 18 }, { header: "Giờ thực tế bắt đầu", key: "actualStart", width: 18 },
    { header: "Giờ thực tế kết thúc", key: "actualEnd", width: 18 }, { header: "Thời lượng thực tế (phút)", key: "duration", width: 19 },
    { header: "Trạng thái", key: "status", width: 14 }, { header: "Nội dung buổi học", key: "content", width: 38 },
    { header: "Bài tập về nhà", key: "homework", width: 34 }, { header: "Nhận xét học sinh", key: "studentNote", width: 32 },
    { header: "Ghi chú chung", key: "lessonNote", width: 30 },
  ];
  const orderedLearningRows = [...input.learningRows].sort((left, right) =>
    left.sessionDate.localeCompare(right.sessionDate) ||
    (left.actualStartTime ?? left.scheduledStartTime).localeCompare(right.actualStartTime ?? right.scheduledStartTime) ||
    left.scheduledStartTime.localeCompare(right.scheduledStartTime) || left.lessonId - right.lessonId || left.attendanceId - right.attendanceId,
  );
  for (const row of orderedLearningRows) learning.addRow({
    date: excelDate(row.sessionDate), class: safeSpreadsheetText(row.className),
    type: lessonTypeLabels[row.lessonType], scheduledStart: row.scheduledStartTime,
    scheduledEnd: row.scheduledEndTime, actualStart: row.actualStartTime ?? "—",
    actualEnd: row.actualEndTime ?? "—", duration: row.actualDurationMinutes,
    status: attendanceLabels[row.attendanceStatus], content: safeSpreadsheetText(row.content),
    homework: safeSpreadsheetText(row.homework), studentNote: safeSpreadsheetText(row.studentNote),
    lessonNote: safeSpreadsheetText(row.lessonNote),
  });
  learning.getColumn("date").numFmt = "dd/mm/yyyy";
  styleSheet(learning, learning.columnCount);

  const tuition = workbook.addWorksheet("Học phí", { properties: { defaultRowHeight: 20 } });
  tuition.columns = [
    { header: "Số chu kỳ", key: "cycle", width: 12 }, { header: "Trạng thái chu kỳ", key: "status", width: 20 },
    { header: "Lớp", key: "class", width: 24 }, { header: "Ngày bắt đầu", key: "started", width: 14 },
    { header: "Ngày đủ 8 buổi", key: "reached", width: 16 }, { header: "Giá gói đã chốt", key: "price", width: 20 },
    { header: "Ngày thanh toán", key: "paidAt", width: 16 }, { header: "Phương thức thanh toán", key: "method", width: 22 },
    { header: "Ghi chú thanh toán", key: "paymentNote", width: 30 }, { header: "Tổng buổi trong chu kỳ", key: "itemCount", width: 20 },
    { header: "Ngày học", key: "date", width: 13 }, { header: "Giờ dự kiến", key: "scheduled", width: 20 },
    { header: "Giờ thực tế", key: "actual", width: 20 }, { header: "Thời lượng thực tế (phút)", key: "duration", width: 19 },
    { header: "Thứ tự buổi", key: "sequence", width: 14 },
  ];
  const orderedTuitionRows = [...input.tuitionRows].sort((left, right) =>
    left.cycleNumber - right.cycleNumber || left.cycleId - right.cycleId || left.sequenceNumber - right.sequenceNumber,
  );
  for (const row of orderedTuitionRows) tuition.addRow({
    cycle: row.cycleNumber, status: cycleStatusLabels[row.cycleStatus], class: safeSpreadsheetText(row.className),
    started: excelDate(row.startedAt), reached: excelDate(row.reachedTargetAt), price: row.packagePriceSnapshot,
    paidAt: excelDate(row.paidAt), method: row.paymentMethod ? paymentLabels[row.paymentMethod] : "—",
    paymentNote: safeSpreadsheetText(row.paymentNote), itemCount: row.cycleItemCount,
    date: excelDate(row.sessionDate), scheduled: `${row.scheduledStartTime} – ${row.scheduledEndTime}`,
    actual: row.actualStartTime && row.actualEndTime ? `${row.actualStartTime} – ${row.actualEndTime}` : "—",
    duration: row.actualDurationMinutes, sequence: row.sequenceNumber,
  });
  for (const key of ["started", "reached", "paidAt", "date"]) tuition.getColumn(key).numFmt = "dd/mm/yyyy";
  tuition.getColumn("price").numFmt = '#,##0 "₫"';
  styleSheet(tuition, tuition.columnCount);

  const summary = workbook.addWorksheet("Tổng hợp", { properties: { defaultRowHeight: 22 } });
  const uniqueCycles = new Map(input.tuitionRows.map((row) => [row.cycleId, row]));
  const paidCycles = [...uniqueCycles.values()].filter((row) => row.cycleStatus === "PAID");
  const unpaidCycles = [...uniqueCycles.values()].filter((row) => row.cycleStatus === "PAYMENT_DUE");
  const count = (status: StudentLearningReportRow["attendanceStatus"]) => input.learningRows.filter((row) => row.attendanceStatus === status).length;
  summary.columns = [{ header: "Thông tin", key: "label", width: 34 }, { header: "Giá trị", key: "value", width: 42 }];
  [
    ["Học sinh", safeSpreadsheetText(input.student.fullName)], ["Lớp hiện tại", safeSpreadsheetText(input.student.currentClassName) || "—"],
    ["Phạm vi báo cáo", rangeText(input.query)], ["Tổng lượt học/điểm danh", input.learningRows.length],
    ["Có mặt", count("PRESENT")], ["Nghỉ", count("ABSENT")], ["Miễn phí", count("FREE")],
    ["Chu kỳ đã thu", paidCycles.length], ["Tổng tiền đã thu", paidCycles.reduce((sum, row) => sum + (row.paidAmount ?? 0), 0)],
    ["Khoản hiện cần thu", unpaidCycles.reduce((sum, row) => sum + row.packagePriceSnapshot, 0)],
    ["Ghi chú", "Thời lượng thực tế chỉ dùng theo dõi, không quy đổi thêm buổi học phí."],
  ].forEach(([label, value]) => summary.addRow({ label, value }));
  summary.getCell("B10").numFmt = '#,##0 "₫"';
  summary.getCell("B11").numFmt = '#,##0 "₫"';
  styleSheet(summary, summary.columnCount);

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}
