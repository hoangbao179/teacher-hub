import { Add, ArrowForwardIos, CalendarMonth, CheckCircle, Payments, Restore } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardResponse } from "@teacher/shared";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { displayDashboardDate, todayInHoChiMinh } from "../utils/date";
import { visibleStatusLabel } from "../components/UiKit";
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
      key: `busy-${item.id}-${item.scheduleId ?? "once"}-${item.date}`, external: item.slotType === "EXTERNAL_CLASS", title: item.title, time: `${item.startTime}–${item.endTime}`,
      label: item.slotType === "EXTERNAL_CLASS" ? (item.organizationType === "SCHOOL" ? "Trường" : "Trung tâm") : item.slotType === "PERSONAL" ? "Cá nhân" : "Khác", href: `/admin/busy-slots/${item.id}/edit`,
    });
    return values;
  }, [data]);

  if (!data && !error) return <LoadingCards />;
  const displayName = auth.user?.displayName.trim() || "cô Vy";
  const greetingName = displayName.startsWith("Cô ") ? `cô ${displayName.slice(3)}` : displayName;
  return <Stack spacing={{ xs: 1.5, md: 2.1 }} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="dashboard-page">
    <Box component="section" sx={{ position: "relative", minHeight: { xs: 134, md: 146 }, overflow: "hidden", p: { xs: 2, md: 3 }, pr: { xs: "36%", md: "36%" }, display: "flex", flexDirection: "column", justifyContent: "center", border: `1px solid ${uiTokens.colors.border}`, borderRadius: { xs: 2.5, md: uiTokens.bannerRadius / 8 }, background: "linear-gradient(110deg, #ffffff 0%, #f3fffb 54%, #e3f7f3 100%)", boxShadow: uiTokens.shadows.card }}>
      <Typography component="h1" variant="h5" sx={{ position: "relative", zIndex: 1, fontSize: { md: 26 }, letterSpacing: "-.02em" }}>{`Xin chào, ${greetingName} 👋`}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.5 }}>{displayDashboardDate(todayInHoChiMinh())}</Typography>
      <Stack direction="row" spacing={0.75} sx={{ position: "relative", zIndex: 1, alignItems: "center", mt: 1.25, color: "primary.dark", minWidth: 0 }}>
        <Box aria-hidden="true" sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", bgcolor: "#42bd85", boxShadow: "0 0 0 5px #dff6eb" }} />
        <Typography variant="caption" sx={{ fontSize: { xs: 10.5, sm: 11.5, md: 12.5 }, fontWeight: 600, whiteSpace: "nowrap" }}>Hôm nay có {todayItems.length} sự kiện trong lịch</Typography>
      </Stack>
      <Box component="img" src="/assets/admin-ui/teacher-dashboard-hero.webp" alt="" aria-hidden="true" sx={{ position: "absolute", right: { xs: -12, md: 4 }, bottom: { xs: -6, md: -28 }, width: { xs: "42%", md: "36%" }, maxWidth: { xs: 154, md: 330 }, height: { xs: 124, md: 188 }, objectFit: "contain", objectPosition: "center bottom", pointerEvents: "none" }} />
    </Box>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setData(null); setError(""); setReload((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
    <Grid container spacing={{ xs: 1, md: 1.5 }}>
      <Grid size={{ xs: 12, md: 4 }}><Card component={Link} to="/admin/tuition?status=PAYMENT_DUE" sx={{ position: "relative", display: "block", width: "100%", height: "100%", overflow: "hidden", bgcolor: uiTokens.colors.peach, borderColor: uiTokens.colors.peachBorder, color: "text.primary", textDecoration: "none", "&::after": { content: '""', position: "absolute", width: 74, height: 74, right: -24, bottom: -30, borderRadius: "50%", bgcolor: "rgba(255,255,255,.45)" }, "&:hover": { borderColor: "#eebd8c", boxShadow: uiTokens.shadows.raised } }} data-testid="dashboard-tuition-card"><CardContent sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} sx={{ position: "relative", zIndex: 1, alignItems: "center", height: "100%" }}><Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 1.75, bgcolor: "#ffddba", color: "#d96516" }}><Payments sx={{ fontSize: 23 }} /></Box><Stack spacing={0.25} sx={{ minWidth: 0, flexGrow: 1 }}><Typography variant="h6" sx={{ fontSize: { xs: 15, md: 16 } }}>{data?.paymentDueCount ?? 0} khoản học phí cần thu</Typography>
        <Typography variant="body2" color="text.secondary">{(data?.totalUnpaidAmount ?? 0).toLocaleString("vi-VN")}đ chưa thu</Typography></Stack><ArrowForwardIos sx={{ display: { xs: "none", md: "block" }, color: "text.secondary", fontSize: 15 }} /></Stack>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 6, md: 4 }}><Card component={Link} to="/admin/reconciliation" sx={{ position: "relative", display: "block", width: "100%", height: "100%", overflow: "hidden", bgcolor: uiTokens.colors.mint, borderColor: uiTokens.colors.mintBorder, textDecoration: "none", color: "inherit", "&::after": { content: '""', position: "absolute", width: 70, height: 70, right: -25, bottom: -30, borderRadius: "50%", bgcolor: "rgba(255,255,255,.42)" }, "&:hover": { borderColor: "#83d8b2", boxShadow: uiTokens.shadows.raised } }} data-testid="dashboard-unrecorded-card"><CardContent sx={{ height: "100%", px: { xs: 1.5, md: 2.5 } }}>
        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ position: "relative", zIndex: 1, alignItems: "center", height: "100%" }}><Box sx={{ display: "grid", placeItems: "center", width: { xs: 40, md: 44 }, height: { xs: 40, md: 44 }, flexShrink: 0, borderRadius: 1.75, bgcolor: "#bcefd7", color: "#168754" }}><CheckCircle sx={{ fontSize: 23 }} /></Box><Stack spacing={0.25} sx={{ minWidth: 0, flexGrow: 1 }}><Typography variant="h6" sx={{ fontSize: { xs: 14, md: 16 } }}>{data?.unrecordedCount ?? 0} buổi cần xác nhận</Typography><Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 11, md: 13 } }}>Trong 14 ngày gần đây</Typography></Stack><ArrowForwardIos sx={{ display: { xs: "none", md: "block" }, color: "text.secondary", fontSize: 15 }} /></Stack>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 6, md: 4 }}><Card component={Link} to="/admin/calendar" sx={{ position: "relative", display: "block", width: "100%", height: "100%", overflow: "hidden", bgcolor: uiTokens.colors.sky, borderColor: uiTokens.colors.skyBorder, textDecoration: "none", color: "inherit", "&::after": { content: '""', position: "absolute", width: 70, height: 70, right: -25, bottom: -30, borderRadius: "50%", bgcolor: "rgba(255,255,255,.46)" }, "&:hover": { borderColor: "#90ccea", boxShadow: uiTokens.shadows.raised } }}><CardContent sx={{ height: "100%", px: { xs: 1.5, md: 2.5 } }}>
        <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ position: "relative", zIndex: 1, alignItems: "center", height: "100%" }}><Box sx={{ display: "grid", placeItems: "center", width: { xs: 40, md: 44 }, height: { xs: 40, md: 44 }, flexShrink: 0, borderRadius: 1.75, bgcolor: "#c4e5fb", color: "info.main" }}><CalendarMonth sx={{ fontSize: 23 }} /></Box><Stack spacing={0.25} sx={{ minWidth: 0, flexGrow: 1 }}><Typography variant="h6" sx={{ fontSize: { xs: 14, md: 16 } }}>{todayItems.length} sự kiện hôm nay</Typography><Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 11, md: 13 } }}>Lớp, buổi học và lịch bận</Typography></Stack><ArrowForwardIos sx={{ display: { xs: "none", md: "block" }, color: "text.secondary", fontSize: 15 }} /></Stack>
      </CardContent></Card></Grid>
    </Grid>

    <Box sx={{ display: "grid", gridTemplateAreas: { xs: '"quick" "schedule"', md: '"schedule quick"' }, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.65fr) minmax(300px, .8fr)" }, gap: { xs: 1.5, md: 2 }, alignItems: "start" }}>
      <Card component="section" sx={{ gridArea: "quick", minWidth: 0 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}><Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 1.5, bgcolor: uiTokens.colors.primarySurface, color: "primary.main" }}><Add sx={{ fontSize: 21 }} /></Box><Typography component="h2" variant="h6">Thao tác nhanh</Typography></Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr)" }, gap: 1 }}>
            <Button startIcon={<CheckCircle />} variant="contained" component={Link} to="/admin/lessons/new" sx={{ gridColumn: "1 / -1", minHeight: 64, justifyContent: "flex-start", bgcolor: "#e7f7f1", color: "#137b61", boxShadow: "none", "&:hover": { bgcolor: "#d6f1e7", boxShadow: "none" } }}>Ghi nhận buổi học</Button>
            <Button startIcon={<Restore />} variant="outlined" component={Link} to="/admin/lessons/new?type=MAKEUP" sx={{ minHeight: 64, justifyContent: "flex-start", bgcolor: "#edf7ff", borderColor: uiTokens.colors.skyBorder, color: "#247dae", "&:hover": { bgcolor: "#e0f2fe", borderColor: "#90ccea" } }}>Buổi học bù</Button>
            <Button startIcon={<CalendarMonth />} variant="outlined" component={Link} to="/admin/busy-slots/new?type=EXTERNAL_CLASS" sx={{ minHeight: 64, justifyContent: "flex-start", bgcolor: uiTokens.colors.cream, borderColor: uiTokens.colors.peachBorder, color: "#a95418", "&:hover": { bgcolor: uiTokens.colors.peach, borderColor: "#eebd8c" } }}>Thêm lịch dạy ngoài</Button>
          </Box>
        </CardContent>
      </Card>

      <Card component="section" sx={{ gridArea: "schedule", minWidth: 0 }}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1.5 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}><Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0, borderRadius: 1.5, bgcolor: uiTokens.colors.primarySurface, color: "primary.main" }}><CalendarMonth sx={{ fontSize: 20 }} /></Box><Typography component="h2" variant="h6">Lịch hôm nay</Typography></Stack><Button size="small" endIcon={<ArrowForwardIos sx={{ fontSize: "14px !important" }} />} component={Link} to="/admin/calendar" sx={{ flexShrink: 0, px: { xs: 0.5, sm: 1 } }}>Xem lịch tuần</Button></Stack>
          {data && todayItems.length === 0 && <EmptyState message="Hôm nay chưa có lớp, buổi học hoặc lịch bận." />}
          <Box data-testid="dashboard-events" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
            {todayItems.map((item) => { const tone = classColor(item.classId ?? item.key); const [startTime, endTime] = item.time.split("–"); return <Card key={item.key} variant="outlined" component={Link} to={item.href} sx={{ gridColumn: { md: "1 / -1" }, textDecoration: "none", color: "inherit", bgcolor: "#fbfefd", boxShadow: "none", "&:hover": { borderColor: "#bfe1da", boxShadow: "0 4px 12px rgba(15,23,42,.05)" } }} data-testid="dashboard-today-event"><CardContent sx={{ py: 1.25, px: { xs: 1.25, sm: 1.5 }, "&:last-child": { pb: 1.25 } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "58px 4px minmax(0, 1fr)", sm: "72px 5px minmax(0, 1fr) auto" }, gap: { xs: 1, sm: 1.5 }, alignItems: "center" }}><Stack spacing={0.25} sx={{ textAlign: "center" }}><Typography variant="subtitle2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{startTime}</Typography><Typography variant="caption" color="text.secondary">đến {endTime}</Typography></Stack><Box aria-hidden="true" sx={{ width: "100%", height: 46, borderRadius: 999, bgcolor: item.external ? "secondary.main" : tone.accent }} /><Stack sx={{ minWidth: 0 }}><Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.external ? "Lịch dạy ngoài" : "Buổi học theo lịch lớp"}</Typography></Stack><Typography variant="caption" sx={{ gridColumn: { xs: 3, sm: "auto" }, justifySelf: "start", px: 1, py: 0.5, borderRadius: 999, bgcolor: item.external ? uiTokens.colors.coralSurface : tone.soft, color: item.external ? "#b94d5c" : tone.text, fontWeight: 700, whiteSpace: "nowrap" }}>{item.label}</Typography></Box>
            </CardContent></Card>; })}
          </Box>
        </CardContent>
      </Card>
    </Box>
  </Stack>;
}
