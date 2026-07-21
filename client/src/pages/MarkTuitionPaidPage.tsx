import { ArrowBack } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { TuitionCycleDetail } from "@teacher/shared";
import { getTuitionCycle, markTuitionPaid } from "../api/tuition";
import { LoadingState } from "../components/LoadingState";
import { TuitionStatusChip } from "../components/TuitionStatusChip";
import { ConfirmationDialog, StickyActionBar } from "../components/UiKit";

export function MarkTuitionPaidPage() {
  const { cycleId } = useParams();
  const id = Number(cycleId);
  const navigate = useNavigate();
  const [item, setItem] = useState<TuitionCycleDetail | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayInHoChiMinh());
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void getTuitionCycle(id).then((value) => {
      if (!active) return;
      setItem(value);
      setAmount(String(value.packagePriceSnapshot));
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [id, retry]);

  const amountNumber = Number(amount);
  const amountValid = item != null && Number.isInteger(amountNumber) && amountNumber === item.packagePriceSnapshot;
  const submit = async () => {
    if (!item || busy || !amountValid) return;
    setBusy(true);
    setError("");
    try {
      await markTuitionPaid(item.id, {
        paidAmount: amountNumber,
        paidAt,
        paymentMethod: method,
        paymentNote: note.trim() || undefined,
      });
      navigate(`/admin/tuition/${item.id}`, { replace: true, state: { success: "Đã ghi nhận thanh toán toàn bộ đợt học phí." } });
    } catch (reason) {
      setConfirming(false);
      setError(reason instanceof Error ? reason.message : "Không thể ghi nhận thanh toán.");
    } finally { setBusy(false); }
  };

  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error" action={<Button color="inherit" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Thử lại</Button>}>{error || "Không tải được đợt học phí."}</Alert>;
  return (
    <Stack spacing={2} data-testid="mark-tuition-paid-page" data-form-width="bounded" sx={{ width: "100%", maxWidth: "var(--app-form-width)", mx: "auto" }}>
      <Button component={Link} to={`/admin/tuition/${item.id}`} startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>Chi tiết đợt học phí</Button>
      <Typography component="h1" variant="h5">Đánh dấu đã thu</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card><CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Stack><Typography variant="subtitle1">{item.studentName}</Typography><Typography variant="body2" color="text.secondary">{item.className} · Đợt học phí {item.cycleNumber}</Typography></Stack>
          <TuitionStatusChip status={item.status} />
        </Stack>
        <Typography color="primary" variant="h6" sx={{ mt: 1 }}>{money(item.packagePriceSnapshot)}</Typography>
      </CardContent></Card>
      {item.status !== "PAYMENT_DUE" ? (
        <Alert severity="info">Đợt học phí này không còn ở trạng thái cần thu. Thông tin hiện tại chỉ đọc.</Alert>
      ) : <>
        <TextField
          label="Số tiền"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={amount !== "" && !amountValid}
          helperText={!amountValid ? `Phải thu toàn bộ đúng ${money(item.packagePriceSnapshot)}; V1 không hỗ trợ thanh toán một phần.` : "Mức học phí đã chốt của đợt."}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
        />
        <TextField label="Ngày thu" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <FormControl>
          <FormLabel>Hình thức thu</FormLabel>
          <RadioGroup row value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
            <FormControlLabel value="CASH" control={<Radio />} label="Tiền mặt" />
            <FormControlLabel value="BANK_TRANSFER" control={<Radio />} label="Chuyển khoản" />
          </RadioGroup>
        </FormControl>
        <TextField label="Ghi chú (tùy chọn)" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        <Alert severity="warning">Sau khi xác nhận, đợt học phí và tám buổi liên quan sẽ được khóa.</Alert>
        <StickyActionBar>
          <Button variant="contained" size="large" fullWidth disabled={busy || !amountValid || !paidAt} onClick={() => setConfirming(true)}>
            Xác nhận đã thu
          </Button>
        </StickyActionBar>
      </>}
      <ConfirmationDialog open={confirming} title="Xác nhận thanh toán?" confirmLabel="Đồng ý, đánh dấu đã thu" confirmTestId="confirm-mark-paid" busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => void submit()}>
        <Typography>Bạn xác nhận đã thu {money(item.packagePriceSnapshot)} ngày {displayDate(paidAt)} bằng {method === "CASH" ? "tiền mặt" : "chuyển khoản"}.</Typography>
      </ConfirmationDialog>
    </Stack>
  );
}

function todayInHoChiMinh(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function money(value: number): string { return `${value.toLocaleString("vi-VN")}đ`; }
function displayDate(value: string): string { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }
