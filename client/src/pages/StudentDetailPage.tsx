import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ClassListItem, IncompleteCycleAction, PaymentMethod, StudentDetail, TuitionMode } from "@teacher/shared";
import { Download } from "@mui/icons-material";
import { api } from "../api/client";
import { downloadStudentReport, endEnrollment as endEnrollmentApi, transferEnrollment } from "../api/students";
import { createAdvanceReceipt } from "../api/tuition";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, PageHeader, ProgressCount } from "../components/UiKit";
import { todayInHoChiMinh } from "../utils/date";
export function StudentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [tuitionOpen, setTuitionOpen] = useState(false);
  const [tuitionMode, setTuitionMode] = useState<TuitionMode>("CLASS_DEFAULT");
  const [customPrice, setCustomPrice] = useState("");
  const today = todayInHoChiMinh();
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(() => (location.state as { success?: string } | null)?.success ?? "");
  const [statusActionName, setStatusActionName] = useState<"pause" | "resume" | null>(null);
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(today);
  const [statusReason, setStatusReason] = useState("");
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [endOpen, setEndOpen] = useState(false);
  const [endDate, setEndDate] = useState(today);
  const [endReason, setEndReason] = useState("");
  const [endNote, setEndNote] = useState("");
  const [closureAction, setClosureAction] = useState<"KEEP_OPEN" | "SETTLE" | "WAIVE">("KEEP_OPEN");
  const [closureAmount, setClosureAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [receiptAction, setReceiptAction] = useState<"NONE" | "REFUND" | "APPLY_TO_OLD_SETTLEMENT">("NONE");
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [receivedAt, setReceivedAt] = useState(today);
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState(0);
  const [transferDate, setTransferDate] = useState(today);
  const [transferReason, setTransferReason] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferReceiptAction, setTransferReceiptAction] = useState<"NONE" | "TRANSFER_TO_NEW_ENROLLMENT" | "REFUND" | "APPLY_TO_OLD_SETTLEMENT">("NONE");
  const load = useCallback(() => api<StudentDetail>(`/api/students/${id}`).then((value) => {
    setItem(value); setTuitionMode(value.tuitionMode ?? "CLASS_DEFAULT");
    setCustomPrice(value.customPackagePrice?.toString() ?? "");
  }).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
    api<ClassListItem[]>("/api/classes").then(setClasses).catch(() => setClasses([]));
  }, [load]);
  const openTransfer = async () => {
    setError("");
    try {
      const values = await api<ClassListItem[]>("/api/classes");
      setClasses(values);
      setTargetClassId(0);
      setTransferOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách lớp.");
    }
  };
  const changeTuition = async () => { if (!item?.enrollmentId) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/tuition-mode`, { method: "PATCH", body: JSON.stringify({ tuitionMode, effectiveFrom, customPackagePrice: tuitionMode === "CUSTOM" ? Number(customPrice) : undefined }) });
    setTuitionOpen(false); await load(); setSuccess("Đã cập nhật chế độ học phí.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi học phí."); } finally { setBusy(false); } };
  const incompleteAction = (reason: string, note: string): IncompleteCycleAction => closureAction === "SETTLE"
    ? { type: "SETTLE", amount: Number(closureAmount), method: paymentMethod, note: note || undefined }
    : closureAction === "WAIVE" ? { type: "WAIVE", reason: reason || "Miễn phần còn lại" } : { type: "KEEP_OPEN" };
  const endEnrollment = async () => { if (!item?.enrollmentId) return; setError(""); setSuccess(""); setBusy(true); try {
    await endEnrollmentApi(item.enrollmentId, { endedAt: endDate, reason: endReason || undefined, note: endNote || undefined,
      incompleteCycleAction: incompleteAction(endReason, endNote), advanceReceiptAction: { type: receiptAction } });
    setEndOpen(false); await load(); setSuccess("Đã ngừng học và giữ nguyên toàn bộ lịch sử.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể kết thúc ghi danh."); } finally { setBusy(false); } };
  const receiveAdvance = async () => { if (!item?.enrollmentId || !item.effectivePackagePrice) return; setBusy(true); setError(""); try {
    await createAdvanceReceipt(item.enrollmentId, { amount: item.effectivePackagePrice, receivedAt, paymentMethod });
    setAdvanceOpen(false); await load(); setSuccess("Đã ghi nhận thu trước; tiến độ vẫn tích lũy đến đủ 8 buổi.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể thu trước."); } finally { setBusy(false); } };
  const transfer = async () => { if (!item?.enrollmentId) return; setBusy(true); setError(""); try {
    await transferEnrollment(item.enrollmentId, { targetClassId, effectiveDate: transferDate, tuitionMode,
      customPackagePrice: tuitionMode === "CUSTOM" ? Number(customPrice) : undefined,
      reason: transferReason, note: transferNote || undefined, incompleteCycleAction: incompleteAction(transferReason, transferNote), advanceReceiptAction: { type: transferReceiptAction } });
    setTransferOpen(false); setTargetClassId(0); await load(); setSuccess("Đã chuyển lớp; lớp mới bắt đầu từ 0/8 và lịch sử lớp cũ được giữ nguyên.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể chuyển lớp."); } finally { setBusy(false); } };
  const changeEnrollmentStatus = async () => { const action = statusActionName; if (!item?.enrollmentId || !action) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/${action}`, { method: "POST", body: JSON.stringify({ effectiveDate: statusEffectiveDate, reason: statusReason || undefined }) }); await load(); setStatusActionName(null); setSuccess(action === "pause" ? "Đã tạm dừng ghi danh theo ngày hiệu lực." : "Đã mở lại ghi danh theo ngày hiệu lực.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái ghi danh."); } finally { setBusy(false); } };
  const exportReport = async () => { setError(""); setSuccess(""); setBusy(true); try {
    const filename = await downloadStudentReport(item!.id); setSuccess(`Đã tải báo cáo Excel: ${filename}`);
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể xuất báo cáo Excel."); } finally { setBusy(false); } };
  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error">{error || "Không tải được học sinh."}</Alert>;
  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={item!.fullName} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button component={Link} to={`/admin/students/${item!.id}/edit`} variant="outlined">Sửa thông tin</Button>
        <Button startIcon={<Download />} variant="contained" disabled={busy} onClick={exportReport}>
          {busy ? "Đang tạo báo cáo…" : "Xuất báo cáo Excel"}
        </Button>
      </Stack>
      <Card>
        <CardContent>
          <Typography>Lớp: {item!.className}</Typography>
          <Typography>
            Phụ huynh: {item!.parentName ?? "—"} · {item!.parentPhone ?? "—"}
          </Typography>
          <Typography>
            Học phí:{" "}
            {item!.tuitionMode === "FREE"
              ? "Miễn phí"
              : <><CurrencyDisplay value={item!.effectivePackagePrice} /> / 8 buổi</>}
          </Typography>
        </CardContent>
      </Card>
      {item!.tuitionMode !== "FREE" && (
        <Card>
          <CardContent>
            <ProgressCount value={item!.currentProgress ?? 0} />
          </CardContent>
        </Card>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {item!.enrollmentStatus === "ACTIVE" && <Button disabled={busy} variant="outlined" onClick={() => setStatusActionName("pause")}>Tạm dừng ghi danh</Button>}
        {item!.enrollmentStatus === "PAUSED" && <Button disabled={busy} variant="outlined" onClick={() => setStatusActionName("resume")}>Mở lại ghi danh</Button>}
        <Button variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED"} onClick={() => setTuitionOpen(true)}>Đổi chế độ học phí</Button>
        {item!.tuitionMode !== "FREE" && <Button variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED" || Boolean(item!.advanceReceipt)} onClick={() => setAdvanceOpen(true)}>Thu học phí trước</Button>}
        <Button variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED"} onClick={() => void openTransfer()}>Chuyển lớp</Button>
        <Button color="error" variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED"} onClick={() => setEndOpen(true)}>Ngừng học</Button>
      </Stack>
      <Dialog open={tuitionOpen} onClose={() => setTuitionOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Chế độ học phí</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <FormControl><InputLabel>Chế độ</InputLabel><Select label="Chế độ" value={tuitionMode} onChange={(e) => setTuitionMode(e.target.value as TuitionMode)}><MenuItem value="CLASS_DEFAULT">Theo giá lớp</MenuItem><MenuItem value="CUSTOM">Giá riêng</MenuItem><MenuItem value="FREE">Miễn phí</MenuItem></Select></FormControl>
        {tuitionMode === "CUSTOM" && <TextField type="number" required label="Giá riêng / 8 buổi" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />}
        <TextField type="date" label="Áp dụng từ" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Alert severity="info">Thay đổi chỉ áp dụng cho đợt học phí tiếp theo.</Alert>
      </Stack></DialogContent><DialogActions><Button onClick={() => setTuitionOpen(false)}>Hủy</Button><Button variant="contained" disabled={busy} onClick={changeTuition}>{busy ? "Đang lưu…" : "Lưu"}</Button></DialogActions></Dialog>
      <Dialog open={Boolean(statusActionName)} onClose={() => !busy && setStatusActionName(null)} fullWidth maxWidth="xs"><DialogTitle>{statusActionName === "pause" ? "Tạm dừng ghi danh" : "Mở lại ghi danh"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Participant lịch sử không đổi; ngày hiệu lực chỉ quyết định các buổi nào học sinh đủ điều kiện.</Alert>
        <TextField required type="date" label="Ngày hiệu lực" value={statusEffectiveDate} onChange={(e) => setStatusEffectiveDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Lý do (tùy chọn)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setStatusActionName(null)}>Hủy</Button><Button variant="contained" disabled={busy || !statusEffectiveDate} onClick={() => void changeEnrollmentStatus()}>{busy ? "Đang lưu…" : "Xác nhận"}</Button></DialogActions></Dialog>
      <Dialog open={advanceOpen} onClose={() => !busy && setAdvanceOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Thu học phí trước</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Thu đúng một gói <CurrencyDisplay value={item!.effectivePackagePrice} />. Chu kỳ chỉ tự chuyển đã thu khi đủ 8 buổi.</Alert>
        <TextField type="date" label="Ngày nhận" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select label="Phương thức" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem></TextField>
      </Stack></DialogContent><DialogActions><Button onClick={() => setAdvanceOpen(false)}>Hủy</Button><Button variant="contained" disabled={busy} onClick={() => void receiveAdvance()}>Xác nhận thu trước</Button></DialogActions></Dialog>
      <Dialog open={endOpen} onClose={() => !busy && setEndOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Ngừng học</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField required type="date" label="Ngày kết thúc" value={endDate} onChange={(e) => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField required label="Lý do" value={endReason} onChange={(e) => setEndReason(e.target.value)} /><TextField multiline minRows={2} label="Ghi chú (tùy chọn)" value={endNote} onChange={(e) => setEndNote(e.target.value)} />
        {item!.incompleteCycle && <Alert severity="info">Đợt hiện tại: {item!.incompleteCycle.itemCount}/8 buổi</Alert>}
        <TextField select label="Xử lý đợt hiện tại" value={closureAction} onChange={(e) => setClosureAction(e.target.value as typeof closureAction)}><MenuItem value="KEEP_OPEN">Để xử lý sau</MenuItem><MenuItem value="SETTLE">Chốt học phí</MenuItem><MenuItem value="WAIVE">Miễn phần còn lại</MenuItem></TextField>
        {closureAction === "SETTLE" && <><TextField type="number" label="Số tiền thực thu" value={closureAmount} onChange={(e) => setClosureAmount(e.target.value)} /><TextField select label="Phương thức" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem></TextField></>}
        {item!.advanceReceipt && <TextField select label="Khoản đã thu trước" value={receiptAction} onChange={(e) => setReceiptAction(e.target.value as typeof receiptAction)}><MenuItem value="NONE">Giữ nguyên</MenuItem><MenuItem value="REFUND">Hoàn tiền</MenuItem><MenuItem value="APPLY_TO_OLD_SETTLEMENT">Dùng để chốt đợt cũ</MenuItem></TextField>}
      </Stack></DialogContent><DialogActions><Button onClick={() => setEndOpen(false)}>Hủy</Button><Button color="error" variant="contained" disabled={busy || !endReason.trim()} onClick={() => void endEnrollment()}>Xác nhận ngừng học</Button></DialogActions></Dialog>
      <Dialog open={transferOpen} onClose={() => !busy && setTransferOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Chuyển lớp</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField select required label="Lớp mới" value={targetClassId || ""} onChange={(e) => setTargetClassId(Number(e.target.value))}>{classes.filter((value) => value.id !== item!.classId && value.status === "ACTIVE").map((value) => <MenuItem key={value.id} value={value.id}>{value.name}</MenuItem>)}</TextField>
        <TextField required type="date" label="Ngày chuyển" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField required label="Lý do chuyển" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} /><TextField multiline minRows={2} label="Ghi chú chuyển lớp (tùy chọn)" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
        <TextField select label="Xử lý đợt cũ" value={closureAction} onChange={(e) => setClosureAction(e.target.value as typeof closureAction)}><MenuItem value="KEEP_OPEN">Để xử lý sau</MenuItem><MenuItem value="SETTLE">Chốt học phí</MenuItem><MenuItem value="WAIVE">Miễn phần còn lại</MenuItem></TextField>
        {closureAction === "SETTLE" && <><TextField type="number" label="Số tiền chốt" value={closureAmount} onChange={(e) => setClosureAmount(e.target.value)} /><TextField select label="Phương thức chốt" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem></TextField></>}
        {item!.advanceReceipt && <TextField select label="Khoản thu trước" value={transferReceiptAction} onChange={(e) => setTransferReceiptAction(e.target.value as typeof transferReceiptAction)}><MenuItem value="TRANSFER_TO_NEW_ENROLLMENT">Chuyển sang lớp mới</MenuItem><MenuItem value="APPLY_TO_OLD_SETTLEMENT">Dùng chốt đợt cũ</MenuItem><MenuItem value="REFUND">Hoàn tiền</MenuItem><MenuItem value="NONE">Giữ nguyên</MenuItem></TextField>}
        <Alert severity="info">Lớp mới bắt đầu 0/8. Lesson, attendance và chu kỳ lớp cũ không thay đổi.</Alert>
      </Stack></DialogContent><DialogActions><Button onClick={() => setTransferOpen(false)}>Hủy</Button><Button variant="contained" disabled={busy || !targetClassId || !transferReason.trim()} onClick={() => void transfer()}>Xác nhận chuyển lớp</Button></DialogActions></Dialog>
    </Stack>
  );
}
