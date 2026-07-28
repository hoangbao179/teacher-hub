import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  Stack, Switch, TextField, Typography,
} from "@mui/material";
import { ArrowBack, CheckCircle, UploadFile } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  AttendanceStatus, LegacyAcademicPeriodPreview, LegacyClassMapping, LegacyImportApplyResult,
  LegacyImportIssueCode, LegacyImportPreview, LegacyImportRowDecision, LegacyImportRowPreview,
  LegacyImportSkipReason, LegacyPaymentResolution, StudentDetail,
} from "@teacher/shared";
import { api } from "../api/client";
import { applyLegacyWorkbook, previewLegacyWorkbook } from "../api/students";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/UiKit";

const issueLabels: Record<LegacyImportIssueCode, string> = {
  INVALID_DATE: "Ngày không hợp lệ", INVALID_TIME: "Giờ học chưa hợp lệ",
  STUDENT_MISMATCH: "Tên trong file khác học sinh đang chọn",
  ATTENDANCE_AMBIGUOUS: "Trạng thái điểm danh cần xác nhận", DUPLICATE_ROW: "Dòng nghi trùng",
  DATE_CORRECTION: "Ngày học có đề xuất chỉnh", TUITION_ROW_UNMATCHED: "Dòng học phí chưa có lesson",
  ACADEMIC_PERIOD_MAPPING_REQUIRED: "Cần map năm học, khối và lớp",
  PAYMENT_REVIEW_REQUIRED: "Sự kiện thanh toán cần xác nhận",
  NEAR_LESSON_MATCH: "Có lesson gần giống", LESSON_CONTENT_CONFLICT: "Nội dung lesson đang khác",
  TIME_MAPPING_REQUIRED: "Cần xác nhận cách hiểu khung giờ",
};
const skipLabels: Record<LegacyImportSkipReason, string> = {
  UNIDENTIFIABLE_DATA: "Dữ liệu không xác định được", DUPLICATE_ROW: "Dòng trùng",
  WRONG_STUDENT: "Không thuộc học sinh này", NOT_NEEDED: "Không cần nhập", OTHER: "Lý do khác",
};
const paymentLabels: Record<LegacyPaymentResolution, string> = {
  PREVIOUS_CYCLE: "Trả đợt trước", CURRENT_CYCLE_ADVANCE: "Thu trước đợt hiện tại",
  SETTLE_INCOMPLETE: "Chốt đợt dở", UNDETERMINED: "Chưa xác định",
};

interface RowDraft {
  date: string;
  startTime: string;
  endTime: string;
  attendance: AttendanceStatus;
  lessonAction: "MATCH" | "CREATE" | "KEEP" | "USE_IMPORT" | "EDIT";
  content: string;
  homework: string;
  payment: LegacyPaymentResolution;
  skipReason: LegacyImportSkipReason;
  otherReason: string;
}

function decisionKey(sheet: string, row: number, issue: LegacyImportIssueCode): string {
  return `${sheet}\u0000${row}\u0000${issue}`;
}

function classMappingValue(mapping: LegacyClassMapping): string {
  if (mapping.type === "CREATE_CLOSED_CLASS") return "closed";
  return `${mapping.type === "CURRENT_CLASS" ? "current" : "existing"}:${mapping.classId}`;
}

function initialDraft(row: LegacyImportRowPreview): RowDraft {
  return {
    date: String(row.normalizedValues.date ?? ""), startTime: String(row.normalizedValues.startTime ?? ""),
    endTime: String(row.normalizedValues.endTime ?? ""),
    attendance: (row.normalizedValues.attendance ?? "PRESENT") as AttendanceStatus,
    lessonAction: row.normalizedValues.existingLessonId ? "KEEP" : "CREATE",
    content: String(row.normalizedValues.content ?? ""), homework: String(row.normalizedValues.homework ?? ""),
    payment: (row.normalizedValues.paymentResolution ?? "UNDETERMINED") as LegacyPaymentResolution,
    skipReason: "UNIDENTIFIABLE_DATA", otherReason: "",
  };
}

