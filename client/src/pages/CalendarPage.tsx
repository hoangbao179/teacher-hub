import { Add, CalendarMonth, CheckCircleOutlined, ChevronLeft, ChevronRight, FactCheckOutlined, Restore, WarningAmber } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { ReconciliationState, ScheduleConflictWarning, WeekScheduleResponse } from "@teacher/shared";
import { scheduleApi } from "../api/schedule";
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

function shortDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function WeekNavigator({ from, currentWeekStart, onChange }: {
  from: string;
  currentWeekStart: string;
  onChange: (value: string) => void;
}) {
  const isCurrentWeek = from === currentWeekStart;
  const dateRange = `${shortDate(from)} – ${shortDate(addDays(from, 6))}`;
  const selectDate = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) onChange(weekStart(event.target.value));
  };
  return <Box
    data-testid="week-navigator"
    sx={{
      p: { xs: 1.25, sm: 1.5 },
      border: 1,
      borderColor: "divider",
      borderRadius: 2.5,
      bgcolor: "background.paper",
      boxShadow: "0 4px 14px rgba(15, 118, 110, 0.05)",
    }}
  >
    <Stack spacing={0.5} sx={{ alignItems: "center" }}>
      {isCurrentWeek
        ? <Typography variant="caption" color="primary.dark" sx={{ minHeight: 28, display: "flex", alignItems: "center", fontWeight: 700 }}>Tuần này</Typography>
        : <Button size="small" variant="text" onClick={() => onChange(currentWeekStart)} sx={{ minHeight: 28, py: 0, px: 1 }}>Về tuần hiện tại</Button>}
      <Stack direction="row" spacing={0.75} sx={{ width: "100%", alignItems: "center" }}>
        <IconButton aria-label="Tuần trước" onClick={() => onChange(addDays(from, -7))} sx={{ width: 48, height: 48, flexShrink: 0, border: 1, borderColor: "divider", bgcolor: "background.paper", "& .MuiSvgIcon-root": { fontSize: 25 } }}>
          <ChevronLeft />
        </IconButton>
        <Box
          data-testid="week-range-control"
          sx={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            px: 1.25,
            borderRadius: 2,
            bgcolor: "primary.light",
            color: "primary.dark",
            "&:focus-within": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", pointerEvents: "none" }}>
            <CalendarMonth sx={{ fontSize: 20 }} />
            <Typography data-testid="week-date-range" sx={{ fontSize: { xs: 17, sm: 18 }, lineHeight: 1.2, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dateRange}</Typography>
          </Stack>
          <Box
            component="input"
            type="date"
            aria-label="Tuần bắt đầu"
            value={from}
            onChange={selectDate}
            sx={{ position: "absolute", inset: 0, zIndex: 1, width: "100%", height: "100%", m: 0, opacity: 0, cursor: "pointer" }}
          />
        </Box>
        <IconButton aria-label="Tuần sau" onClick={() => onChange(addDays(from, 7))} sx={{ width: 48, height: 48, flexShrink: 0, border: 1, borderColor: "divider", bgcolor: "background.paper", "& .MuiSvgIcon-root": { fontSize: 25 } }}>
          <ChevronRight />
        </IconButton>
      </Stack>
    </Stack>
  </Box>;
}

function WeeklyScheduleEmptyState({ currentWeek, onAdd }: {
  currentWeek: boolean;
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return <Box
    role="status"
    data-testid="weekly-calendar-empty-state"
    sx={{ p: { xs: 2.25, sm: 3 }, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2.5, bgcolor: "rgba(221,247,241,.48)" }}
  >
    <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, mx: "auto", mb: 1.25, borderRadius: 2, bgcolor: "primary.light", color: "primary.dark" }}>
      <CalendarMonth aria-hidden="true" sx={{ fontSize: 23 }} />
    </Box>
    <Typography variant="subtitle1">{currentWeek ? "Tuần này chưa có lịch dự kiến" : "Tuần đang xem chưa có lịch dự kiến"}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: "auto", mt: 0.5 }}>
      Thêm lịch trước để dễ theo dõi buổi học và lịch bận.
    </Typography>
    <Button variant="outlined" startIcon={<Add />} onClick={onAdd} sx={{ mt: 1.5 }}>Thêm lịch</Button>
  </Box>;
}

