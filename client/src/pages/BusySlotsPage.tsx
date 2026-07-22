import { Add } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { TeacherBusySlot } from "@teacher/shared";
import { scheduleApi } from "../api/schedule";
import { LoadingCards } from "../components/LoadingCards";
import { EmptyState } from "../components/EmptyState";
import { ConfirmationDialog, PageHeader } from "../components/UiKit";
import { displayDate, todayInHoChiMinh } from "../utils/date";

const weekday = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];

export function BusySlotsPage() {
  const today = todayInHoChiMinh();
  const [items, setItems] = useState<TeacherBusySlot[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ slot: TeacherBusySlot; action: "END" | "DELETE" } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => scheduleApi.busySlots().then(setItems).catch((value: Error) => setError(value.message)), []);
  useEffect(() => { void load(); }, [load]);
  const mutate = async () => {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      if (pending.action === "DELETE") await scheduleApi.deleteBusySlot(pending.slot.id);
      else await scheduleApi.updateBusySlot(pending.slot.id, {
        slotType: pending.slot.slotType, organizationType: pending.slot.organizationType ?? undefined,
        organizationName: pending.slot.organizationName ?? undefined,
        title: pending.slot.title, recurrenceType: "WEEKLY", dayOfWeek: pending.slot.dayOfWeek!,
        startTime: pending.slot.startTime, endTime: pending.slot.endTime,
        effectiveFrom: pending.slot.effectiveFrom!, effectiveTo: today,
        location: pending.slot.location ?? undefined, note: pending.slot.note ?? undefined,
      });
      setPending(null); await load();
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(false); }
  };
  const groups = useMemo(() => {
    const values = { active: [] as TeacherBusySlot[], upcoming: [] as TeacherBusySlot[], ended: [] as TeacherBusySlot[] };
    for (const slot of items ?? []) {
      const from = slot.recurrenceType === "ONCE" ? slot.specificDate! : slot.effectiveFrom!;
      const to = slot.recurrenceType === "ONCE" ? slot.specificDate! : slot.effectiveTo;
      if (from > today) values.upcoming.push(slot); else if (to && to < today) values.ended.push(slot); else values.active.push(slot);
    }
    return values;
  }, [items, today]);
  const section = (title: string, slots: TeacherBusySlot[]) => <Stack spacing={1}>
    <Typography variant="h6">{title}</Typography>
    {!slots.length && <EmptyState message="Không có lịch bận trong nhóm này." />}
    {slots.map((slot) => <Card key={slot.id} variant="outlined"><CardContent><Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Stack sx={{ minWidth: 0 }}><Typography variant="subtitle1">{slot.title}</Typography>{slot.organizationName && <Typography variant="body2" color="text.secondary">{slot.organizationName}</Typography>}</Stack><Stack direction="row" spacing={0.5}><Chip size="small" color={slot.slotType === "EXTERNAL_CLASS" ? "secondary" : "default"} label={slot.slotType === "EXTERNAL_CLASS" ? (slot.organizationType === "SCHOOL" ? "Trường" : "Trung tâm") : slot.slotType === "PERSONAL" ? "Cá nhân" : "Khác"} /><Chip size="small" label={slot.recurrenceType === "ONCE" ? "Một lần" : "Hằng tuần"} /></Stack></Stack>
      <Typography color="text.secondary">{slot.recurrenceType === "ONCE" ? displayDate(slot.specificDate!) : weekday[slot.dayOfWeek ?? 0]} · {slot.startTime}–{slot.endTime}</Typography>
      {slot.recurrenceType === "WEEKLY" && <Typography variant="body2">Hiệu lực: {displayDate(slot.effectiveFrom!)} – {slot.effectiveTo ? displayDate(slot.effectiveTo) : "không giới hạn"}</Typography>}
      {slot.location && <Typography variant="body2">Địa điểm: {slot.location}</Typography>}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button component={Link} to={`/admin/busy-slots/${slot.id}/edit`} size="small">Sửa lịch bận</Button>
        {slot.recurrenceType === "WEEKLY" && (!slot.effectiveTo || slot.effectiveTo >= today) && slot.effectiveFrom! <= today &&
          <Button size="small" color="warning" onClick={() => setPending({ slot, action: "END" })}>Kết thúc hôm nay</Button>}
        {(slot.recurrenceType === "ONCE" ? slot.specificDate! >= today : slot.effectiveFrom! > today) &&
          <Button size="small" color="error" onClick={() => setPending({ slot, action: "DELETE" })}>Xóa</Button>}
      </Stack>
    </Stack></CardContent></Card>)}
  </Stack>;
  return <Stack spacing={2} data-testid="busy-slot-list" sx={{ minWidth: 0 }}>
    <PageHeader title="Lịch bận và lịch dạy ngoài" action={<Stack direction="row" spacing={0.5}><Button component={Link} to="/admin/busy-slots/new?type=EXTERNAL_CLASS" variant="contained" size="small" startIcon={<Add />}>Thêm lịch dạy ngoài</Button><Button component={Link} to="/admin/busy-slots/new" variant="outlined" size="small">Thêm lịch bận</Button></Stack>} />
    <Alert severity="info">Lịch bận chỉ dùng để hiển thị và cảnh báo trùng. Hệ thống không tự nghỉ hoặc tự đổi lịch lớp.</Alert>
    {error && <Alert severity="error">{error}</Alert>}{!items && !error && <LoadingCards />}
    {items && <>{section("Đang áp dụng", groups.active)}{section("Sắp tới", groups.upcoming)}{section("Đã kết thúc", groups.ended)}</>}
    <ConfirmationDialog open={Boolean(pending)} title={pending?.action === "END" ? "Kết thúc lịch bận?" : "Xóa lịch bận?"}
      confirmLabel={pending?.action === "END" ? "Kết thúc hôm nay" : "Xóa lịch bận"} destructive={pending?.action === "DELETE"}
      busy={busy} onCancel={() => setPending(null)} onConfirm={() => void mutate()}>
      {pending?.action === "END" ? "Lịch lặp sẽ được giữ trong lịch sử và ngừng áp dụng sau hôm nay." : "Lịch bận sắp tới này sẽ bị xóa."}
    </ConfirmationDialog>
  </Stack>;
}
