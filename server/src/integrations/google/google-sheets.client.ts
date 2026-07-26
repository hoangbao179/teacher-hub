import { google, type sheets_v4 } from "googleapis";

type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

function isTeacherHubConditionalRule(rule: sheets_v4.Schema$ConditionalFormatRule): boolean {
  const condition = rule.booleanRule?.condition;
  const value = condition?.values?.[0]?.userEnteredValue;
  const ranges = rule.ranges ?? [];
  if (ranges.length !== 1) return false;
  const range = ranges[0];
  if (range.startRowIndex !== 1) return false;
  if (condition?.type === "CUSTOM_FORMULA" && value === "=ISEVEN(ROW())")
    return range.startColumnIndex === 0 && (range.endColumnIndex === 13 || range.endColumnIndex === 14);
  if (condition?.type === "TEXT_EQ" && value === "Nghỉ")
    return range.startColumnIndex === 6 && range.endColumnIndex === 7;
  if (condition?.type === "TEXT_EQ" && value === "Cần thu")
    return range.startColumnIndex === 10 && range.endColumnIndex === 11;
  return false;
}

export function teacherHubFormattingCleanup(
  sheets: sheets_v4.Schema$Sheet[],
): sheets_v4.Schema$Request[] {
  const cleanup: sheets_v4.Schema$Request[] = [];
  for (const sheet of sheets) {
    const sheetId = sheet.properties?.sheetId;
    if (sheetId == null) continue;
    for (let index = (sheet.conditionalFormats?.length ?? 0) - 1; index >= 0; index -= 1) {
      if (isTeacherHubConditionalRule(sheet.conditionalFormats![index]))
        cleanup.push({ deleteConditionalFormatRule: { sheetId, index } });
    }
    for (const protection of sheet.protectedRanges ?? []) {
      if (protection.protectedRangeId != null && protection.description === "Teacher Hub metadata")
        cleanup.push({ deleteProtectedRange: { protectedRangeId: protection.protectedRangeId } });
    }
  }
  return cleanup;
}

export class GoogleSheetsClient {
  private readonly sheets: sheets_v4.Sheets;
  constructor(auth: GoogleOAuthClient) { this.sheets = google.sheets({ version: "v4", auth }); }

  async create(title: string): Promise<string> {
    const response = await this.sheets.spreadsheets.create({ requestBody: { properties: { title }, sheets: [
      { properties: { title: "Tổng quan", gridProperties: { hideGridlines: true } } },
      { properties: { title: "Nhật ký học tập" } }, { properties: { title: "Học phí" } },
      { properties: { title: "_TeacherHub", hidden: true } },
    ] }, fields: "spreadsheetId" });
    if (!response.data.spreadsheetId) throw new Error("Malformed spreadsheet create response");
    return response.data.spreadsheetId;
  }

  async metadata(spreadsheetId: string): Promise<Record<string, number>> {
    const response = await this.sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId,title))" });
    return Object.fromEntries((response.data.sheets ?? []).flatMap((sheet) =>
      sheet.properties?.title && sheet.properties.sheetId != null ? [[sheet.properties.title, sheet.properties.sheetId]] : []));
  }

  async ensureSheets(spreadsheetId: string, names: string[]): Promise<Record<string, number>> {
    let ids = await this.metadata(spreadsheetId);
    const missing = names.filter((name) => ids[name] == null);
    if (missing.length) {
      await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map((title) =>
        ({ addSheet: { properties: { title, hidden: title === "_TeacherHub" } } })) } });
      ids = await this.metadata(spreadsheetId);
    }
    return ids;
  }

  async clearAndWrite(spreadsheetId: string, values: sheets_v4.Schema$ValueRange[], requests: sheets_v4.Schema$Request[]): Promise<void> {
    const current = await this.sheets.spreadsheets.get({ spreadsheetId,
      fields: "sheets(properties(sheetId),conditionalFormats(ranges,booleanRule(condition(type,values(userEnteredValue)))),protectedRanges(protectedRangeId,description))" });
    const cleanup = teacherHubFormattingCleanup(current.data.sheets ?? []);
    if (cleanup.length) await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: cleanup } });
    await this.sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: values.map((item) => item.range!) } });
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: {
      valueInputOption: "RAW", data: values,
    } });
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  async syncLearningRow(
    spreadsheetId: string,
    lessonId: number,
    row: Array<string | number | boolean> | null,
    overview: Array<{ range: string; value: string | number | boolean }>,
    syncedAt: string,
  ): Promise<void> {
    const range = "'Nhật ký học tập'!A:N";
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values ?? [];
    const rowIndex = values.findIndex((candidate, index) => index > 0 && String(candidate[0] ?? "") === String(lessonId));
    if (row) {
      if (rowIndex >= 1) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Nhật ký học tập'!A${rowIndex + 1}:N${rowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });
      } else {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [row] },
        });
      }
    } else if (rowIndex >= 1) {
      const ids = await this.metadata(spreadsheetId);
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteDimension: { range: {
          sheetId: ids["Nhật ký học tập"], dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1,
        } } }] },
      });
    }
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          ...overview.map((item) => ({ range: `'Tổng quan'!${item.range}`, values: [[item.value]] })),
          { range: "'_TeacherHub'!B7", values: [[syncedAt]] },
        ],
      },
    });
  }
}
