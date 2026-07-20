import type {
  MarkTuitionPaidRequest,
  TuitionCycleStatus,
} from "@teacher/shared";

export interface PayableCycleSnapshot {
  status: TuitionCycleStatus;
  itemCount: number;
  packagePriceSnapshot: number;
  paidAmount: number | null;
  paidAt: string | null;
  paymentMethod: "CASH" | "BANK_TRANSFER" | null;
  paymentNote: string | null;
}

export type TuitionPaymentDecision =
  | "MARK_PAID"
  | "IDEMPOTENT"
  | "NOT_DUE"
  | "INVALID_ITEM_COUNT"
  | "INVALID_AMOUNT"
  | "CONFLICT";

export function decideTuitionPayment(
  cycle: PayableCycleSnapshot,
  input: MarkTuitionPaidRequest,
): TuitionPaymentDecision {
  const note = input.paymentNote?.trim() || null;
  if (cycle.status === "PAID") {
    return cycle.paidAmount === input.paidAmount &&
      cycle.paidAt === input.paidAt &&
      cycle.paymentMethod === input.paymentMethod &&
      cycle.paymentNote === note
      ? "IDEMPOTENT"
      : "CONFLICT";
  }
  if (cycle.status !== "PAYMENT_DUE") return "NOT_DUE";
  if (cycle.itemCount !== 8) return "INVALID_ITEM_COUNT";
  if (input.paidAmount !== cycle.packagePriceSnapshot) return "INVALID_AMOUNT";
  return "MARK_PAID";
}
