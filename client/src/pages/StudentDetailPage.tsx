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
import type { StudentDetail, TuitionMode } from "@teacher/shared";
import { Download } from "@mui/icons-material";
import { api } from "../api/client";
import { downloadStudentReport } from "../api/students";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, PageHeader, ProgressCount } from "../components/UiKit";
export function StudentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [tuitionOpen, setTuitionOpen] = useState(false);
  const [tuitionMode, setTuitionMode] = useState<TuitionMode>("CLASS_DEFAULT");
  const [customPrice, setCustomPrice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(() => (location.state as { success?: string } | null)?.success ?? "");
  const load = useCallback(() => api<StudentDetail>(`/api/students/${id}`).then((value) => {
    setItem(value); setTuitionMode(value.tuitionMode ?? "CLASS_DEFAULT");
    setCustomPrice(value.customPackagePrice?.toString() ?? "");
  }).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const changeTuition = async () => { if (!item?.enrollmentId) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/tuition-mode`, { method: "PATCH", body: JSON.stringify({ tuitionMode, effectiveFrom, customPackagePrice: tuitionMode === "CUSTOM" ? Number(customPrice) : undefined }) });
    setTuitionOpen(false); await load(); setSuccess("Đã cập nhật chế độ học phí.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi học phí."); } finally { setBusy(false); } };
  const endEnrollment = async () => { if (!item?.enrollmentId || !window.confirm("Kết thúc ghi danh? Lịch sử học vẫn được giữ lại.")) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/end`, { method: "POST", body: JSON.stringify({ endedAt: today }) }); await load(); setSuccess("Đã kết thúc ghi danh và giữ nguyên lịch sử.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể kết thúc ghi danh."); } finally { setBusy(false); } };
  const changeEnrollmentStatus = async (action: "pause" | "resume") => { if (!item?.enrollmentId) return; if (action === "pause" && !window.confirm("Tạm dừng ghi danh này?")) return; setError(""); setSuccess(""); setBusy(true); try {
    await api(`/api/enrollments/${item.enrollmentId}/${action}`, { method: "POST" }); await load(); setSuccess(action === "pause" ? "Đã tạm dừng ghi danh." : "Đã mở lại ghi danh.");
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể đổi trạng thái ghi danh."); } finally { setBusy(false); } };
  const exportReport = async () => { setError(""); setSuccess(""); setBusy(true); try {
    const filename = await downloadStudentReport(item!.id); setSuccess(`Đã tải báo cáo Excel: ${filename}`);
  } catch (e) { setError(e instanceof Error ? e.message : "Không thể xuất báo cáo Excel."); } finally { setBusy(false); } };
  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error">{error || "Không tải được học sinh."}</Alert>;
  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <PageHeader title={item!.fullName} />
      <Button component={Link} to={`/admin/students/${item!.id}/edit`} variant="outlined">Sửa thông tin</Button>
      <Button startIcon={<Download />} variant="contained" disabled={busy} onClick={exportReport}>
        {busy ? "Đang tạo báo cáo…" : "Xuất báo cáo Excel"}
      </Button>
      <Card>
        <CardContent>
          <Typography>Lớp: {item!.className}</Typography>
          <Typography>
            Phụ huynh: {item!.parentName ?? "—"} · {item!.parentPhone ?? "—"}
          </Typography>
          <Typography>
            Học phí:{" "}
            {item!.tuitionMode === "FREE"
              ? "Miễn phí"
              : <><CurrencyDisplay value={item!.effectivePackagePrice} /> / 8 buổi</>}
          </Typography>
        </CardContent>
      </Card>
      {item!.tuitionMode !== "FREE" && (
        <Card>
          <CardContent>
            <ProgressCount value={item!.currentProgress ?? 0} />
          </CardContent>
        </Card>
      )}
      {item!.enrollmentStatus === "ACTIVE" && <Button disabled={busy} variant="outlined" onClick={() => changeEnrollmentStatus("pause")}>Tạm dừng ghi danh</Button>}
      {item!.enrollmentStatus === "PAUSED" && <Button disabled={busy} variant="outlined" onClick={() => changeEnrollmentStatus("resume")}>Mở lại ghi danh</Button>}
      <Button variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED"} onClick={() => setTuitionOpen(true)}>Đổi chế độ học phí</Button>
      <Button color="error" variant="outlined" disabled={busy || !item!.enrollmentId || item!.enrollmentStatus === "ENDED"} onClick={endEnrollment}>
        Cho ngừng học
      </Button>
      <Dialog open={tuitionOpen} onClose={() => setTuitionOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Chế độ học phí</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <FormControl><InputLabel>Chế độ</InputLabel><Select label="Chế độ" value={tuitionMode} onChange={(e) => setTuitionMode(e.target.value as TuitionMode)}><MenuItem value="CLASS_DEFAULT">Theo giá lớp</MenuItem><MenuItem value="CUSTOM">Giá riêng</MenuItem><MenuItem value="FREE">Miễn phí</MenuItem></Select></FormControl>
        {tuitionMode === "CUSTOM" && <TextField type="number" required label="Giá riêng / 8 buổi" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />}
        <TextField type="date" label="Áp dụng từ" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Alert severity="info">Thay đổi chỉ áp dụng cho chu kỳ học phí tiếp theo.</Alert>
      </Stack></DialogContent><DialogActions><Button onClick={() => setTuitionOpen(false)}>Hủy</Button><Button variant="contained" disabled={busy} onClick={changeTuition}>{busy ? "Đang lưu…" : "Lưu"}</Button></DialogActions></Dialog>
    </Stack>
  );
}
