import type { sheets_v4 } from "googleapis";
import type { StudentGoogleSheetSnapshot } from "./google-integration.types";

const attendanceLabels = { PRESENT: "Có mặt", ABSENT: "Vắng", FREE: "Có mặt" } as const;
const names = ["Sổ theo dõi học tập", "_TeacherHub"] as const;

export function googleLearningRowValues(row: StudentGoogleSheetSnapshot["learning"][number]): Array<string | number | boolean> {
  const comment = row.studentComment || row.generalComment;
  return [row.lessonId, googleDate(row.date), attendanceLabels[row.attendance], safeGoogleCell(comment), safeGoogleCell(row.content)];
}

export function safeGoogleCell(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function googleDate(value: string): string {
  const date = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function conditionalAttendanceRequest(
  sheetId: number,
  rows: number,
  label: "Có mặt" | "Vắng",
): sheets_v4.Schema$Request {
  const backgroundColor = label === "Có mặt"
    ? { red: 232 / 255, green: 245 / 255, blue: 233 / 255 }
    : { red: 255 / 255, green: 235 / 255, blue: 238 / 255 };
  return { addConditionalFormatRule: { index: 0, rule: {
    ranges: [{ sheetId, startRowIndex: 6, endRowIndex: Math.max(rows, 7), startColumnIndex: 2, endColumnIndex: 3 }],
    booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: label }] }, format: { backgroundColor } },
  } } };
}

export interface GoogleTemplatePlan {
  values: sheets_v4.Schema$ValueRange[];
  clearRanges: string[];
  requests: sheets_v4.Schema$Request[];
}

export class GoogleSheetTemplateService {
  readonly sheetNames = [...names];
  readonly obsoleteSheetNames = ["Tổng quan", "Nhật ký học tập", "Quá trình học tập", "Học phí", "Ôn từ vựng"];
  readonly renamedSheetNames = { "Quá trình học tập": "Sổ theo dõi học tập", "Nhật ký học tập": "Sổ theo dõi học tập" };

  build(snapshot: StudentGoogleSheetSnapshot, spreadsheetId: string, ids: Record<string, number>, metadata: {
    templateVersion: string; generatedAt: string; syncedAt?: string | null;
  }): GoogleTemplatePlan {
    for (const name of names) if (ids[name] == null) throw new Error(`Missing template sheet: ${name}`);
    const generatedDate = googleDate(metadata.generatedAt);
    const learning = [
      ["SỔ THEO DÕI HỌC TẬP", "", "", "", ""],
      ["Học sinh", safeGoogleCell(snapshot.student.fullName), "", "", ""],
      ["Lớp", safeGoogleCell(snapshot.student.currentClass), "", "", ""],
      ["Cập nhật gần nhất", generatedDate, "", "", ""],
      ["", "", "", "", ""],
      ["Teacher Hub Lesson ID", "Ngày học", "Điểm danh", "Nhận xét của cô", "Nội dung"],
      ...snapshot.learning.map(googleLearningRowValues),
    ];
    const technical = [["key", "value"], ["schemaVersion", "2"], ["templateVersion", metadata.templateVersion],
      ["studentId", snapshot.student.id], ["spreadsheetId", spreadsheetId], ["lastGeneratedAt", metadata.generatedAt],
      ["lastSyncedAt", metadata.syncedAt ?? ""]];
    const learningId = ids["Sổ theo dõi học tập"];
    const technicalId = ids._TeacherHub;
    const requests: sheets_v4.Schema$Request[] = [
      { updateSheetProperties: { properties: { sheetId: learningId, gridProperties: { frozenRowCount: 6 } }, fields: "gridProperties.frozenRowCount" } },
      { mergeCells: { range: { sheetId: learningId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }, mergeType: "MERGE_ALL" } },
      { repeatCell: { range: { sheetId: learningId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: { backgroundColor: { red: 41 / 255, green: 98 / 255, blue: 155 / 255 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
          horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat" } },
      { repeatCell: { range: { sheetId: learningId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: { backgroundColor: { red: 217 / 255, green: 234 / 255, blue: 247 / 255 },
          textFormat: { bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
      { repeatCell: { range: { sheetId: learningId, startRowIndex: 6, endRowIndex: Math.max(learning.length, 7), startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(verticalAlignment,wrapStrategy)" } },
      conditionalAttendanceRequest(learningId, learning.length, "Có mặt"),
      conditionalAttendanceRequest(learningId, learning.length, "Vắng"),
      { updateDimensionProperties: { range: { sheetId: learningId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
      ...[95, 105, 240, 280].map((pixelSize, offset) => ({ updateDimensionProperties: {
        range: { sheetId: learningId, dimension: "COLUMNS" as const, startIndex: offset + 1, endIndex: offset + 2 },
        properties: { pixelSize }, fields: "pixelSize",
      } })),
      { updateSheetProperties: { properties: { sheetId: technicalId, hidden: true }, fields: "hidden" } },
      { addProtectedRange: { protectedRange: { range: { sheetId: technicalId }, description: "Teacher Hub metadata", warningOnly: false } } },
    ];
    return {
      values: [{ range: "'Sổ theo dõi học tập'!A1:E", values: learning }, { range: "'_TeacherHub'!A1:B100", values: technical }],
      clearRanges: ["'Sổ theo dõi học tập'!A:E"],
      requests,
    };
  }
}
