import { ArrowBack, Lock, Payments } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { PaymentMethod, TuitionCycleDetail } from "@teacher/shared";
import { getTuitionCycle, settleIncompleteCycle } from "../api/tuition";
import { LoadingState } from "../components/LoadingState";
import { TuitionStatusChip } from "../components/TuitionStatusChip";
import { DateTimeDisplay, PageHeader, StickyActionBar } from "../components/UiKit";

export function TuitionDetailPage() {
  const { cycleId } = useParams();
  const location = useLocation();
  const id = Number(cycleId);
  const [item, setItem] = useState<TuitionCycleDetail | null>(null);
  const [error, setError] = useState("");
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleType, setSettleType] = useState<"SETTLE" | "WAIVE">("SETTLE");
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reason, setReason] = useState("");
  const success = (location.state as { success?: string } | null)?.success;
  const load = useCallback(() => {
    return getTuitionCycle(id).then(setItem).catch((reason: Error) => setError(reason.message));
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const settle = async () => { if (!item) return; setError(""); try {
    const updated = await settleIncompleteCycle(item.id, settleType === "SETTLE"
      ? { type: "SETTLE", amount: Number(amount), method, reason }
      : { type: "WAIVE", reason });
    setItem(updated); setSettleOpen(false);
  } catch (value) { setError((value as Error).message); } };

  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error" action={<Button color="inherit" onClick={() => { setError(""); void load(); }}>Thử lại</Button>}>{error || "Không tải được đợt học phí."}</Alert>;
  const visibleItems = item.items.filter((entry) => entry.attendanceStatus === "PRESENT");
  return (
    <Stack spacing={2} data-testid="tuition-detail-page" sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      <Button component={Link} to="/admin/tuition" startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>Học phí</Button>
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={`${item.studentName} · Đợt học phí ${item.cycleNumber}`} subtitle={item.className} action={<TuitionStatusChip status={item.status} />} />

      <Card>
        <CardContent>
          <InfoRow label="Học phí đã chốt" value={money(item.packagePriceSnapshot)} strong />
          <InfoRow label="Tiến độ" value={`${item.itemCount}/${item.targetCount} buổi`} />
          <InfoRow label="Ngày bắt đầu" value={displayDate(item.startedAt)} />
          <InfoRow label="Ngày buổi 8" value={displayDate(item.reachedTargetAt)} />
          {item.paidAt && <InfoRow label="Ngày thu" value={displayDate(item.paidAt)} />}
          {item.paymentMethod && <InfoRow label="Hình thức" value={item.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"} />}
          {item.paymentNote && <InfoRow label="Ghi chú thu" value={item.paymentNote} />}
          {item.status === "INCOMPLETE" && <InfoRow label="Xử lý đợt dở" value={item.settlementStatus === "OPEN" ? "Chờ xử lý" : item.settlementStatus === "SETTLED" ? `Đã chốt ${money(item.settledAmount ?? 0)}` : "Đã miễn"} />}
        </CardContent>
      </Card>

      <Typography component="h2" variant="h6">{visibleItems.length} buổi được tính học phí</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
        {visibleItems.map((entry) => (
          <Card key={entry.attendanceId} variant="outlined" data-testid="tuition-cycle-item">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="subtitle1">Buổi {entry.sequenceNumber}</Typography>
                <DateTimeDisplay date={entry.sessionDate} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Dự kiến {entry.scheduledStartTime}–{entry.scheduledEndTime}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Thực tế {entry.actualStartTime ?? "—"}–{entry.actualEndTime ?? "—"}
                {entry.actualDurationMinutes != null ? ` · ${entry.actualDurationMinutes} phút` : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">Loại buổi: {lessonType(entry.lessonType)}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Alert severity="info">Thời lượng thực tế chỉ để theo dõi, không thay đổi số buổi học phí.</Alert>
      {item.status === "PAID" && <Alert icon={<Lock />} severity="success">Đợt học phí đã thu và đang ở trạng thái chỉ đọc.</Alert>}
      {item.status === "PAYMENT_DUE" && (
        <StickyActionBar>
          <Button
            component={Link}
            to={`/admin/tuition/${item.id}/mark-paid`}
            startIcon={<Payments />}
            variant="contained"
            size="large"
            fullWidth
          >
            Đánh dấu đã thu
          </Button>
        </StickyActionBar>
      )}
      {item.status === "INCOMPLETE" && item.settlementStatus === "OPEN" && <Button variant="contained" onClick={() => { setAmount(String(Math.round(item.packagePriceSnapshot * item.itemCount / 8))); setSettleOpen(true); }}>Chốt học phí</Button>}
      <Dialog open={settleOpen} onClose={() => setSettleOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Chốt học phí đợt dở dang</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Đợt hiện tại: {item.itemCount}/8 · Gợi ý theo tỷ lệ: {money(Math.round(item.packagePriceSnapshot * item.itemCount / 8))}. Trạng thái chu kỳ vẫn là dở dang.</Alert>
        <TextField select label="Cách xử lý" value={settleType} onChange={(event) => setSettleType(event.target.value as typeof settleType)}><MenuItem value="SETTLE">Chốt số tiền thực thu</MenuItem><MenuItem value="WAIVE">Miễn phần còn lại</MenuItem></TextField>
        {settleType === "SETTLE" && <><TextField type="number" label="Số tiền thực thu" value={amount} onChange={(event) => setAmount(event.target.value)} /><TextField select label="Phương thức" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem></TextField></>}
        <TextField required label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setSettleOpen(false)}>Hủy</Button><Button variant="contained" disabled={!reason.trim()} onClick={() => void settle()}>Xác nhận</Button></DialogActions></Dialog>
    </Stack>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <><Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", py: 1 }}><Typography color="text.secondary">{label}</Typography><Typography sx={{ fontWeight: strong ? 700 : 600, textAlign: "right" }}>{value}</Typography></Stack><Divider /></>;
}

function money(value: number): string { return `${value.toLocaleString("vi-VN")}đ`; }
function displayDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
function lessonType(value: "REGULAR" | "MAKEUP" | "EXTRA"): string {
  return value === "REGULAR" ? "Thông thường" : value === "MAKEUP" ? "Học bù" : "Bổ sung";
}
