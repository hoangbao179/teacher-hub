import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, UploadFile } from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  LegacyAcademicPeriodPreview,
  LegacyClassMapping,
  LegacyImportPreview,
  LegacyPaymentResolution,
  LegacyReconciliationStatus,
  StudentDetail,
} from "@teacher/shared";
import { api } from "../api/client";
import { previewLegacyWorkbook } from "../api/students";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/UiKit";

const reconciliationLabels: Record<LegacyReconciliationStatus, string> = {
  MATCHED: "Đã khớp",
  LEARNING_ONLY_ABSENT: "Buổi nghỉ — không tính phí",
  LEARNING_ONLY_NEEDS_REVIEW: "Có lesson — cần kiểm tra học phí",
  TUITION_ONLY_NEEDS_REVIEW: "Chỉ có ở học phí — không tạo lesson",
  DATE_CORRECTION_SUGGESTED: "Đề xuất sửa ngày",
  DUPLICATE_SUSPECTED: "Nghi trùng",
  UNRESOLVED_DATE: "Chưa xác định ngày",
};
const paymentLabels: Record<LegacyPaymentResolution, string> = {
  PREVIOUS_CYCLE: "Trả đợt trước",
  CURRENT_CYCLE_ADVANCE: "Thu trước đợt hiện tại",
  SETTLE_INCOMPLETE: "Chốt đợt dở",
  UNDETERMINED: "Chưa xác định",
};

function statusColor(status: LegacyReconciliationStatus): "success" | "info" | "warning" | "error" {
  if (status === "MATCHED") return "success";
  if (status === "LEARNING_ONLY_ABSENT") return "info";
  if (status === "UNRESOLVED_DATE") return "error";
  return "warning";
}

function classMappingValue(mapping: LegacyClassMapping): string {
  if (mapping.type === "CREATE_CLOSED_CLASS") return "closed";
  if (mapping.type === "CURRENT_CLASS") return `current:${mapping.classId}`;
  return `existing:${mapping.classId}`;
}

