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
  Chip,
  CircularProgress,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ClassListItem, IncompleteCycleAction, PaymentMethod, StudentDetail, StudentGoogleSheetState, TuitionMode } from "@teacher/shared";
import { ContentCopy, Download, Launch, UploadFile } from "@mui/icons-material";
import { api } from "../api/client";
import { archiveStudentGoogleSheet, createStudentGoogleSheet, downloadStudentReport, endEnrollment as endEnrollmentApi,
  getStudentGoogleSheet, regenerateStudentGoogleSheet, retryStudentGoogleSheet, transferEnrollment } from "../api/students";
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleState, setGoogleState] = useState<StudentGoogleSheetState | null>(null);
  const [googleConfirm, setGoogleConfirm] = useState<"regenerate" | "archive" | null>(null);
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
  const loadGoogleSheet = useCallback(() => getStudentGoogleSheet(Number(id)).then(setGoogleState)
    .catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
    void loadGoogleSheet();
    api<ClassListItem[]>("/api/classes").then(setClasses).catch(() => setClasses([]));
  }, [load, loadGoogleSheet]);
  useEffect(() => {
    if (googleState?.sheet?.status !== "CREATING") return;
    const timer = window.setInterval(() => void loadGoogleSheet(), 2000);
    return () => window.clearInterval(timer);
  }, [googleState?.sheet?.status, loadGoogleSheet]);
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
    setTransferOpen(false); setTargetClassId(0); await load(); setSuccess("Đã chuyển lớp; tiến độ học phí được tiếp tục khi giá không đổi và lịch sử lớp cũ được giữ nguyên.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể chuyển lớp."); } finally { setBusy(false); } };
  const changeEnrollmentStatus = async () => { const action = statusActionName; if (!item?.enrollmentId || !action) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/${action}`, { method: "POST", body: JSON.stringify({ effectiveDate: statusEffectiveDate, reason: statusReason || undefined }) }); await load(); setStatusActionName(null); setSuccess(action === "pause" ? "Đã tạm dừng ghi danh theo ngày hiệu lực." : "Đã mở lại ghi danh theo ngày hiệu lực.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái ghi danh."); } finally { setBusy(false); } };
  const exportReport = async () => { setError(""); setSuccess(""); setBusy(true); try {
    const filename = await downloadStudentReport(item!.id); setSuccess(`Đã tải báo cáo Excel: ${filename}`);
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể xuất báo cáo Excel."); } finally { setBusy(false); } };
  const mutateGoogle = async (action: "create" | "retry" | "regenerate" | "archive") => {
    setError(""); setSuccess(""); setGoogleBusy(true);
    try {
      const result = action === "create" ? await createStudentGoogleSheet(item!.id)
        : action === "retry" ? await retryStudentGoogleSheet(item!.id)
          : action === "regenerate" ? await regenerateStudentGoogleSheet(item!.id)
            : await archiveStudentGoogleSheet(item!.id);
      setGoogleConfirm(null); await loadGoogleSheet();
      setSuccess(action === "archive" ? "Đã lưu trữ liên kết. File Google không bị xóa."
        : result.sheet.status === "CREATING" ? "Đang tạo sổ theo dõi; trạng thái sẽ tự cập nhật."
          : action === "regenerate" ? "Đã tạo lại nội dung từ dữ liệu Teacher Hub."
            : "Đã liên kết Google Sheet cho học sinh.");
    } catch (e) { await loadGoogleSheet(); setError(e instanceof Error ? e.message : "Không thể xử lý Google Sheet."); }
    finally { setGoogleBusy(false); }
  };
  const copyGoogleLink = async () => {
    const url = googleState?.sheet?.webViewUrl; if (!url) return;
    try { await navigator.clipboard.writeText(url); setSuccess("Đã sao chép liên kết Google Sheet."); }
    catch { setError("Không thể sao chép tự động. Hãy mở Sheet và sao chép liên kết từ trình duyệt."); }
  };
  const displayDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value)) : "—";
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
        <Button component={Link} to={`/admin/students/${item!.id}/legacy-import`} startIcon={<UploadFile />} variant="outlined">
          Import lịch sử
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
      <Card data-testid="student-google-sheet-card">
        <CardContent><Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="h6">Sổ theo dõi phụ huynh</Typography>
          {!googleState ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><CircularProgress size={20} /><Typography>Đang tải trạng thái…</Typography></Stack>
            : !googleState.sheet ? <>
              <Typography>Chưa tạo Google Sheet</Typography>
              <Typography color="text.secondary">{googleState.enabled
                ? `Google Drive đã sẵn sàng${googleState.ownerLabel ? ` · ${googleState.ownerLabel}` : ""}.`
                : "Google Drive chưa được bật trên máy chủ."}</Typography>
              <Button variant="contained" disabled={googleBusy || !googleState.enabled} onClick={() => void mutateGoogle("create")}>
                {googleBusy ? "Đang tạo…" : "Tạo sổ theo dõi"}
              </Button>
            </> : googleState.sheet.status === "CREATING" ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} /><Typography>Đang tạo Google Sheet…</Typography>
            </Stack> : googleState.sheet.status === "GENERATION_ERROR" ? <>
              <Chip color="error" label="Tạo chưa thành công" sx={{ alignSelf: "flex-start" }} />
              <Alert severity="error">{googleState.sheet.lastSyncError ?? "Không thể tạo Google Sheet."}</Alert>
              <Button variant="contained" disabled={googleBusy || !googleState.enabled} onClick={() => void mutateGoogle("retry")}>
                {googleBusy ? "Đang thử lại…" : "Thử tạo lại"}
              </Button>
            </> : <>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{googleState.sheet.fileName}</Typography>
                <Chip color="success" label="Đã liên kết" sx={{ alignSelf: "flex-start" }} />
              </Stack>
              <Typography color="text.secondary">Lần tạo: {displayDateTime(googleState.sheet.lastGeneratedAt)}</Typography>
              <Typography color="text.secondary">Lần đồng bộ tự động: Chưa bật trong V16C</Typography>
              <Typography>Quyền chia sẻ: {googleState.sheet.sharingStatus === "RESTRICTED" ? "Giới hạn" : "Đã chia sẻ thủ công"}</Typography>
              <Alert severity="info">Sheet mặc định ở chế độ giới hạn. Hãy cấp quyền Viewer cho phụ huynh trực tiếp trong Google Sheets.</Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap", minWidth: 0 }}>
                <Button component="a" href={googleState.sheet.webViewUrl ?? undefined} target="_blank" rel="noopener noreferrer"
                  startIcon={<Launch />} variant="contained" disabled={!googleState.sheet.webViewUrl}>Mở Google Sheet</Button>
                <Button startIcon={<ContentCopy />} variant="outlined" disabled={!googleState.sheet.webViewUrl} onClick={() => void copyGoogleLink()}>Sao chép liên kết</Button>
                <Button variant="outlined" disabled={googleBusy} onClick={() => setGoogleConfirm("regenerate")}>Tạo lại nội dung</Button>
                <Button color="warning" variant="outlined" disabled={googleBusy} onClick={() => setGoogleConfirm("archive")}>Lưu trữ</Button>
              </Stack>
            </>}
        </Stack></CardContent>
      </Card>
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
        <Alert severity="info">Nếu giá gói không đổi, tiến độ đang dở tiếp tục theo học sinh. Nếu giá đổi, lựa chọn chốt/giữ đợt cũ được áp dụng rõ ràng. Lesson và attendance cũ không thay đổi.</Alert>
      </Stack></DialogContent><DialogActions><Button onClick={() => setTransferOpen(false)}>Hủy</Button><Button variant="contained" disabled={busy || !targetClassId || !transferReason.trim()} onClick={() => void transfer()}>Xác nhận chuyển lớp</Button></DialogActions></Dialog>
      <Dialog open={Boolean(googleConfirm)} onClose={() => !googleBusy && setGoogleConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{googleConfirm === "archive" ? "Lưu trữ Google Sheet" : "Tạo lại nội dung Sheet"}</DialogTitle>
        <DialogContent><Alert severity={googleConfirm === "archive" ? "warning" : "info"} sx={{ mt: 1 }}>
          {googleConfirm === "archive"
            ? "Liên kết sẽ được lưu trữ trong Teacher Hub. File Google không bị xóa và có thể tạo một sổ mới sau đó."
            : "Toàn bộ vùng do Teacher Hub quản lý sẽ được dựng lại từ database. URL Google Sheet vẫn giữ nguyên."}
        </Alert></DialogContent>
        <DialogActions><Button onClick={() => setGoogleConfirm(null)} disabled={googleBusy}>Hủy</Button>
          <Button color={googleConfirm === "archive" ? "warning" : "primary"} variant="contained" disabled={googleBusy}
            onClick={() => googleConfirm && void mutateGoogle(googleConfirm)}>{googleBusy ? "Đang xử lý…" : "Xác nhận"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
