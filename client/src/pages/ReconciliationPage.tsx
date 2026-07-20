import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ClassListItem, ReconciliationState, ScheduleConflictWarning, ScheduleOccurrence } from "@teacher/shared";
import { api } from "../api/client";
import { scheduleApi } from "../api/schedule";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { addDays, displayDate, todayInHoChiMinh } from "../utils/date";

const labels: Record<ReconciliationState, string> = {
  UNRECORDED: "Chưa ghi nhận", RECORDED: "Đã ghi nhận", SKIPPED: "Nghỉ", RESCHEDULED: "Đã đổi lịch",
};

interface SkipDialogState { keys: string[]; bulk: boolean }

export function ReconciliationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const today = todayInHoChiMinh();
  const [from, setFrom] = useState(params.get("from") ?? addDays(today, -14));
  const [to, setTo] = useState(params.get("to") ?? today);
  const [classId, setClassId] = useState(Number(params.get("classId") ?? 0));
  const [state, setState] = useState<ReconciliationState | "ALL">((params.get("state") as ReconciliationState) ?? "UNRECORDED");
  const [items, setItems] = useState<ScheduleOccurrence[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [reload, setReload] = useState(0);
  const [skipDialog, setSkipDialog] = useState<SkipDialogState | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<ScheduleOccurrence | null>(null);
  const [replacementDate, setReplacementDate] = useState(today);
  const [replacementStart, setReplacementStart] = useState("18:00");
  const [replacementEnd, setReplacementEnd] = useState("19:30");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [warnings, setWarnings] = useState<ScheduleConflictWarning[]>([]);

  useEffect(() => { api<ClassListItem[]>("/api/classes").then(setClasses).catch(() => setClasses([])); }, []);
  const load = useCallback(() => {
    scheduleApi.occurrences({ from, to, classId: classId || undefined, state: state === "ALL" ? undefined : state, lookbackDays: 60 })
      .then((values) => { setItems(values); setSelected((old) => old.filter((key) => values.some((item) => item.key === key && item.state === "UNRECORDED"))); })
      .catch((value: Error) => { setItems([]); setError(value.message); });
  }, [classId, from, state, to]);
  useEffect(load, [load, reload]);

  const selectable = useMemo(() => items?.filter((item) => item.state === "UNRECORDED") ?? [], [items]);
  const allSelected = selectable.length > 0 && selectable.every((item) => selected.includes(item.key));
  const toggle = (key: string) => setSelected((old) => old.includes(key) ? old.filter((value) => value !== key) : [...old, key]);

  async function createDraft(item: ScheduleOccurrence) {
    setBusyKey(item.key); setError("");
    try { const result = await scheduleApi.createDraft(item.key); navigate(result.wizardPath); }
    catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  async function submitSkip() {
    if (!skipDialog || !skipReason.trim()) return;
    setBusyKey("skip"); setError("");
    try {
      if (skipDialog.bulk) {
        const results = await scheduleApi.bulkSkip({ keys: skipDialog.keys, reason: skipReason, note: skipNote || undefined });
        const ok = results.filter((item) => item.success).length;
        setSuccess(`Đã đánh dấu nghỉ ${ok}/${results.length} buổi.`);
      } else {
        await scheduleApi.skip(skipDialog.keys[0], { reason: skipReason, note: skipNote || undefined });
        setSuccess("Đã đánh dấu nghỉ cho occurrence.");
      }
      setSkipDialog(null); setSkipReason(""); setSkipNote(""); setSelected([]); setReload((value) => value + 1);
    } catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  async function submitBulkDrafts() {
    setBusyKey("bulk"); setError("");
    try {
      const results = await scheduleApi.bulkCreateDrafts({ keys: selected });
      const ok = results.filter((item) => item.success).length;
      setSuccess(`Đã tạo ${ok}/${results.length} lesson draft độc lập. Mở từng draft để điểm danh và hoàn tất.`);
      setSelected([]); setBulkConfirm(false); setReload((value) => value + 1);
    } catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  function openReschedule(item: ScheduleOccurrence) {
    setRescheduleItem(item); setReplacementDate(item.occurrenceDate);
    setReplacementStart(item.scheduledStartTime); setReplacementEnd(item.scheduledEndTime);
    setRescheduleReason(""); setRescheduleNote("");
  }

  async function submitReschedule() {
    if (!rescheduleItem || !rescheduleReason.trim()) return;
    setBusyKey("reschedule"); setError("");
    try {
      const result = await scheduleApi.reschedule(rescheduleItem.key, {
        replacementDate, replacementStartTime: replacementStart, replacementEndTime: replacementEnd,
        reason: rescheduleReason, note: rescheduleNote || undefined,
      });
      setWarnings(result.conflicts); setSuccess("Đã đổi lịch cho một occurrence; lịch lặp không thay đổi.");
      setRescheduleItem(null); setReload((value) => value + 1);
    } catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  return (
    <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="reconciliation-page">
      <Typography variant="h5" sx={{ fontWeight: 900 }}>Đối soát buổi học</Typography>
      <Typography color="text.secondary">Xác nhận lịch dự kiến thành lesson draft, nghỉ hoặc đổi lịch. Học phí chỉ đổi sau khi hoàn tất lesson wizard.</Typography>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setItems(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}
      {warnings.length > 0 && <Alert severity="warning" onClose={() => setWarnings([])} data-testid="schedule-conflict-warning">
        Có {warnings.length} xung đột lịch; thao tác vẫn được lưu. {warnings.map((item) => `${item.title} ${item.startTime}–${item.endTime}`).join("; ")}
      </Alert>}

      <Card variant="outlined"><CardContent><Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField fullWidth type="date" label="Từ ngày" value={from} onChange={(event) => { setItems(null); setError(""); setFrom(event.target.value); }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth type="date" label="Đến ngày" value={to} onChange={(event) => { setItems(null); setError(""); setTo(event.target.value); }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <TextField select fullWidth label="Lớp" value={classId && classes.some((item) => item.id === classId) ? classId : 0} onChange={(event) => { setItems(null); setError(""); setClassId(Number(event.target.value)); }}>
          <MenuItem value={0}>Tất cả lớp</MenuItem>{classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </TextField>
        <TextField select fullWidth label="Trạng thái" value={state} onChange={(event) => { setItems(null); setError(""); setState(event.target.value as ReconciliationState | "ALL"); }}>
          <MenuItem value="ALL">Tất cả</MenuItem>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
      </Stack></CardContent></Card>

      {selectable.length > 0 && <Card variant="outlined"><CardContent><Stack spacing={1}>
        <FormControlLabel control={<Checkbox checked={allSelected} onChange={() => setSelected(allSelected ? [] : selectable.map((item) => item.key))} />} label={`Chọn tất cả (${selected.length} đã chọn)`} />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button variant="contained" disabled={!selected.length || Boolean(busyKey)} onClick={() => setBulkConfirm(true)}>Tạo {selected.length} bản nháp</Button>
          <Button variant="outlined" color="error" disabled={!selected.length || Boolean(busyKey)} onClick={() => setSkipDialog({ keys: selected, bulk: true })}>Cho {selected.length} buổi nghỉ</Button>
        </Stack>
      </Stack></CardContent></Card>}

      {!items && <LoadingCards />}
      {items?.length === 0 && !error && <EmptyState message="Không có occurrence phù hợp trong khoảng đã chọn." />}
      {items?.map((item) => {
        const replacement = item.projectionSource === "RESCHEDULED";
        return <Card key={item.key} id={`occurrence-${item.key}`} data-testid="occurrence-card" variant="outlined"><CardContent><Stack spacing={1.25}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
            <Stack sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{item.className}</Typography><Typography color="text.secondary">{displayDate(item.occurrenceDate)} · {item.scheduledStartTime}–{item.scheduledEndTime}</Typography></Stack>
            <Chip size="small" color={item.state === "UNRECORDED" ? "warning" : item.state === "RECORDED" ? "success" : "default"} label={replacement && item.state === "UNRECORDED" ? "Lịch thay thế" : labels[item.state]} />
          </Stack>
          {item.conflicts.length > 0 && <Alert severity="warning">{item.conflicts.length} cảnh báo trùng lịch</Alert>}
          {item.state === "UNRECORDED" && <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
            <Checkbox aria-label={`Chọn ${item.className} ${item.occurrenceDate}`} checked={selected.includes(item.key)} onChange={() => toggle(item.key)} />
            <Button size="small" variant="contained" disabled={Boolean(busyKey)} onClick={() => void createDraft(item)}>{busyKey === item.key ? "Đang tạo…" : "Đã dạy"}</Button>
            {!replacement && <Button size="small" color="error" variant="outlined" disabled={Boolean(busyKey)} onClick={() => setSkipDialog({ keys: [item.key], bulk: false })}>Nghỉ</Button>}
            {!replacement && <Button size="small" variant="outlined" disabled={Boolean(busyKey)} onClick={() => openReschedule(item)}>Đổi lịch</Button>}
          </Stack>}
          {item.linkedLessonId && <Button size="small" variant="outlined" onClick={() => navigate(`/admin/lessons/${item.linkedLessonId}/edit`)}>Mở lesson {item.linkedLessonStatus}</Button>}
        </Stack></CardContent></Card>;
      })}

      <Dialog open={Boolean(skipDialog)} onClose={() => { if (!busyKey) setSkipDialog(null); }} fullWidth maxWidth="xs">
        <DialogTitle>{skipDialog?.bulk ? `Cho ${skipDialog.keys.length} buổi nghỉ` : "Xác nhận buổi nghỉ"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Chỉ tạo schedule exception; không tạo attendance hoặc thay đổi học phí.</Alert>
          <TextField required label="Lý do nghỉ" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} />
          <TextField multiline minRows={2} label="Ghi chú (tùy chọn)" value={skipNote} onChange={(event) => setSkipNote(event.target.value)} />
        </Stack></DialogContent>
        <DialogActions><Button disabled={Boolean(busyKey)} onClick={() => setSkipDialog(null)}>Hủy</Button><Button variant="contained" color="error" disabled={!skipReason.trim() || Boolean(busyKey)} onClick={() => void submitSkip()}>{busyKey ? "Đang lưu…" : "Xác nhận nghỉ"}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(rescheduleItem)} onClose={() => { if (!busyKey) setRescheduleItem(null); }} fullWidth maxWidth="xs">
        <DialogTitle>Đổi lịch một buổi</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <TextField required type="date" label="Ngày thay thế" value={replacementDate} onChange={(event) => setReplacementDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Stack direction="row" spacing={1}><TextField fullWidth required type="time" label="Bắt đầu mới" value={replacementStart} onChange={(event) => setReplacementStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth required type="time" label="Kết thúc mới" value={replacementEnd} onChange={(event) => setReplacementEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
          <TextField required label="Lý do đổi lịch" value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} />
          <TextField multiline minRows={2} label="Ghi chú đổi lịch (tùy chọn)" value={rescheduleNote} onChange={(event) => setRescheduleNote(event.target.value)} />
        </Stack></DialogContent><DialogActions><Button disabled={Boolean(busyKey)} onClick={() => setRescheduleItem(null)}>Hủy</Button><Button variant="contained" disabled={!rescheduleReason.trim() || !replacementDate || replacementEnd <= replacementStart || Boolean(busyKey)} onClick={() => void submitReschedule()}>{busyKey ? "Đang lưu…" : "Lưu đổi lịch"}</Button></DialogActions>
      </Dialog>

      <Dialog open={bulkConfirm} onClose={() => { if (!busyKey) setBulkConfirm(false); }} fullWidth maxWidth="xs">
        <DialogTitle>Tạo {selected.length} lesson draft?</DialogTitle><DialogContent><Alert severity="info">Mỗi buổi là một draft riêng. Bạn vẫn phải mở từng lesson để điểm danh và hoàn tất.</Alert></DialogContent><DialogActions><Button disabled={Boolean(busyKey)} onClick={() => setBulkConfirm(false)}>Hủy</Button><Button data-testid="confirm-bulk-drafts" variant="contained" disabled={!selected.length || Boolean(busyKey)} onClick={() => void submitBulkDrafts()}>{busyKey ? "Đang tạo…" : "Tạo bản nháp"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
