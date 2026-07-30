import type { sheets_v4 } from "googleapis";
import { studentTuitionSheetHeaders } from "../../domain/student-report";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const attendanceLabels = { PRESENT: "Có mặt", ABSENT: "Nghỉ", FREE: "Miễn phí" } as const;
const lessonTypeLabels = { REGULAR: "Buổi thường", MAKEUP: "Buổi học bù", EXTRA: "Buổi học thêm" } as const;
const names = [
  "Quá trình học tập",
  "Học phí",
  "_TeacherHub",
] as const;

export function googleLearningRowValues(row: StudentGoogleSheetSnapshot["learning"][number]): Array<string | number | boolean> {
  return [row.lessonId, row.date, safeGoogleCell(row.className), lessonTypeLabels[row.lessonType],
    row.scheduledStartTime, row.scheduledEndTime, attendanceLabels[row.attendance], safeGoogleCell(row.content),
    safeGoogleCell(row.homework), safeGoogleCell(row.studentComment)];
}

export function safeGoogleCell(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function googleDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function googleTuitionValues(
  rows: StudentGoogleSheetSnapshot["tuition"],
  vietinBankAccountNumber: string,
): Array<Array<string | number | boolean>> {
  const values: Array<Array<string | number | boolean>> = [[...studentTuitionSheetHeaders]];
  for (const cycle of [...rows].sort((left, right) =>
    left.cycleNumber - right.cycleNumber || left.cycleId - right.cycleId)) {
    const sessions = [...cycle.sessions].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
    sessions.forEach((session, index) => values.push([
      index === 0 ? cycle.cycleNumber : "",
      index === 0 ? googleDate(cycle.startedAt) : "",
      index === 0 ? googleDate(cycle.reachedTargetAt) : "",
      googleDate(session.sessionDate),
      `${session.scheduledStartTime} – ${session.scheduledEndTime}`,
      index === 0 ? safeGoogleCell(vietinBankAccountNumber) : "",
    ]));
  }
  return values;
}

export function googleHeaderRequest(sheetId: number, columns: number): sheets_v4.Schema$Request {
  return { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns },
    cell: { userEnteredFormat: { backgroundColor: { red: 217 / 255, green: 234 / 255, blue: 247 / 255 },
      textFormat: { foregroundColor: { red: 23 / 255, green: 50 / 255, blue: 77 / 255 }, bold: true },
      horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
    fields: "userEnteredFormat" } };
}

function tableRequests(sheetId: number, columns: number, rows: number): sheets_v4.Schema$Request[] {
  return [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    googleHeaderRequest(sheetId, columns),
    { clearBasicFilter: { sheetId } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(rows, 2), startColumnIndex: 0, endColumnIndex: columns },
      cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
    { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: Math.max(rows, 2), startColumnIndex: 0, endColumnIndex: columns }],
      booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=ISEVEN(ROW())" }] },
        format: { backgroundColor: { red: 243 / 255, green: 248 / 255, blue: 252 / 255 } } } } } },
  ];
}

export interface GoogleTemplatePlan {
  values: sheets_v4.Schema$ValueRange[];
  clearRanges: string[];
  requests: sheets_v4.Schema$Request[];
}

export class GoogleSheetTemplateService {
  readonly sheetNames = [...names];
  readonly obsoleteSheetNames = ["Tổng quan", "Nhật ký học tập", "Ôn từ vựng"];
  readonly renamedSheetNames = { "Nhật ký học tập": "Quá trình học tập" };

  constructor(private readonly vietinBankAccountNumber = "") {}

  build(snapshot: StudentGoogleSheetSnapshot, spreadsheetId: string, ids: Record<string, number>, metadata: {
    templateVersion: string; generatedAt: string; syncedAt?: string | null;
  }): GoogleTemplatePlan {
    for (const name of names) if (ids[name] == null) throw new Error(`Missing template sheet: ${name}`);
    const learning = [["Teacher Hub Lesson ID", "Ngày học", "Lớp", "Loại buổi", "Giờ dự kiến bắt đầu",
      "Giờ dự kiến kết thúc", "Trạng thái", "Nội dung buổi học", "Bài tập về nhà", "Nhận xét học sinh"],
      ...snapshot.learning.map(googleLearningRowValues)];
    const tuition = googleTuitionValues(snapshot.tuition, this.vietinBankAccountNumber);
    const technical = [["key", "value"], ["schemaVersion", "1"], ["templateVersion", metadata.templateVersion],
      ["studentId", snapshot.student.id], ["spreadsheetId", spreadsheetId], ["lastGeneratedAt", metadata.generatedAt],
      ["lastSyncedAt", metadata.syncedAt ?? ""]];
    const values: sheets_v4.Schema$ValueRange[] = [
      { range: "'Quá trình học tập'!A1:J", values: learning },
      { range: "'Học phí'!A1:F", values: tuition }, { range: "'_TeacherHub'!A1:B100", values: technical },
    ];
    const learningId = ids["Quá trình học tập"];
    const tuitionId = ids["Học phí"];
    const technicalId = ids._TeacherHub;
    const requests: sheets_v4.Schema$Request[] = [
      ...tableRequests(learningId, 10, learning.length), ...tableRequests(tuitionId, 6, tuition.length),
      { repeatCell: { range: { sheetId: tuitionId, startColumnIndex: 6, endColumnIndex: 13 },
        cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } },
      { addConditionalFormatRule: { index: 0, rule: { ranges: [{ sheetId: learningId, startRowIndex: 1, endRowIndex: Math.max(learning.length, 2), startColumnIndex: 6, endColumnIndex: 7 }],
        booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Nghỉ" }] },
          format: { backgroundColor: { red: 1, green: 0.94, blue: 0.78 } } } } } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 },
        properties: { pixelSize: 300 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 9, endIndex: 10 },
        properties: { pixelSize: 200 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId: tuitionId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { hiddenByUser: false }, fields: "hiddenByUser" } },
      ...[85, 100, 115, 95, 135, 190].map((pixelSize, index) => ({
        updateDimensionProperties: {
          range: { sheetId: tuitionId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
          properties: { pixelSize }, fields: "pixelSize",
        },
      })),
      { updateSheetProperties: { properties: { sheetId: technicalId, hidden: true }, fields: "hidden" } },
      { addProtectedRange: { protectedRange: { range: { sheetId: technicalId }, description: "Teacher Hub metadata",
        warningOnly: false } } },
    ];
    return { values, clearRanges: ["'Quá trình học tập'!A:N", "'Học phí'!A:M"], requests };
  }
}
