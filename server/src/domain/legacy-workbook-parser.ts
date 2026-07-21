import ExcelJS from "exceljs";
import { AppError } from "../errors/app-error";
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
}

export interface ParsedLegacyPaymentEvent { sourceRow: number; date: string | null }

export interface ParsedLegacyWorkbook {
  learningRows: ParsedLegacyLearningRow[];
  tuitionRows: ParsedLegacyTuitionRow[];
  paymentEvents: ParsedLegacyPaymentEvent[];
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
    let lastTuitionDate: string | null = null;
    for (let rowNumber = 1; rowNumber <= tuition.rowCount; rowNumber += 1) {
      const row = tuition.getRow(rowNumber);
      const dateCell = row.getCell(3);
      const date = this.dates.normalizeFullDate(dateCell.value, plainText(dateCell));
      const paidMarker = /\bPAID\b/i.test(plainText(row.getCell(6)));
      if (date) {
        const duration = plainText(row.getCell(2));
        const hoursCell = row.getCell(4);
        const fallbackHours = typeof hoursCell.value === "string" ? plainText(hoursCell) : "";
        tuitionRows.push({ sourceRow: rowNumber, date, time: nullable(duration || fallbackHours), paidMarker });
        lastTuitionDate = date;
      }
      if (paidMarker) paymentEvents.push({ sourceRow: rowNumber, date: date ?? lastTuitionDate });
    }

    const rawLearning: Array<Omit<ParsedLegacyLearningRow, "originalDate" | "normalizedDate" | "dateResolution"> & { dateInput: LegacyDateInput }> = [];
    for (let headerRow = 1; headerRow <= learning.rowCount; headerRow += 1) {
      const row = learning.getRow(headerRow);
      if (key(plainText(row.getCell(1))) !== "DATE" || !key(plainText(row.getCell(3))).startsWith("CONTENT")) continue;
      const dateCell = row.getCell(2);
      const teacher = nullable(plainText(learning.getRow(headerRow + 1).getCell(2)));
      const content = nullable(plainText(row.getCell(6)));
      const participantHeader = learning.getRow(headerRow + 2);
      if (key(plainText(participantHeader.getCell(1))) !== "STT") continue;
      const learningCountBeforeBlock = rawLearning.length;
      for (let dataRow = headerRow + 3; dataRow <= learning.rowCount; dataRow += 1) {
        const candidate = learning.getRow(dataRow);
        if (dataRow > headerRow + 3 && key(plainText(candidate.getCell(1))) === "DATE") break;
        const sequence = plainText(candidate.getCell(1));
        const student = plainText(candidate.getCell(2));
        if (!sequence && !student) break;
        if (!student || !/^\d+$/.test(sequence)) continue;
        rawLearning.push({
          sourceRow: dataRow,
          dateInput: { raw: dateCell.value, display: plainText(dateCell) },
          teacher,
          ...splitStudent(student),
          content,
          homework: nullable(plainText(candidate.getCell(5))),
          classwork: nullable(plainText(candidate.getCell(6))),
          note: nullable(plainText(candidate.getCell(7))),
          absent: isAbsent(plainText(candidate.getCell(4))),
        });
      }
      if (rawLearning.length === learningCountBeforeBlock) {
        const candidate = learning.getRow(headerRow + 3);
        rawLearning.push({
          sourceRow: headerRow,
          dateInput: { raw: dateCell.value, display: plainText(dateCell) },
          teacher,
          ...splitStudent(plainText(candidate.getCell(2))),
          content,
          homework: nullable(plainText(candidate.getCell(5))),
          classwork: nullable(plainText(candidate.getCell(6))),
          note: nullable(plainText(candidate.getCell(7))),
          absent: isAbsent(plainText(candidate.getCell(4))),
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
    return { learningRows, tuitionRows, paymentEvents };
  }
}
