import type { sheets_v4 } from "googleapis";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const attendanceLabels = { PRESENT: "Có mặt", ABSENT: "Nghỉ", FREE: "Miễn phí" } as const;
const lessonTypeLabels = { REGULAR: "Buổi thường", MAKEUP: "Buổi học bù", EXTRA: "Buổi học thêm" } as const;
const tuitionLabels = { ACCUMULATING: "Đang tích lũy", PAYMENT_DUE: "Cần thu", PAID: "Đã thu", INCOMPLETE: "Chưa hoàn thành" } as const;
const paymentLabels = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản", "": "" } as const;
const names = [
  "Nhật ký học tập",
  "Học phí",
  "Ôn từ vựng",
  "_TeacherHub",
] as const;

export function googleLearningRowValues(row: StudentGoogleSheetSnapshot["learning"][number]): Array<string | number | boolean> {
  return [row.lessonId, row.date, safeGoogleCell(row.className), lessonTypeLabels[row.lessonType],
    row.scheduledStartTime, row.scheduledEndTime, attendanceLabels[row.attendance], safeGoogleCell(row.content),
    safeGoogleCell(row.homework), safeGoogleCell(row.studentComment)];
}

export function googleVocabularyAttemptRowValues(
  row: StudentGoogleSheetSnapshot["vocabularyAttempts"][number],
): Array<string | number | boolean> {
  return [row.attemptId, row.completedAt, safeGoogleCell(row.assignmentTitle), safeGoogleCell(row.className),
    safeGoogleCell(row.ageBand), row.attemptNumber, row.scoredQuestionCount, row.correctFirstTry,
    row.finalCorrect, row.scorePercent ?? "", row.masteredWords, row.learningWords,
    row.needsReviewWords, safeGoogleCell(row.reviewWordList), safeGoogleCell(row.status), row.updatedAt];
}

export function safeGoogleCell(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function headerRequest(sheetId: number, columns: number): sheets_v4.Schema$Request {
  return { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns },
    cell: { userEnteredFormat: { backgroundColor: { red: 0.42, green: 0.31, blue: 0.72 },
      textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
      horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
    fields: "userEnteredFormat" } };
}

function tableRequests(sheetId: number, columns: number, rows: number): sheets_v4.Schema$Request[] {
  return [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    headerRequest(sheetId, columns),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: Math.max(rows, 2), startColumnIndex: 0, endColumnIndex: columns } } } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(rows, 2), startColumnIndex: 0, endColumnIndex: columns },
      cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
    { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: Math.max(rows, 2), startColumnIndex: 0, endColumnIndex: columns }],
      booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=ISEVEN(ROW())" }] },
        format: { backgroundColor: { red: 0.97, green: 0.96, blue: 1 } } } } } },
  ];
}

export interface GoogleTemplatePlan {
  values: sheets_v4.Schema$ValueRange[];
  clearRanges: string[];
  requests: sheets_v4.Schema$Request[];
}

export class GoogleSheetTemplateService {
  readonly sheetNames = [...names];
  readonly obsoleteSheetNames = ["Tổng quan"];

  build(snapshot: StudentGoogleSheetSnapshot, spreadsheetId: string, ids: Record<string, number>, metadata: {
    templateVersion: string; generatedAt: string; syncedAt?: string | null;
  }): GoogleTemplatePlan {
    for (const name of names) if (ids[name] == null) throw new Error(`Missing template sheet: ${name}`);
    const learning = [["Teacher Hub Lesson ID", "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu",
      "Giờ dự kiến kết thúc", "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh"],
      ...snapshot.learning.map(googleLearningRowValues)];
    const tuition = [["Teacher Hub Tuition Cycle ID", "Chu kỳ", "Năm học", "Lớp", "Từ ngày", "Đến ngày", "Số buổi tính phí",
      "Số buổi nghỉ", "Tổng lịch học", "Mức học phí", "Trạng thái", "Ngày thu", "Hình thức thanh toán"],
      ...snapshot.tuition.map((row) => [row.cycleId, `Chu kỳ ${row.cycleNumber} · ${row.billableCount}/8`, row.academicYear,
        safeGoogleCell(row.className), row.fromDate, row.toDate, row.billableCount, row.absentCount, row.totalLessonCount,
        row.packagePrice, tuitionLabels[row.status], row.paidAt, paymentLabels[row.paymentMethod]])];
    const vocabulary = [[
      "Teacher Hub Attempt ID", "Ngày hoàn thành", "Tên bài", "Lớp",
      "Nhóm tuổi", "Lần làm", "Số câu tính điểm", "Đúng lần đầu",
      "Đúng cuối cùng", "Điểm", "Số từ đã nhớ", "Số từ đang học",
      "Số từ cần ôn", "Danh sách từ cần ôn", "Trạng thái", "Cập nhật lúc",
    ], ...snapshot.vocabularyAttempts.map(googleVocabularyAttemptRowValues)];
    const technical = [["key", "value"], ["schemaVersion", "1"], ["templateVersion", metadata.templateVersion],
      ["studentId", snapshot.student.id], ["spreadsheetId", spreadsheetId], ["lastGeneratedAt", metadata.generatedAt],
      ["lastSyncedAt", metadata.syncedAt ?? ""]];
    const values: sheets_v4.Schema$ValueRange[] = [
      { range: "'Nhật ký học tập'!A1:J", values: learning },
      { range: "'Học phí'!A1:M", values: tuition }, { range: "'_TeacherHub'!A1:B100", values: technical },
      { range: "'Ôn từ vựng'!A1:P", values: vocabulary },
    ];
    const learningId = ids["Nhật ký học tập"];
    const tuitionId = ids["Học phí"];
    const technicalId = ids._TeacherHub;
    const vocabularyId = ids["Ôn từ vựng"];
    const requests: sheets_v4.Schema$Request[] = [
      ...tableRequests(learningId, 10, learning.length), ...tableRequests(tuitionId, 13, tuition.length),
      ...tableRequests(vocabularyId, 16, vocabulary.length),
      { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId: learningId, startRowIndex: 1, endRowIndex: Math.max(learning.length, 2), startColumnIndex: 6, endColumnIndex: 7 }],
        booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Nghỉ" }] },
          format: { backgroundColor: { red: 1, green: 0.94, blue: 0.78 } } } } } },
      { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId: tuitionId, startRowIndex: 1, endRowIndex: Math.max(tuition.length, 2), startColumnIndex: 10, endColumnIndex: 11 }],
        booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Cần thu" }] },
          format: { backgroundColor: { red: 1, green: 0.94, blue: 0.72 }, textFormat: { bold: true } } } } } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 },
        properties: { pixelSize: 300 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 9, endIndex: 10 },
        properties: { pixelSize: 200 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId: tuitionId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
      { updateDimensionProperties: { range: { sheetId: vocabularyId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
      { updateSheetProperties: { properties: { sheetId: technicalId, hidden: true }, fields: "hidden" } },
      { addProtectedRange: { protectedRange: { range: { sheetId: technicalId }, description: "Teacher Hub metadata",
        warningOnly: false } } },
    ];
    return { values, clearRanges: ["'Nhật ký học tập'!A:N"], requests };
  }
}
