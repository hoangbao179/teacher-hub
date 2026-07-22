import { Add, ChevronLeft, ChevronRight, WarningAmber } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ReconciliationState, ScheduleConflictWarning, WeekScheduleResponse } from "@teacher/shared";
import { scheduleApi } from "../api/schedule";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { addDays, displayDate, todayInHoChiMinh, weekStart } from "../utils/date";
import { PageHeader, visibleStatusLabel } from "../components/UiKit";
import { classColor } from "../utils/classColor";

type CalendarEntry = {
  key: string; date: string; startTime: string; endTime: string; title: string;
  subtitle: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info";
  detail?: string;
  classId?: number;
  href?: string;
  warnings?: ScheduleConflictWarning[];
};

const stateLabel: Record<ReconciliationState, string> = {
  UNRECORDED: "Dự kiến", RECORDED: "Đã ghi nhận", SKIPPED: "Nghỉ", RESCHEDULED: "Đổi lịch",
};

export function CalendarPage() {
  const [from, setFrom] = useState(weekStart(todayInHoChiMinh()));
  const [data, setData] = useState<WeekScheduleResponse | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [conflicts, setConflicts] = useState<ScheduleConflictWarning[]>([]);
  useEffect(() => {
    scheduleApi.week(from).then(setData).catch((value: Error) => setError(value.message));
  }, [from, reload]);

  const entries = useMemo(() => {
    if (!data) return [];
    const values: CalendarEntry[] = [];
    const linkedLessonIds = new Set(data.occurrences.map((item) => item.linkedLessonId).filter((id): id is number => id != null));
    for (const item of data.occurrences) values.push({
      key: `occurrence-${item.key}`, classId: item.classId, date: item.occurrenceDate, startTime: item.scheduledStartTime,
      endTime: item.scheduledEndTime, title: item.className,
      subtitle: item.projectionSource === "RESCHEDULED" && item.state === "UNRECORDED" ? "Lịch thay thế" : stateLabel[item.state],
      color: item.state === "UNRECORDED" ? "warning" : item.state === "RECORDED" ? "success" : item.state === "SKIPPED" ? "default" : "info",
      href: item.linkedLessonId ? `/admin/lessons/${item.linkedLessonId}/edit` : `/admin/reconciliation?from=${item.occurrenceDate}&to=${item.occurrenceDate}&state=ALL`,
      warnings: item.conflicts,
    });
    for (const item of data.lessons.filter((lesson) => !linkedLessonIds.has(lesson.id))) values.push({
      key: `lesson-${item.id}`, classId: item.classId, date: item.date, startTime: item.startTime, endTime: item.endTime,
      title: item.className, subtitle: `${visibleStatusLabel(item.lessonType)} · ${visibleStatusLabel(item.status)}`,
      color: item.status === "COMPLETED" ? "success" : item.status === "DRAFT" ? "primary" : "default",
      href: `/admin/lessons/${item.id}/edit`,
    });
    for (const item of data.busyOccurrences) values.push({
      key: `busy-${item.id}-${item.date}`, date: item.date, startTime: item.startTime, endTime: item.endTime,
      title: item.title,
      subtitle: item.slotType === "EXTERNAL_CLASS" ? (item.organizationType === "SCHOOL" ? "Trường" : "Trung tâm") : item.slotType === "PERSONAL" ? "Cá nhân" : "Khác",
      detail: [item.organizationName, item.location].filter(Boolean).join(" · "), color: item.slotType === "EXTERNAL_CLASS" ? "secondary" : "error",
      href: `/admin/busy-slots/${item.id}/edit`,
    });
    return values.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.key.localeCompare(b.key));
  }, [data]);
  const grouped = useMemo(() => {
    const values = new Map<string, CalendarEntry[]>();
    for (const item of entries) values.set(item.date, [...(values.get(item.date) ?? []), item]);
    return [...values.entries()];
  }, [entries]);

  return <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="weekly-calendar">
    <PageHeader title="Lịch tuần" action={<Stack direction="row" spacing={0.5}><Button size="small" variant="contained" startIcon={<Add />} component={Link} to="/admin/busy-slots/new?type=EXTERNAL_CLASS">Thêm lịch dạy ngoài</Button><Button size="small" variant="outlined" component={Link} to="/admin/busy-slots/new">Thêm lịch bận</Button></Stack>} />
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", width: "100%", maxWidth: 500 }}>
      <IconButton aria-label="Tuần trước" onClick={() => { setData(null); setError(""); setFrom(addDays(from, -7)); }}><ChevronLeft /></IconButton>
      <TextField fullWidth type="date" label="Tuần bắt đầu" value={from} onChange={(event) => { setData(null); setError(""); setFrom(weekStart(event.target.value)); }} slotProps={{ inputLabel: { shrink: true } }} />
      <IconButton aria-label="Tuần sau" onClick={() => { setData(null); setError(""); setFrom(addDays(from, 7)); }}><ChevronRight /></IconButton>
    </Stack>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, max-content)" }, gap: 1, justifyContent: "start" }}>
      <Button variant="contained" component={Link} to={`/admin/lessons/new?date=${from}`}>Ghi nhận buổi học</Button>
      <Button variant="outlined" component={Link} to={`/admin/lessons/new?type=MAKEUP&date=${from}`}>Buổi học bù</Button>
      <Button variant="outlined" component={Link} to={`/admin/reconciliation?from=${from}&to=${addDays(from, 6)}&state=ALL`}>Kiểm tra lịch tuần</Button>
    </Box>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setData(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
    {!data && !error && <LoadingCards />}
    {data && grouped.length === 0 && <EmptyState message="Tuần này chưa có lịch dự kiến, buổi học hoặc lịch bận." />}
    <Box data-testid="calendar-day-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "start" }}>
    {grouped.map(([date, items]) => <Stack key={date} spacing={1} data-testid="calendar-day">
      <Typography variant="h6" sx={{ mt: 1 }}>{displayDate(date)}</Typography>
      {items.map((item) => <Card key={item.key} variant="outlined" component={item.href ? Link : "div"} to={item.href} sx={{ textDecoration: "none", color: "inherit", borderLeft: 5, borderLeftColor: item.classId ? classColor(item.classId).accent : `${item.color}.main` }} data-testid="calendar-event">
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}><Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Stack sx={{ minWidth: 0 }}><Typography variant="subtitle1">{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.startTime}–{item.endTime}{item.detail ? ` · ${item.detail}` : ""}</Typography></Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>{Boolean(item.warnings?.length) && <IconButton size="small" color="warning" aria-label={`Xem ${item.warnings!.length} cảnh báo trùng lịch`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConflicts(item.warnings!); }}><WarningAmber fontSize="small" /></IconButton>}<Chip size="small" color={item.color} label={item.subtitle} /></Stack>
        </Stack></CardContent>
      </Card>)}
    </Stack>)}
    </Box>
    <Dialog open={conflicts.length > 0} onClose={() => setConflicts([])} fullWidth maxWidth="xs"><DialogTitle>Chi tiết trùng lịch</DialogTitle><DialogContent><Stack spacing={1.5}>
      {conflicts.map((warning, index) => <Alert key={`${warning.kind}-${warning.id ?? warning.occurrenceKey}-${index}`} severity="warning">
        <Typography variant="subtitle2">{warning.kind === "PROJECTED_OCCURRENCE" ? "Trùng lớp khác" : warning.kind === "LESSON" ? "Trùng buổi học" : "Trùng lịch bận"}</Typography>
        <Typography variant="body2">Trùng với {warning.title}</Typography><Typography variant="body2">{displayDate(warning.date)} · {warning.startTime}–{warning.endTime}</Typography>
      </Alert>)}
    </Stack></DialogContent></Dialog>
  </Stack>;
}
