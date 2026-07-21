import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import type { ClassListItem, StudentDetail } from "@teacher/shared";
import { LegacyDateNormalizer } from "./legacy-date-normalizer";
import { LegacyWorkbookParser } from "./legacy-workbook-parser";
import { LegacyReconciliationEngine } from "./legacy-reconciliation-engine";
import { LegacyImportPreview } from "./legacy-import-preview";

interface LearningFixture { date: string; absent?: boolean; name?: string }

async function workbookBytes(learningRows: LearningFixture[], tuitionDates: string[], paidAfterTuitionIndex?: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  learningRows.forEach((item, index) => {
    const row = index * 5 + 1;
    learning.getCell(row, 1).value = "DATE";
    learning.getCell(row, 2).value = item.date;
    learning.getCell(row, 3).value = "CONTENT -NỘI DUNG HỌC";
    learning.getCell(row, 6).value = `Nội dung ${index + 1}`;
    learning.getCell(row + 1, 1).value = "TEACHER";
    learning.getCell(row + 1, 2).value = "Cô Vy";
    learning.getCell(row + 1, 3).value = "HOMEWORK";
    ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) => {
      learning.getCell(row + 2, column + 1).value = value;
    });
    learning.getCell(row + 3, 1).value = 1;
    learning.getCell(row + 3, 2).value = item.name ?? "Học sinh Mẫu (Mây)";
    learning.getCell(row + 3, 4).value = item.absent ? "x" : "";
    learning.getCell(row + 3, 5).value = `Bài tập ${index + 1}`;
    learning.getCell(row + 3, 6).value = `Bài tại lớp ${index + 1}`;
    learning.getCell(row + 3, 7).value = `Ghi chú ${index + 1}`;
  });
  const tuition = workbook.addWorksheet("Học phí");
  ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, column) => tuition.getCell(1, column + 1).value = value);
  tuitionDates.forEach((date, index) => {
    const row = index + 2;
    tuition.getCell(row, 1).value = "Học sinh Mẫu";
    tuition.getCell(row, 2).value = "18:00-19:30";
    tuition.getCell(row, 3).value = new Date(`${date}T00:00:00Z`);
    tuition.getCell(row, 3).numFmt = "d/m/yyyy";
    tuition.getCell(row, 4).value = 45_000 + index;
    if (paidAfterTuitionIndex === index + 1) tuition.getCell(row + 1, 6).value = "PAID";
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function withWorkbook(bytes: Buffer, action: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "teacher-hub-legacy-test-"));
  const path = join(directory, "fixture.xlsx");
  try { await writeFile(path, bytes); await action(path); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("LegacyDateNormalizer resolves a missing year from tuition references", () => {
  const normalizer = new LegacyDateNormalizer();
  const result = normalizer.normalize([{ raw: "T2 01/06", display: "T2 01/06" }], ["2025-06-01"]);
  assert.deepEqual(result[0], { originalDate: "T2 01/06", normalizedDate: "2025-06-01", resolution: "TUITION_REFERENCE" });
  assert.deepEqual(normalizer.normalize([{ raw: "June 8th", display: "June 8th" }], ["2025-06-08"])[0],
    { originalDate: "June 8th", normalizedDate: "2025-06-08", resolution: "TUITION_REFERENCE" });
});

test("LegacyWorkbookParser reads both sheets, preserves every learning block and ignores numeric HOURS", async () => {
  const bytes = await workbookBytes([
    { date: "01/06" }, { date: "08/06", absent: true }, { date: "15/06" }, { date: "22/06", name: "" },
  ], ["2025-06-01", "2025-06-15"]);
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.learningRows.length, 4);
    assert.equal(parsed.tuitionRows.length, 2);
    assert.equal(parsed.learningRows[0].normalizedDate, "2025-06-01");
    assert.equal(parsed.learningRows[0].teacher, "Cô Vy");
    assert.equal(parsed.learningRows[0].nickname, "Mây");
    assert.equal(parsed.learningRows[0].homework, "Bài tập 1");
    assert.equal(parsed.learningRows[1].absent, true);
    assert.equal(parsed.learningRows[3].studentName, null);
    assert.equal(parsed.tuitionRows[0].time, "18:00-19:30");
    assert.doesNotMatch(parsed.tuitionRows[0].time ?? "", /^45/);
  });
});

