import { CheckCircleOutlined } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  AttendanceStatus,
  CombinedTeachingOccurrenceDetail,
} from "@teacher/shared";
import { combinedClassGroupApi } from "../api/combinedClassGroups";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/UiKit";
import { displayDate } from "../utils/date";

export function CombinedTeachingOccurrencePage() {
  const id = Number(useParams().id ?? 0);
  const [item, setItem] = useState<CombinedTeachingOccurrenceDetail | null>(null);
  const [attendances, setAttendances] = useState<Record<number, AttendanceStatus>>({});
  const [actualStartTime, setActualStartTime] = useState("");
  const [actualEndTime, setActualEndTime] = useState("");
  const [content, setContent] = useState("");
  const [homework, setHomework] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => combinedClassGroupApi.occurrence(id).then((value) => {
    setItem(value);
    setActualStartTime(value.startTime);
    setActualEndTime(value.endTime);
    setAttendances(Object.fromEntries(value.classes.flatMap((entry) =>
      entry.participants.map((participant) => [
        participant.enrollmentId,
        participant.attendance?.status ?? (participant.tuitionMode === "FREE" ? "FREE" : "PRESENT"),
      ]))));
  }).catch((value: Error) => setError(value.message)), [id]);

  useEffect(() => {
    void load();
  }, [load]);
  const participantCount = useMemo(
    () => item?.classes.reduce((count, entry) => count + entry.participants.length, 0) ?? 0,
    [item],
  );

  const complete = async () => {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      await combinedClassGroupApi.completeOccurrence(id, {
        actualStartTime,
        actualEndTime,
        content: content || undefined,
        homework: homework || undefined,
        note: note || undefined,
        attendances: item.classes.flatMap((entry) => entry.participants.map((participant) => ({
          enrollmentId: participant.enrollmentId,
          status: attendances[participant.enrollmentId],
        }))),
      });
      await load();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!item && !error) return <LoadingState />;
  if (!item) return <Alert severity="error">{error}</Alert>;
  const completed = item.status === "COMPLETED";
  return <Stack
    spacing={2}
    sx={{ width: "100%", maxWidth: "var(--app-form-width)", mx: "auto", minWidth: 0, pb: { xs: 10, sm: 2 } }}
    data-testid="combined-occurrence-page"
  >
    <PageHeader title={item.groupName} />
    {error && <Alert severity="error">{error}</Alert>}
    <Card variant="outlined"><CardContent>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip size="small" color="secondary" label="Học ghép" />
        <Chip size="small" variant="outlined" label={`${item.classes.length} lớp · ${participantCount} học sinh`} />
        <Chip size="small" color={completed ? "success" : "warning"} label={completed ? "Đã hoàn thành" : "Chờ ghi nhận"} />
      </Stack>
      <Typography sx={{ mt: 1.5 }}>{displayDate(item.date)} · {item.startTime}–{item.endTime}</Typography>
      <Typography color="text.secondary">{item.classes.map((entry) => entry.className).join(" · ")}</Typography>
    </CardContent></Card>

    {!completed && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <TextField
        fullWidth
        type="time"
        label="Giờ bắt đầu thực tế"
        value={actualStartTime}
        onChange={(event) => setActualStartTime(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        fullWidth
        type="time"
        label="Giờ kết thúc thực tế"
        value={actualEndTime}
        onChange={(event) => setActualEndTime(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        error={actualEndTime <= actualStartTime}
      />
    </Stack>}

    {item.classes.map((entry) => <Card key={entry.classId} variant="outlined" data-testid="combined-occurrence-class">
      <CardContent>
        <Typography variant="h6">{entry.className}</Typography>
        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
          {entry.participants.map((participant) => <Stack
            key={participant.enrollmentId}
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", minWidth: 0 }}
          >
            <Stack sx={{ minWidth: 0 }}>
              <Typography sx={{ overflowWrap: "anywhere" }}>{participant.studentName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {participant.tuitionMode === "FREE" ? "Miễn phí" : `Tiến độ hiện tại: ${participant.currentProgress ?? 0}/8`}
              </Typography>
            </Stack>
            <TextField
              select
              size="small"
              disabled={completed}
              label="Điểm danh"
              value={attendances[participant.enrollmentId] ?? ""}
              onChange={(event) => setAttendances((current) => ({
                ...current,
                [participant.enrollmentId]: event.target.value as AttendanceStatus,
              }))}
              sx={{ width: { xs: "100%", sm: 150 }, flexShrink: 0 }}
            >
              {participant.tuitionMode !== "FREE" && <MenuItem value="PRESENT">Có mặt</MenuItem>}
              <MenuItem value="ABSENT">Nghỉ</MenuItem>
              <MenuItem value="FREE">Miễn phí</MenuItem>
            </TextField>
          </Stack>)}
        </Stack>
      </CardContent>
    </Card>)}

    {!completed && <Card variant="outlined"><CardContent><Stack spacing={1.5}>
      <TextField multiline minRows={2} label="Nội dung buổi học" value={content} onChange={(event) => setContent(event.target.value)} />
      <TextField multiline minRows={2} label="Bài tập về nhà" value={homework} onChange={(event) => setHomework(event.target.value)} />
      <TextField multiline minRows={2} label="Ghi chú chung" value={note} onChange={(event) => setNote(event.target.value)} />
    </Stack></CardContent></Card>}

    {!completed && <Alert severity="info">
      Hệ thống ghi nhận đồng thời cho {item.classes.length} lớp trong một giao dịch. Tiến độ và học phí vẫn được cập nhật riêng theo từng enrollment.
    </Alert>}
    {!completed && <Button
      variant="contained"
      size="large"
      startIcon={<CheckCircleOutlined />}
      disabled={busy || actualEndTime <= actualStartTime || Object.keys(attendances).length !== participantCount}
      onClick={() => void complete()}
      sx={{ alignSelf: { sm: "flex-end" } }}
    >
      {busy ? "Đang ghi nhận…" : "Đã dạy"}
    </Button>}
  </Stack>;
}
