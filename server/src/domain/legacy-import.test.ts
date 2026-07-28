import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import type { ClassListItem, StudentDetail } from "@teacher/shared";
import { LegacyDateNormalizer } from "./legacy-date-normalizer";
import { LegacyWorkbookParser } from "./legacy-workbook-parser";
import { LegacyReconciliationEngine, lessonTimes } from "./legacy-reconciliation-engine";
import { LegacyImportPreview } from "./legacy-import-preview";
import { resolveLegacyImportDecisions } from "./legacy-import-decisions";

interface LearningFixture { date: string; absent?: boolean; name?: string }
interface TuitionFixture { date: string; time?: string; off?: boolean }

async function workbookBytes(
  learningRows: LearningFixture[],
  tuitionDates: Array<string | TuitionFixture>,
  paidAfterTuitionIndex?: number,
  tuitionDuration = "18:00-19:30",
): Promise<Buffer> {
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
  tuitionDates.forEach((item, index) => {
    const fixture = typeof item === "string" ? { date: item } : item;
    const row = index + 2;
    tuition.getCell(row, 1).value = "Học sinh Mẫu";
    tuition.getCell(row, 2).value = fixture.time ?? tuitionDuration;
    tuition.getCell(row, 3).value = new Date(`${fixture.date}T00:00:00Z`);
    tuition.getCell(row, 3).numFmt = "d/m/yyyy";
    tuition.getCell(row, 4).value = 45_000 + index;
    if (fixture.off) tuition.getCell(row, 5).value = "  off ";
    if (paidAfterTuitionIndex === index + 1) tuition.getCell(row + 1, 6).value = "PAID";
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function withWorkbook(bytes: Buffer, action: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "teacher-hub-legacy-test-"));
  const path = join(directory, "fixture.xlsx");
  try { await writeFile(path, bytes); await action(path); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("lessonTimes normalizes supported legacy durations and rejects invalid ranges", () => {
  const validCases = [
    ["8h30-10h", { start: "08:30", end: "10:00" }],
    ["8h-10h", { start: "08:00", end: "10:00" }],
    ["8h30-10h30", { start: "08:30", end: "10:30" }],
    ["8:30-10:00", { start: "08:30", end: "10:00" }],
    ["08.30 – 10.00", { start: "08:30", end: "10:00" }],
  ] as const;
  for (const [value, expected] of validCases) assert.deepEqual(lessonTimes(value), expected);

  for (const value of ["25h-26h", "8h75-10h", "10h-8h", "10h-10h", null, ""]) {
    assert.deepEqual(lessonTimes(value), { start: null, end: null });
  }
});

test("legacy duration without end minutes keeps lesson time and learning-column mappings", async () => {
  const bytes = await workbookBytes([{ date: "2025-06-01" }], ["2025-06-01"], undefined, "8h30-10h");
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const student = {
      id: 7, fullName: "Học sinh Mẫu", nickname: null, status: "ACTIVE", parentName: null, parentPhone: null,
      classId: null, className: null, enrollmentId: null, enrollmentStatus: null, tuitionMode: null,
      customPackagePrice: null, currentProgress: 0, hasPaymentDue: false, dateOfBirth: null, note: null,
      joinedAt: "2025-01-01", effectivePackagePrice: null, incompleteCycle: null, advanceReceipt: null,
    } satisfies StudentDetail;
    const preview = new LegacyImportPreview().build(
      student,
      [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "a".repeat(64) },
      reconciled,
    );
    const lesson = reconciled.lessons[0];
    const lessonRow = preview.rows.find((row) => row.rowType === "LESSON");

    assert.equal(lesson.scheduledStartTime, "08:30");
    assert.equal(lesson.scheduledEndTime, "10:00");
    assert.equal(lesson.content, "Nội dung 1");
    assert.equal(lesson.homework, "Bài tập 1");
    assert.equal(lesson.note, "Ghi chú 1");
    assert.ok(!lessonRow?.issueCodes.includes("INVALID_TIME"));
    assert.equal(lessonRow?.normalizedValues.homework, "Bài tập 1");
    assert.equal(lessonRow?.normalizedValues.studentNote, "Ghi chú 1");
  });
});

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
    assert.equal(result.lessons[1].scheduledStartTime, "18:00");
    assert.equal(result.lessons[1].scheduledEndTime, "19:30");
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

function previewStudent(): StudentDetail {
  return {
    id: 7, fullName: "Học sinh Mẫu", nickname: null, status: "ACTIVE", parentName: null, parentPhone: null,
    classId: null, className: null, enrollmentId: null, enrollmentStatus: null, tuitionMode: null,
    customPackagePrice: null, currentProgress: 0, hasPaymentDue: false, dateOfBirth: null, note: null,
    joinedAt: "2025-01-01", effectivePackagePrice: null, incompleteCycle: null, advanceReceipt: null,
  };
}

test("an absent lesson without a tuition row infers the unique recurring time and stays non-billable", async () => {
  const dates = ["2026-06-15", "2026-06-17", "2026-06-22", "2026-06-24", "2026-07-01",
    "2026-07-06", "2026-07-08", "2026-07-13", "2026-07-15"];
  const bytes = await workbookBytes(dates.map((date, index) => ({ date, absent: index === 7 })),
    dates.filter((_, index) => index !== 7), undefined, "8h30-10h");
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const absent = reconciled.lessons[7];
    assert.equal(absent.reconciliationStatus, "LEARNING_ONLY_ABSENT");
    assert.equal(absent.scheduledStartTime, "08:30");
    assert.equal(absent.scheduledEndTime, "10:00");
    assert.equal(absent.attendanceStatus, "ABSENT");
    assert.equal(absent.billingType, "NONE");
    assert.deepEqual(reconciled.tuitionCycles.map((cycle) => cycle.itemCount), [8]);
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "a".repeat(64) }, reconciled);
    assert.ok(!preview.rows.find((row) => row.id === absent.id)?.issueCodes.includes("INVALID_TIME"));
  });
});

