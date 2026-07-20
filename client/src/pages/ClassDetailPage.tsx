import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ClassDetail, StudentListItem, TuitionMode } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, ErrorState, MobileCard, PageHeader, ProgressCount, StatusBadge } from "../components/UiKit";
export function ClassDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<ClassDetail | null>(null);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tuitionMode, setTuitionMode] = useState<TuitionMode>("CLASS_DEFAULT");
  const [customPrice, setCustomPrice] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(() => (location.state as { success?: string } | null)?.success ?? "");
  const load = useCallback(() => api<ClassDetail>(`/api/classes/${id}`).then(setItem).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
    api<StudentListItem[]>("/api/students").then(setStudents).catch(() => undefined);
  }, [load]);
  const statusAction = async (action: "pause" | "resume" | "close") => {
    if (action !== "resume" && !window.confirm(action === "close" ? "Đóng lớp? Lịch sử sẽ được giữ lại và không thể mở lại." : "Tạm dừng lớp?")) return;
    setError("");
    setSuccess(""); setBusy(true);
    try { await api(`/api/classes/${id}/${action}`, { method: "POST" }); await load(); setSuccess(action === "pause" ? "Đã tạm dừng lớp." : action === "resume" ? "Đã mở lại lớp." : "Đã đóng lớp."); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái."); }
    finally { setBusy(false); }
  };
  const enroll = async () => {
    setError("");
    setBusy(true); setSuccess(""); try {
      await api(`/api/classes/${id}/enrollments`, { method: "POST", body: JSON.stringify({
        studentId: Number(studentId), joinedAt, tuitionMode,
        customPackagePrice: tuitionMode === "CUSTOM" ? Number(customPrice) : undefined,
      }) });
      setDialogOpen(false); setStudentId(""); await load(); setSuccess("Đã ghi danh học sinh.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể ghi danh."); }
    finally { setBusy(false); }
  };
  if (!item && !error) return <LoadingState />;
  if (!item) return <ErrorState message={error || "Không tải được lớp."} onRetry={() => { setError(""); void load(); }} />;
  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={item!.name} action={<StatusBadge status={item!.status} />} />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button component={Link} to={`/admin/lessons/new?classId=${item!.id}`} variant="contained" disabled={item!.status === "CLOSED"}>
          Ghi buổi học
        </Button>
        <Button component={Link} to={`/admin/lessons/new?classId=${item!.id}&type=MAKEUP`} variant="outlined" disabled={item!.status === "CLOSED"}>Buổi học bù</Button>
        <Button component={Link} to={`/admin/classes/${item!.id}/edit`} variant="outlined">Sửa</Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {item!.status === "ACTIVE" && <Button disabled={busy} onClick={() => statusAction("pause")}>Tạm dừng</Button>}
        {item!.status === "PAUSED" && <Button disabled={busy} onClick={() => statusAction("resume")}>Mở lại</Button>}
        {item!.status !== "CLOSED" && <Button disabled={busy} color="error" onClick={() => statusAction("close")}>Đóng lớp</Button>}
      </Stack>
      <MobileCard>
          <Typography>Giá mặc định: <CurrencyDisplay value={item!.defaultPackagePrice} /> / 8 buổi</Typography>
          <Typography>
            Lịch:{" "}
            {item!.schedules
              .map((s) => `T${s.dayOfWeek} ${s.startTime}`)
              .join(", ")}
          </Typography>
      </MobileCard>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>Học sinh</Typography><Button variant="contained" disabled={busy || item!.status !== "ACTIVE" || (item!.type === "ONE_TO_ONE" && item!.activeStudentCount >= 1)} onClick={() => setDialogOpen(true)}>Ghi danh</Button></Stack>
      {item!.students.map((student) => (
        <Card key={student.enrollmentId}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 800 }}>{student.fullName}</Typography>
              <Typography>
                {student.tuitionMode === "FREE"
                  ? "Miễn phí"
                  : `${student.currentProgress ?? 0}/8`}
              </Typography>
            </Stack>
            {student.tuitionMode !== "FREE" && (
              <ProgressCount value={student.currentProgress ?? 0} />
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ghi danh học sinh</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl required><InputLabel>Học sinh</InputLabel><Select label="Học sinh" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.filter((x) => !x.enrollmentId && x.status === "ACTIVE").map((x) => <MenuItem value={String(x.id)} key={x.id}>{x.fullName}</MenuItem>)}
          </Select></FormControl>
          <TextField type="date" label="Ngày vào học" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <FormControl><InputLabel>Học phí</InputLabel><Select label="Học phí" value={tuitionMode} onChange={(e) => setTuitionMode(e.target.value as TuitionMode)}><MenuItem value="CLASS_DEFAULT">Theo giá lớp</MenuItem><MenuItem value="CUSTOM">Giá riêng</MenuItem><MenuItem value="FREE">Miễn phí</MenuItem></Select></FormControl>
          {tuitionMode === "CUSTOM" && <TextField required type="number" label="Giá riêng / 8 buổi" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />}
        </Stack></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)}>Hủy</Button><Button variant="contained" disabled={!studentId || busy} onClick={enroll}>{busy ? "Đang ghi danh…" : "Ghi danh"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
