import { google, type sheets_v4 } from "googleapis";
import { googleHeaderRequest } from "./google-sheet-template.service";

type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

function isTeacherHubConditionalRule(rule: sheets_v4.Schema$ConditionalFormatRule): boolean {
  const condition = rule.booleanRule?.condition;
  const value = condition?.values?.[0]?.userEnteredValue;
  const ranges = rule.ranges ?? [];
  if (ranges.length !== 1) return false;
  const range = ranges[0];
  if (range.startRowIndex !== 1) return false;
  if (condition?.type === "CUSTOM_FORMULA" && value === "=ISEVEN(ROW())")
    return range.startColumnIndex === 0 && (range.endColumnIndex === 6 || range.endColumnIndex === 10 || range.endColumnIndex === 13 || range.endColumnIndex === 14);
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

export function templateSheetReconciliationRequests(
  ids: Record<string, number>, requiredNames: string[], obsoleteNames: string[], renamedNames: Record<string, string> = {},
): sheets_v4.Schema$Request[] {
  const effectiveIds = { ...ids };
  const rename = Object.entries(renamedNames).flatMap(([oldName, newName]) => {
    if (effectiveIds[oldName] == null || effectiveIds[newName] != null || !requiredNames.includes(newName)) return [];
    const sheetId = effectiveIds[oldName];
    delete effectiveIds[oldName];
    effectiveIds[newName] = sheetId;
    return [{ updateSheetProperties: { properties: { sheetId, title: newName }, fields: "title" } }];
  });
  const add = requiredNames.filter((name) => effectiveIds[name] == null).map((title) =>
    ({ addSheet: { properties: { title, ...(title === "_TeacherHub" ? { hidden: true } : {}) } } }));
  const remove = obsoleteNames.filter((name) => !requiredNames.includes(name) && effectiveIds[name] != null).map((name) =>
    ({ deleteSheet: { sheetId: effectiveIds[name] } }));
  return [...rename, ...add, ...remove];
}

export class GoogleSheetsClient {
  private readonly sheets: sheets_v4.Sheets;
  constructor(auth: GoogleOAuthClient) { this.sheets = google.sheets({ version: "v4", auth }); }

  async create(title: string): Promise<string> {
    const response = await this.sheets.spreadsheets.create({ requestBody: { properties: { title }, sheets: [
      { properties: { title: "Quá trình học tập" } }, { properties: { title: "Học phí" } },
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

  async ensureSheets(spreadsheetId: string, names: string[], obsoleteNames: string[] = [],
    renamedNames: Record<string, string> = {}): Promise<Record<string, number>> {
    let ids = await this.metadata(spreadsheetId);
    const requests = templateSheetReconciliationRequests(ids, names, obsoleteNames, renamedNames);
    if (requests.length) {
      await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
      ids = await this.metadata(spreadsheetId);
    }
    return ids;
  }

  async clearAndWrite(spreadsheetId: string, values: sheets_v4.Schema$ValueRange[], clearRanges: string[],
    requests: sheets_v4.Schema$Request[]): Promise<void> {
    const current = await this.sheets.spreadsheets.get({ spreadsheetId,
      fields: "sheets(properties(sheetId),conditionalFormats(ranges,booleanRule(condition(type,values(userEnteredValue)))),protectedRanges(protectedRangeId,description))" });
    const cleanup = teacherHubFormattingCleanup(current.data.sheets ?? []);
    if (cleanup.length) await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: cleanup } });
    await this.sheets.spreadsheets.values.batchClear({ spreadsheetId, requestBody: {
      ranges: [...new Set([...values.map((item) => item.range!), ...clearRanges])],
    } });
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: {
      valueInputOption: "RAW", data: values,
    } });
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  async syncLearningRow(
    spreadsheetId: string,
    lessonId: number,
    row: Array<string | number | boolean> | null,
    tuitionValues: Array<Array<string | number | boolean>>,
    syncedAt: string,
  ): Promise<void> {
    const range = "'Quá trình học tập'!A:J";
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values ?? [];
    const rowIndex = values.findIndex((candidate, index) => index > 0 && String(candidate[0] ?? "") === String(lessonId));
    const ids = await this.metadata(spreadsheetId);
    const learningSheetId = ids["Quá trình học tập"];
    const tuitionSheetId = ids["Học phí"];
    if (learningSheetId == null || tuitionSheetId == null) throw new Error("Missing managed Google Sheet tab");
    if (row) {
      if (rowIndex >= 1) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Quá trình học tập'!A${rowIndex + 1}:J${rowIndex + 1}`,
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
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteDimension: { range: {
          sheetId: learningSheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1,
        } } }] },
      });
    }
    await this.sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: ["'Học phí'!A:M"] },
    });
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: "'Học phí'!A1:F", values: tuitionValues },
          { range: "'_TeacherHub'!B7", values: [[syncedAt]] },
        ],
      },
    });
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [
        { clearBasicFilter: { sheetId: learningSheetId } },
        { clearBasicFilter: { sheetId: tuitionSheetId } },
        googleHeaderRequest(learningSheetId, 10),
        googleHeaderRequest(tuitionSheetId, 6),
        { updateDimensionProperties: {
          range: { sheetId: tuitionSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
          properties: { hiddenByUser: false }, fields: "hiddenByUser",
        } },
      ] },
    });
  }

}
