import { History, Search } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PaymentMethod, TuitionBoard, TuitionBoardRow } from "@teacher/shared";
import { getTuitionBoard, markTuitionPaid } from "../api/tuition";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { todayInHoChiMinh } from "../utils/date";
import { filterTuitionBoardRows, tuitionBoardAmount, tuitionBoardDetailCycleId, tuitionBoardMultipleDue, tuitionBoardProgress, type TuitionBoardScope } from "../features/tuition-board";

export function TuitionBoardPage() {
  const [searchParams] = useSearchParams();
  const [board, setBoard] = useState<TuitionBoard | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [scope, setScope] = useState<TuitionBoardScope>(() =>
    searchParams.get("status") === "PAYMENT_DUE" ? "PAYMENT_DUE" : "ALL");
  const [paymentRow, setPaymentRow] = useState<TuitionBoardRow | null>(null);
  const [paidAt, setPaidAt] = useState(todayInHoChiMinh());
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setBoard(await getTuitionBoard()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được bảng học phí."); }
  }, []);
  useEffect(() => {
    let active = true;
    void getTuitionBoard().then((value) => { if (active) setBoard(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không tải được bảng học phí."); });
    return () => { active = false; };
  }, []);

  const classes = useMemo(() => {
    const values = new Map<number, string>();
    board?.rows.forEach((row) => values.set(row.classId, row.className));
    return [...values].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [board]);
  const rows = useMemo(() => {
    return filterTuitionBoardRows(board?.rows ?? [], { search, classId, scope });
  }, [board, classId, scope, search]);

  const openPayment = (row: TuitionBoardRow) => {
    setPaidAt(todayInHoChiMinh()); setMethod("BANK_TRANSFER"); setNote(""); setPaymentRow(row);
  };
  const confirmPayment = async () => {
    if (!paymentRow?.paymentDueCycleId || !paymentRow.paymentDueAmount || busy) return;
    setBusy(true); setError("");
    try {
      await markTuitionPaid(paymentRow.paymentDueCycleId, {
        paidAmount: paymentRow.paymentDueAmount, paidAt, paymentMethod: method,
        paymentNote: note.trim() || undefined,
      });
      setPaymentRow(null);
      setSuccess(`Đã ghi nhận học phí của ${paymentRow.studentName}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ghi nhận học phí.");
    } finally { setBusy(false); }
  };

  return (
    <Stack spacing={2} data-testid="tuition-board-page" sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
        <Box>
          <Typography component="h1" variant="h5">Bảng học phí</Typography>
          {board && <Typography color={board.paymentDueStudentCount ? "warning.dark" : "text.secondary"} sx={{ mt: 0.5, fontWeight: 600 }}>
            {board.paymentDueStudentCount
              ? `${board.paymentDueStudentCount} học sinh cần thu · ${money(board.totalPaymentDueAmount)}`
              : "Không có học phí cần thu"}
          </Typography>}
        </Box>
        <Button component={Link} to="/admin/tuition/history" startIcon={<History />} variant="text" sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}>
          Xem lịch sử học phí
        </Button>
      </Stack>

      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, 1.5fr) minmax(150px, 1fr) minmax(150px, .8fr)" }, gap: 1 }}>
        <TextField size="small" label="Tìm học sinh" value={search} onChange={(event) => setSearch(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }} />
        <FormControl size="small"><InputLabel>Lớp</InputLabel><Select label="Lớp" value={classId} onChange={(event) => setClassId(event.target.value)}>
          <MenuItem value="">Tất cả lớp</MenuItem>{classes.map(([id, name]) => <MenuItem key={id} value={String(id)}>{name}</MenuItem>)}
        </Select></FormControl>
        <FormControl size="small"><InputLabel>Hiển thị</InputLabel><Select label="Hiển thị" value={scope} onChange={(event) => setScope(event.target.value as TuitionBoardScope)}>
          <MenuItem value="ALL">Tất cả</MenuItem><MenuItem value="PAYMENT_DUE">Cần thu</MenuItem>
        </Select></FormControl>
      </Box>

      {!board && !error && <LoadingState />}
      {board && rows.length === 0 && <EmptyState message="Không có học sinh phù hợp." />}
      {board && rows.length > 0 && <>
        <TableContainer component={Card} variant="outlined" sx={{ display: { xs: "none", md: "block" } }}>
          <Table size="small" aria-label="Bảng trạng thái học phí">
            <TableHead><TableRow>
              <TableCell>Học sinh</TableCell><TableCell>Lớp</TableCell><TableCell align="center">Tiến độ</TableCell>
              <TableCell align="right">Học phí</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell>
            </TableRow></TableHead>
            <TableBody>{rows.map((row) => <TableRow key={row.enrollmentId} hover data-testid="tuition-board-row">
              <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{row.studentName}</Typography>{row.studentNickname && <Typography variant="caption" color="text.secondary">{row.studentNickname}</Typography>}{row.enrollmentStatus !== "ACTIVE" && <InactiveEnrollmentLabel status={row.enrollmentStatus} />}</TableCell>
              <TableCell>{row.className}</TableCell><TableCell align="center">{progress(row)}</TableCell>
              <TableCell align="right"><BoardAmount row={row} /></TableCell><TableCell><BoardStatus row={row} /></TableCell>
              <TableCell align="right"><RowAction row={row} onPayment={openPayment} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
        <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
          {rows.map((row) => <Card key={row.enrollmentId} variant="outlined" data-testid="tuition-board-card"><CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700 }}>{row.studentName}</Typography><Typography variant="body2" color="text.secondary">{row.className}{row.enrollmentStatus !== "ACTIVE" ? ` · ${inactiveEnrollmentText(row.enrollmentStatus)}` : ""}</Typography></Box>
              <BoardStatus row={row} />
            </Stack>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mt: 1 }}>
              <BoardAmount row={row} /><Typography variant="body2" sx={{ fontWeight: 600 }}>{progress(row)}</Typography>
            </Stack>
            {row.paymentDue && row.currentProgress?.attended !== 8 && <Typography variant="caption" color="text.secondary">Đợt trước đã đủ 8 buổi</Typography>}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: row.paymentDue ? 1 : 0 }}><RowAction row={row} onPayment={openPayment} /></Box>
          </CardContent></Card>)}
        </Stack>
      </>}

      <Dialog open={Boolean(paymentRow)} onClose={() => !busy && setPaymentRow(null)} fullWidth maxWidth="xs" aria-labelledby="payment-dialog-title">
        <DialogTitle id="payment-dialog-title">Đã nhận tiền</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 0.5 }}>
          <Box><Typography variant="body2">Học sinh: <strong>{paymentRow?.studentName}</strong></Typography><Typography variant="body2">Số tiền: <strong>{money(paymentRow?.paymentDueAmount ?? 0)}</strong></Typography></Box>
          <TextField label="Ngày nhận" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Phương thức" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><MenuItem value="BANK_TRANSFER">Chuyển khoản</MenuItem><MenuItem value="CASH">Tiền mặt</MenuItem></TextField>
          <TextField label="Ghi chú (tùy chọn)" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setPaymentRow(null)}>Hủy</Button><Button data-testid="confirm-board-payment" variant="contained" disabled={busy || !paidAt} onClick={() => void confirmPayment()}>{busy ? "Đang lưu…" : "Xác nhận"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

function BoardStatus({ row }: { row: TuitionBoardRow }) {
  const values = {
    PAYMENT_DUE: { label: "Cần thu", color: "warning" as const, variant: "filled" as const },
    NEEDS_REVIEW: { label: "Cần kiểm tra", color: "warning" as const, variant: "outlined" as const },
    LEARNING: { label: "Đang học", color: "primary" as const, variant: "outlined" as const },
    NOT_CONFIGURED: { label: "Chưa cài học phí", color: "default" as const, variant: "outlined" as const },
    FREE: { label: "Miễn học phí", color: "success" as const, variant: "outlined" as const },
  }[row.status];
  return <Chip size="small" {...values} />;
}
function RowAction({ row, onPayment }: { row: TuitionBoardRow; onPayment: (row: TuitionBoardRow) => void }) {
  if (row.paymentDue) return <Button size="small" variant="contained" onClick={() => onPayment(row)} sx={{ minHeight: 44, whiteSpace: "nowrap" }}>Đã nhận tiền</Button>;
  const cycleId = tuitionBoardDetailCycleId(row);
  if (row.needsReview && cycleId) return <Button component={Link} to={`/admin/tuition/${cycleId}`} size="small">Xem chi tiết</Button>;
  return null;
}
function BoardAmount({ row }: { row: TuitionBoardRow }) {
  const multipleDue = tuitionBoardMultipleDue(row);
  if (multipleDue) return <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{multipleDue.label}</Typography><Typography variant="caption" color="text.secondary">Tổng: {money(multipleDue.totalAmount)}</Typography></Box>;
  return <Typography variant="body2" sx={{ fontWeight: 700 }}>{amount(row)}</Typography>;
}
function InactiveEnrollmentLabel({ status }: { status: TuitionBoardRow["enrollmentStatus"] }) {
  return <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{inactiveEnrollmentText(status)}</Typography>;
}
function inactiveEnrollmentText(status: TuitionBoardRow["enrollmentStatus"]): string {
  return status === "PAUSED" ? "Tạm nghỉ" : "Đã nghỉ";
}
function progress(row: TuitionBoardRow): string { return tuitionBoardProgress(row); }
function amount(row: TuitionBoardRow): string {
  const value = tuitionBoardAmount(row);
  return value == null ? "—" : money(value);
}
function money(value: number): string { return `${value.toLocaleString("vi-VN")}đ`; }
