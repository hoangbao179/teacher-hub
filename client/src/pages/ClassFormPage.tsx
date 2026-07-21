import { Add, Delete } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ClassDetail, ClassStatus, ClassType, RecurringScheduleInput } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { FormSection } from "../components/UiKit";
import { todayInHoChiMinh } from "../utils/date";

const emptySchedule: RecurringScheduleInput = { dayOfWeek: 1, startTime: "18:00", endTime: "19:30" };
const today = todayInHoChiMinh();
const priceDigits = (value: string): string => value.replace(/\D/g, "").replace(/^0+/, "");
const formatPrice = (value: string | number): string => {
  const digits = priceDigits(String(value));
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

export function ClassFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ClassType>("GROUP");
  const [subject, setSubject] = useState("Tiếng Anh");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(90);
  const [startDate, setStartDate] = useState(today);
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [status, setStatus] = useState<ClassStatus>("ACTIVE");
  const [originalStatus, setOriginalStatus] = useState<ClassStatus>("ACTIVE");
  const [note, setNote] = useState("");
  const [schedules, setSchedules] = useState<RecurringScheduleInput[]>([{ ...emptySchedule }]);
  const [scheduleEffectiveDate, setScheduleEffectiveDate] = useState(today);

  useEffect(() => {
    if (!id) return;
    api<ClassDetail>(`/api/classes/${id}`).then((item) => {
      setName(item.name); setType(item.type); setSubject(item.subject ?? "");
      setPrice(formatPrice(item.defaultPackagePrice)); setDuration(item.defaultDurationMinutes);
      setStartDate(item.startDate); setExpectedEndDate(item.expectedEndDate ?? "");
      setStatus(item.status); setOriginalStatus(item.status); setNote(item.note ?? "");
      setSchedules(item.schedules.map(({ id: scheduleId, dayOfWeek, startTime, endTime }) => ({ id: scheduleId, dayOfWeek, startTime, endTime })));
    }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(priceDigits(price));
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setError("Học phí gói 8 buổi phải lớn hơn 0.");
      return;
    }
    if (editing && status !== originalStatus && (status === "PAUSED" || status === "CLOSED") &&
      !window.confirm(status === "CLOSED" ? "Đóng lớp? Lịch sử sẽ được giữ lại và không thể mở lại." : "Tạm dừng lớp?")) return;
    setSaving(true); setError("");
    const body = { name, type, subject: subject || undefined, defaultPackagePrice: parsedPrice,
      defaultDurationMinutes: Number(duration), startDate, expectedEndDate: expectedEndDate || undefined,
      note: note || undefined, status, schedules,
      scheduleEffectiveDate: editing ? scheduleEffectiveDate : undefined };
    try {
      if (editing) await api(`/api/classes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      else {
        const result = await api<{ id: number }>("/api/classes", { method: "POST", body: JSON.stringify(body) });
        navigate(`/admin/classes/${result.id}`, { state: { success: "Đã tạo lớp." } }); return;
      }
      navigate(`/admin/classes/${id}`, { state: { success: "Đã cập nhật lớp." } });
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu lớp."); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingState />;
  return <Stack component="form" spacing={2} onSubmit={submit} data-testid="bounded-form" sx={{ width: "100%", maxWidth: "var(--app-form-width)", mx: "auto" }}>
    <Typography component="h1" variant="h5">{editing ? "Sửa lớp" : "Thêm lớp"}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <FormSection title="Thông tin lớp">
      <TextField required label="Tên lớp" value={name} onChange={(e) => setName(e.target.value)} />
      <FormControl><InputLabel>Loại lớp</InputLabel><Select label="Loại lớp" value={type} onChange={(e) => setType(e.target.value as ClassType)}>
        <MenuItem value="ONE_TO_ONE">1 kèm 1</MenuItem><MenuItem value="GROUP">Lớp nhóm</MenuItem>
      </Select></FormControl>
      <TextField label="Môn học" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <TextField required type="number" label="Thời lượng mặc định (phút)" value={duration} onChange={(e) => setDuration(Number(e.target.value))} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField required fullWidth type="date" label="Ngày bắt đầu" value={startDate} onChange={(e) => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField fullWidth type="date" label="Ngày kết thúc dự kiến" value={expectedEndDate} onChange={(e) => setExpectedEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      {editing && <Alert severity="info">Đổi trạng thái lớp tại trang chi tiết để chọn đúng ngày hiệu lực.</Alert>}
    </FormSection>
    <FormSection title="Học phí" description="Mức học phí cho đúng 8 buổi.">
      <TextField required label="Giá gói 8 buổi (VND)" placeholder="Ví dụ: 2.400.000" value={price} onChange={(event) => setPrice(formatPrice(event.target.value))} onBlur={() => setPrice(formatPrice(price))} slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9.]*" } }} />
    </FormSection>
    <FormSection title="Lịch học hằng tuần">
      {editing && <TextField required type="date" label="Áp dụng thay đổi lịch từ" value={scheduleEffectiveDate} onChange={(e) => setScheduleEffectiveDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="Chỉ dùng khi thêm, sửa hoặc xóa lịch; sửa metadata không tạo version lịch mới." />}
      {schedules.map((schedule, index) => <Card key={index} variant="outlined"><CardContent><Stack spacing={1.5}>
        <FormControl><InputLabel>Thứ</InputLabel><Select label="Thứ" value={schedule.dayOfWeek} onChange={(e) => setSchedules((old) => old.map((x, i) => i === index ? { ...x, dayOfWeek: Number(e.target.value) as RecurringScheduleInput["dayOfWeek"] } : x))}>
          {[1,2,3,4,5,6,7].map((day) => <MenuItem key={day} value={day}>{day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`}</MenuItem>)}
        </Select></FormControl>
        <Stack direction="row" spacing={1}><TextField fullWidth type="time" label="Bắt đầu" value={schedule.startTime} onChange={(e) => setSchedules((old) => old.map((x, i) => i === index ? { ...x, startTime: e.target.value } : x))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField fullWidth type="time" label="Kết thúc" value={schedule.endTime} onChange={(e) => setSchedules((old) => old.map((x, i) => i === index ? { ...x, endTime: e.target.value } : x))} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
        <Button color="error" startIcon={<Delete />} disabled={schedules.length === 1} onClick={() => setSchedules((old) => old.filter((_, i) => i !== index))}>Xóa lịch</Button>
      </Stack></CardContent></Card>)}
      <Button startIcon={<Add />} onClick={() => setSchedules((old) => [...old, { ...emptySchedule }])}>Thêm lịch</Button>
    </FormSection>
    <FormSection title="Ghi chú"><TextField multiline minRows={2} label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} /></FormSection>
    <Button type="submit" variant="contained" size="large" disabled={saving}>{saving ? "Đang lưu…" : "Lưu lớp"}</Button>
  </Stack>;
}
