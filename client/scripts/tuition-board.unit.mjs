import assert from "node:assert/strict";
import test from "node:test";
import {
  filterTuitionBoardRows,
  moveTuitionMonth,
  tuitionAttendanceLabel,
} from "../src/features/tuition-board.ts";

function row(overrides = {}) {
  return {
    paymentId: null, enrollmentId: 10, studentId: 1, studentName: "Ken",
    studentNickname: null, classId: 2, className: "Lớp 3", year: 2026, month: 9,
    attendance: { present: 6, absent: 2, total: 8 }, status: "UNPAID",
    amount: null, paidAt: null, note: null, ...overrides,
  };
}

test("attendance is displayed as present over total with a separate absent count", () => {
  assert.deepEqual(tuitionAttendanceLabel(row()), { progress: "6/8", absent: "Vắng 2" });
  assert.deepEqual(
    tuitionAttendanceLabel(row({ attendance: { present: 7, absent: 2, total: 9 } })),
    { progress: "7/9", absent: "Vắng 2" },
  );
});

test("month navigation crosses year boundaries without normalizing invalid input", () => {
  assert.deepEqual(moveTuitionMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(moveTuitionMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.throws(() => moveTuitionMonth({ year: 2026, month: 13 }, 1), /month/i);
});

test("board filters preserve server ordering and support paid status", () => {
  const rows = [
    row({ studentName: "An", status: "PAID", paymentId: 5, paidAt: "2026-09-20" }),
    row({ enrollmentId: 11, studentId: 2, studentName: "Bình", classId: 3 }),
  ];
  assert.deepEqual(filterTuitionBoardRows(rows, { search: "an", classId: "", scope: "ALL" }).map((item) => item.studentName), ["An"]);
  assert.deepEqual(filterTuitionBoardRows(rows, { search: "", classId: "", scope: "PAID" }).map((item) => item.studentName), ["An"]);
  assert.deepEqual(filterTuitionBoardRows(rows, { search: "", classId: "3", scope: "UNPAID" }).map((item) => item.studentName), ["Bình"]);
});

test("amount stays optional after a month is marked paid", () => {
  const paid = row({ status: "PAID", amount: null, paidAt: "2026-09-20" });
  assert.equal(paid.amount, null);
  assert.equal(paid.status, "PAID");
});
