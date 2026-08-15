import assert from "node:assert/strict";
import test from "node:test";
import { filterTuitionBoardRows, tuitionBoardAmount, tuitionBoardDetailCycleId, tuitionBoardMultipleDue, tuitionBoardProgress } from "../src/features/tuition-board.ts";

function row(overrides = {}) {
  return {
    studentId: 1, studentName: "Ken", studentNickname: null, enrollmentId: 10, enrollmentStatus: "ACTIVE",
    classId: 2, className: "Lớp 3", tuitionMode: "CLASS_DEFAULT", tuitionTracking: "TRACKED",
    status: "LEARNING", currentProgress: { attended: 6, target: 8 }, currentAmount: 1_068_750,
    currentCycleId: 20, paymentDue: false, paymentDueCycleId: null, paymentDueAmount: null,
    paymentDueCount: 0, totalDueAmount: 0, lastPaidAt: null, hasAdvancePayment: false,
    needsReview: false, needsReviewCycleId: null, ...overrides,
  };
}

test("a due cycle takes the displayed amount while current progress stays on the new cycle", () => {
  const item = row({ currentProgress: { attended: 2, target: 8 }, paymentDue: true,
    paymentDueCycleId: 19, paymentDueAmount: 1_068_750, status: "PAYMENT_DUE" });
  assert.equal(tuitionBoardProgress(item), "2/8");
  assert.equal(tuitionBoardAmount(item), 1_068_750);
});

test("not configured and free rows display neither zero progress nor zero tuition", () => {
  for (const item of [
    row({ tuitionTracking: "NOT_CONFIGURED", status: "NOT_CONFIGURED", currentProgress: null, currentAmount: null }),
    row({ tuitionMode: "FREE", tuitionTracking: "FREE", status: "FREE", currentProgress: null, currentAmount: null }),
  ]) {
    assert.equal(tuitionBoardProgress(item), "—");
    assert.equal(tuitionBoardAmount(item), null);
  }
});

test("simple board filters preserve the server ordering", () => {
  const rows = [row({ studentName: "An", paymentDue: true }), row({ studentId: 2, enrollmentId: 11, studentName: "Bình", classId: 3 })];
  assert.deepEqual(filterTuitionBoardRows(rows, { search: "an", classId: "", scope: "ALL" }).map((item) => item.studentName), ["An"]);
  assert.deepEqual(filterTuitionBoardRows(rows, { search: "", classId: "", scope: "PAYMENT_DUE" }).map((item) => item.studentName), ["An"]);
});

test("multiple due cycles expose the student-level total while payment keeps the oldest cycle", () => {
  const item = row({ paymentDue: true, paymentDueCycleId: 18, paymentDueAmount: 1_200_000,
    paymentDueCount: 2, totalDueAmount: 2_400_000, status: "PAYMENT_DUE" });
  assert.deepEqual(tuitionBoardMultipleDue(item), { label: "2 khoản cần thu", totalAmount: 2_400_000 });
  assert.equal(item.paymentDueCycleId, 18);
});

test("review action targets the oldest unresolved cycle instead of the accumulating cycle", () => {
  const item = row({ currentCycleId: 22, currentProgress: { attended: 3, target: 8 },
    needsReview: true, needsReviewCycleId: 11, status: "NEEDS_REVIEW" });
  assert.equal(tuitionBoardDetailCycleId(item), 11);
  assert.equal(item.currentCycleId, 22);
});
