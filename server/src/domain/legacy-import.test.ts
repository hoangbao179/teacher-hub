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
import { LegacyImportRepository } from "../repositories/legacy-import.repository";

interface LearningFixture { date: string; absent?: boolean; name?: string }
interface TuitionFixture { date: string; rawDate?: string; time?: string; off?: boolean; marker?: string }

async function workbookBytes(
  learningRows: LearningFixture[],
  tuitionDates: Array<string | TuitionFixture>,
  paidAfterTuitionIndex?: number,
  tuitionDuration = "18:00-19:30",
  paidMarkerColumn = 6,
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
    tuition.getCell(row, 3).value = fixture.rawDate ?? new Date(`${fixture.date}T00:00:00Z`);
    if (!fixture.rawDate) tuition.getCell(row, 3).numFmt = "d/m/yyyy";
    tuition.getCell(row, 4).value = 45_000 + index;
    if (fixture.off) tuition.getCell(row, 5).value = "  off ";
    if (fixture.marker) tuition.getCell(row, 5).value = fixture.marker;
    if (paidAfterTuitionIndex === index + 1) {
      const paidCell = tuition.getCell(row + 1, paidMarkerColumn);
      paidCell.value = "PAID";
      paidCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    }
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function withWorkbook(bytes: Buffer, action: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "teacher-hub-legacy-test-"));
  const path = join(directory, "fixture.xlsx");
  try { await writeFile(path, bytes); await action(path); } finally { await rm(directory, { recursive: true, force: true }); }
}

