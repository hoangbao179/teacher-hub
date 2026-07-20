import assert from "node:assert/strict";
import test from "node:test";
import type { MarkTuitionPaidRequest } from "@teacher/shared";
import {
  decideTuitionPayment,
  type PayableCycleSnapshot,
} from "./tuition-payment";

const payment: MarkTuitionPaidRequest = {
  paidAmount: 2_400_000,
  paidAt: "2026-07-20",
  paymentMethod: "BANK_TRANSFER",
  paymentNote: "Đã nhận",
};

const due: PayableCycleSnapshot = {
  status: "PAYMENT_DUE",
  itemCount: 8,
  packagePriceSnapshot: 2_400_000,
  paidAmount: null,
  paidAt: null,
  paymentMethod: null,
  paymentNote: null,
};

test("PAYMENT_DUE with eight items and exact snapshot may become PAID", () => {
  assert.equal(decideTuitionPayment(due, payment), "MARK_PAID");
});

test("ACCUMULATING and INCOMPLETE cycles cannot be paid", () => {
  assert.equal(decideTuitionPayment({ ...due, status: "ACCUMULATING" }, payment), "NOT_DUE");
  assert.equal(decideTuitionPayment({ ...due, status: "INCOMPLETE" }, payment), "NOT_DUE");
});

test("partial payment and overpayment are rejected", () => {
  assert.equal(decideTuitionPayment(due, { ...payment, paidAmount: 2_000_000 }), "INVALID_AMOUNT");
  assert.equal(decideTuitionPayment(due, { ...payment, paidAmount: 2_500_000 }), "INVALID_AMOUNT");
});

test("a due cycle must contain exactly eight stored items", () => {
  assert.equal(decideTuitionPayment({ ...due, itemCount: 7 }, payment), "INVALID_ITEM_COUNT");
});

test("identical paid replay is idempotent while conflicting data is rejected", () => {
  const paid: PayableCycleSnapshot = {
    ...due,
    status: "PAID",
    paidAmount: payment.paidAmount,
    paidAt: payment.paidAt,
    paymentMethod: payment.paymentMethod,
    paymentNote: payment.paymentNote!,
  };
  assert.equal(decideTuitionPayment(paid, payment), "IDEMPOTENT");
  assert.equal(decideTuitionPayment(paid, { ...payment, paymentMethod: "CASH" }), "CONFLICT");
});
