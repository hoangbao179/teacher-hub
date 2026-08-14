import ExcelJS from "exceljs";
import { AppError } from "../errors/app-error";
import type { LegacyTuitionRowKind } from "@teacher/shared";
import { LegacyDateNormalizer, type LegacyDateInput } from "./legacy-date-normalizer";

export interface ParsedLegacyLearningRow {
  sourceRow: number;
  originalDate: string;
  normalizedDate: string | null;
  dateResolution: "EXACT" | "TUITION_REFERENCE" | "SEQUENCE_INFERENCE" | "UNRESOLVED";
  teacher: string | null;
  studentName: string | null;
  nickname: string | null;
  content: string | null;
  homework: string | null;
  classwork: string | null;
  note: string | null;
  absent: boolean;
}

export interface ParsedLegacyTuitionRow {
  sourceRow: number;
  date: string;
  time: string | null;
  paidMarker: boolean;
  offMarker: boolean;
  kind: LegacyTuitionRowKind;
  blockId: string;
}

export interface ParsedLegacyPaymentEvent { sourceRow: number; date: string | null }

export interface ParsedLegacyTuitionBlock {
  id: string;
  sourceStartRow: number;
  sourceEndRow: number;
  paidMarkerSourceRow: number | null;
  unpaidMarkerSourceRow: number | null;
  tuitionSourceRows: number[];
  paidCandidateSourceRows: number[];
}

export interface ParsedLegacyWorkbook {
  learningRows: ParsedLegacyLearningRow[];
  tuitionRows: ParsedLegacyTuitionRow[];
  paymentEvents: ParsedLegacyPaymentEvent[];
  tuitionBlocks: ParsedLegacyTuitionBlock[];
}

function plainText(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula) {
    const formulaValue = cell.value as ExcelJS.CellFormulaValue;
    return formulaValue.result == null ? "" : String(formulaValue.result).trim();
  }
  return cell.text.trim();
}