export function LegacyImportPage() {
  const id = Number(useParams().studentId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LegacyImportPreview | null>(null);
  const [periods, setPeriods] = useState<LegacyAcademicPeriodPreview[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [decisions, setDecisions] = useState<Record<string, LegacyImportRowDecision>>({});
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<LegacyImportApplyResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<StudentDetail>(`/api/students/${id}`).then(setStudent).catch((reason: Error) => setError(reason.message));
  }, [id]);

  const upload = async (selected: File) => {
    setError(""); setResult(null);
    if (!selected.name.toLowerCase().endsWith(".xlsx")) { setError("Chỉ chấp nhận file .xlsx."); return; }
    if (selected.size > 10 * 1024 * 1024) { setError("File XLSX không được vượt quá 10 MB."); return; }
    setBusy(true);
    try {
      const next = await previewLegacyWorkbook(id, selected);
      setFile(selected); setPreview(next); setPeriods(next.academicPeriods); setDecisions({});
      setDrafts(Object.fromEntries(next.rows.map((row) => [row.id, initialDraft(row)])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể phân tích workbook."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const setDraft = (row: LegacyImportRowPreview, update: Partial<RowDraft>) =>
    setDrafts((values) => ({ ...values, [row.id]: { ...(values[row.id] ?? initialDraft(row)), ...update } }));
  const setDecision = (decision: LegacyImportRowDecision) =>
    setDecisions((values) => ({ ...values,
      [decisionKey(decision.sourceSheet, decision.sourceRow, decision.issueCode)]: decision }));
  const clearRowDecisions = (row: LegacyImportRowPreview) => setDecisions((values) => {
    const next = { ...values };
    row.issueCodes.forEach((issue) => delete next[decisionKey(row.sourceSheet, row.sourceRow, issue)]);
    return next;
  });

  const rowStatus = (row: LegacyImportRowPreview) => {
    if (!row.issueCodes.length) return "VALID" as const;
    const selected = row.issueCodes.map((issue) => decisions[decisionKey(row.sourceSheet, row.sourceRow, issue)]).filter(Boolean);
    if (selected.some((decision) => decision.action === "SKIP")) return "SKIPPED" as const;
    return selected.length === row.issueCodes.length ? "RESOLVED" as const : row.status;
  };

  const resolveRow = (row: LegacyImportRowPreview, bulk = false) => {
    const draft = drafts[row.id] ?? initialDraft(row);
    const next: LegacyImportRowDecision[] = [];
    for (const issueCode of row.issueCodes) {
      const base = { sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, issueCode };
      if (issueCode === "TIME_MAPPING_REQUIRED") {
        next.push({ ...base, action: "CONFIRM_TIME_MAPPING", resolvedValue: {
          mappingId: String(row.normalizedValues.mappingId), startTime: draft.startTime, endTime: draft.endTime } });
        continue;
      }
      if (["INVALID_DATE", "INVALID_TIME", "DATE_CORRECTION"].includes(issueCode))
        next.push({ ...base, action: "EDIT_ROW", resolvedValue: { date: draft.date || undefined,
          startTime: draft.startTime || undefined, endTime: draft.endTime || undefined,
          content: draft.content, homework: draft.homework } });
      else if (issueCode === "STUDENT_MISMATCH")
        next.push({ ...base, action: "CONFIRM_STUDENT", resolvedValue: { studentId: id } });
      else if (issueCode === "ATTENDANCE_AMBIGUOUS")
        next.push({ ...base, action: "SET_ATTENDANCE", resolvedValue: draft.attendance });
      else if (issueCode === "DUPLICATE_ROW" || issueCode === "NEAR_LESSON_MATCH") {
        const lessonId = Number(row.normalizedValues.existingLessonId ?? row.normalizedValues.nearLessonId);
        next.push(draft.lessonAction === "MATCH" || draft.lessonAction === "KEEP"
          ? { ...base, action: "MATCH_EXISTING_LESSON", lessonId }
          : { ...base, action: "CREATE_LESSON" });
      } else if (issueCode === "LESSON_CONTENT_CONFLICT") {
        next.push(draft.lessonAction === "USE_IMPORT" ? { ...base, action: "USE_IMPORTED_LESSON" }
          : draft.lessonAction === "EDIT" ? { ...base, action: "EDIT_LESSON_CONTENT",
            resolvedValue: { content: draft.content, homework: draft.homework } }
          : { ...base, action: "KEEP_EXISTING_LESSON" });
      } else if (issueCode === "PAYMENT_REVIEW_REQUIRED")
        next.push({ ...base, action: "CONFIRM_PAYMENT", resolvedValue: draft.payment });
      else { setError("Dòng này chỉ có thể được bỏ qua với lý do."); return; }
    }
    if (next.some((item) => item.action === "MATCH_EXISTING_LESSON" && !(item as { lessonId?: number }).lessonId)) {
      setError("Không có lesson hợp lệ để ghép."); return;
    }
    next.forEach(setDecision); setError("");
    if (bulk && preview) {
      const siblings = preview.rows.filter((candidate) => candidate.id !== row.id &&
        JSON.stringify(candidate.normalizedValues) === JSON.stringify(row.normalizedValues) &&
        candidate.issueCodes.join("|") === row.issueCodes.join("|"));
      if (siblings.length && window.confirm(`Áp dụng quyết định này cho ${siblings.length + 1} dòng giống nhau?`)) {
        for (const sibling of siblings) next.forEach((item) => setDecision({ ...item,
          sourceSheet: sibling.sourceSheet, sourceRow: sibling.sourceRow }));
      }
    }
  };

  const skipRow = (row: LegacyImportRowPreview) => {
    const draft = drafts[row.id] ?? initialDraft(row);
    clearRowDecisions(row);
    setDecision({ sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, issueCode: row.issueCodes[0],
      action: "SKIP", reason: draft.skipReason, ...(draft.skipReason === "OTHER" ? { otherReason: draft.otherReason } : {}) });
  };

  const confirmPeriod = (period: LegacyAcademicPeriodPreview, index: number) => {
    if (!period.gradeLevel) { setError(`Hãy chọn khối cho giai đoạn ${period.schoolYear}.`); return; }
    setDecision({ sourceSheet: "Giai đoạn học", sourceRow: index + 1,
      issueCode: "ACADEMIC_PERIOD_MAPPING_REQUIRED", action: "MAP_ACADEMIC_PERIOD",
      resolvedValue: { periodId: period.id, gradeLevel: period.gradeLevel,
        classMapping: period.proposedClassMapping } });
    setError("");
  };

  const summary = (() => {
    const rows = preview?.rows ?? [];
    const statuses = rows.map(rowStatus);
    return { valid: statuses.filter((item) => item === "VALID").length,
      review: statuses.filter((item) => item === "NEEDS_REVIEW").length,
      blocked: statuses.filter((item) => item === "BLOCKED").length,
      resolved: statuses.filter((item) => item === "RESOLVED").length,
      skipped: statuses.filter((item) => item === "SKIPPED").length };
  })();
  const unresolved = summary.review + summary.blocked;
  const timeMappingRows = (preview?.rows ?? []).filter((row) => row.rowType === "TIME_MAPPING");
  const visibleRows = (preview?.rows ?? []).filter((row) => row.rowType !== "ACADEMIC_PERIOD" && row.rowType !== "TIME_MAPPING" &&
    (!onlyNeedsReview || ["NEEDS_REVIEW", "BLOCKED"].includes(rowStatus(row))));

  const applyImport = async () => {
    if (!file || !preview || unresolved) return;
    setBusy(true); setError("");
    try { setResult(await applyLegacyWorkbook(id, file, preview.file.sha256, Object.values(decisions))); setConfirmOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể áp dụng workbook."); }
    finally { setBusy(false); }
  };

  if (!student && !error) return <LoadingState />;
  return <Stack spacing={2.5} sx={{ width: "100%", maxWidth: 960, mx: "auto", minWidth: 0, pb: 10 }} data-testid="legacy-import-page">
    <Button component={Link} to={`/admin/students/${id}`} startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>
      Quay lại chi tiết học sinh
    </Button>
    <PageHeader title="Import lịch sử" subtitle={student?.fullName ?? "Học sinh"} />
    {error && <Alert severity="error">{error}</Alert>}
    <Alert severity="info">Preview không ghi dữ liệu. Chỉ nút “Xác nhận import” mới áp dụng toàn bộ thay đổi trong một transaction.</Alert>
    <Card><CardContent><Stack spacing={1.5}>
      <Typography variant="h6">Chọn workbook cô Vy</Typography>
      <Typography color="text.secondary">File .xlsx tối đa 10 MB, gồm hai sheet Quá trình học tập và Học phí.</Typography>
      <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void upload(selected); }} />
      <Button startIcon={<UploadFile />} variant="contained" disabled={busy || Boolean(result)}
        onClick={() => inputRef.current?.click()} sx={{ alignSelf: { sm: "flex-start" } }}>
        {busy && !preview ? "Đang phân tích…" : preview ? "Chọn file khác" : "Chọn file Excel"}
      </Button>
    </Stack></CardContent></Card>

    {result && <Alert icon={<CheckCircle />} severity="success"><Stack spacing={1}>
      <Typography sx={{ fontWeight: 700 }}>Import #{result.importId} đã hoàn tất{result.idempotent ? " (đã áp dụng trước đó)" : ""}.</Typography>
      <Typography>{result.importedLessonCount} lesson mới, {result.matchedLessonCount} lesson ghép, {result.importedAttendanceCount} attendance,
        {` ${result.importedClassCount}`} lớp, {result.importedEnrollmentCount} enrollment, {result.importedTuitionCycleCount} cycle; {result.skippedRowCount} dòng bỏ qua.</Typography>
      <Button component={Link} to={`/admin/students/${id}`} variant="outlined" sx={{ alignSelf: "flex-start" }}>Về chi tiết học sinh</Button>
    </Stack></Alert>}

    {preview && !result && <>
      <Card><CardContent><Stack spacing={1}>
        <Typography variant="h6">Tổng hợp kiểm tra</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(5,minmax(0,1fr))" }, gap: 1 }}>
          {[["Tổng dòng", preview.rows.length], ["Hợp lệ", summary.valid], ["Cần xử lý", summary.review],
            ["Blocked", summary.blocked], ["Đã resolve", summary.resolved], ["Bỏ qua", summary.skipped],
            ["Lesson dự kiến", preview.summary.expectedLessonCount], ["Cycle dự kiến", preview.summary.expectedTuitionCycleCount]]
            .map(([label, value]) => <Box key={label} sx={{ p: 1.25, bgcolor: "background.default", borderRadius: 1.5, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6">{value}</Typography>
            </Box>)}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>SHA-256: {preview.file.sha256}</Typography>
      </Stack></CardContent></Card>

      <Stack spacing={1.5}>
        <Typography variant="h6">Năm học, khối và lớp</Typography>
        {periods.map((period, index) => <Card key={period.id} variant="outlined"><CardContent><Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 700 }}>{period.schoolYear} · {period.lessonCount} lesson</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <FormControl><InputLabel id={`${period.id}-grade-label`}>Khối</InputLabel><Select labelId={`${period.id}-grade-label`}
              label="Khối" value={period.gradeLevel ?? ""} onChange={(event) => {
                const next = periods.map((item) => item.id === period.id ? { ...item, gradeLevel: Number(event.target.value) } : item);
                setPeriods(next); clearRowDecisions(preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD" && row.sourceRow === index + 1)!);
              }}>{Array.from({ length: 9 }, (_, item) => item + 1).map((grade) => <MenuItem key={grade} value={grade}>Lớp {grade}</MenuItem>)}</Select></FormControl>
            <FormControl><InputLabel id={`${period.id}-mapping-label`}>Mapping lớp</InputLabel><Select labelId={`${period.id}-mapping-label`}
              label="Mapping lớp" value={classMappingValue(period.proposedClassMapping)} onChange={(event) => {
                const value = event.target.value; let mapping: LegacyClassMapping;
                if (value === "closed") mapping = { type: "CREATE_CLOSED_CLASS", proposedName: `Lớp lịch sử ${period.schoolYear}` };
                else { const [kind, rawId] = value.split(":"); const candidate = preview.classCandidates.find((item) => item.id === Number(rawId))!;
                  mapping = kind === "current" ? { type: "CURRENT_CLASS", classId: candidate.id, className: candidate.name }
                    : { type: "EXISTING_CLASS", classId: candidate.id, className: candidate.name }; }
                setPeriods((items) => items.map((item) => item.id === period.id ? { ...item, proposedClassMapping: mapping } : item));
                clearRowDecisions(preview.rows.find((row) => row.rowType === "ACADEMIC_PERIOD" && row.sourceRow === index + 1)!);
              }}>
              {preview.classCandidates.filter((item) => item.isCurrent).map((item) => <MenuItem key={`current-${item.id}`} value={`current:${item.id}`}>Lớp hiện tại: {item.name}</MenuItem>)}
              {preview.classCandidates.map((item) => <MenuItem key={`existing-${item.id}`} value={`existing:${item.id}`}>Lớp có sẵn: {item.name}</MenuItem>)}
              <MenuItem value="closed">Tạo lớp lịch sử đã đóng</MenuItem>
            </Select></FormControl>
          </Box>
          <Button variant="outlined" onClick={() => confirmPeriod(period, index)}>Xác nhận mapping</Button>
        </Stack></CardContent></Card>)}
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Typography variant="h6">Xử lý từng dòng</Typography>
          <FormControlLabel control={<Switch checked={onlyNeedsReview} onChange={(event) => setOnlyNeedsReview(event.target.checked)} />}
            label="Chỉ xem dòng cần xử lý" />
        </Stack>
        {visibleRows.length === 0 && <Alert severity="success">Không còn dòng cần xử lý.</Alert>}
        {timeMappingRows.map((row) => {
          const draft = drafts[row.id] ?? initialDraft(row); const status = rowStatus(row);
          return <Card key={row.id} variant="outlined"><CardContent><Stack spacing={1.25}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 700 }}>Xác nhận khung giờ: {String(row.rawValues.rawTime)}</Typography>
              <Chip size="small" color={status === "RESOLVED" ? "success" : "warning"}
                label={status === "RESOLVED" ? "Đã xác nhận" : "Cần xác nhận"} sx={{ alignSelf: "flex-start" }} />
            </Stack>
            <Typography variant="body2" color="text.secondary">Áp dụng cho {String(row.rawValues.affectedLessonCount)} lesson trong cùng giai đoạn.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              <TextField type="time" label="Bắt đầu" value={draft.startTime} onChange={(event) => setDraft(row, { startTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField type="time" label="Kết thúc" value={draft.endTime} onChange={(event) => setDraft(row, { endTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <Button variant="contained" onClick={() => resolveRow(row)}>Xác nhận cho tất cả dòng cùng khung giờ</Button>
          </Stack></CardContent></Card>;
        })}
        {visibleRows.map((row) => {
          const draft = drafts[row.id] ?? initialDraft(row); const status = rowStatus(row);
          return <Card key={row.id} variant="outlined"><CardContent><Stack spacing={1.25} sx={{ minWidth: 0 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 700 }}>{row.sourceSheet} · dòng {row.sourceRow}</Typography>
              <Chip size="small" color={status === "VALID" || status === "RESOLVED" ? "success" : status === "BLOCKED" ? "error" : status === "SKIPPED" ? "default" : "warning"}
                label={status === "VALID" ? "Hợp lệ" : status === "RESOLVED" ? "Đã resolve" : status === "SKIPPED" ? "Đã bỏ qua" : status === "BLOCKED" ? "Blocked" : "Cần xử lý"} sx={{ alignSelf: "flex-start" }} />
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>{row.issueCodes.map((issue) => <Chip key={issue} size="small" variant="outlined" label={issueLabels[issue]} />)}</Stack>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              Giá trị gốc: {JSON.stringify(row.rawValues)}
            </Typography>
            {row.rowType === "LESSON" && status !== "VALID" && status !== "SKIPPED" && <>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" }, gap: 1 }}>
                <TextField type="date" label="Ngày" value={draft.date} onChange={(event) => setDraft(row, { date: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="time" label="Bắt đầu" value={draft.startTime} onChange={(event) => setDraft(row, { startTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="time" label="Kết thúc" value={draft.endTime} onChange={(event) => setDraft(row, { endTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
              {row.issueCodes.includes("ATTENDANCE_AMBIGUOUS") && <FormControl><InputLabel id={`${row.id}-attendance`}>Điểm danh</InputLabel><Select labelId={`${row.id}-attendance`} label="Điểm danh" value={draft.attendance}
                onChange={(event) => setDraft(row, { attendance: event.target.value as AttendanceStatus })}>
                <MenuItem value="PRESENT">Có mặt · tính phí</MenuItem><MenuItem value="ABSENT">Nghỉ · không tính phí</MenuItem>
                <MenuItem value="FREE">Miễn phí</MenuItem>
              </Select></FormControl>}
              {(row.issueCodes.includes("DUPLICATE_ROW") || row.issueCodes.includes("NEAR_LESSON_MATCH") || row.issueCodes.includes("LESSON_CONTENT_CONFLICT")) &&
                <FormControl><InputLabel id={`${row.id}-lesson-action`}>Xử lý lesson</InputLabel><Select labelId={`${row.id}-lesson-action`} label="Xử lý lesson" value={draft.lessonAction}
                  onChange={(event) => setDraft(row, { lessonAction: event.target.value as RowDraft["lessonAction"] })}>
                  {(row.normalizedValues.existingLessonId || row.normalizedValues.nearLessonId) && <MenuItem value="MATCH">Ghép lesson hiện có</MenuItem>}
                  <MenuItem value="CREATE">Tạo lesson mới</MenuItem><MenuItem value="KEEP">Giữ nội dung hiện có</MenuItem>
                  <MenuItem value="USE_IMPORT">Dùng nội dung từ file</MenuItem><MenuItem value="EDIT">Chỉnh nội dung thủ công</MenuItem>
                </Select></FormControl>}
              {draft.lessonAction === "EDIT" && <><TextField label="Nội dung" multiline value={draft.content} onChange={(event) => setDraft(row, { content: event.target.value })} />
                <TextField label="Bài tập" multiline value={draft.homework} onChange={(event) => setDraft(row, { homework: event.target.value })} /></>}
            </>}
            {row.rowType === "PAYMENT" && <FormControl><InputLabel id={`${row.id}-payment`}>Cách hiểu PAID</InputLabel><Select labelId={`${row.id}-payment`} label="Cách hiểu PAID" value={draft.payment}
              onChange={(event) => setDraft(row, { payment: event.target.value as LegacyPaymentResolution })}>
              {Object.entries(paymentLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select></FormControl>}
            {status !== "VALID" && <><Divider /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              <FormControl><InputLabel id={`${row.id}-skip`}>Lý do bỏ qua</InputLabel><Select labelId={`${row.id}-skip`} label="Lý do bỏ qua" value={draft.skipReason}
                onChange={(event) => setDraft(row, { skipReason: event.target.value as LegacyImportSkipReason })}>
                {Object.entries(skipLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </Select></FormControl>
              {draft.skipReason === "OTHER" && <TextField label="Lý do khác" value={draft.otherReason} onChange={(event) => setDraft(row, { otherReason: event.target.value })} />}
            </Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" onClick={() => resolveRow(row)}>Áp dụng quyết định</Button>
              <Button variant="outlined" onClick={() => resolveRow(row, true)}>Áp dụng cho dòng giống nhau</Button>
              <Button color="inherit" onClick={() => skipRow(row)}>Bỏ qua dòng</Button>
            </Stack></>}
          </Stack></CardContent></Card>;
        })}
      </Stack>

      <Card sx={{ position: "sticky", bottom: { xs: 72, sm: 16 }, zIndex: 2 }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography>{unresolved ? `Còn ${unresolved} dòng chưa xử lý.` : "Tất cả dòng đã sẵn sàng."}</Typography>
        <Button variant="contained" disabled={busy || unresolved > 0} onClick={() => setConfirmOpen(true)}>Xác nhận import</Button>
      </Stack></CardContent></Card>
    </>}

    <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Xác nhận import lịch sử</DialogTitle><DialogContent><Stack spacing={1} sx={{ pt: 1 }}>
        <Typography>Accepted: {summary.valid + summary.resolved}</Typography><Typography>Resolved: {summary.resolved}</Typography>
        <Typography>Skipped: {summary.skipped}</Typography><Typography>Lesson dự kiến: {preview?.summary.expectedLessonCount ?? 0}</Typography>
        <Typography>Cycle dự kiến: {preview?.summary.expectedTuitionCycleCount ?? 0}</Typography>
        <Alert severity="warning">Nếu một mutation lỗi, toàn bộ dữ liệu và audit sẽ rollback.</Alert>
      </Stack></DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)} disabled={busy}>Quay lại</Button>
        <Button variant="contained" onClick={() => void applyImport()} disabled={busy}>{busy ? "Đang import…" : "Import dữ liệu"}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
