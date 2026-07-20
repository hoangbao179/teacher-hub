import {
  Alert,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { TuitionCycleDetail } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
export function TuitionDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<TuitionCycleDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<TuitionCycleDetail>(`/api/tuition-cycles/${id}`)
      .then(setItem)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!item && !error) return <LoadingState />;
  if (error) return <Alert severity="error">{error}</Alert>;
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        {item!.studentName} · Chu kỳ #{item!.cycleNumber}
      </Typography>
      <Card>
        <CardContent>
          <Typography>
            Giá snapshot: {item!.packagePriceSnapshot.toLocaleString("vi-VN")}đ
          </Typography>
          <Typography>Trạng thái: {item!.status}</Typography>
        </CardContent>
      </Card>
      <List>
        {item!.items.map((entry) => (
          <ListItem key={entry.attendanceId} divider>
            <ListItemText
              primary={`Buổi ${entry.sequenceNumber} · ${entry.sessionDate}`}
              secondary={`Dự kiến ${entry.scheduledStartTime}-${entry.scheduledEndTime} · Thực tế ${entry.actualStartTime ?? "—"}-${entry.actualEndTime ?? "—"}`}
            />
          </ListItem>
        ))}
      </List>
      {item!.status === "PAYMENT_DUE" && (
        <Button variant="contained" disabled>Đánh dấu đã thu · Chưa triển khai (M4)</Button>
      )}
    </Stack>
  );
}