async function blockedTuitionWorkbookBytes(): Promise<Buffer> {
  const first = Array.from({ length: 10 }, (_, index) => `2026-03-${String(index + 20).padStart(2, "0")}`);
  const second = Array.from({ length: 8 }, (_, index) => `2026-06-${String(index + 10).padStart(2, "0")}`);
  const current = ["2026-07-08", "2026-07-13", "2026-07-15"];
  const dates = [...first, ...second, ...current];
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  dates.forEach((date, index) => {
    const row = index * 5 + 1;
    learning.getCell(row, 1).value = "DATE";
    learning.getCell(row, 2).value = date;
    learning.getCell(row, 3).value = "CONTENT -NỘI DUNG HỌC";
    learning.getCell(row, 6).value = `Nội dung ẩn danh ${index + 1}`;
    learning.getCell(row + 1, 1).value = "TEACHER";
    learning.getCell(row + 1, 2).value = "Giáo viên";
    ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) =>
      learning.getCell(row + 2, column + 1).value = value);
    learning.getCell(row + 3, 1).value = 1;
    learning.getCell(row + 3, 2).value = "Học sinh Ẩn danh";
  });
  const tuition = workbook.addWorksheet("Học phí");
  let row = 1;
  const addBlock = (blockDates: string[], paidAfter: number | null, postPaidCount = 0) => {
    ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, column) =>
      tuition.getCell(row, column + 1).value = value);
    row += 1;
    blockDates.forEach((date, index) => {
      tuition.getCell(row, 1).value = "Học sinh Ẩn danh";
      tuition.getCell(row, 2).value = "18:00-19:30";
      tuition.getCell(row, 3).value = new Date(`${date}T00:00:00Z`);
      tuition.getCell(row, 3).numFmt = "d/m/yyyy";
      row += 1;
      if (paidAfter === index + 1) { tuition.getCell(row, 6).value = "PAID"; row += 1; }
    });
    assert.equal(postPaidCount, paidAfter == null ? 0 : blockDates.length - paidAfter);
    tuition.getCell(row, 1).value = "TOTAL";
    row += 1;
  };
  addBlock(first, 8, 2);
  addBlock(second, 8);
  addBlock(current, null);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function longHistoryWorkbookBytes(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  const dateAt = (offset: number) => new Date(Date.UTC(2025, 0, 1 + offset)).toISOString().slice(0, 10);
  const paidBlocks = Array.from({ length: 7 }, (_, block) =>
    Array.from({ length: 8 }, (_, item) => dateAt(31 + block * 8 + item)));
  const postPaid = [dateAt(87), dateAt(88)];
  const current = [dateAt(89), dateAt(90), dateAt(91)];
  const tuitionOnly = new Set(paidBlocks.slice(0, 6).map((block) => block[0]));
  const learningDates = [
    ...Array.from({ length: 14 }, (_, index) => dateAt(index)),
    ...paidBlocks.flat().filter((date) => !tuitionOnly.has(date)), ...postPaid, ...current,
    dateAt(19), dateAt(20),
  ];
  learningDates.forEach((date, index) => {
    const row = index * 5 + 1;
    learning.getCell(row, 1).value = "DATE"; learning.getCell(row, 2).value = date;
    learning.getCell(row, 3).value = "CONTENT - NỘI DUNG HỌC"; learning.getCell(row, 6).value = `Nội dung ẩn danh ${index + 1}`;
    learning.getCell(row + 1, 1).value = "TEACHER"; learning.getCell(row + 1, 2).value = "Giáo viên";
    ["STT", "FULL NAME", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) =>
      learning.getCell(row + 2, column + 1).value = value);
    learning.getCell(row + 3, 1).value = 1; learning.getCell(row + 3, 2).value = "Học sinh Ẩn danh";
    if (index >= learningDates.length - 2) learning.getCell(row + 3, 4).value = "x";
  });
  const tuition = workbook.addWorksheet("Học phí");
  let row = 1;
  const addBlock = (dates: string[], paid: boolean) => {
    ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, column) =>
      tuition.getCell(row, column + 1).value = value);
    row += 1;
    dates.forEach((date, index) => {
      tuition.getCell(row, 1).value = "Học sinh Ẩn danh"; tuition.getCell(row, 2).value = "20h-22h";
      tuition.getCell(row, 3).value = new Date(`${date}T00:00:00Z`); row += 1;
      if (paid && index === 7) { tuition.getCell(row, 6).value = "PAID"; row += 1; }
    });
  };
  paidBlocks.forEach((dates, index) => {
    addBlock(index === 0 ? [...dates, ...postPaid] : dates, true);
    tuition.getCell(row, 1).value = "TOTAL"; row += 1;
  });
  addBlock(current, false);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("lessonTimes normalizes supported legacy durations and rejects invalid ranges", () => {
  const validCases = [
    ["8h30-10h", { start: "08:30", end: "10:00" }],
    ["8h-10h", { start: "08:00", end: "10:00" }],
    ["8h30-10h30", { start: "08:30", end: "10:30" }],
    ["8:30-10:00", { start: "08:30", end: "10:00" }],
    ["08.30 – 10.00", { start: "08:30", end: "10:00" }],
    ["20h-21h35)", { start: "20:00", end: "21:35" }],
    ["20h-21h35", { start: "20:00", end: "21:35" }],
    ["20h-22h", { start: "20:00", end: "22:00" }],
    ["20h5-22h", { start: "20:05", end: "22:00" }],
    ["20h8-22h", { start: "20:08", end: "22:00" }],
    ["20-22h", { start: "20:00", end: "22:00" }],
    ["7h15-9h5", { start: "19:15", end: "21:05" }],
  ] as const;
  for (const [value, expected] of validCases) assert.deepEqual(lessonTimes(value), expected);

  for (const value of ["25h-26h", "8h75-10h", "10h-8h", "10h-10h", "20h-10h", "5h-6h30pm", null, ""]) {
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

test("LegacyDateNormalizer rejects non-modern years without guessing a correction", () => {
  const normalizer = new LegacyDateNormalizer();
  assert.equal(normalizer.normalizeFullDate("27/7/0226", "27/7/0226"), null);
  assert.equal(normalizer.normalizeFullDate("27/7/2026", "27/7/2026"), "2026-07-27");
  assert.equal(normalizer.normalizeFullDate("27/7/26", "27/7/26"), "2026-07-27");
});

test("a learning row with year 0226 is blocked as INVALID_DATE in preview", async () => {
  const bytes = await workbookBytes([{ date: "27/7/0226" }], ["2026-07-27"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.lessons[0].normalizedDate, null);
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "invalid-year.xlsx", size: bytes.length, sha256: "5".repeat(64) }, result);
    const row = preview.rows.find((item) => item.rowType === "LESSON")!;
    assert.equal(row.status, "BLOCKED");
    assert.ok(row.issueCodes.includes("INVALID_DATE"));
  });
});

