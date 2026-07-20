import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { UnrecordedSession } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
export function UnrecordedPage() {
  const [items, setItems] = useState<UnrecordedSession[] | null>(null);
  useEffect(() => {
    api<UnrecordedSession[]>("/api/schedule/unrecorded?days=14")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  if (!items) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Buổi chưa ghi nhận
      </Typography>
      {items.length === 0 && (
        <EmptyState message="Không có buổi dự kiến nào cần đối soát." />
      )}
      {items.map((item) => (
        <Card key={`${item.classId}-${item.expectedDate}`}>
          <CardContent>
            <Typography sx={{ fontWeight: 800 }}>{item.className}</Typography>
            <Typography>
              {item.expectedDate} · {item.scheduledStartTime}–
              {item.scheduledEndTime}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" variant="contained" disabled>
                Đã dạy · Chưa triển khai (M2)
              </Button>
              <Button size="small" color="error" variant="outlined" disabled>
                Nghỉ · Chưa triển khai
              </Button>
              <Button size="small" variant="outlined" disabled>
                Đổi lịch · Chưa triển khai
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
