import type { ElementType, ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { displayDate } from "../utils/date";

const visibleLabels: Record<string, string> = {
  ACTIVE: "Đang dạy",
  PAUSED: "Tạm dừng",
  CLOSED: "Đã đóng",
  INACTIVE: "Ngừng hoạt động",
  ENDED: "Đã ngừng học",
  PRESENT: "Có mặt",
  ABSENT: "Nghỉ",
  FREE: "Miễn phí",
  ACCUMULATING: "Chưa đủ 8 buổi",
  PAYMENT_DUE: "Cần thu",
  PAID: "Đã thu",
  INCOMPLETE: "Dở dang",
  CANCELLED: "Đã hủy",
  REGULAR: "Buổi thường",
  MAKEUP: "Buổi học bù",
  EXTRA: "Buổi học thêm",
  DRAFT: "Bản nháp",
  COMPLETED: "Đã hoàn thành",
  UNRECORDED: "Chưa ghi nhận",
  RECORDED: "Đã ghi nhận",
  SKIPPED: "Nghỉ",
  RESCHEDULED: "Đã đổi lịch",
};

export function visibleStatusLabel(value: string): string {
  return visibleLabels[value] ?? "Không xác định";
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <Stack direction="row" useFlexGap sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography component="h1" variant="h5" sx={{ overflowWrap: "anywhere" }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
    </Box>
    {action}
  </Stack>;
}

export function StatusBadge({ status }: { status: string }) {
  const color = status === "ACTIVE" || status === "COMPLETED" || status === "PAID" || status === "RECORDED" ? "success"
    : status === "PAYMENT_DUE" || status === "UNRECORDED" || status === "PAUSED" ? "warning"
      : status === "CLOSED" || status === "CANCELLED" || status === "ENDED" ? "default" : "primary";
  return <Chip size="small" color={color} variant={status === "INCOMPLETE" || status === "CLOSED" ? "outlined" : "filled"} label={visibleStatusLabel(status)} sx={{ flexShrink: 0 }} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Alert severity="error" role="alert" action={onRetry ? <Button color="inherit" onClick={onRetry}>Thử lại</Button> : undefined}>{message}</Alert>;
}

export function ConfirmationDialog({ open, title, children, confirmLabel, confirmTestId, busy = false, destructive = false, onCancel, onConfirm }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; busy?: boolean;
  confirmTestId?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <Dialog open={open} onClose={() => { if (!busy) onCancel(); }} fullWidth maxWidth="xs" aria-labelledby="confirmation-dialog-title">
    <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
    <DialogContent>{children}</DialogContent>
    <DialogActions sx={{ flexWrap: "wrap" }}>
      <Button disabled={busy} onClick={onCancel}>Quay lại</Button>
      <Button data-testid={confirmTestId} variant="contained" color={destructive ? "error" : "primary"} disabled={busy} onClick={onConfirm}>{busy ? "Đang xử lý…" : confirmLabel}</Button>
    </DialogActions>
  </Dialog>;
}

export function StickyActionBar({ children }: { children: ReactNode }) {
  return <Box data-testid="sticky-action-bar" sx={{ position: "sticky", bottom: { xs: "calc(var(--admin-nav-height) + env(safe-area-inset-bottom) + 8px)", md: 16 }, zIndex: 10, bgcolor: "background.default", py: 1 }}>
    <Stack direction="row" spacing={1} sx={{ justifyContent: { md: "flex-end" } }}>{children}</Stack>
  </Box>;
}

export function MobileCard({ children, ...props }: { children: ReactNode; component?: ElementType; to?: string }) {
  return <Card variant="outlined" {...props} sx={{ minWidth: 0, textDecoration: "none", color: "inherit" }}><CardContent>{children}</CardContent></Card>;
}

export function CurrencyDisplay({ value }: { value: number | null | undefined }) {
  return <Typography component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{value == null ? "—" : `${value.toLocaleString("vi-VN")}đ`}</Typography>;
}

export function DateTimeDisplay({ date, startTime, endTime }: { date?: string | null; startTime?: string | null; endTime?: string | null }) {
  const time = startTime ? `${startTime}${endTime ? `–${endTime}` : ""}` : "";
  return <Typography component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{[date ? displayDate(date) : "", time].filter(Boolean).join(" · ") || "—"}</Typography>;
}

export function ProgressCount({ value, target = 8, label = "Tiến độ" }: { value: number; target?: number; label?: string }) {
  const safeValue = Math.min(Math.max(value, 0), target);
  return <Stack spacing={0.75}>
    <Typography variant="subtitle2">{label} {safeValue}/{target}</Typography>
    <LinearProgress aria-label={`${label} ${safeValue} trên ${target}`} variant="determinate" value={target ? (safeValue / target) * 100 : 0} sx={{ height: 6, borderRadius: 4, bgcolor: "#e6e1f3", "& .MuiLinearProgress-bar": { borderRadius: 4 } }} />
  </Stack>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <Card variant="outlined"><CardContent><Stack spacing={2}>
    <Box><Typography component="h2" variant="h6">{title}</Typography>{description && <Typography variant="body2" color="text.secondary">{description}</Typography>}</Box>
    {children}
  </Stack></CardContent></Card>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <Stack direction="row" useFlexGap sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
    <Typography component="h2" variant="h6">{title}</Typography>
    {action}
  </Stack>;
}

export function SummaryMetricCard({ icon, value, label, tone = "default" }: {
  icon?: ReactNode; value: ReactNode; label: string; tone?: "default" | "primary" | "warning";
}) {
  return <Card variant="outlined" sx={{ bgcolor: tone === "primary" ? "#f2edff" : tone === "warning" ? "#fff7ed" : "background.paper" }}>
    <CardContent><Stack spacing={0.75}>
      {icon}
      <Typography component="p" variant="h6">{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Stack></CardContent>
  </Card>;
}

export function ResponsivePageContainer({ children, form = false }: { children: ReactNode; form?: boolean }) {
  return <Box sx={{ width: "100%", maxWidth: form ? "var(--app-form-width)" : "var(--app-content-width)", mx: "auto" }}>{children}</Box>;
}