test("an EDIT_ROW date outside preview bounds expands the single workbook runtime", async () => {
  const bytes = await workbookBytes([{ date: "không rõ" }], ["2026-07-18"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "edited-date.xlsx", size: bytes.length, sha256: "6".repeat(64) }, result);
    const lessonRow = preview.rows.find((row) => row.rowType === "LESSON")!;
    const periodRow = preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD")!;
    const groupRow = preview.rows.find((row) => row.rowType === "TUITION_GROUP")!;
    const decisions = [
      ...lessonRow.issueCodes.map((issueCode) => ({
        sourceSheet: lessonRow.sourceSheet, sourceRow: lessonRow.sourceRow, issueCode,
        action: "EDIT_ROW" as const, resolvedValue: { date: "2026-08-01", startTime: "18:00", endTime: "19:30" },
      })),
      { sourceSheet: periodRow.sourceSheet, sourceRow: periodRow.sourceRow,
        issueCode: "ACADEMIC_PERIOD_MAPPING_REQUIRED" as const, action: "MAP_ACADEMIC_PERIOD" as const,
        resolvedValue: { periodId: preview.academicPeriods[0].id, gradeLevel: 6,
          classMapping: { type: "CREATE_CLOSED_CLASS" as const, proposedName: "Lớp lịch sử" } } },
      { sourceSheet: groupRow.sourceSheet, sourceRow: groupRow.sourceRow,
        issueCode: "TUITION_ONLY_GROUP" as const, action: "SKIP" as const, reason: "NOT_NEEDED" as const },
    ];
    const rows = resolveLegacyImportDecisions(preview, decisions);
    const repository = new LegacyImportRepository() as unknown as {
      periodRuntimes: (inputPreview: typeof preview, inputRows: typeof rows) => Array<{
        fromDate: string; toDate: string | null; dataFromDate: string; dataToDate: string;
      }>;
    };
    const runtime = repository.periodRuntimes(preview, rows)[0];
    assert.deepEqual(
      [runtime.fromDate, runtime.toDate, runtime.dataFromDate, runtime.dataToDate],
      ["2026-07-18", "2026-08-01", "2026-08-01", "2026-08-01"],
    );
  });
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

test("LegacyWorkbookParser recognizes a colored PAID marker in column G", async () => {
  const dates = Array.from({ length: 8 }, (_, index) => `2025-06-${String(index + 1).padStart(2, "0")}`);
  const bytes = await workbookBytes(dates.map((date) => ({ date })), dates, 8, "18:00-19:30", 7);
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.tuitionBlocks[0].paidMarkerSourceRow, 10);
    assert.equal(parsed.tuitionBlocks[0].paidCandidateSourceRows.length, 8);
    const result = new LegacyReconciliationEngine().reconcile(parsed);
    assert.deepEqual(result.tuitionCycles.map((cycle) => [cycle.itemCount, cycle.paymentState]), [[8, "PAID_CLEAR"]]);
  });
});

test("TOTAL HOURS terminates a block and explicit PAID or UNPAID controls payment state", async () => {
  const dates = Array.from({ length: 8 }, (_, index) => `2025-08-${String(index + 1).padStart(2, "0")}`);
  for (const marker of ["PAID", "UNPAID"] as const) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await workbookBytes(dates.map((date) => ({ date })), dates) as never);
    const tuition = workbook.getWorksheet("Học phí")!;
    tuition.getCell(10, 1).value = "TOTAL HOURS";
    tuition.getCell(10, 6).value = marker;
    await withWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), async (path) => {
      const parsed = await new LegacyWorkbookParser().parse(path);
      assert.equal(parsed.tuitionBlocks[0].sourceEndRow, 10);
      assert.equal(parsed.tuitionBlocks[0].paidMarkerSourceRow, marker === "PAID" ? 10 : null);
      assert.equal(parsed.tuitionBlocks[0].unpaidMarkerSourceRow, marker === "UNPAID" ? 10 : null);
      const result = new LegacyReconciliationEngine().reconcile(parsed);
      assert.equal(result.tuitionCycles[0].paymentState, marker === "PAID" ? "PAID_CLEAR" : "UNPAID");
      assert.equal(result.paymentEvents.length, 0);
    });
  }
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

