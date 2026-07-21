import { ArrowBack, Lock, Payments } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { TuitionCycleDetail } from "@teacher/shared";
import { getTuitionCycle } from "../api/tuition";
import { LoadingState } from "../components/LoadingState";
import { TuitionStatusChip } from "../components/TuitionStatusChip";
import { DateTimeDisplay, PageHeader, StickyActionBar } from "../components/UiKit";

export function TuitionDetailPage() {
  const { cycleId } = useParams();
  const location = useLocation();
  const id = Number(cycleId);
  const [item, setItem] = useState<TuitionCycleDetail | null>(null);
  const [error, setError] = useState("");
  const success = (location.state as { success?: string } | null)?.success;
  const load = useCallback(() => {
    return getTuitionCycle(id).then(setItem).catch((reason: Error) => setError(reason.message));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error" action={<Button color="inherit" onClick={() => { setError(""); void load(); }}>Thử lại</Button>}>{error || "Không tải được chu kỳ."}</Alert>;
  const visibleItems = item.items.filter((entry) => entry.attendanceStatus === "PRESENT");
  return (
    <Stack spacing={2} data-testid="tuition-detail-page" sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      <Button component={Link} to="/admin/tuition" startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>Học phí</Button>
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={`${item.studentName} · Chu kỳ #${item.cycleNumber}`} subtitle={item.className} action={<TuitionStatusChip status={item.status} />} />

      <Card>
        <CardContent>
          <InfoRow label="Giá gói (snapshot)" value={money(item.packagePriceSnapshot)} strong />
          <InfoRow label="Tiến độ" value={`${item.itemCount}/${item.targetCount} buổi`} />
          <InfoRow label="Ngày bắt đầu" value={displayDate(item.startedAt)} />
          <InfoRow label="Ngày buổi 8" value={displayDate(item.reachedTargetAt)} />
          {item.paidAt && <InfoRow label="Ngày thu" value={displayDate(item.paidAt)} />}
          {item.paymentMethod && <InfoRow label="Hình thức" value={item.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"} />}
          {item.paymentNote && <InfoRow label="Ghi chú thu" value={item.paymentNote} />}
        </CardContent>
      </Card>

      <Typography component="h2" variant="h6">{visibleItems.length} buổi trong chu kỳ</Typography>
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
      {item.status === "PAID" && <Alert icon={<Lock />} severity="success">Chu kỳ đã thu và đang ở trạng thái chỉ đọc.</Alert>}
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
