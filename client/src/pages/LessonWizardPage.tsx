import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  AttendanceStatus,
  ClassDetail,
  ClassListItem,
  CompleteLessonResult,
  LessonDetail,
  LessonType,
} from "@teacher/shared";
import { ApiError } from "../api/client";
import { lessonApi } from "../api/lessons";
import { LoadingState } from "../components/LoadingState";
import { visibleStatusLabel } from "../components/UiKit";

const steps = ["Thông tin buổi học", "Điểm danh", "Nội dung và bài tập", "Xác nhận"];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

type AttendanceDraft = Record<number, { status: AttendanceStatus; studentNote: string }>;

function duration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const value = eh * 60 + em - sh * 60 - sm;
  return value > 0 ? value : null;
}

function attendanceFrom(detail: LessonDetail): AttendanceDraft {
  return Object.fromEntries(detail.participants.map((participant) => [participant.enrollmentId, {
    status: participant.attendance?.status ?? (participant.tuitionMode === "FREE" ? "FREE" : "PRESENT"),
    studentNote: participant.attendance?.studentNote ?? "",
  }]));
}

export function LessonWizardPage() {
  const { id } = useParams();
  const lessonId = id ? Number(id) : null;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [classId, setClassId] = useState(Number(params.get("classId") ?? 0));
  const [sessionDate, setSessionDate] = useState(params.get("date") ?? today);
  const [scheduledStart, setScheduledStart] = useState(params.get("start") ?? "18:00");
  const [scheduledEnd, setScheduledEnd] = useState(params.get("end") ?? "19:30");
  const [actualStart, setActualStart] = useState(params.get("start") ?? "18:00");
  const [actualEnd, setActualEnd] = useState(params.get("end") ?? "19:30");
  const [lessonType, setLessonType] = useState<LessonType>(params.get("type") === "MAKEUP" ? "MAKEUP" : "REGULAR");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [attendances, setAttendances] = useState<AttendanceDraft>({});
  const [content, setContent] = useState("");
  const [homework, setHomework] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(Boolean(lessonId));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [completion, setCompletion] = useState<CompleteLessonResult | null>(null);

  useEffect(() => {
    lessonApi.listClasses().then(setClasses).catch((value: Error) => setError(value.message));
  }, []);

  useEffect(() => {
    if (!lessonId) return;
    lessonApi.detail(lessonId).then((detail) => {
      setLesson(detail); setClassId(detail.classId); setSessionDate(detail.sessionDate);
      setScheduledStart(detail.scheduledStartTime); setScheduledEnd(detail.scheduledEndTime);
      setActualStart(detail.actualStartTime ?? detail.scheduledStartTime);
      setActualEnd(detail.actualEndTime ?? detail.scheduledEndTime);
      setLessonType(detail.lessonType); setSelectedIds(detail.participants.map((item) => item.enrollmentId));
      setAttendances(attendanceFrom(detail)); setContent(detail.content ?? "");
      setHomework(detail.homework ?? ""); setNote(detail.note ?? "");
      if (detail.status === "COMPLETED" || detail.content || detail.homework) setStep(3);
      else if (detail.participants.length && detail.participants.every((item) => item.attendance)) setStep(2);
      else if (detail.participants.length) setStep(1);
    }).catch((value: Error) => setError(value.message)).finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    if (!classId) return;
    lessonApi.classDetail(classId).then((detail) => {
      setClassDetail(detail);
      if (!lessonId) {
        const schedule = detail.schedules[0];
        if (schedule && !params.get("start") && !params.get("end")) {
          setScheduledStart(schedule.startTime); setScheduledEnd(schedule.endTime);
          setActualStart(schedule.startTime); setActualEnd(schedule.endTime);
        }
      }
    }).catch((value: Error) => setError(value.message));
  }, [classId, lessonId, params]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault(); event.returnValue = "";
    };
    const outsideClick = (event: MouseEvent) => {
      if (!dirty) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-wizard-action]")) return;
      if (target?.closest("button,a") && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang và bỏ thay đổi?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", outsideClick, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", outsideClick, true);
    };
  }, [dirty]);

  const markDirty = () => setDirty(true);
  const actualDuration = duration(actualStart, actualEnd);
  const participants = lesson?.participants ?? [];
  const availableStudents = useMemo(() => {
    const values = new Map<number, { enrollmentId: number; fullName: string }>();
    classDetail?.students.forEach((item) => values.set(item.enrollmentId, { enrollmentId: item.enrollmentId, fullName: item.fullName }));
    lesson?.participants.forEach((item) => values.set(item.enrollmentId, { enrollmentId: item.enrollmentId, fullName: item.studentName }));
    return [...values.values()];
  }, [classDetail, lesson]);
  const counts = useMemo(() => ({
    PRESENT: Object.values(attendances).filter((item) => item.status === "PRESENT").length,
    ABSENT: Object.values(attendances).filter((item) => item.status === "ABSENT").length,
    FREE: Object.values(attendances).filter((item) => item.status === "FREE").length,
  }), [attendances]);

  const handleError = (value: unknown) => {
    const message = value instanceof Error ? value.message : "Không thể lưu dữ liệu.";
    if (value instanceof ApiError && value.status === 409) setConflict(message);
    else setError(message);
  };

  async function saveInformation() {
    setError(""); setConflict("");
    if (!classId || !sessionDate || !scheduledStart || !scheduledEnd || !actualStart || !actualEnd || !actualDuration) {
      setError("Hãy nhập đủ lớp, ngày và giờ; giờ kết thúc phải sau giờ bắt đầu."); return;
    }
    if (lessonType !== "REGULAR" && !selectedIds.length) {
      setError("Buổi học bù/học thêm cần chọn ít nhất một học sinh."); return;
    }
    setBusy(true);
    try {
      let saved: LessonDetail;
      if (!lessonId) {
        saved = await lessonApi.create({
          classId, sessionDate, scheduledStartTime: scheduledStart, scheduledEndTime: scheduledEnd,
          lessonType, selectedEnrollmentIds: lessonType === "REGULAR" ? undefined : selectedIds, note,
        });
        saved = await lessonApi.update(saved.id, { actualStartTime: actualStart, actualEndTime: actualEnd });
        navigate(`/admin/lessons/${saved.id}/edit`, { replace: true });
      } else if (lesson?.status === "COMPLETED") {
        saved = await lessonApi.update(lessonId, {
          sessionDate, scheduledStartTime: scheduledStart, scheduledEndTime: scheduledEnd,
          actualStartTime: actualStart, actualEndTime: actualEnd, note,
        });
      } else {
        saved = await lessonApi.update(lessonId, {
          classId, sessionDate, scheduledStartTime: scheduledStart, scheduledEndTime: scheduledEnd,
          actualStartTime: actualStart, actualEndTime: actualEnd, lessonType, note,
          refreshParticipants: true,
          selectedEnrollmentIds: lessonType === "REGULAR" ? undefined : selectedIds,
        });
        const desiredIds = lessonType === "REGULAR" ? saved.participants.map((item) => item.enrollmentId) : selectedIds;
        const currentIds = saved.participants.map((item) => item.enrollmentId);
        if (desiredIds.length !== currentIds.length || desiredIds.some((value) => !currentIds.includes(value)))
          saved = await lessonApi.participants(saved.id, { enrollmentIds: desiredIds });
      }
      setLesson(saved); setSelectedIds(saved.participants.map((item) => item.enrollmentId));
      setAttendances(attendanceFrom(saved)); setDirty(false); setStep(1);
    } catch (value) { handleError(value); }
    finally { setBusy(false); }
  }

  async function saveAttendance() {
    if (!lesson) return;
    if (participants.some((item) => !attendances[item.enrollmentId]?.status)) {
      setError("Mỗi học sinh phải có đúng một trạng thái điểm danh."); return;
    }
    setBusy(true); setError(""); setConflict("");
    try {
      const saved = await lessonApi.attendances(lesson.id, { attendances: participants.map((item) => ({
        enrollmentId: item.enrollmentId,
        status: attendances[item.enrollmentId].status,
        studentNote: attendances[item.enrollmentId].studentNote || undefined,
      })) });
      setLesson(saved); setDirty(false); setStep(2);
    } catch (value) { handleError(value); }
    finally { setBusy(false); }
  }

  async function saveContent() {
    if (!lesson) return;
    setBusy(true); setError(""); setConflict("");
    try {
      const saved = await lessonApi.content(lesson.id, { content, homework, note });
      setLesson(saved); setDirty(false); setStep(3);
    } catch (value) { handleError(value); }
    finally { setBusy(false); }
  }

  async function complete() {
    if (!lesson) return;
    setBusy(true); setError(""); setConflict("");
    try {
      const result = await lessonApi.complete(lesson.id, {
        actualStartTime: actualStart, actualEndTime: actualEnd, content, homework, note,
        attendances: participants.map((item) => ({
          enrollmentId: item.enrollmentId,
          status: attendances[item.enrollmentId].status,
          studentNote: attendances[item.enrollmentId].studentNote || undefined,
        })),
      });
      setCompletion(result); setLesson({ ...lesson, ...result.lesson, status: "COMPLETED" }); setDirty(false);
    } catch (value) { handleError(value); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState />;
  if (completion) return <CompletionState result={completion} />;

  return (
    <Stack spacing={2} sx={{ minWidth: 0, overflowX: "clip" }} data-testid="lesson-wizard">
      <Typography variant="h5" sx={{ fontWeight: 900 }}>Ghi nhận buổi học</Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mx: -1, "& .MuiStepLabel-label": { fontSize: { xs: "0.65rem", sm: "0.75rem" }, lineHeight: 1.15 } }}>
        {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>
      {error && <Alert severity="error">{error}</Alert>}
      {conflict && <Alert severity="warning"><strong>Xung đột:</strong> {conflict} Hãy tải lại buổi học.</Alert>}
      {lesson?.status === "COMPLETED" && <Alert severity="success">Buổi học đã hoàn thành và được lưu.</Alert>}

      {step === 0 && <Stack spacing={2}>
        <TextField select required label="Lớp" value={classes.some((item) => item.id === classId) ? classId : ""} onChange={(event) => { setClassId(Number(event.target.value)); setSelectedIds([]); markDirty(); }}>
          {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </TextField>
        <TextField required type="date" label="Ngày học" value={sessionDate} onChange={(event) => { setSessionDate(event.target.value); markDirty(); }} slotProps={{ inputLabel: { shrink: true } }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Giờ dự kiến</Typography>
        <Stack direction="row" spacing={1}>
          <TextField fullWidth required type="time" label="Bắt đầu dự kiến" value={scheduledStart} onChange={(event) => { setScheduledStart(event.target.value); markDirty(); }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth required type="time" label="Kết thúc dự kiến" value={scheduledEnd} onChange={(event) => { setScheduledEnd(event.target.value); markDirty(); }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Giờ thực tế</Typography>
        <Stack direction="row" spacing={1}>
          <TextField fullWidth required type="time" label="Bắt đầu thực tế" value={actualStart} onChange={(event) => { setActualStart(event.target.value); markDirty(); }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth required type="time" label="Kết thúc thực tế" value={actualEnd} onChange={(event) => { setActualEnd(event.target.value); markDirty(); }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Alert severity={actualDuration ? "info" : "warning"}>
          Thời lượng thực tế: {actualDuration ? `${actualDuration} phút` : "không hợp lệ"}. Học phí vẫn tính tối đa một buổi.
        </Alert>
        <TextField select label="Loại buổi" value={lessonType} onChange={(event) => { setLessonType(event.target.value as LessonType); setSelectedIds([]); markDirty(); }}>
          <MenuItem value="REGULAR">Buổi thường</MenuItem><MenuItem value="MAKEUP">Học bù</MenuItem><MenuItem value="EXTRA">Học thêm</MenuItem>
        </TextField>
        {lessonType !== "REGULAR" && <Card variant="outlined"><CardContent>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Chọn học sinh tham gia</Typography>
          {!availableStudents.length && <Alert severity="info">Lớp chưa có học sinh có thể chọn.</Alert>}
          {availableStudents.map((student) => <FormControlLabel key={student.enrollmentId} control={<Checkbox checked={selectedIds.includes(student.enrollmentId)} onChange={(event) => {
            setSelectedIds((current) => event.target.checked ? [...current, student.enrollmentId] : current.filter((value) => value !== student.enrollmentId)); markDirty();
          }} />} label={student.fullName} />)}
        </CardContent></Card>}
        <TextField multiline minRows={2} label="Ghi chú" value={note} onChange={(event) => { setNote(event.target.value.slice(0, 1000)); markDirty(); }} helperText={`${note.length}/1000`} />
      </Stack>}

      {step === 1 && <Stack spacing={1.5}>
        {!participants.length && <Alert severity="warning">Không có participant trong snapshot. Quay lại để kiểm tra ngày học hoặc danh sách chọn.</Alert>}
        {participants.map((participant) => <Card key={participant.participantId} variant="outlined"><CardContent>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography sx={{ fontWeight: 800 }}>{participant.studentName}</Typography>
            <Chip size="small" label={participant.tuitionMode === "FREE" ? "Miễn phí toàn phần" : `${participant.currentProgress ?? 0}/8`} />
          </Stack>
          <ToggleButtonGroup exclusive fullWidth size="small" value={attendances[participant.enrollmentId]?.status ?? null} onChange={(_event, value: AttendanceStatus | null) => {
            if (!value) return;
            setAttendances((current) => ({ ...current, [participant.enrollmentId]: { ...(current[participant.enrollmentId] ?? { studentNote: "" }), status: value } })); markDirty();
          }} sx={{ mt: 1, "& .MuiToggleButton-root": { minHeight: 44, px: 0.5 } }}>
            <ToggleButton value="PRESENT" color="success" disabled={participant.tuitionMode === "FREE"}>Có mặt</ToggleButton>
            <ToggleButton value="ABSENT" color="error">Nghỉ</ToggleButton>
            <ToggleButton value="FREE" color="warning">Miễn phí</ToggleButton>
          </ToggleButtonGroup>
          <TextField fullWidth size="small" label="Nhận xét riêng (tùy chọn)" sx={{ mt: 1 }} value={attendances[participant.enrollmentId]?.studentNote ?? ""} onChange={(event) => {
            setAttendances((current) => ({ ...current, [participant.enrollmentId]: { status: current[participant.enrollmentId]?.status ?? "PRESENT", studentNote: event.target.value.slice(0, 1000) } })); markDirty();
          }} />
        </CardContent></Card>)}
      </Stack>}

      {step === 2 && <Stack spacing={2}>
        <TextField multiline minRows={5} label="Nội dung buổi học" value={content} onChange={(event) => { setContent(event.target.value.slice(0, 2000)); markDirty(); }} helperText={`${content.length}/2000`} />
        <TextField multiline minRows={4} label="Bài tập về nhà" value={homework} onChange={(event) => { setHomework(event.target.value.slice(0, 2000)); markDirty(); }} helperText={`${homework.length}/2000`} />
        <TextField multiline minRows={3} label="Ghi chú chung" value={note} onChange={(event) => { setNote(event.target.value.slice(0, 1000)); markDirty(); }} helperText={`${note.length}/1000`} />
      </Stack>}

      {step === 3 && <Card variant="outlined"><CardContent><Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Xác nhận buổi học</Typography>
        <Summary label="Lớp" value={lesson?.className ?? classDetail?.name ?? "—"} />
        <Summary label="Ngày học" value={sessionDate} />
        <Summary label="Giờ dự kiến" value={`${scheduledStart}–${scheduledEnd}`} />
        <Summary label="Giờ thực tế" value={`${actualStart}–${actualEnd}`} />
        <Summary label="Thời lượng" value={`${actualDuration ?? 0} phút (không đổi số buổi)`} />
        <Summary label="Loại buổi" value={visibleStatusLabel(lessonType)} />
        <Divider />
        <Summary label="Có mặt / Nghỉ / Miễn phí" value={`${counts.PRESENT} / ${counts.ABSENT} / ${counts.FREE}`} />
        <Summary label="Nội dung" value={content || "Chưa nhập"} />
        <Summary label="Bài tập" value={homework || "Chưa nhập"} />
      </Stack></CardContent></Card>}

      <Box data-wizard-action sx={{ position: "sticky", bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 10, bgcolor: "background.paper", py: 1, mt: 2, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1}>
          {step > 0 && <Button fullWidth variant="outlined" sx={{ minHeight: 48 }} disabled={busy} onClick={() => setStep((value) => value - 1)}>Quay lại</Button>}
          <Button fullWidth variant="contained" sx={{ minHeight: 48 }} disabled={busy || (lesson?.status === "COMPLETED" && step === 3) || (step === 1 && !participants.length)} onClick={step === 0 ? saveInformation : step === 1 ? saveAttendance : step === 2 ? saveContent : complete}>
            {busy ? "Đang lưu…" : step === 3 ? (lesson?.status === "COMPLETED" ? "Đã hoàn thành" : "Hoàn tất ghi nhận") : "Lưu và tiếp tục"}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
    <Typography color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
    <Typography sx={{ fontWeight: 700, textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography>
  </Stack>;
}

function CompletionState({ result }: { result: CompleteLessonResult }) {
  return <Stack spacing={2} data-testid="lesson-success">
    <Alert severity="success"><strong>Đã lưu buổi học thành công.</strong> Thời lượng {result.actualDurationMinutes} phút không thay đổi số buổi tính phí.</Alert>
    <Card><CardContent><Stack spacing={1}>
      <Typography variant="h6" sx={{ fontWeight: 900 }}>{result.lesson.className}</Typography>
      <Typography>{result.lesson.sessionDate} · {result.lesson.actualStartTime}–{result.lesson.actualEndTime}</Typography>
      <Typography>Có mặt {result.presentCount} · Nghỉ {result.absentCount} · Miễn phí {result.freeCount}</Typography>
    </Stack></CardContent></Card>
    <Typography sx={{ fontWeight: 900 }}>Tác động tiến độ</Typography>
    {result.tuitionImpacts.map((item) => <Card key={item.enrollmentId} variant="outlined"><CardContent>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 800 }}>{item.studentName}</Typography><Typography>{item.previousProgress ?? "—"} → {item.newProgress ?? "—"}/8</Typography></Stack>
      {item.becamePaymentDue && <Chip sx={{ mt: 1 }} color="warning" label="Đã đạt 8/8 · Cần thu" />}
    </CardContent></Card>)}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} data-wizard-action>
      <Button component={Link} to="/admin" variant="contained" fullWidth>Về Dashboard</Button>
      <Button component={Link} to={`/admin/lessons/${result.lessonId}/edit`} variant="outlined" fullWidth>Xem chi tiết buổi học</Button>
    </Stack>
  </Stack>;
}