test("a clear PAID block makes only its post-marker rows FREE until TOTAL", async () => {
  const bytes = await blockedTuitionWorkbookBytes();
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.tuitionBlocks.length, 3);
    assert.deepEqual(parsed.tuitionBlocks[0].paidCandidateSourceRows.length, 8);
    const result = new LegacyReconciliationEngine().reconcile(parsed);
    assert.deepEqual(result.tuitionCycles.map((cycle) => [cycle.itemCount, cycle.paymentState]),
      [[8, "PAID_CLEAR"], [8, "PAID_CLEAR"], [3, "UNPAID"]]);
    const postPaidLessons = result.lessons.filter((lesson) =>
      ["2026-03-28", "2026-03-29"].includes(lesson.normalizedDate ?? ""));
    assert.deepEqual(postPaidLessons.map((lesson) => [lesson.attendanceStatus, lesson.billingType]),
      [["FREE", "NONE"], ["FREE", "NONE"]]);
    assert.ok(postPaidLessons.every((lesson) => lesson.content?.startsWith("Nội dung ẩn danh")));
    assert.equal(result.lessons.filter((lesson) => lesson.billingType === "BILLABLE").length, 19);
    assert.equal(result.tuitionRows.filter((row) => row.postPaidFree).length, 2);
    assert.ok(result.paymentEvents.every((event) => !event.requiresReview && event.date == null));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "d".repeat(64) }, result);
    assert.equal(preview.summary.paidCycleCount, 2);
    assert.equal(preview.summary.freeLessonCount, 2);
    assert.equal(preview.summary.postPaidFreeLessonCount, 2);
    assert.equal(preview.summary.currentCycleProgress, 3);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("PAYMENT_REVIEW_REQUIRED")).length, 0);
    assert.equal(preview.rows.filter((row) => row.normalizedValues.legacyReason != null).length, 0);
  });
});

