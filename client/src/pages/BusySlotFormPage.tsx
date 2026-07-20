import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { BusySlotRecurrenceType, ScheduleConflictWarning, TeacherBusySlotInput } from "@teacher/shared";
import { scheduleApi } from "../api/schedule";
import { LoadingState } from "../components/LoadingState";
import { ConfirmationDialog, FormSection, PageHeader, StickyActionBar } from "../components/UiKit";
import { todayInHoChiMinh } from "../utils/date";

export function BusySlotFormPage() {
  const { id } = useParams();
  const slotId = id ? Number(id) : null;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const today = todayInHoChiMinh();
  const [title, setTitle] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<BusySlotRecurrenceType>("ONCE");
  const [specificDate, setSpecificDate] = useState(params.get("date") ?? today);
  const [dayOfWeek, setDayOfWeek] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(Boolean(slotId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warnings, setWarnings] = useState<ScheduleConflictWarning[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!slotId) return;
    scheduleApi.busySlot(slotId).then((slot) => {
      setTitle(slot.title); setRecurrenceType(slot.recurrenceType); setSpecificDate(slot.specificDate ?? today);
      setDayOfWeek(slot.dayOfWeek ?? 1); setStartTime(slot.startTime); setEndTime(slot.endTime);
      setEffectiveFrom(slot.effectiveFrom ?? today); setEffectiveTo(slot.effectiveTo ?? "");
      setLocation(slot.location ?? ""); setNote(slot.note ?? "");
    }).catch((value: Error) => setError(value.message)).finally(() => setLoading(false));
  }, [slotId, today]);

  function payload(): TeacherBusySlotInput {
    return recurrenceType === "ONCE" ? {
      title, recurrenceType, specificDate, startTime, endTime,
      location: location || undefined, note: note || undefined,
    } : {
      title, recurrenceType, dayOfWeek, startTime, endTime, effectiveFrom,
      effectiveTo: effectiveTo || undefined, location: location || undefined, note: note || undefined,
    };
  }

  async function submit() {
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = slotId ? await scheduleApi.updateBusySlot(slotId, payload()) : await scheduleApi.createBusySlot(payload());
      setWarnings(result.conflicts); setSuccess(slotId ? "Đã cập nhật lịch bận." : "Đã tạo lịch bận.");
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!slotId) return;
    setBusy(true); setError("");
    try { await scheduleApi.deleteBusySlot(slotId); navigate("/admin/calendar", { replace: true }); }
    catch (value) { setError((value as Error).message); setConfirmDelete(false); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState />;
  const valid = title.trim() && startTime && endTime > startTime &&
    (recurrenceType === "ONCE" ? specificDate : effectiveFrom && (!effectiveTo || effectiveTo >= effectiveFrom));
  return <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="busy-slot-form">
    <PageHeader title={slotId ? "Sửa lịch bận" : "Thêm lịch bận"} subtitle="Lịch dạy ở trường hoặc việc riêng chỉ dùng để hiển thị và cảnh báo trùng lịch." />
    {error && <Alert severity="error" action={slotId ? <Button color="inherit" onClick={() => window.location.reload()}>Thử lại</Button> : undefined}>{error}</Alert>}
    {success && <Alert severity="success">{success}</Alert>}
    {warnings.length > 0 && <Alert severity="warning" data-testid="busy-conflict-warning">Có {warnings.length} cảnh báo trùng lịch: {warnings.map((item) => `${item.title} ${item.date} ${item.startTime}–${item.endTime}`).join("; ")}</Alert>}
    <FormSection title="Thông tin lịch bận">
      <TextField required label="Tiêu đề lịch bận" value={title} onChange={(event) => setTitle(event.target.value)} />
      <RadioGroup row value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as BusySlotRecurrenceType)}>
        <FormControlLabel value="ONCE" control={<Radio />} label="Một lần" />
        <FormControlLabel value="WEEKLY" control={<Radio />} label="Hằng tuần" />
      </RadioGroup>
      {recurrenceType === "ONCE" ? <TextField required type="date" label="Ngày bận" value={specificDate} onChange={(event) => setSpecificDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /> : <>
        <TextField select required label="Thứ trong tuần" value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value) as typeof dayOfWeek)}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => <MenuItem key={day} value={day}>{day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`}</MenuItem>)}
        </TextField>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField fullWidth required type="date" label="Hiệu lực từ" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth type="date" label="Hiệu lực đến (tùy chọn)" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </>}
      <Stack direction="row" spacing={1}>
        <TextField fullWidth required type="time" label="Bắt đầu" value={startTime} onChange={(event) => setStartTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField fullWidth required type="time" label="Kết thúc" value={endTime} onChange={(event) => setEndTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      <TextField label="Địa điểm (tùy chọn)" value={location} onChange={(event) => setLocation(event.target.value)} />
      <TextField multiline minRows={3} label="Ghi chú lịch bận (tùy chọn)" value={note} onChange={(event) => setNote(event.target.value)} />
      <Alert severity="info">Lịch bận không có học sinh, điểm danh hoặc học phí.</Alert>
    </FormSection>
    <StickyActionBar>
      {slotId && <Button color="error" variant="outlined" disabled={busy} onClick={() => setConfirmDelete(true)}>Xóa</Button>}
      <Button fullWidth size="large" variant="contained" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Đang lưu…" : "Lưu lịch bận"}</Button>
    </StickyActionBar>
    <ConfirmationDialog open={confirmDelete} title="Xóa lịch bận?" confirmLabel="Xóa lịch bận" destructive busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()}>
      Thao tác chỉ xóa lịch bận này và không ảnh hưởng buổi học hoặc học phí.
    </ConfirmationDialog>
  </Stack>;
}
