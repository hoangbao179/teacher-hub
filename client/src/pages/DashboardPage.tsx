import { Add, CalendarMonth, CheckCircle, Payments } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardResponse } from "@teacher/shared";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { displayDashboardDate, todayInHoChiMinh } from "../utils/date";
import { PageHeader, visibleStatusLabel } from "../components/UiKit";
import { useAuth } from "../auth/AuthContext";
import { uiTokens } from "../theme";
import { classColor } from "../utils/classColor";

interface TodayItem { key: string; classId?: number; external?: boolean; title: string; time: string; label: string; href: string }

export function DashboardPage() {
  const auth = useAuth();
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
      key: `occurrence-${item.key}`, classId: item.classId, title: item.className,
      time: `${item.scheduledStartTime}–${item.scheduledEndTime}`,
      label: item.state === "UNRECORDED" ? (item.projectionSource === "RESCHEDULED" ? "Lịch thay thế" : "Dự kiến") : item.state === "RECORDED" ? `Buổi học · ${visibleStatusLabel(item.linkedLessonStatus ?? "DRAFT")}` : item.state === "SKIPPED" ? "Nghỉ" : "Đổi lịch",
      href: item.linkedLessonId ? `/admin/lessons/${item.linkedLessonId}/edit` : `/admin/reconciliation?from=${item.occurrenceDate}&to=${item.occurrenceDate}&state=ALL`,
    });
    for (const item of data.todaySchedule.lessons.filter((lesson) => !linked.has(lesson.id))) values.push({
      key: `lesson-${item.id}`, classId: item.classId, title: item.className, time: `${item.startTime}–${item.endTime}`,
      label: `${visibleStatusLabel(item.lessonType)} · ${visibleStatusLabel(item.status)}`,
      href: `/admin/lessons/${item.id}/edit`,
    });
    for (const item of data.todaySchedule.busyOccurrences) values.push({
      key: `busy-${item.id}-${item.date}`, external: item.slotType === "EXTERNAL_CLASS", title: item.title, time: `${item.startTime}–${item.endTime}`,
      label: item.slotType === "EXTERNAL_CLASS" ? (item.organizationType === "SCHOOL" ? "Trường" : "Trung tâm") : item.slotType === "PERSONAL" ? "Cá nhân" : "Khác", href: `/admin/busy-slots/${item.id}/edit`,
    });
    return values;
  }, [data]);

  if (!data && !error) return <LoadingCards />;
  const displayName = auth.user?.displayName.trim() || "cô Vy";
  const greetingName = displayName.startsWith("Cô ") ? `cô ${displayName.slice(3)}` : displayName;
  return <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="dashboard-page">
    <PageHeader title={`Xin chào, ${greetingName} 👋`} subtitle={displayDashboardDate(todayInHoChiMinh())} />
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setData(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, md: 4 }}><Card component={Link} to="/admin/tuition?status=PAYMENT_DUE" sx={{ display: "block", width: "100%", height: "100%", bgcolor: uiTokens.colors.lavender, border: `1px solid ${uiTokens.colors.lavenderBorder}`, boxShadow: 1, color: "text.primary", textDecoration: "none" }} data-testid="dashboard-tuition-card"><CardContent>
        <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", bgcolor: "#ded2ff", color: "primary.main", mb: 1 }}><Payments sx={{ fontSize: 20 }} /></Box><Typography variant="h6">{data?.paymentDueCount ?? 0} khoản học phí cần thu</Typography>
        <Typography>{(data?.totalUnpaidAmount ?? 0).toLocaleString("vi-VN")}đ chưa thu</Typography>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}><Card component={Link} to="/admin/reconciliation" sx={{ display: "block", width: "100%", height: "100%", bgcolor: uiTokens.colors.mint, border: `1px solid ${uiTokens.colors.mintBorder}`, boxShadow: 1, textDecoration: "none", color: "inherit" }} data-testid="dashboard-unrecorded-card"><CardContent>
        <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", bgcolor: "#d8f2e3", color: "#168754", mb: 1 }}><CheckCircle sx={{ fontSize: 20 }} /></Box><Typography variant="h6">{data?.unrecordedCount ?? 0} buổi cần xác nhận</Typography><Typography variant="body2" color="text.secondary">Trong 14 ngày gần đây</Typography>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}><Card component={Link} to="/admin/calendar" sx={{ display: "block", width: "100%", height: "100%", bgcolor: uiTokens.colors.blue, border: `1px solid ${uiTokens.colors.blueBorder}`, boxShadow: 1, textDecoration: "none", color: "inherit" }}><CardContent>
        <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", bgcolor: "#d9edff", color: "info.main", mb: 1 }}><CalendarMonth sx={{ fontSize: 20 }} /></Box><Typography variant="h6">{todayItems.length} sự kiện hôm nay</Typography><Typography variant="body2" color="text.secondary">Lớp, buổi học và lịch bận</Typography>
      </CardContent></Card></Grid>
    </Grid>

    <Typography component="h2" variant="h6">Thao tác nhanh</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "minmax(220px, 260px) repeat(2, minmax(180px, 220px))" }, gap: 1, justifyContent: "start" }}>
      <Button startIcon={<Add />} variant="contained" component={Link} to="/admin/lessons/new" sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>Ghi nhận buổi học</Button>
      <Button variant="outlined" component={Link} to="/admin/lessons/new?type=MAKEUP">Buổi học bù</Button>
      <Button variant="outlined" component={Link} to="/admin/busy-slots/new?type=EXTERNAL_CLASS">Thêm lịch dạy ngoài</Button>
    </Box>

    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography component="h2" variant="h6">Lịch hôm nay</Typography><Button size="small" component={Link} to="/admin/calendar">Xem lịch tuần</Button></Stack>
    {data && todayItems.length === 0 && <EmptyState message="Hôm nay chưa có lớp, buổi học hoặc lịch bận." />}
    <Box data-testid="dashboard-events" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {todayItems.map((item) => { const tone = classColor(item.classId ?? item.key); return <Card key={item.key} variant="outlined" component={Link} to={item.href} sx={{ textDecoration: "none", color: "inherit", borderLeft: 4, borderLeftColor: item.external ? "secondary.main" : tone.accent }} data-testid="dashboard-today-event"><CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Stack sx={{ minWidth: 0 }}><Typography variant="subtitle1">{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.time}</Typography></Stack><Typography variant="body2" color="primary" sx={{ fontWeight: 600, textAlign: "right" }}>{item.label}</Typography></Stack>
      </CardContent></Card>; })}
    </Box>
  </Stack>;
}