test("an ambiguous six-row PAID block never infers post-marker FREE", async () => {
  const dates = Array.from({ length: 8 }, (_, index) => `2026-04-${String(index + 1).padStart(2, "0")}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await workbookBytes(dates.map((date) => ({ date })), dates) as never);
  const tuition = workbook.getWorksheet("Học phí")!;
  tuition.getCell(7, 6).value = "PAID";
  tuition.getCell(10, 1).value = "TOTAL HOURS";
  await withWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.paymentEvents.length, 1);
    assert.equal(result.paymentEvents[0].requiresReview, true);
    assert.equal(result.tuitionRows.filter((row) => row.postPaidFree).length, 0);
    assert.ok(result.lessons.every((lesson) => lesson.attendanceStatus === "PRESENT"));
    assert.ok(result.tuitionCycles.every((cycle) => cycle.paymentState === "NEEDS_REVIEW"));
  });
});

test("an invalid tuition date stays visible and blocks Apply instead of being dropped", async () => {
  const bytes = await workbookBytes([{ date: "2026-07-27" }], [
    { date: "2026-07-26", rawDate: "27/7/0226", time: "17h-18h30" },
    { date: "2026-07-27", time: "17h-18h30" },
  ]);
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.deepEqual(parsed.invalidTuitionRows.map((row) => [row.sourceRow, row.rawDate]), [[2, "27/7/0226"]]);
    assert.equal(parsed.tuitionRows[0].date, "2026-07-27");
    const result = new LegacyReconciliationEngine().reconcile(parsed);
    const invalid = result.tuitionRows.find((row) => row.sourceRow === 2)!;
    assert.equal(invalid.date, null);
    assert.equal(invalid.rawDate, "27/7/0226");
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "invalid-tuition-date.xlsx", size: bytes.length, sha256: "7".repeat(64) }, result);
    const invalidRow = preview.rows.find((row) => row.sourceSheet === "Học phí" && row.sourceRow === 2)!;
    assert.equal(invalidRow.status, "BLOCKED");
    assert.deepEqual(invalidRow.issueCodes, ["INVALID_TUITION_DATE"]);
    assert.equal(invalidRow.rawValues.date, "27/7/0226");
    assert.deepEqual(invalidRow.supportedActions, []);
    assert.throws(() => resolveLegacyImportDecisions(preview, []),
      /Sheet Học phí, dòng 2 có ngày không hợp lệ: "27\/7\/0226"\. Hãy sửa file rồi tải lại\./);
  });
});

test("an ambiguous ten-row block before PAID stays grouped for payment review", async () => {
  const dates = Array.from({ length: 10 }, (_, index) => `2025-07-${String(index + 1).padStart(2, "0")}`);
  const bytes = await workbookBytes(dates.map((date) => ({ date })), dates, 10);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.deepEqual(result.tuitionCycles.map((cycle) => cycle.itemCount), [8, 2]);
    assert.equal(result.paymentEvents.length, 1);
    assert.equal(result.paymentEvents[0].recommendedResolution, "UNDETERMINED");
    assert.equal(result.paymentEvents[0].requiresReview, true);
    assert.deepEqual(result.paymentEvents[0].resolutionOptions, ["EXCLUDE_FINANCE"]);
  });
});

test("preview keeps one workbook class context across 01/06 and uses its filename grade", async () => {
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
    assert.equal(preview.academicPeriods.length, 1);
    assert.equal(preview.academicPeriods[0].gradeLevel, 9);
    assert.equal(preview.academicPeriods[0].fromDate, "2025-05-31");
    assert.equal(preview.academicPeriods[0].toDate, "2026-06-01");
    assert.equal(preview.academicPeriods[0].lessonCount, 3);
    assert.deepEqual(preview.academicPeriods[0].proposedClassMapping,
      { type: "CURRENT_CLASS", classId: 4, className: "Lớp hiện tại" });
  });
});

test("preview falls back to a closed historical class when the student has no current class", async () => {
  const bytes = await workbookBytes([{ date: "2026-06-01" }], ["2026-06-01"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture Grade 3.xlsx", size: bytes.length, sha256: "4".repeat(64) }, result);
    assert.equal(preview.academicPeriods[0].proposedClassMapping.type, "CREATE_CLOSED_CLASS");
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
    const absentRow = preview.rows.find((row) => row.id === absent.id);
    assert.ok(!absentRow?.issueCodes.includes("INVALID_TIME"));
    assert.ok(!absentRow?.issueCodes.includes("ATTENDANCE_AMBIGUOUS"));
    assert.equal(absentRow?.normalizedValues.countsForTuition, false);
  });
});

test("a present learning-only lesson is valid without tuition evidence and stays non-billable", async () => {
  const bytes = await workbookBytes([{ date: "2026-07-01" }, { date: "2026-07-08" }],
    [{ date: "2026-07-08", time: "20h-22h" }]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const learningOnly = result.lessons[0];
    assert.equal(learningOnly.reconciliationStatus, "LEARNING_ONLY_PRESENT");
    assert.equal(learningOnly.attendanceStatus, "PRESENT");
    assert.equal(learningOnly.billingType, "NONE");
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "Học sinh Grade 3.xlsx", size: bytes.length, sha256: "1".repeat(64) }, result);
    const row = preview.rows.find((item) => item.id === learningOnly.id)!;
    assert.ok(!row.issueCodes.includes("ATTENDANCE_AMBIGUOUS"));
    assert.equal(row.normalizedValues.countsForTuition, false);
    assert.equal(row.normalizedValues.reconciliationNote, "Không có dữ liệu học phí đối chiếu");
  });
});

test("missing lesson times stay in local confirmations instead of one workbook-wide mapping", async () => {
  const dates = ["2026-06-10", "2026-06-15", "2026-06-17", "2026-06-22", "2026-06-24",
    "2026-06-29", "2026-07-01", "2026-07-06", "2026-07-08", "2026-07-13", "2026-07-15"];
  const bytes = await workbookBytes(dates.map((date, index) => ({ date, absent: index === 3 || index === 4 })),
    dates.filter((_, index) => index !== 3 && index !== 4), undefined, "3h30-5h");
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.deepEqual(reconciled.lessons.filter((lesson) => lesson.attendanceStatus === "ABSENT")
      .map((lesson) => [lesson.scheduledStartTime, lesson.scheduledEndTime]), [["15:30", "17:00"], ["15:30", "17:00"]]);
    assert.equal(reconciled.timeMappings.length, 3);
    assert.equal(Math.max(...reconciled.timeMappings.map((mapping) => mapping.lessonSourceRows.length)), 9);
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "b".repeat(64) }, reconciled);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("TIME_MAPPING_REQUIRED")).length, 3);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("INVALID_TIME")).length, 0);
    const mappingRows = preview.rows.filter((row) => row.rowType === "TIME_MAPPING");
    const resolved = resolveLegacyImportDecisions({ ...preview,
      rows: preview.rows.filter((row) => row.rowType === "LESSON" || row.rowType === "TIME_MAPPING") },
    mappingRows.map((mappingRow) => ({
      sourceSheet: mappingRow.sourceSheet, sourceRow: mappingRow.sourceRow, issueCode: "TIME_MAPPING_REQUIRED" as const,
      action: "CONFIRM_TIME_MAPPING" as const, resolvedValue: { mappingId: String(mappingRow.normalizedValues.mappingId),
        startTime: "15:30", endTime: "17:00" },
    })));
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

test("single-digit h-minutes are parsed as literal zero-padded minutes", async () => {
  assert.deepEqual(lessonTimes("20h8-22h"), { start: "20:08", end: "22:00" });
  const bytes = await workbookBytes([{ date: "2025-09-03" }, { date: "2025-09-06" }],
    [{ date: "2025-09-03", time: "20h-22h" }, { date: "2025-09-06", time: "20h8-22h" }]);
  await withWorkbook(bytes, async (path) => {
    const reconciled = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.deepEqual(reconciled.lessons.map((lesson) => [lesson.scheduledStartTime, lesson.scheduledEndTime]),
      [["20:00", "22:00"], ["20:08", "22:00"]]);
    assert.ok(!reconciled.timeMappings.some((item) => item.rawValues.includes("20h8-22h")));
  });
});

test("shifted learning headers and FREE plus eight BILLABLE rows produce one exact PAID cycle", async () => {
  const workbook = new ExcelJS.Workbook();
  const learning = workbook.addWorksheet("Quá trình học tập");
  const dates = Array.from({ length: 9 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`);
  dates.forEach((date, index) => {
    const row = index * 5 + 1;
    learning.getCell(row, 1).value = "DATE"; learning.getCell(row, 2).value = date;
    learning.getCell(row, 4).value = "CONTENT - NỘI DUNG HỌC"; learning.getCell(row, 7).value = `Nội dung lệch ${index + 1}`;
    learning.getCell(row + 1, 1).value = "TEACHER"; learning.getCell(row + 1, 2).value = "Giáo viên";
    ["STT", "FULL NAME", "", "", "ABSENCE", "BTVN", "BÀI TẠI LỚP", "GHI CHÚ"].forEach((value, column) =>
      learning.getCell(row + 2, column + 1).value = value);
    learning.getCell(row + 3, 1).value = 1; learning.getCell(row + 3, 2).value = "Học sinh Mẫu";
    learning.getCell(row + 3, 6).value = `BTVN ${index + 1}`; learning.getCell(row + 3, 8).value = `Ghi chú ${index + 1}`;
  });
  const tuition = workbook.addWorksheet("Học phí");
  ["FULL NAME", "DURATION", "DATE", "HOURS", "VIETINBANK", ""].forEach((value, index) => tuition.getCell(1, index + 1).value = value);
  dates.forEach((date, index) => {
    const row = index + 2; tuition.getCell(row, 1).value = "Học sinh Mẫu"; tuition.getCell(row, 2).value = "20h-22h";
    tuition.getCell(row, 3).value = new Date(`${date}T00:00:00Z`);
    if (index === 0) tuition.getCell(row, 5).value = " free ";
  });
  tuition.getCell(11, 6).value = "PAID";
  await withWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.learningRows[0].content, "Nội dung lệch 1");
    assert.equal(parsed.learningRows[0].homework, "BTVN 1");
    assert.equal(parsed.learningRows[0].note, "Ghi chú 1");
    assert.equal(parsed.tuitionRows[0].kind, "FREE");
    assert.equal(parsed.tuitionBlocks[0].paidCandidateSourceRows.length, 8);
    const result = new LegacyReconciliationEngine().reconcile(parsed);
    assert.equal(result.lessons.filter((lesson) => lesson.attendanceStatus === "FREE").length, 1);
    assert.deepEqual(result.tuitionCycles.map((cycle) => [cycle.itemCount, cycle.paymentState]), [[8, "PAID_CLEAR"]]);
  });
});