test("two absent lessons share one confirmed ambiguous time mapping instead of row-level time reviews", async () => {
  const dates = ["2026-06-10", "2026-06-15", "2026-06-17", "2026-06-22", "2026-06-24",
    "2026-06-29", "2026-07-01", "2026-07-06", "2026-07-08", "2026-07-13", "2026-07-15"];
  const bytes = await workbookBytes(dates.map((date, index) => ({ date, absent: index === 3 || index === 4 })),
    dates.filter((_, index) => index !== 3 && index !== 4), undefined, "3h30-5h");
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.deepEqual(reconciled.lessons.filter((lesson) => lesson.attendanceStatus === "ABSENT")
      .map((lesson) => [lesson.scheduledStartTime, lesson.scheduledEndTime]), [["15:30", "17:00"], ["15:30", "17:00"]]);
    assert.equal(reconciled.timeMappings.length, 1);
    assert.equal(reconciled.timeMappings[0].lessonSourceRows.length, 11);
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "b".repeat(64) }, reconciled);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("TIME_MAPPING_REQUIRED")).length, 1);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("INVALID_TIME")).length, 0);
    const mappingRow = preview.rows.find((row) => row.rowType === "TIME_MAPPING")!;
    const resolved = resolveLegacyImportDecisions({ ...preview,
      rows: preview.rows.filter((row) => row.rowType === "LESSON" || row.rowType === "TIME_MAPPING") }, [{
      sourceSheet: mappingRow.sourceSheet, sourceRow: mappingRow.sourceRow, issueCode: "TIME_MAPPING_REQUIRED",
      action: "CONFIRM_TIME_MAPPING", resolvedValue: { mappingId: String(mappingRow.normalizedValues.mappingId),
        startTime: "15:30", endTime: "17:00" },
    }]);
    assert.ok(resolved.filter((row) => row.rowType === "LESSON")
      .every((row) => row.normalizedValues.startTime === "15:30" && row.normalizedValues.endTime === "17:00"));
  });
});

test("exact absent plus OFF is a clear non-billable match and OFF is not PAID", async () => {
  const bytes = await workbookBytes([{ date: "2026-06-29", absent: true }],
    [{ date: "2026-06-29", time: "3h30-5h", off: true }]);
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.tuitionRows[0].offMarker, true);
    assert.equal(parsed.tuitionRows[0].paidMarker, false);
    const reconciled = new LegacyReconciliationEngine().reconcile(parsed);
    assert.equal(reconciled.lessons[0].reconciliationStatus, "MATCHED");
    assert.equal(reconciled.lessons[0].billingType, "NONE");
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "c".repeat(64) }, reconciled);
    assert.ok(!preview.rows.find((row) => row.rowType === "LESSON")?.issueCodes.includes("ATTENDANCE_AMBIGUOUS"));
  });
});

test("a backward June day suggests the unused same day in July without silently changing it", async () => {
  const bytes = await workbookBytes([{ date: "June 29" }, { date: "June 1" }, { date: "Jul 6" }],
    ["2026-06-29", "2026-07-01", "2026-07-06"]);
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(reconciled.lessons[1].normalizedDate, "2026-06-01");
    assert.equal(reconciled.lessons[1].suggestedDate, "2026-07-01");
    assert.equal(reconciled.lessons[1].reconciliationStatus, "DATE_CORRECTION_SUGGESTED");
  });
});

test("the learning sequence anchors 2025 through the 2026 rollover", () => {
  const dates = ["June 24", "July 1", "August 27", "September 3", "December 20", "January 3", "July 15"];
  const references = ["2025-09-03", "2025-12-20", "2026-01-03", "2026-07-15"];
  assert.deepEqual(new LegacyDateNormalizer().normalize(dates.map((date) => ({ raw: date, display: date })), references)
    .map((item) => item.normalizedDate),
  ["2025-06-24", "2025-07-01", "2025-08-27", "2025-09-03", "2025-12-20", "2026-01-03", "2026-07-15"]);
});

test("a fully matched clear-time workbook keeps every lesson matched", async () => {
  const dates = ["2026-06-15", "2026-06-17", "2026-06-22", "2026-06-24", "2026-06-29",
    "2026-07-01", "2026-07-06", "2026-07-08", "2026-07-13", "2026-07-15"];
  const bytes = await workbookBytes(dates.map((date) => ({ date })), dates, undefined, "8h30-10h");
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(reconciled.lessons.filter((lesson) => lesson.reconciliationStatus === "MATCHED").length, 10);
    assert.equal(reconciled.timeMappings.length, 0);
  });
});

test("single-digit h-minutes are typo suggestions, not literal minutes", async () => {
  assert.deepEqual(lessonTimes("20h8-22h"), { start: null, end: null });
  const bytes = await workbookBytes([{ date: "2025-09-03" }, { date: "2025-09-06" }],
    [{ date: "2025-09-03", time: "20h-22h" }, { date: "2025-09-06", time: "20h8-22h" }]);
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const mapping = reconciled.timeMappings.find((item) => item.rawValue === "20h8-22h");
    assert.deepEqual([mapping?.proposedStartTime, mapping?.proposedEndTime], ["20:00", "22:00"]);
    assert.equal(mapping?.reason, "TYPO_SUGGESTION");
  });
});