export function LegacyImportPage() {
  const { studentId } = useParams();
  const id = Number(studentId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [preview, setPreview] = useState<LegacyImportPreview | null>(null);
  const [periods, setPeriods] = useState<LegacyAcademicPeriodPreview[]>([]);
  const [paymentChoices, setPaymentChoices] = useState<Record<string, LegacyPaymentResolution>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<StudentDetail>(`/api/students/${id}`).then(setStudent).catch((reason: Error) => setError(reason.message));
  }, [id]);

  const upload = async (file: File) => {
    setError("");
    if (!file.name.toLowerCase().endsWith(".xlsx")) { setError("Chỉ chấp nhận file .xlsx."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("File XLSX không được vượt quá 10 MB."); return; }
    setBusy(true);
    try {
      const result = await previewLegacyWorkbook(id, file);
      setPreview(result);
      setPeriods(result.academicPeriods);
      setPaymentChoices(Object.fromEntries(result.paymentEvents.map((event) => [event.id, event.recommendedResolution])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể phân tích workbook.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const updatePeriod = (periodId: string, update: Partial<LegacyAcademicPeriodPreview>) =>
    setPeriods((values) => values.map((period) => period.id === periodId ? { ...period, ...update } : period));
  const updateMapping = (period: LegacyAcademicPeriodPreview, value: string) => {
    if (!preview) return;
    let mapping: LegacyClassMapping;
    if (value === "closed") mapping = { type: "CREATE_CLOSED_CLASS", proposedName: `Lớp lịch sử ${period.schoolYear}` };
    else {
      const [type, rawId] = value.split(":");
      const candidate = preview.classCandidates.find((item) => item.id === Number(rawId));
      if (!candidate) return;
      mapping = type === "current"
        ? { type: "CURRENT_CLASS", classId: candidate.id, className: candidate.name }
        : { type: "EXISTING_CLASS", classId: candidate.id, className: candidate.name };
    }
    updatePeriod(period.id, { proposedClassMapping: mapping });
  };
  const adjusted = useMemo(() => {
    if (!preview) return null;
    const chosen = Object.values(paymentChoices);
    const paymentStillOpen = chosen.filter((choice) => choice === "UNDETERMINED").length;
    const missingGrades = periods.filter((period) => period.gradeLevel == null).length;
    const basePaymentIssues = preview.paymentEvents.filter((event) => event.requiresReview).length;
    return {
      paidCycles: Math.min(preview.summary.completedCycleCount, chosen.filter((choice) => choice === "PREVIOUS_CYCLE").length),
      advance: chosen.some((choice) => choice === "CURRENT_CYCLE_ADVANCE") ? "Có" : paymentStillOpen ? "Chưa xác định" : "Không",
      issues: Math.max(0, preview.summary.unresolvedIssueCount - basePaymentIssues - preview.academicPeriods.length + paymentStillOpen + missingGrades),
    };
  }, [paymentChoices, periods, preview]);

  if (!student && !error) return <LoadingState />;
  return (
    <Stack spacing={2.5} sx={{ width: "100%", maxWidth: 960, mx: "auto", minWidth: 0 }} data-testid="legacy-import-page">
      <Button component={Link} to={`/admin/students/${id}`} startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>
        Quay lại chi tiết học sinh
      </Button>
      <PageHeader title="Import lịch sử" subtitle={student?.fullName ?? "Học sinh"} />
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="info">V16A chỉ phân tích và mô phỏng. Chưa có dữ liệu nào được ghi vào hệ thống.</Alert>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Chọn workbook cô Vy</Typography>
            <Typography color="text.secondary">File .xlsx, tối đa 10 MB, gồm hai sheet Quá trình học tập và Học phí.</Typography>
            <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
              const file = event.target.files?.[0]; if (file) void upload(file);
            }} />
            <Button startIcon={<UploadFile />} variant="contained" disabled={busy} onClick={() => inputRef.current?.click()} sx={{ alignSelf: { sm: "flex-start" } }}>
              {busy ? "Đang phân tích…" : preview ? "Chọn file khác" : "Chọn file Excel"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {preview && adjusted && <>
        <Card><CardContent><Stack spacing={0.75}>
          <Typography variant="h6">Kết quả sẽ trở thành gì?</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
            {[
              ["Lesson lịch sử", preview.summary.totalLessons], ["Có mặt / Nghỉ", `${preview.summary.presentLessons} / ${preview.summary.absentLessons}`],
              ["Giai đoạn", periods.length], ["Đợt đủ 8 buổi", preview.summary.completedCycleCount],
              ["Đợt đã thu", adjusted.paidCycles], ["Đợt hiện tại", `${preview.summary.currentCycleProgress}/8`],
              ["Khoản thu trước", adjusted.advance], ["Cần xử lý", adjusted.issues],
            ].map(([label, value]) => <Box key={label} sx={{ p: 1.25, bgcolor: "background.default", borderRadius: 1.5, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
            </Box>)}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>SHA-256: {preview.file.sha256}</Typography>
        </Stack></CardContent></Card>

        <Stack spacing={1.5}>
          <Typography variant="h6">Năm học, khối và lớp dự kiến</Typography>
          <Alert severity="warning">Tên file không được dùng để gán khối. Hãy xác nhận từng giai đoạn.</Alert>
          {periods.map((period) => <Card key={period.id} variant="outlined"><CardContent><Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 700 }}>{period.schoolYear} · {period.lessonCount} lesson</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField type="date" label="Từ ngày" value={period.fromDate} onChange={(event) => updatePeriod(period.id, { fromDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField type="date" label="Đến ngày" value={period.toDate ?? ""} onChange={(event) => updatePeriod(period.id, { toDate: event.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} helperText="Để trống nếu đến hiện tại" />
              <TextField label="Năm học" value={period.schoolYear} onChange={(event) => updatePeriod(period.id, { schoolYear: event.target.value })} />
              <FormControl><InputLabel id={`${period.id}-grade-label`}>Khối</InputLabel><Select id={`${period.id}-grade`} labelId={`${period.id}-grade-label`} label="Khối" value={period.gradeLevel ?? ""} onChange={(event) => updatePeriod(period.id, { gradeLevel: Number(event.target.value) })}>
                {Array.from({ length: 9 }, (_, index) => index + 1).map((grade) => <MenuItem key={grade} value={grade}>Lớp {grade}</MenuItem>)}
              </Select></FormControl>
            </Box>
            <FormControl fullWidth><InputLabel id={`${period.id}-mapping-label`}>Mapping lớp dự kiến</InputLabel><Select id={`${period.id}-mapping`} labelId={`${period.id}-mapping-label`} label="Mapping lớp dự kiến" value={classMappingValue(period.proposedClassMapping)} onChange={(event) => updateMapping(period, event.target.value)}>
              {preview.classCandidates.filter((item) => item.isCurrent).map((item) => <MenuItem key={`current-${item.id}`} value={`current:${item.id}`}>Lớp hiện tại: {item.name}</MenuItem>)}
              {preview.classCandidates.map((item) => <MenuItem key={`existing-${item.id}`} value={`existing:${item.id}`}>Lớp có sẵn: {item.name} ({item.status === "ACTIVE" ? "Đang dạy" : item.status === "PAUSED" ? "Tạm dừng" : "Đã đóng"})</MenuItem>)}
              <MenuItem value="closed">Chuẩn bị tạo lớp lịch sử đã đóng ở V16B</MenuItem>
            </Select></FormControl>
          </Stack></CardContent></Card>)}
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h6">Mô phỏng học phí 8 buổi</Typography>
          {preview.tuitionCycles.map((cycle) => <Card key={cycle.cycleNumber} variant="outlined"><CardContent>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 700 }}>Đợt {cycle.cycleNumber}</Typography><Chip size="small" label={`${cycle.itemCount}/8 · ${cycle.state === "COMPLETE" ? "Đủ buổi" : "Đang tích lũy"}`} /></Stack>
            <Typography color="text.secondary">{cycle.fromDate ?? "Chưa rõ ngày"} → {cycle.toDate ?? "Chưa rõ ngày"}</Typography>
          </CardContent></Card>)}
          {preview.paymentEvents.length === 0 && <Alert severity="info">Không tìm thấy dấu PAID trong workbook.</Alert>}
          {preview.paymentEvents.map((event, index) => <Card key={event.id} variant="outlined"><CardContent><Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 700 }}>Sự kiện thanh toán {index + 1} · dòng {event.sourceRow}</Typography>
            <Typography color="text.secondary">Ngày đối chiếu: {event.date ?? "Chưa xác định"}. PAID không tự tạo ranh giới chu kỳ.</Typography>
            <FormControl fullWidth><InputLabel id={`${event.id}-resolution-label`}>Cách hiểu sự kiện PAID</InputLabel><Select id={`${event.id}-resolution`} labelId={`${event.id}-resolution-label`} label="Cách hiểu sự kiện PAID" value={paymentChoices[event.id]} onChange={(e) => setPaymentChoices((values) => ({ ...values, [event.id]: e.target.value as LegacyPaymentResolution }))}>
              {event.resolutionOptions.map((option) => <MenuItem key={option} value={option}>{paymentLabels[option]}</MenuItem>)}
            </Select></FormControl>
          </Stack></CardContent></Card>)}
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h6">Đối soát từng lesson</Typography>
          {preview.lessons.map((lesson) => <Card key={lesson.id} variant="outlined"><CardContent><Stack spacing={1} sx={{ minWidth: 0 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Typography sx={{ fontWeight: 700 }}>Dòng {lesson.sourceRow} · {lesson.originalDate || "Không có ngày"}</Typography>
              <Chip size="small" color={statusColor(lesson.reconciliationStatus)} label={reconciliationLabels[lesson.reconciliationStatus]} sx={{ alignSelf: "flex-start" }} />
            </Stack>
            <Typography>Ngày chuẩn hóa: {lesson.normalizedDate ?? "Chưa xác định"}{lesson.suggestedDate ? ` · đề xuất ${lesson.suggestedDate}` : ""}</Typography>
            <Typography color="text.secondary">{lesson.attendanceStatus === "ABSENT" ? "Nghỉ · không tính phí" : "Có mặt · dự kiến tính phí"}</Typography>
            {(lesson.content || lesson.homework || lesson.classwork || lesson.note) && <><Divider /><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{lesson.content ?? "Không có nội dung"}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Bài tập: {lesson.homework ?? "—"} · Bài tại lớp: {lesson.classwork ?? "—"} · Ghi chú: {lesson.note ?? "—"}</Typography></>}
          </Stack></CardContent></Card>)}
        </Stack>

        {preview.tuitionRows.some((row) => row.reconciliationStatus !== "MATCHED") && <Stack spacing={1.25}>
          <Typography variant="h6">Dòng học phí chưa có lesson</Typography>
          {preview.tuitionRows.filter((row) => row.reconciliationStatus !== "MATCHED").map((row) => <Card key={row.id} variant="outlined"><CardContent>
            <Typography sx={{ fontWeight: 700 }}>Dòng {row.sourceRow} · {row.date ?? "Chưa xác định"}</Typography>
            <Typography color="text.secondary">{reconciliationLabels[row.reconciliationStatus]}. Sẽ không tự tạo lesson.</Typography>
          </CardContent></Card>)}
        </Stack>}
        <Alert severity="info">Đã đến cuối preview V16A. Việc tạo dữ liệu chỉ được thực hiện trong V16B sau khi các mục audit được xác nhận.</Alert>
      </>}
    </Stack>
  );
}
