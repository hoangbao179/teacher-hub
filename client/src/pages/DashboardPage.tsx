import { Add, CalendarMonth, CheckCircle, Payments } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardResponse } from "@teacher/shared";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { displayDate, todayInHoChiMinh } from "../utils/date";

interface TodayItem { key: string; title: string; time: string; label: string; href: string }

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    api<DashboardResponse>("/api/dashboard").then(setData).catch((value: Error) => setError(value.message));
  }, [reload]);
  const todayItems = useMemo(() => {
    if (!data) return [];
    const values: TodayItem[] = [];
    const linked = new Set(data.todaySchedule.occurrences.map((item) => item.linkedLessonId).filter((id): id is number => id != null));
    for (const item of data.todaySchedule.occurrences) values.push({
      key: `occurrence-${item.key}`, title: item.className,
      time: `${item.scheduledStartTime}–${item.scheduledEndTime}`,
      label: item.state === "UNRECORDED" ? (item.projectionSource === "RESCHEDULED" ? "Lịch thay thế" : "Dự kiến") : item.state === "RECORDED" ? `Lesson ${item.linkedLessonStatus}` : item.state === "SKIPPED" ? "Nghỉ" : "Đổi lịch",
      href: item.linkedLessonId ? `/admin/lessons/${item.linkedLessonId}/edit` : `/admin/reconciliation?from=${item.occurrenceDate}&to=${item.occurrenceDate}&state=ALL`,
    });
    for (const item of data.todaySchedule.lessons.filter((lesson) => !linked.has(lesson.id))) values.push({
      key: `lesson-${item.id}`, title: item.className, time: `${item.startTime}–${item.endTime}`,
      label: item.lessonType === "MAKEUP" ? `Học bù ${item.status}` : `${item.lessonType} ${item.status}`,
      href: `/admin/lessons/${item.id}/edit`,
    });
    for (const item of data.todaySchedule.busyOccurrences) values.push({
      key: `busy-${item.id}-${item.date}`, title: item.title, time: `${item.startTime}–${item.endTime}`,
      label: "Lịch bận", href: `/admin/busy-slots/${item.id}/edit`,
    });
    return values;
  }, [data]);

  if (!data && !error) return <LoadingCards />;
  return <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="dashboard-page">
    <Typography variant="h5" sx={{ fontWeight: 900 }}>Hôm nay · {displayDate(todayInHoChiMinh())}</Typography>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setData(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
    <Grid container spacing={1.5}>
      <Grid size={12}><Card component={Link} to="/admin/tuition?status=PAYMENT_DUE" sx={{ bgcolor: "primary.main", color: "white", textDecoration: "none" }} data-testid="dashboard-tuition-card"><CardContent>
        <Payments /><Typography variant="h5" sx={{ fontWeight: 900 }}>{data?.paymentDueCount ?? 0} chu kỳ cần thu</Typography>
        <Typography>{(data?.totalUnpaidAmount ?? 0).toLocaleString("vi-VN")}đ chưa thu</Typography>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12, sm: 6 }}><Card component={Link} to="/admin/reconciliation" sx={{ height: "100%", textDecoration: "none", color: "inherit" }} data-testid="dashboard-unrecorded-card"><CardContent>
        <CheckCircle color="warning" /><Typography variant="h6" sx={{ fontWeight: 900 }}>{data?.unrecordedCount ?? 0} buổi chưa ghi</Typography><Typography color="text.secondary">Trong 14 ngày gần đây</Typography>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12, sm: 6 }}><Card component={Link} to="/admin/calendar" sx={{ height: "100%", textDecoration: "none", color: "inherit" }}><CardContent>
        <CalendarMonth color="info" /><Typography variant="h6" sx={{ fontWeight: 900 }}>{todayItems.length} sự kiện hôm nay</Typography><Typography color="text.secondary">Lớp, lesson và lịch bận</Typography>
      </CardContent></Card></Grid>
    </Grid>

    <Typography sx={{ fontWeight: 900 }}>Thao tác nhanh</Typography>
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      <Button startIcon={<Add />} variant="contained" component={Link} to="/admin/lessons/new">Ghi nhận buổi học</Button>
      <Button variant="outlined" component={Link} to="/admin/lessons/new?type=MAKEUP">Buổi học bù</Button>
      <Button variant="outlined" component={Link} to="/admin/busy-slots/new">Thêm lịch bận</Button>
    </Stack>

    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography sx={{ fontWeight: 900 }}>Lịch hôm nay</Typography><Button size="small" component={Link} to="/admin/calendar">Xem lịch tuần</Button></Stack>
    {data && todayItems.length === 0 && <EmptyState message="Hôm nay chưa có lớp, lesson hoặc lịch bận." />}
    {todayItems.map((item) => <Card key={item.key} variant="outlined" component={Link} to={item.href} sx={{ textDecoration: "none", color: "inherit" }} data-testid="dashboard-today-event"><CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Stack sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{item.title}</Typography><Typography color="text.secondary">{item.time}</Typography></Stack><Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>{item.label}</Typography></Stack>
    </CardContent></Card>)}
  </Stack>;
}