test("reconciliation covers absence, tuition-only, date suggestions, duplicates and unresolved dates", async () => {
  const bytes = await workbookBytes([
    { date: "2025-06-01" },
    { date: "2025-06-08", absent: true },
    { date: "2025-06-15" },
    { date: "2025-06-22" },
    { date: "2025-06-22" },
    { date: "không rõ" },
  ], ["2025-06-01", "2025-06-16", "2025-06-29"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.lessons.length, 6);
    assert.equal(result.lessons[0].reconciliationStatus, "MATCHED");
    assert.equal(result.lessons[1].reconciliationStatus, "LEARNING_ONLY_ABSENT");
    assert.equal(result.lessons[2].reconciliationStatus, "DATE_CORRECTION_SUGGESTED");
    assert.equal(result.lessons[2].suggestedDate, "2025-06-16");
    assert.equal(result.lessons[3].reconciliationStatus, "DUPLICATE_SUSPECTED");
    assert.equal(result.lessons[4].reconciliationStatus, "DUPLICATE_SUSPECTED");
    assert.equal(result.lessons[5].reconciliationStatus, "UNRESOLVED_DATE");
    assert.equal(result.tuitionRows.at(-1)?.reconciliationStatus, "TUITION_ONLY_NEEDS_REVIEW");
  });
});

test("ten present lessons before PAID become 8 + 2 and keep payment resolution undecided", async () => {
  const dates = Array.from({ length: 10 }, (_, index) => `2025-07-${String(index + 1).padStart(2, "0")}`);
  const bytes = await workbookBytes(dates.map((date) => ({ date })), dates, 10);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.deepEqual(result.tuitionCycles.map((cycle) => cycle.itemCount), [8, 2]);
    assert.equal(result.paymentEvents.length, 1);
    assert.equal(result.paymentEvents[0].recommendedResolution, "UNDETERMINED");
    assert.equal(result.paymentEvents[0].requiresReview, true);
    assert.deepEqual(result.paymentEvents[0].resolutionOptions,
      ["PREVIOUS_CYCLE", "CURRENT_CYCLE_ADVANCE", "SETTLE_INCOMPLETE", "UNDETERMINED"]);
  });
});

test("preview splits school years and never applies a filename grade to history", async () => {
  const bytes = await workbookBytes([{ date: "2025-05-31" }, { date: "2025-06-01" }, { date: "2026-06-01" }],
    ["2025-05-31", "2025-06-01", "2026-06-01"]);
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const student = { id: 7, fullName: "Học sinh Mẫu", nickname: null, status: "ACTIVE", parentName: null, parentPhone: null,
      classId: 4, className: "Lớp hiện tại", enrollmentId: 9, enrollmentStatus: "ACTIVE", tuitionMode: "CLASS_DEFAULT",
      customPackagePrice: null, currentProgress: 0, hasPaymentDue: false, dateOfBirth: null, note: null, joinedAt: "2025-01-01",
      effectivePackagePrice: 2_000_000, incompleteCycle: null, advanceReceipt: null } satisfies StudentDetail;
    const classes = [{ id: 4, name: "Lớp hiện tại", type: "ONE_TO_ONE", subject: null, status: "ACTIVE", defaultPackagePrice: 2_000_000,
      defaultDurationMinutes: 90, activeStudentCount: 1, paymentDueCount: 0 }] satisfies ClassListItem[];
    const preview = new LegacyImportPreview().build(student, classes, { name: "Student Grade 9.xlsx", size: bytes.length, sha256: "a".repeat(64) }, reconciled);
    assert.deepEqual(preview.academicPeriods.map((period) => period.schoolYear), ["2024-2025", "2025-2026", "2026-2027"]);
    assert.ok(preview.academicPeriods.every((period) => period.gradeLevel === null));
    assert.ok(preview.academicPeriods.some((period) => period.proposedClassMapping.type === "CURRENT_CLASS"));
  });
});
