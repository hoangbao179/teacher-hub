import { Chip } from "@mui/material";
import type { TuitionCycleStatus } from "@teacher/shared";

const labels: Record<TuitionCycleStatus, string> = {
  ACCUMULATING: "Đang tích lũy",
  PAYMENT_DUE: "Cần thu",
  PAID: "Đã thu",
  INCOMPLETE: "Chưa hoàn thành",
  CANCELLED: "Đã hủy",
};

export function tuitionStatusLabel(status: TuitionCycleStatus): string {
  return labels[status];
}

export function TuitionStatusChip({ status }: { status: TuitionCycleStatus }) {
  const color = status === "PAID" ? "success"
    : status === "PAYMENT_DUE" ? "warning"
      : status === "INCOMPLETE" ? "default" : "primary";
  return <Chip size="small" color={color} variant={status === "INCOMPLETE" ? "outlined" : "filled"} label={labels[status]} />;
}