test("exact reservations prevent a nearby learning row from stealing another row's exact tuition date", async () => {
  const bytes = await workbookBytes([{ date: "2026-11-14" }, { date: "2026-11-15" }], ["2026-11-12", "2026-11-15"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.lessons[1].matchedTuitionSourceRow, 3);
    assert.equal(result.lessons[1].reconciliationStatus, "MATCHED");
    assert.equal(result.lessons[0].matchedTuitionSourceRow, 2);
  });
});

test("duplicate tuition date keeps the later learning date and flags the tuition direction", async () => {
  const bytes = await workbookBytes([{ date: "2026-07-03" }, { date: "2026-07-04" }], ["2026-07-03", "2026-07-03"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.lessons[1].normalizedDate, "2026-07-04");
    assert.equal(result.lessons[1].suggestedDate, null);
    assert.equal(result.lessons[1].matchedTuitionSourceRow, 3);
    assert.equal(result.lessons[1].reconciliationStatus, "DATE_CORRECTION_SUGGESTED");
  });
});

test("a full block without PAID remains reviewable and never silently becomes historical debt", async () => {
  const dates = Array.from({ length: 8 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`);
  const bytes = await workbookBytes(dates.map((date) => ({ date })), dates);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.tuitionCycles[0].paymentState, "NEEDS_REVIEW");
    assert.equal(result.paymentEvents[0].kind, "MISSING_PAYMENT_STATUS");
    assert.deepEqual(result.paymentEvents[0].resolutionOptions, ["PAID_UNDATED", "UNPAID", "EXCLUDE_FINANCE"]);
  });
});

test("tuition marker kinds are normalized and never enter a billable candidate", async () => {
  const bytes = await workbookBytes(
    [{ date: "2026-10-01" }, { date: "2026-10-02" }, { date: "2026-10-03" }, { date: "2026-10-04" }],
    [{ date: "2026-10-01", marker: " free " }, { date: "2026-10-02", marker: " v " },
      { date: "2026-10-03", marker: " OFF " }, { date: "2026-10-04", marker: "123456789012" }], 4,
  );
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.deepEqual(parsed.tuitionRows.map((row) => row.kind), ["FREE", "ABSENT", "OFF", "BILLABLE"]);
    assert.deepEqual(parsed.tuitionBlocks[0].paidCandidateSourceRows, [5]);
  });
});

test("7h is ambiguous while distinct malformed raw times keep separate mappings", async () => {
  const ambiguous = await workbookBytes([{ date: "2026-12-01" }], [{ date: "2026-12-01", time: "7:30-9h" }]);
  await withWorkbook(ambiguous, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.timeMappings[0].reason, "AMBIGUOUS_12H");
    assert.deepEqual([result.timeMappings[0].proposedStartTime, result.timeMappings[0].proposedEndTime], ["19:30", "21:00"]);
  });
  const rawTimes = ["20h-22h", "20h8-22h", "20h5-22h", "20h-21h35)", "20h-10h"];
  const dates = rawTimes.map((_, index) => `2026-12-${String(index + 1).padStart(2, "0")}`);
  const grouped = await workbookBytes(dates.map((date) => ({ date })), dates.map((date, index) => ({ date, time: rawTimes[index] })));
  await withWorkbook(grouped, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.ok(!result.timeMappings.some((item) => item.rawValues.includes("20h-21h35)")));
    assert.equal(result.lessons[3].scheduledStartTime, "20:00");
    assert.equal(result.lessons[3].scheduledEndTime, "21:35");
    assert.ok(!result.timeMappings.some((item) => item.rawValues.includes("20h8-22h") || item.rawValues.includes("20h5-22h")));
    assert.equal(result.timeMappings.filter((item) => item.rawValues.includes("20h-10h")).length, 1);
  });
});

test("a backward full tuition date proposes a structured year correction", async () => {
  const dates = ["2025-12-29", "2026-01-03", "2026-01-19", "2025-01-24", "2026-01-26"];
  const bytes = await workbookBytes(dates.map((date) => ({ date: date === "2025-01-24" ? "2026-01-24" : date })), dates);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    assert.equal(result.tuitionRows.find((row) => row.date === "2025-01-24")?.suggestedDate, "2026-01-24");
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture.xlsx", size: bytes.length, sha256: "e".repeat(64) }, result);
    assert.equal(preview.rows.filter((row) => row.issueCodes.includes("TUITION_DATE_CORRECTION")).length, 1);
  });
});

test("long-history fixture collapses row noise into grouped decisions and stable cycle plans", async () => {
  const bytes = await longHistoryWorkbookBytes();
  await withWorkbook(bytes, async (path) => {
    const parsed = await new LegacyWorkbookParser().parse(path);
    assert.equal(parsed.learningRows.length, 71);
    assert.equal(parsed.tuitionRows.length, 61);
    const result = new LegacyReconciliationEngine().reconcile(parsed);
    assert.equal(result.minimalLessonGroups[0].lessonCount, 6);
    assert.equal(result.tuitionCycles.filter((cycle) => cycle.paymentState === "PAID_CLEAR").length, 7);
    assert.equal(result.lessons.filter((lesson) => lesson.attendanceStatus === "FREE").length, 2);
    assert.equal(result.tuitionCycles.at(-1)?.itemCount, 3);
    assert.deepEqual(result.tuitionCycles.map((cycle) => cycle.blockId), result.tuitionCyclePlans.map((plan) => plan.blockId));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "long-history.xlsx", size: bytes.length, sha256: "f".repeat(64) }, result);
    assert.equal(preview.rows.filter((row) => row.rowType === "TUITION_GROUP").length, 1);
    const timeMappings = preview.timeMappings;
    assert.ok(timeMappings.length > 2);
    assert.ok(timeMappings.every((mapping) => mapping.lessonSourceRows.length <= 1));
    assert.ok(timeMappings.filter((mapping) => mapping.proposedStartTime == null).length > 0);
  });
});

test("time mapping affected lesson count does not double-count matched tuition rows", async () => {
  const dates = ["2026-12-01", "2026-12-02"];
  const bytes = await workbookBytes(dates.map((date) => ({ date })),
    dates.map((date) => ({ date, time: "7h30-9h" })));
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture Grade 3.xlsx", size: bytes.length, sha256: "2".repeat(64) }, result);
    const mappingRow = preview.rows.find((row) => row.rowType === "TIME_MAPPING")!;
    assert.equal(mappingRow.rawValues.affectedLessonCount, 2);
    assert.equal(mappingRow.rawValues.affectedTuitionRowCount, 2);
  });
});

test("suggested date correction is preserved as a structured preview resolution", async () => {
  const bytes = await workbookBytes([{ date: "2026-11-14" }], ["2026-11-15"]);
  await withWorkbook(bytes, async (path) => {
    const result = new LegacyReconciliationEngine().reconcile(await new LegacyWorkbookParser().parse(path));
    const preview = new LegacyImportPreview().build(previewStudent(), [],
      { name: "fixture Grade 3.xlsx", size: bytes.length, sha256: "3".repeat(64) }, result);
    const correction = preview.rows.find((row) => row.issueCodes.includes("DATE_CORRECTION"))!;
    assert.deepEqual(correction.suggestedResolution, {
      sourceSheet: "Quá trình học tập", sourceRow: correction.sourceRow,
      issueCode: "DATE_CORRECTION", action: "EDIT_ROW", resolvedValue: { date: "2026-11-15" },
    });
  });
});
