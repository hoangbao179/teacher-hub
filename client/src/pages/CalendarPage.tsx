import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { WeekScheduleResponse } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
export function CalendarPage() {
  const [data, setData] = useState<WeekScheduleResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<WeekScheduleResponse>("/api/schedule/week")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (!data && !error) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Lịch tuần
      </Typography>
      {error && <Alert severity="warning">{error}</Alert>}
      {data?.classSchedules.map((item, index) => (
        <Card key={`${item.classId}-${index}`}>
          <CardContent>
            <Typography sx={{ fontWeight: 800 }}>
              T{item.dayOfWeek} · {item.className}
            </Typography>
            <Typography>
              {item.startTime}–{item.endTime}
            </Typography>
          </CardContent>
        </Card>
      ))}
      <Typography sx={{ fontWeight: 800 }}>Lịch bận</Typography>
      {data?.busySlots.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
            <Typography>
              {item.startTime}–{item.endTime}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
