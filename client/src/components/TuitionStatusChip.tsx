import { Chip } from "@mui/material";
import type { TuitionCycleStatus } from "@teacher/shared";

const labels: Record<TuitionCycleStatus, string> = {
  ACCUMULATING: "Chưa đủ 8 buổi",
  PAYMENT_DUE: "Cần thu",
  PAID: "Đã thu",
  INCOMPLETE: "Dở dang",
  CANCELLED: "Đã hủy",
};

export function tuitionStatusLabel(status: TuitionCycleStatus): string {
  return labels[status];
}

export function TuitionStatusChip({ status }: { status: TuitionCycleStatus }) {
  const color = status === "PAID" ? "success"
    : status === "PAYMENT_DUE" ? "warning"
      : status === "INCOMPLETE" ? "default" : "primary";
  return <Chip data-tuition-tone={status === "ACCUMULATING" ? "blue" : status === "PAYMENT_DUE" ? "orange" : status === "PAID" ? "green" : "neutral"} size="small" color={color} variant={status === "INCOMPLETE" || status === "CANCELLED" ? "outlined" : "filled"} label={labels[status]} />;
}
