import { ChevronLeft, ChevronRight, Search } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MonthlyTuitionBoard, MonthlyTuitionRow } from "@teacher/shared";
import { getMonthlyTuitionBoard, markMonthlyTuitionPaid } from "../api/tuition";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import {
  filterTuitionBoardRows, moveTuitionMonth, tuitionAttendanceLabel,
  type TuitionBoardScope,
} from "../features/tuition-board";
import { todayInHoChiMinh } from "../utils/date";

function currentMonth(): { year: number; month: number } {
  const today = todayInHoChiMinh();
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function TuitionBoardPage() {
  const [period, setPeriod] = useState(currentMonth);
  const [board, setBoard] = useState<MonthlyTuitionBoard | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [scope, setScope] = useState<TuitionBoardScope>("ALL");
  const [paymentRow, setPaymentRow] = useState<MonthlyTuitionRow | null>(null);
  const [paidAt, setPaidAt] = useState(todayInHoChiMinh());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(""); setBoard(null);
    try { setBoard(await getMonthlyTuitionBoard(period)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được học phí tháng."); }
  }, [period]);
  useEffect(() => {
    let active = true;
    void getMonthlyTuitionBoard(period)
      .then((value) => { if (active) { setBoard(value); setError(""); } })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không tải được học phí tháng.");
      });
    return () => { active = false; };
  }, [period]);

  const classes = useMemo(() => {
    const values = new Map<number, string>();
    board?.rows.forEach((row) => values.set(row.classId, row.className));
    return [...values].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [board]);
  const rows = useMemo(
    () => filterTuitionBoardRows(board?.rows ?? [], { search, classId, scope }),
    [board, classId, scope, search],
  );

  const openPayment = (row: MonthlyTuitionRow) => {
    setPaymentRow(row); setPaidAt(todayInHoChiMinh()); setAmount(""); setNote("");
  };
  const confirmPayment = async () => {
    if (!paymentRow || busy) return;
    setBusy(true); setError("");
    try {
      await markMonthlyTuitionPaid(paymentRow.enrollmentId, period.year, period.month, {
        paidAt,
        amount: amount === "" ? null : Number(amount),
        note: note.trim() || undefined,
      });
      setPaymentRow(null);
      setSuccess(`Đã ghi nhận học phí tháng ${period.month} của ${paymentRow.studentName}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ghi nhận học phí.");
    } finally { setBusy(false); }
  };

  return <Stack spacing={2} data-testid="tuition-board-page" sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
    <Box>
      <Typography component="h1" variant="h5">Học phí theo tháng</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>Theo dõi số buổi học và trạng thái đã thu.</Typography>
    </Box>

    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "center" }}>
      <IconButton aria-label="Tháng trước" onClick={() => setPeriod((value) => moveTuitionMonth(value, -1))}><ChevronLeft /></IconButton>
      <Typography variant="h6" sx={{ minWidth: 150, textAlign: "center" }}>Tháng {period.month}/{period.year}</Typography>
      <IconButton aria-label="Tháng sau" onClick={() => setPeriod((value) => moveTuitionMonth(value, 1))}><ChevronRight /></IconButton>
    </Stack>

    {board && <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
      <Chip label={`${board.unpaidCount} chưa thu`} color={board.unpaidCount ? "warning" : "default"} />
      <Chip label={`${board.paidCount} đã thu`} color="success" variant="outlined" />
    </Stack>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
    {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, 1.5fr) 1fr 1fr" }, gap: 1 }}>
      <TextField size="small" label="Tìm học sinh" value={search} onChange={(event) => setSearch(event.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }} />
      <FormControl size="small"><InputLabel>Lớp</InputLabel><Select label="Lớp" value={classId} onChange={(event) => setClassId(event.target.value)}>
        <MenuItem value="">Tất cả lớp</MenuItem>{classes.map(([id, name]) => <MenuItem key={id} value={String(id)}>{name}</MenuItem>)}
      </Select></FormControl>
      <FormControl size="small"><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={scope} onChange={(event) => setScope(event.target.value as TuitionBoardScope)}>
        <MenuItem value="ALL">Tất cả</MenuItem><MenuItem value="UNPAID">Chưa thu</MenuItem><MenuItem value="PAID">Đã thu</MenuItem>
      </Select></FormControl>
    </Box>

    {!board && !error && <LoadingState />}
    {board && rows.length === 0 && <EmptyState message="Không có học sinh phù hợp." />}
    {board && rows.length > 0 && <>
      <TableContainer component={Card} variant="outlined" sx={{ display: { xs: "none", md: "block" } }}>
        <Table size="small" aria-label="Học phí theo tháng"><TableHead><TableRow>
          <TableCell>Học sinh</TableCell><TableCell>Lớp</TableCell><TableCell align="center">Có mặt / tổng</TableCell>
          <TableCell align="center">Vắng</TableCell><TableCell align="right">Số tiền</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell>
        </TableRow></TableHead><TableBody>{rows.map((row) => <DesktopRow key={row.enrollmentId} row={row} onPayment={openPayment} />)}</TableBody></Table>
      </TableContainer>
      <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
        {rows.map((row) => <MobileCard key={row.enrollmentId} row={row} onPayment={openPayment} />)}
      </Stack>
    </>}

    <Dialog open={Boolean(paymentRow)} onClose={() => !busy && setPaymentRow(null)} fullWidth maxWidth="xs">
      <DialogTitle>Đánh dấu đã thu</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 0.5 }}>
        <Typography>Học sinh: <strong>{paymentRow?.studentName}</strong></Typography>
        <TextField label="Ngày thu" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Số tiền (tùy chọn)" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} slotProps={{ htmlInput: { min: 0, step: 1 } }} />
        <TextField label="Ghi chú (tùy chọn)" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Stack></DialogContent><DialogActions>
        <Button disabled={busy} onClick={() => setPaymentRow(null)}>Hủy</Button>
        <Button data-testid="confirm-monthly-payment" variant="contained" disabled={busy || !paidAt || (amount !== "" && (!Number.isInteger(Number(amount)) || Number(amount) < 0))} onClick={() => void confirmPayment()}>{busy ? "Đang lưu…" : "Xác nhận"}</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}

function DesktopRow({ row, onPayment }: { row: MonthlyTuitionRow; onPayment: (row: MonthlyTuitionRow) => void }) {
  const attendance = tuitionAttendanceLabel(row);
  return <TableRow hover data-testid="tuition-board-row"><TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{row.studentName}</Typography>{row.studentNickname && <Typography variant="caption" color="text.secondary">{row.studentNickname}</Typography>}</TableCell>
    <TableCell>{row.className}</TableCell><TableCell align="center">{attendance.progress}</TableCell><TableCell align="center">{row.attendance.absent}</TableCell>
    <TableCell align="right">{money(row.amount)}</TableCell><TableCell><PaymentStatus row={row} /></TableCell><TableCell align="right">{row.status === "UNPAID" && <Button size="small" variant="contained" onClick={() => onPayment(row)}>Đã thu</Button>}</TableCell></TableRow>;
}

function MobileCard({ row, onPayment }: { row: MonthlyTuitionRow; onPayment: (row: MonthlyTuitionRow) => void }) {
  const attendance = tuitionAttendanceLabel(row);
  return <Card variant="outlined" data-testid="tuition-board-card"><CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 700 }}>{row.studentName}</Typography><Typography variant="body2" color="text.secondary">{row.className}</Typography></Box><PaymentStatus row={row} /></Stack>
    <Stack direction="row" spacing={2} sx={{ mt: 1, alignItems: "baseline" }}><Typography sx={{ fontWeight: 700 }}>{attendance.progress} buổi</Typography><Typography variant="body2" color="text.secondary">{attendance.absent}</Typography><Typography variant="body2" sx={{ ml: "auto" }}>{money(row.amount)}</Typography></Stack>
    {row.status === "UNPAID" && <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}><Button variant="contained" onClick={() => onPayment(row)}>Đã thu</Button></Box>}
  </CardContent></Card>;
}

function PaymentStatus({ row }: { row: MonthlyTuitionRow }) {
  return <Chip size="small" label={row.status === "PAID" ? "Đã thu" : "Chưa thu"} color={row.status === "PAID" ? "success" : "warning"} variant={row.status === "PAID" ? "filled" : "outlined"} />;
}

function money(value: number | null): string { return value == null ? "—" : `${value.toLocaleString("vi-VN")}đ`; }