export function CalendarPage() {
  const currentWeekStart = weekStart(todayInHoChiMinh());
  const [from, setFrom] = useState(currentWeekStart);
  const [data, setData] = useState<WeekScheduleResponse | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [conflicts, setConflicts] = useState<ScheduleConflictWarning[]>([]);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
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
      key: `busy-${item.id}-${item.scheduleId ?? "once"}-${item.date}`, date: item.date, startTime: item.startTime, endTime: item.endTime,
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
  const isCurrentWeek = from === currentWeekStart;
  const changeWeek = (value: string) => {
    setData(null);
    setError("");
    setFrom(value);
  };

  return <Stack spacing={{ xs: 1.75, md: 2 }} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="weekly-calendar">
    <PageHeader title="Lịch tuần" />
    <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={() => setAddMenuAnchor(null)}>
      <MenuItem component={Link} to="/admin/busy-slots/new?type=EXTERNAL_CLASS" onClick={() => setAddMenuAnchor(null)}>Lịch dạy tại trường/trung tâm</MenuItem>
      <MenuItem component={Link} to="/admin/busy-slots/new" onClick={() => setAddMenuAnchor(null)}>Lịch bận cá nhân</MenuItem>
    </Menu>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "minmax(360px, 1fr) auto" }, alignItems: { xl: "center" }, gap: { xs: 1.5, md: 2 }, p: { md: 1.5 }, border: { md: 1 }, borderColor: { md: "divider" }, borderRadius: { md: 2.5 }, bgcolor: { md: "background.paper" }, boxShadow: { md: "0 4px 16px rgba(36,29,62,.04)" } }}>
      <Box sx={{ width: "100%", maxWidth: { md: 520, xl: "none" } }}>
        <WeekNavigator from={from} currentWeekStart={currentWeekStart} onChange={changeWeek} />
      </Box>
      <Box data-testid="calendar-quick-actions" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, max-content)" }, columnGap: { xs: 1.5, md: 1 }, rowGap: { xs: 1.25, md: 1 }, justifyContent: { xs: "stretch", md: "start", xl: "end" } }}>
        <Button startIcon={<CheckCircleOutlined />} variant="contained" component={Link} to={`/admin/lessons/new?date=${from}`} sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minHeight: { xs: 48, md: 44 }, "& .MuiButton-startIcon > *": { fontSize: 19 } }}>Ghi nhận buổi học</Button>
        <Button startIcon={<Restore />} variant="outlined" component={Link} to={`/admin/lessons/new?type=MAKEUP&date=${from}`} sx={{ "& .MuiButton-startIcon > *": { fontSize: 19 } }}>Buổi học bù</Button>
        <Button startIcon={<Add />} variant="outlined" onClick={(event) => setAddMenuAnchor(event.currentTarget)} sx={{ "& .MuiButton-startIcon > *": { fontSize: 19 } }}>Thêm lịch</Button>
      </Box>
    </Box>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setData(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
    {!data && !error && <LoadingCards />}
    <Stack direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 0.5, sm: 1.5 } }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
        <Typography component="h2" variant="h6">{isCurrentWeek ? "Lịch dự kiến tuần này" : "Lịch dự kiến"}</Typography>
        <Chip size="small" label={data ? `${entries.length} buổi` : "Đang tải"} color="primary" variant="outlined" sx={{ flexShrink: 0 }} />
      </Stack>
      <Button startIcon={<FactCheckOutlined />} variant="text" component={Link} to={`/admin/reconciliation?from=${from}&to=${addDays(from, 6)}&state=ALL`} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, px: { xs: 0.5, sm: 1 } }}>Kiểm tra lịch tuần</Button>
    </Stack>
    {data && grouped.length === 0 && <WeeklyScheduleEmptyState currentWeek={isCurrentWeek} onAdd={(event) => setAddMenuAnchor(event.currentTarget)} />}
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
