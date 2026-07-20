import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  ClassDetail,
  ClassListItem,
  CreateLessonRequest,
} from "@teacher/shared";
import { api } from "../api/client";
export function LessonWizardPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [classId, setClassId] = useState(Number(params.get("classId") ?? 0));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("20:00");
  const [end, setEnd] = useState("21:30");
  const [error, setError] = useState("");
  useEffect(() => {
    api<ClassListItem[]>("/api/classes").then(setClasses);
  }, []);
  useEffect(() => {
    if (!classId) return;
    api<ClassDetail>(`/api/classes/${classId}`).then((detail) => {
      const first = detail.schedules[0];
      if (first) {
        setStart(first.startTime);
        setEnd(first.endTime);
      }
    });
  }, [classId]);
  async function create() {
    setError("");
    try {
      const result = await api<{ id: number }>("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          classId,
          sessionDate: date,
          scheduledStartTime: start,
          scheduledEndTime: end,
          lessonType: "REGULAR",
        } satisfies CreateLessonRequest),
      });
      navigate(`/admin/lessons/${result.id}/complete`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được buổi học.");
    }
  }
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Ghi nhận buổi học
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        select
        label="Lớp"
        value={classId}
        onChange={(e) => setClassId(Number(e.target.value))}
      >
        {classes.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="date"
        label="Ngày học"
        slotProps={{ inputLabel: { shrink: true } }}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          fullWidth
          type="time"
          label="Giờ dự kiến"
          slotProps={{ inputLabel: { shrink: true } }}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          fullWidth
          type="time"
          label="Kết thúc"
          slotProps={{ inputLabel: { shrink: true } }}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </Stack>
      <Button
        variant="contained"
        size="large"
        onClick={create}
        disabled={!classId}
      >
        Tiếp tục
      </Button>
    </Stack>
  );
}
