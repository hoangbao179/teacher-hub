import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ClassDetail, StudentListItem, TemporaryReschedulePreview, TuitionMode, Weekday } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, ErrorState, MobileCard, PageHeader, ProgressCount, StatusBadge } from "../components/UiKit";
import { scheduleApi } from "../api/schedule";
import { addDays, todayInHoChiMinh } from "../utils/date";
export function ClassDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<ClassDetail | null>(null);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tuitionMode, setTuitionMode] = useState<TuitionMode>("CLASS_DEFAULT");
  const [customPrice, setCustomPrice] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(() => (location.state as { success?: string } | null)?.success ?? "");
  const today = todayInHoChiMinh();
  const [statusActionName, setStatusActionName] = useState<"pause" | "resume" | "close" | null>(null);
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(today);
  const [statusReason, setStatusReason] = useState("");
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [temporaryFrom, setTemporaryFrom] = useState(today);
  const [temporaryTo, setTemporaryTo] = useState(addDays(today, 14));
  const [temporaryMappings, setTemporaryMappings] = useState<Record<number, { selected: boolean; day: Weekday; start: string; end: string }>>({});
  const [temporaryReason, setTemporaryReason] = useState("");
  const [temporaryNote, setTemporaryNote] = useState("");
  const [temporaryPreview, setTemporaryPreview] = useState<TemporaryReschedulePreview | null>(null);
  const load = useCallback(() => api<ClassDetail>(`/api/classes/${id}`).then(setItem).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
    api<StudentListItem[]>("/api/students").then(setStudents).catch(() => undefined);
  }, [load]);
  const statusAction = async () => {
    const action = statusActionName;
    if (!action) return;
    setError("");
    setSuccess(""); setBusy(true);
    try { await api(`/api/classes/${id}/${action}`, { method: "POST", body: JSON.stringify({ effectiveDate: statusEffectiveDate, reason: statusReason || undefined }) }); await load(); setStatusActionName(null); setSuccess(action === "pause" ? "Đã tạm dừng lớp theo ngày hiệu lực." : action === "resume" ? "Đã mở lại lớp theo ngày hiệu lực." : "Đã đóng lớp và giữ lịch sử."); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái."); }
    finally { setBusy(false); }
  };
  const temporaryPayload = (confirmConflicts = false) => ({
    classId: item!.id, fromDate: temporaryFrom, toDate: temporaryTo,
    mappings: Object.entries(temporaryMappings).filter(([, value]) => value.selected).map(([scheduleId, value]) => ({
      recurringScheduleId: Number(scheduleId), replacementDayOfWeek: value.day,
      replacementStartTime: value.start, replacementEndTime: value.end,
    })),
    reason: temporaryReason, note: temporaryNote || undefined, confirmConflicts,
  });
  const previewTemporary = async () => { setBusy(true); setError(""); try {
    setTemporaryPreview(await scheduleApi.previewTemporary(temporaryPayload()));
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể xem trước đổi lịch."); } finally { setBusy(false); } };
  const applyTemporary = async () => { if (!temporaryPreview) return; setBusy(true); setError(""); try {
    await scheduleApi.applyTemporary(temporaryPayload(temporaryPreview.conflictCount > 0));
    setTemporaryOpen(false); setTemporaryPreview(null); setSuccess("Đã đổi lịch tạm thời bằng schedule exceptions; lịch gốc không thay đổi.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể áp dụng đổi lịch."); } finally { setBusy(false); } };
  const enroll = async () => {
    setError("");
    setBusy(true); setSuccess(""); try {
      await api(`/api/classes/${id}/enrollments`, { method: "POST", body: JSON.stringify({
        studentId: Number(studentId), joinedAt, tuitionMode,
        customPackagePrice: tuitionMode === "CUSTOM" ? Number(customPrice) : undefined,
      }) });
      setDialogOpen(false); setStudentId(""); await load(); setSuccess("Đã ghi danh học sinh.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể ghi danh."); }
    finally { setBusy(false); }
  };
  if (!item && !error) return <LoadingState />;
  if (!item) return <ErrorState message={error || "Không tải được lớp."} onRetry={() => { setError(""); void load(); }} />;
  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={item!.name} action={<StatusBadge status={item!.status} />} />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button component={Link} to={`/admin/lessons/new?classId=${item!.id}`} variant="contained" disabled={item!.status === "CLOSED"}>
          Ghi buổi học
        </Button>
        <Button component={Link} to={`/admin/lessons/new?classId=${item!.id}&type=MAKEUP`} variant="outlined" disabled={item!.status === "CLOSED"}>Buổi học bù</Button>
        <Button component={Link} to={`/admin/classes/${item!.id}/edit`} variant="outlined">Sửa</Button>
        <Button variant="outlined" disabled={!item!.schedules.length || item!.status === "CLOSED"} onClick={() => { setTemporaryMappings(Object.fromEntries(item!.schedules.map((schedule, index) => [schedule.id, { selected: index === 0, day: schedule.dayOfWeek, start: schedule.startTime, end: schedule.endTime }]))); setTemporaryOpen(true); }}>Đổi lịch tạm thời</Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {item!.status === "ACTIVE" && <Button disabled={busy} onClick={() => setStatusActionName("pause")}>Tạm dừng</Button>}
        {item!.status === "PAUSED" && <Button disabled={busy} onClick={() => setStatusActionName("resume")}>Mở lại</Button>}
        {item!.status !== "CLOSED" && <Button disabled={busy} color="error" onClick={() => setStatusActionName("close")}>Đóng lớp</Button>}
      </Stack>
      <MobileCard>
          <Typography>Giá mặc định: <CurrencyDisplay value={item!.defaultPackagePrice} /> / 8 buổi</Typography>
          <Typography>
            Lịch:{" "}
            {item!.schedules
              .map((s) => `T${s.dayOfWeek} ${s.startTime}`)
              .join(", ")}
          </Typography>
      </MobileCard>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography variant="h6">Học sinh</Typography><Button variant="contained" disabled={busy || item!.status !== "ACTIVE" || (item!.type === "ONE_TO_ONE" && item!.activeStudentCount >= 1)} onClick={() => setDialogOpen(true)}>Ghi danh</Button></Stack>
      {item!.students.map((student) => (
        <Card key={student.enrollmentId}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="subtitle1">{student.fullName}</Typography>
              <Typography>
                {student.tuitionMode === "FREE"
                  ? "Miễn phí"
                  : `${student.currentProgress ?? 0}/8`}
              </Typography>
            </Stack>
            {student.tuitionMode !== "FREE" && (
              <ProgressCount value={student.currentProgress ?? 0} />
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ghi danh học sinh</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl required><InputLabel>Học sinh</InputLabel><Select label="Học sinh" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.filter((x) => !x.enrollmentId && x.status === "ACTIVE").map((x) => <MenuItem value={String(x.id)} key={x.id}>{x.fullName}</MenuItem>)}
          </Select></FormControl>
          <TextField type="date" label="Ngày vào học" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <FormControl><InputLabel>Học phí</InputLabel><Select label="Học phí" value={tuitionMode} onChange={(e) => setTuitionMode(e.target.value as TuitionMode)}><MenuItem value="CLASS_DEFAULT">Theo giá lớp</MenuItem><MenuItem value="CUSTOM">Giá riêng</MenuItem><MenuItem value="FREE">Miễn phí</MenuItem></Select></FormControl>
          {tuitionMode === "CUSTOM" && <TextField required type="number" label="Giá riêng / 8 buổi" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />}
        </Stack></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)}>Hủy</Button><Button variant="contained" disabled={!studentId || busy} onClick={enroll}>{busy ? "Đang ghi danh…" : "Ghi danh"}</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(statusActionName)} onClose={() => !busy && setStatusActionName(null)} fullWidth maxWidth="xs">
        <DialogTitle>{statusActionName === "pause" ? "Tạm dừng lớp" : statusActionName === "resume" ? "Mở lại lớp" : "Đóng lớp"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Ngày hiệu lực quyết định khoảng nào có occurrence; lịch lặp và lịch sử cũ được giữ nguyên.</Alert>
          <TextField required type="date" label="Ngày hiệu lực" value={statusEffectiveDate} onChange={(e) => setStatusEffectiveDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Lý do (tùy chọn)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
        </Stack></DialogContent><DialogActions><Button onClick={() => setStatusActionName(null)}>Hủy</Button><Button color={statusActionName === "close" ? "error" : "primary"} variant="contained" disabled={busy || !statusEffectiveDate} onClick={() => void statusAction()}>{busy ? "Đang lưu…" : "Xác nhận"}</Button></DialogActions>
      </Dialog>
      <Dialog open={temporaryOpen} onClose={() => !busy && setTemporaryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Đổi lịch tạm thời</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Hệ thống tạo exception cho từng buổi. Hết khoảng chọn, lớp tự trở về lịch gốc.</Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth required type="date" label="Từ ngày" value={temporaryFrom} onChange={(e) => { setTemporaryFrom(e.target.value); setTemporaryPreview(null); }} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth required type="date" label="Đến ngày" value={temporaryTo} onChange={(e) => { setTemporaryTo(e.target.value); setTemporaryPreview(null); }} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
          {item!.schedules.map((schedule) => { const mapping = temporaryMappings[schedule.id]; if (!mapping) return null; return <Card key={schedule.id} variant="outlined"><CardContent><Stack spacing={1}>
            <FormControlLabel control={<Checkbox checked={mapping.selected} onChange={(e) => { setTemporaryMappings((current) => ({ ...current, [schedule.id]: { ...current[schedule.id], selected: e.target.checked } })); setTemporaryPreview(null); }} />} label={`T${schedule.dayOfWeek} · ${schedule.startTime}–${schedule.endTime}`} />
            {mapping.selected && <><TextField select label="Chuyển sang" value={mapping.day} onChange={(e) => { setTemporaryMappings((current) => ({ ...current, [schedule.id]: { ...current[schedule.id], day: Number(e.target.value) as Weekday } })); setTemporaryPreview(null); }}>{[1,2,3,4,5,6,7].map((day) => <MenuItem key={day} value={day}>{day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`}</MenuItem>)}</TextField>
            <Stack direction="row" spacing={1}><TextField fullWidth required type="time" label="Bắt đầu mới" value={mapping.start} onChange={(e) => { setTemporaryMappings((current) => ({ ...current, [schedule.id]: { ...current[schedule.id], start: e.target.value } })); setTemporaryPreview(null); }} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth required type="time" label="Kết thúc mới" value={mapping.end} onChange={(e) => { setTemporaryMappings((current) => ({ ...current, [schedule.id]: { ...current[schedule.id], end: e.target.value } })); setTemporaryPreview(null); }} slotProps={{ inputLabel: { shrink: true } }} /></Stack></>}
          </Stack></CardContent></Card>; })}
          <TextField required label="Lý do" value={temporaryReason} onChange={(e) => { setTemporaryReason(e.target.value); setTemporaryPreview(null); }} />
          <TextField label="Ghi chú (tùy chọn)" value={temporaryNote} onChange={(e) => setTemporaryNote(e.target.value)} />
          {temporaryPreview && <Stack spacing={1}>{temporaryPreview.items.map((preview) => <Alert key={preview.originalOccurrenceKey} severity={!preview.eligible ? "error" : preview.conflicts.length ? "warning" : "success"}>{preview.originalDate} {preview.originalStartTime} → {preview.replacementDate} {preview.replacementStartTime}{preview.conflicts.length ? ` · ${preview.conflicts.length} cảnh báo trùng` : ""}</Alert>)}</Stack>}
        </Stack></DialogContent><DialogActions><Button onClick={() => setTemporaryOpen(false)}>Hủy</Button>{temporaryPreview ? <Button variant="contained" disabled={busy || !temporaryPreview.canApply} onClick={() => void applyTemporary()}>{busy ? "Đang áp dụng…" : temporaryPreview.conflictCount ? "Xác nhận dù trùng" : "Áp dụng"}</Button> : <Button variant="contained" disabled={busy || !temporaryReason.trim() || !Object.values(temporaryMappings).some((value) => value.selected)} onClick={() => void previewTemporary()}>{busy ? "Đang xem…" : "Xem trước"}</Button>}</DialogActions>
      </Dialog>
    </Stack>
  );
}
