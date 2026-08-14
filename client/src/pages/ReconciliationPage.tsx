import { CalendarMonth, FilterList } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ClassListItem, ReconciliationState, ScheduleConflictWarning, ScheduleOccurrence } from "@teacher/shared";
import { api } from "../api/client";
import { scheduleApi } from "../api/schedule";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { addDays, displayDate } from "../utils/date";
import { useHoChiMinhToday } from "../hooks/useHoChiMinhToday";

const labels: Record<ReconciliationState, string> = {
  UNRECORDED: "Chưa ghi nhận", RECORDED: "Đã ghi nhận", SKIPPED: "Nghỉ", RESCHEDULED: "Đã đổi lịch",
};

interface SkipDialogState { keys: string[]; bulk: boolean }
interface ReconciliationFilters {
  from: string;
  to: string;
  classId: number;
  state: ReconciliationState | "ALL";
}

function shortDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function conflictLabel(count: number) {
  return count === 1 ? "Trùng lịch với một buổi khác" : `Trùng với ${count} buổi khác`;
}

function ReconciliationFilterFields({ values, classes, onChange }: {
  values: ReconciliationFilters;
  classes: ClassListItem[];
  onChange: (next: ReconciliationFilters) => void;
}) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
      <TextField required fullWidth type="date" label="Từ ngày" value={values.from} onChange={(event) => onChange({ ...values, from: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField required fullWidth type="date" label="Đến ngày" value={values.to} onChange={(event) => onChange({ ...values, to: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
    <TextField select fullWidth label="Lớp" value={values.classId && classes.some((item) => item.id === values.classId) ? values.classId : 0} onChange={(event) => onChange({ ...values, classId: Number(event.target.value) })}>
      <MenuItem value={0}>Tất cả lớp</MenuItem>{classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
    </TextField>
    <TextField select fullWidth label="Trạng thái" value={values.state} onChange={(event) => onChange({ ...values, state: event.target.value as ReconciliationState | "ALL" })}>
      <MenuItem value="ALL">Tất cả</MenuItem>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
  </Box>;
}

export function ReconciliationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const today = useHoChiMinhToday();
  const [fromOverride, setFromOverride] = useState<string | null>(() => params.get("from"));
  const [toOverride, setToOverride] = useState<string | null>(() => params.get("to"));
  const from = fromOverride ?? addDays(today, -14);
  const to = toOverride ?? today;
  const [classId, setClassId] = useState(Number(params.get("classId") ?? 0));
  const [state, setState] = useState<ReconciliationState | "ALL">((params.get("state") as ReconciliationState) ?? "UNRECORDED");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ReconciliationFilters>({ from, to, classId, state });
  const queryKey = `${from}|${to}|${classId}|${state}`;
  const [itemsSnapshot, setItemsSnapshot] = useState<{ queryKey: string; items: ScheduleOccurrence[] } | null>(null);
  const items = itemsSnapshot?.queryKey === queryKey ? itemsSnapshot.items : null;
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [reload, setReload] = useState(0);
  const [skipDialog, setSkipDialog] = useState<SkipDialogState | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [makeupRequired, setMakeupRequired] = useState(true);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<ScheduleOccurrence | null>(null);
  const [replacementDate, setReplacementDate] = useState("");
  const [replacementStart, setReplacementStart] = useState("18:00");
  const [replacementEnd, setReplacementEnd] = useState("19:30");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [warnings, setWarnings] = useState<ScheduleConflictWarning[]>([]);

  useEffect(() => { api<ClassListItem[]>("/api/classes").then(setClasses).catch(() => setClasses([])); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    scheduleApi.occurrences(
      { from, to, classId: classId || undefined, state: state === "ALL" ? undefined : state, lookbackDays: 60 },
      { signal: controller.signal },
    )
      .then((values) => {
        if (!active) return;
        setItemsSnapshot({ queryKey, items: values });
        setSelected((old) => old.filter((key) => values.some((item) => item.key === key && item.state === "UNRECORDED")));
      })
      .catch((value: Error) => { if (active) { setItemsSnapshot({ queryKey, items: [] }); setError(value.message); } });
    return () => { active = false; controller.abort(); };
  }, [classId, from, queryKey, reload, state, to]);

  const selectable = useMemo(() => items?.filter((item) => item.state === "UNRECORDED") ?? [], [items]);
  const allSelected = selectable.length > 0 && selectable.every((item) => selected.includes(item.key));
  const toggle = (key: string) => setSelected((old) => old.includes(key) ? old.filter((value) => value !== key) : [...old, key]);
  const appliedFilters: ReconciliationFilters = { from, to, classId, state };
  const selectedClassName = classes.find((item) => item.id === classId)?.name ?? (classId ? "Đang tải lớp…" : "Tất cả lớp");
  const activeFilterCount = Number(Boolean(classId)) + Number(state !== "ALL");
  const filterSummary = `${shortDate(from)}–${shortDate(to)}`;
  const draftInvalid = !draftFilters.from || !draftFilters.to || draftFilters.from > draftFilters.to;

  function applyFilters(next: ReconciliationFilters) {
    setFilterOpen(false);
    if (next.from === from && next.to === to && next.classId === classId && next.state === state) return;
    setItemsSnapshot(null); setError("");
    if (next.from !== from) setFromOverride(next.from);
    if (next.to !== to) setToOverride(next.to);
    setClassId(next.classId); setState(next.state);
  }

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFilterOpen(true);
  }

  async function createDraft(item: ScheduleOccurrence) {
    setBusyKey(item.key); setError("");
    try { const result = await scheduleApi.createDraft(item.key); navigate(result.wizardPath, { state: { scheduleConflicts: result.conflicts } }); }
    catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  async function submitSkip() {
    if (!skipDialog || !skipReason.trim()) return;
    setBusyKey("skip"); setError("");
    try {
      if (skipDialog.bulk) {
        const results = await scheduleApi.bulkSkip({ keys: skipDialog.keys, reason: skipReason, note: skipNote || undefined, makeupRequired });
        const ok = results.filter((item) => item.success).length;
        setSuccess(`Đã đánh dấu nghỉ ${ok}/${results.length} buổi.`);
      } else {
        await scheduleApi.skip(skipDialog.keys[0], { reason: skipReason, note: skipNote || undefined, makeupRequired });
        setSuccess("Đã đánh dấu nghỉ cho buổi dự kiến.");
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
      setSuccess(`Đã tạo ${ok}/${results.length} buổi để ghi nhận. Mở từng buổi để điểm danh và hoàn tất.`);
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
      setWarnings(result.conflicts); setSuccess("Đã đổi một buổi dự kiến; lịch lặp không thay đổi.");
      setRescheduleItem(null); setReload((value) => value + 1);
    } catch (value) { setError((value as Error).message); }
    finally { setBusyKey(""); }
  }

  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ width: "100%", maxWidth: "var(--app-operation-width)", mx: "auto", minWidth: 0, overflowX: "clip" }} data-testid="reconciliation-page" data-content-size="operation">
      <Typography component="h1" variant="h5">Xác nhận lịch dạy</Typography>
      <Typography color="text.secondary">Kiểm tra các buổi theo lịch và chọn Đã dạy, Nghỉ hoặc Đổi lịch. Học phí chỉ thay đổi sau khi hoàn tất ghi nhận.</Typography>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setItemsSnapshot(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}
      {warnings.length > 0 && <Alert severity="warning" onClose={() => setWarnings([])} data-testid="schedule-conflict-warning">
        Có {warnings.length} xung đột lịch; thao tác vẫn được lưu. {warnings.map((item) => `${item.title} ${item.startTime}–${item.endTime}`).join("; ")}
      </Alert>}

      <Card variant="outlined" data-testid="reconciliation-filter-summary" sx={{ display: { xs: "block", sm: "none" }, boxShadow: "none" }}><CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
        <Stack direction="row" useFlexGap sx={{ alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Chip icon={<CalendarMonth />} label={filterSummary} color="primary" variant="outlined" />
          <Chip label={selectedClassName} variant="outlined" sx={{ maxWidth: 150, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }} />
          {state !== "ALL" && <Chip label={labels[state]} color="warning" variant="outlined" />}
          <Button startIcon={<FilterList />} size="small" variant="outlined" onClick={openFilters} sx={{ ml: "auto", minHeight: 36, px: 1.25 }}>
            {activeFilterCount ? `Bộ lọc (${activeFilterCount})` : "Bộ lọc"}
          </Button>
        </Stack>
      </CardContent></Card>
      <Card variant="outlined" data-testid="reconciliation-filter-card" sx={{ display: { xs: "none", sm: "block" } }}><CardContent>
        <ReconciliationFilterFields values={appliedFilters} classes={classes} onChange={applyFilters} />
      </CardContent></Card>

      {selectable.length > 0 && <Card variant="outlined" data-testid="reconciliation-bulk-card" sx={{ boxShadow: "none" }}><CardContent sx={{ py: { xs: 0.5, sm: 2 }, "&:last-child": { pb: { xs: 0.5, sm: 2 } } }}><Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={allSelected} onChange={() => setSelected(allSelected ? [] : selectable.map((item) => item.key))} />} label="Chọn tất cả" />
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{selected.length} đã chọn</Typography>
        </Stack>
        {selected.length > 0 && <Box data-testid="reconciliation-desktop-bulk-actions" sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "repeat(2, max-content)", gap: 1, justifyContent: "start" }}>
          <Button variant="contained" disabled={Boolean(busyKey)} onClick={() => setBulkConfirm(true)} sx={{ whiteSpace: "nowrap" }}>Tạo {selected.length} buổi để ghi nhận</Button>
          <Button variant="outlined" color="error" disabled={Boolean(busyKey)} onClick={() => setSkipDialog({ keys: selected, bulk: true })} sx={{ whiteSpace: "nowrap" }}>Cho {selected.length} buổi nghỉ</Button>
        </Box>}
      </Stack></CardContent></Card>}

      {!items && <LoadingCards />}
      {items?.length === 0 && !error && <EmptyState message="Không có buổi dự kiến phù hợp trong khoảng đã chọn." />}
      <Box data-testid="reconciliation-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.25, sm: 1.5 }, alignItems: "start", pb: { xs: selected.length ? 9 : 0, sm: 0 } }}>
      {items?.map((item) => {
        const replacement = item.projectionSource === "RESCHEDULED";
        return <Card key={item.key} id={`occurrence-${item.key}`} data-testid="occurrence-card" variant="outlined"><CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}><Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
            <Stack sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="subtitle1">{item.className}</Typography>
                {item.combinedGroupId && <Chip size="small" color="secondary" variant="outlined" label={`Học ghép · ${item.memberClasses.length} lớp`} />}
              </Stack>
              <Typography variant="body2" color="text.secondary">{displayDate(item.occurrenceDate)} · {item.scheduledStartTime}–{item.scheduledEndTime}</Typography>
              {item.combinedGroupId && <Typography variant="body2" color="text.secondary">{item.memberClasses.map((member) => member.name).join(" · ")}</Typography>}
            </Stack>
            <Chip size="small" color={item.state === "UNRECORDED" ? "warning" : item.state === "RECORDED" ? "success" : "default"} label={replacement && item.state === "UNRECORDED" ? "Lịch thay thế" : labels[item.state]} />
          </Stack>
          {item.conflicts.length > 0 && <Alert severity="warning" sx={{ py: 0.25 }}>{conflictLabel(item.conflicts.length)}</Alert>}
          {item.state === "SKIPPED" && item.skipReason && <Typography variant="body2" color="text.secondary">Lý do: {item.skipReason}</Typography>}
          {item.state === "UNRECORDED" && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "auto repeat(3, max-content)", lg: "auto repeat(3, minmax(0, 1fr))" }, alignItems: "center", gap: 0.5 }}>
            <Checkbox aria-label={`Chọn ${item.className} ${item.occurrenceDate}`} checked={selected.includes(item.key)} onChange={() => toggle(item.key)} />
            <Button size="small" variant="contained" disabled={Boolean(busyKey)} onClick={() => void createDraft(item)}>{busyKey === item.key ? "Đang tạo…" : "Đã dạy"}</Button>
            <Button size="small" color="error" variant="outlined" disabled={Boolean(busyKey)} onClick={() => { setMakeupRequired(true); setSkipDialog({ keys: [item.key], bulk: false }); }}>Nghỉ</Button>
            {!replacement && <Button size="small" variant="outlined" disabled={Boolean(busyKey)} onClick={() => openReschedule(item)}>Đổi lịch</Button>}
          </Box>}
          {item.combinedTeachingOccurrenceId && <Button size="small" variant="outlined" onClick={() => navigate(`/admin/combined-class-groups/occurrences/${item.combinedTeachingOccurrenceId}`)}>
            {item.state === "RECORDED" ? "Xem ca học ghép" : "Tiếp tục ghi nhận nhóm"}
          </Button>}
          {!item.combinedTeachingOccurrenceId && item.linkedLessonId && <Button size="small" variant="outlined" onClick={() => navigate(`/admin/lessons/${item.linkedLessonId}/edit`)}>
            {item.linkedLessonStatus === "DRAFT" ? "Tiếp tục ghi nhận" : item.linkedLessonStatus === "COMPLETED" ? "Xem buổi đã ghi" : item.linkedLessonStatus === "CANCELLED" ? "Xem buổi đã hủy" : "Xem buổi học"}
          </Button>}
          {item.state === "SKIPPED" && !item.combinedGroupId && <Button size="small" variant="contained" onClick={() => navigate(`/admin/lessons/new?classId=${item.classId}&type=MAKEUP&source=${encodeURIComponent(item.originalKey)}`)}>Tạo buổi học bù</Button>}
        </Stack></CardContent></Card>;
      })}
      </Box>

      {selected.length > 0 && <Box
        data-testid="reconciliation-mobile-bulk-actions"
        sx={{
          display: { xs: "grid", sm: "none" },
          position: "fixed",
          zIndex: 15,
          left: 12,
          right: 12,
          bottom: "calc(var(--admin-nav-height) + var(--admin-safe-bottom) + 8px)",
          gridTemplateColumns: "minmax(0, 1fr) auto auto",
          alignItems: "center",
          gap: 0.75,
          p: 1,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.16)",
        }}
      >
        <Typography variant="subtitle2" noWrap>{selected.length} buổi đã chọn</Typography>
        <Button size="small" variant="contained" aria-label={`Tạo ${selected.length} buổi để ghi nhận`} disabled={Boolean(busyKey)} onClick={() => setBulkConfirm(true)} sx={{ minHeight: 40, px: 1.25 }}>Đã dạy</Button>
        <Button size="small" variant="outlined" color="error" aria-label={`Cho ${selected.length} buổi nghỉ`} disabled={Boolean(busyKey)} onClick={() => setSkipDialog({ keys: selected, bulk: true })} sx={{ minHeight: 40, px: 1.25 }}>Nghỉ</Button>
      </Box>}

      <Drawer
        anchor="bottom"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        data-testid="reconciliation-filter-sheet"
        slotProps={{ paper: { sx: { maxHeight: "calc(100dvh - 24px)", borderRadius: "18px 18px 0 0", overflow: "auto" } } }}
      >
        <Stack spacing={2} sx={{ width: "100%", maxWidth: 600, mx: "auto", p: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          <Box>
            <Typography component="h2" variant="h6">Bộ lọc lịch dạy</Typography>
            <Typography variant="body2" color="text.secondary">Điều chỉnh khoảng ngày, lớp và trạng thái hiển thị.</Typography>
          </Box>
          <ReconciliationFilterFields values={draftFilters} classes={classes} onChange={setDraftFilters} />
          <Stack direction="row" useFlexGap sx={{ alignItems: "center", justifyContent: "flex-end", gap: 0.75, flexWrap: "wrap" }}>
            <Button onClick={() => setDraftFilters((current) => ({ ...current, classId: 0, state: "ALL" }))} sx={{ mr: "auto", px: 1 }}>Xóa bộ lọc</Button>
            <Button onClick={() => setFilterOpen(false)}>Hủy</Button>
            <Button variant="contained" disabled={draftInvalid} onClick={() => applyFilters(draftFilters)}>Áp dụng</Button>
          </Stack>
        </Stack>
      </Drawer>

      <Dialog open={Boolean(skipDialog)} onClose={() => { if (!busyKey) setSkipDialog(null); }} fullWidth maxWidth="xs">
        <DialogTitle>{skipDialog?.bulk ? `Cho ${skipDialog.keys.length} buổi nghỉ` : "Xác nhận buổi nghỉ"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Chỉ tạo schedule exception; không tạo attendance hoặc thay đổi học phí.</Alert>
          <TextField required label="Lý do nghỉ" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} />
          <TextField multiline minRows={2} label="Ghi chú (tùy chọn)" value={skipNote} onChange={(event) => setSkipNote(event.target.value)} />
          <FormControlLabel control={<Checkbox checked={makeupRequired} onChange={(event) => setMakeupRequired(event.target.checked)} />} label="Cần sắp xếp học bù" />
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
        <DialogTitle>Tạo {selected.length} buổi để ghi nhận?</DialogTitle><DialogContent><Alert severity="info">Mỗi buổi được tạo riêng. Bạn vẫn cần mở từng buổi để điểm danh và hoàn tất.</Alert></DialogContent><DialogActions><Button disabled={Boolean(busyKey)} onClick={() => setBulkConfirm(false)}>Hủy</Button><Button data-testid="confirm-bulk-drafts" variant="contained" disabled={!selected.length || Boolean(busyKey)} onClick={() => void submitBulkDrafts()}>{busyKey ? "Đang tạo…" : "Tạo buổi"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