function nullable(value: string): string | null { return value || null; }
function key(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function splitStudent(value: string): { studentName: string | null; nickname: string | null } {
  const cleaned = value.trim();
  if (!cleaned) return { studentName: null, nickname: null };
  const match = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return match ? { studentName: nullable(match[1].trim()), nickname: nullable(match[2].trim()) }
    : { studentName: cleaned, nickname: null };
}

function isAbsent(value: string): boolean {
  const normalized = key(value);
  return Boolean(normalized) && !["0", "NO", "PRESENT", "CO MAT"].includes(normalized);
}

function tuitionKind(value: string): LegacyTuitionRowKind {
  const marker = key(value);
  if (marker === "FREE") return "FREE";
  if (marker === "V") return "ABSENT";
  if (marker === "OFF") return "OFF";
  return "BILLABLE";
}

function findColumn(row: ExcelJS.Row, labels: string[]): number | null {
  for (let column = 1; column <= row.cellCount; column += 1) {
    const value = key(plainText(row.getCell(column)));
    if (labels.some((label) => value === label || value.startsWith(label))) return column;
  }
  return null;
}

export class LegacyWorkbookParser {
  constructor(private readonly dates = new LegacyDateNormalizer()) {}

  async parse(filePath: string): Promise<ParsedLegacyWorkbook> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch {
      throw new AppError(400, "INVALID_XLSX", "Không thể đọc workbook XLSX.");
    }
    const learning = workbook.worksheets.find((sheet) => key(sheet.name) === "QUA TRINH HOC TAP");
    const tuition = workbook.worksheets.find((sheet) => key(sheet.name) === "HOC PHI");
    if (!learning || !tuition) {
      throw new AppError(400, "LEGACY_SHEETS_MISSING", "Workbook phải có hai sheet Quá trình học tập và Học phí.");
    }

    const tuitionRows: ParsedLegacyTuitionRow[] = [];
    const paymentEvents: ParsedLegacyPaymentEvent[] = [];
    const tuitionBlocks: ParsedLegacyTuitionBlock[] = [];
    const headerRows: number[] = [];
    for (let rowNumber = 1; rowNumber <= tuition.rowCount; rowNumber += 1)
      if (key(plainText(tuition.getRow(rowNumber).getCell(1))) === "FULL NAME") headerRows.push(rowNumber);
    for (const [blockIndex, headerRow] of headerRows.entries()) {
      const nextHeader = headerRows[blockIndex + 1] ?? tuition.rowCount + 1;
      let sourceEndRow = nextHeader - 1;
      for (let rowNumber = headerRow + 1; rowNumber < nextHeader; rowNumber += 1) {
        if (key(plainText(tuition.getRow(rowNumber).getCell(1))).startsWith("TOTAL")) { sourceEndRow = rowNumber; break; }
      }
      const id = `tuition-block-${headerRow}`;
      let paidMarkerSourceRow: number | null = null;
      let unpaidMarkerSourceRow: number | null = null;
      const blockRows: ParsedLegacyTuitionRow[] = [];
      for (let rowNumber = headerRow + 1; rowNumber <= sourceEndRow; rowNumber += 1) {
        const row = tuition.getRow(rowNumber);
        const markerText = Array.from({ length: 7 }, (_, column) => plainText(row.getCell(column + 1))).join(" ");
        const paidMarker = /\bPAID\b/i.test(markerText);
        const unpaidMarker = /\bUNPAID\b/i.test(markerText);
        if (paidMarker && paidMarkerSourceRow == null) paidMarkerSourceRow = rowNumber;
        if (unpaidMarker && unpaidMarkerSourceRow == null) unpaidMarkerSourceRow = rowNumber;
        const dateCell = row.getCell(3);
        const date = this.dates.normalizeFullDate(dateCell.value, plainText(dateCell));
        if (!date) continue;
        const duration = plainText(row.getCell(2));
        const hoursCell = row.getCell(4);
        const fallbackHours = typeof hoursCell.value === "string" ? plainText(hoursCell) : "";
        const kind = tuitionKind(plainText(row.getCell(5)));
        blockRows.push({ sourceRow: rowNumber, date, time: nullable(duration || fallbackHours), paidMarker,
          offMarker: kind === "OFF", kind, blockId: id });
      }
      const tuitionSourceRows = blockRows.map((row) => row.sourceRow);
      const paidCandidateSourceRows = paidMarkerSourceRow == null ? []
        : blockRows.filter((row) => row.sourceRow <= paidMarkerSourceRow! && row.kind === "BILLABLE")
          .map((row) => row.sourceRow);
      tuitionRows.push(...blockRows);
      tuitionBlocks.push({ id, sourceStartRow: headerRow, sourceEndRow, paidMarkerSourceRow, unpaidMarkerSourceRow,
        tuitionSourceRows, paidCandidateSourceRows });
      if (paidMarkerSourceRow != null) paymentEvents.push({ sourceRow: paidMarkerSourceRow, date: null });
    }

    const rawLearning: Array<Omit<ParsedLegacyLearningRow, "originalDate" | "normalizedDate" | "dateResolution"> & { dateInput: LegacyDateInput }> = [];
    for (let headerRow = 1; headerRow <= learning.rowCount; headerRow += 1) {
      const row = learning.getRow(headerRow);
      const dateLabelColumn = findColumn(row, ["DATE"]);
      const contentLabelColumn = findColumn(row, ["CONTENT - NOI DUNG HOC", "CONTENT"]);
      if (!dateLabelColumn || !contentLabelColumn) continue;
      const dateCell = row.getCell(dateLabelColumn + 1);
      const teacher = nullable(plainText(learning.getRow(headerRow + 1).getCell(2)));
      let content: string | null = null;
      for (let column = contentLabelColumn + 1; column <= row.cellCount; column += 1) {
        content = nullable(plainText(row.getCell(column)));
        if (content) break;
      }
      const participantHeader = learning.getRow(headerRow + 2);
      const sttColumn = findColumn(participantHeader, ["STT"]);
      const nameColumn = findColumn(participantHeader, ["TEN HOC VIEN", "FULL NAME"]);
      const absenceColumn = findColumn(participantHeader, ["ABSENCE"]);
      const homeworkColumn = findColumn(participantHeader, ["BTVN"]);
      const classworkColumn = findColumn(participantHeader, ["BAI TAI LOP"]);
      const noteColumn = findColumn(participantHeader, ["GHI CHU"]);
      if (!sttColumn || !nameColumn || !absenceColumn || !homeworkColumn || !classworkColumn || !noteColumn) continue;
      const learningCountBeforeBlock = rawLearning.length;
      for (let dataRow = headerRow + 3; dataRow <= learning.rowCount; dataRow += 1) {
        const candidate = learning.getRow(dataRow);
        if (dataRow > headerRow + 3 && findColumn(candidate, ["DATE"])) break;
        const sequence = plainText(candidate.getCell(sttColumn));
        const student = plainText(candidate.getCell(nameColumn));
        if (!sequence && !student) break;
        if (!student || !/^\d+$/.test(sequence)) continue;
        rawLearning.push({
          sourceRow: dataRow,
          dateInput: { raw: dateCell.value, display: plainText(dateCell) },
          teacher,
          ...splitStudent(student),
          content,
          homework: nullable(plainText(candidate.getCell(homeworkColumn))),
          classwork: nullable(plainText(candidate.getCell(classworkColumn))),
          note: nullable(plainText(candidate.getCell(noteColumn))),
          absent: isAbsent(plainText(candidate.getCell(absenceColumn))),
        });
      }
      if (rawLearning.length === learningCountBeforeBlock) {
        const candidate = learning.getRow(headerRow + 3);
        rawLearning.push({
          sourceRow: headerRow,
          dateInput: { raw: dateCell.value, display: plainText(dateCell) },
          teacher,
          ...splitStudent(plainText(candidate.getCell(nameColumn))),
          content,
          homework: nullable(plainText(candidate.getCell(homeworkColumn))),
          classwork: nullable(plainText(candidate.getCell(classworkColumn))),
          note: nullable(plainText(candidate.getCell(noteColumn))),
          absent: isAbsent(plainText(candidate.getCell(absenceColumn))),
        });
      }
    }
    const normalized = this.dates.normalize(rawLearning.map((row) => row.dateInput), tuitionRows.map((row) => row.date));
    const learningRows = rawLearning.map(({ dateInput: _dateInput, ...row }, index): ParsedLegacyLearningRow => ({
      ...row,
      originalDate: normalized[index].originalDate,
      normalizedDate: normalized[index].normalizedDate,
      dateResolution: normalized[index].resolution,
    }));
    return { learningRows, tuitionRows, paymentEvents, tuitionBlocks };
  }
}
