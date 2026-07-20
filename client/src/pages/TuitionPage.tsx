import {
  Alert,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { TuitionCycleListItem, TuitionCycleStatus } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
const statuses: Array<{ label: string; value: TuitionCycleStatus }> = [
  { label: "Đang tích lũy", value: "ACCUMULATING" },
  { label: "Cần thu", value: "PAYMENT_DUE" },
  { label: "Đã thu", value: "PAID" },
];
export function TuitionPage() {
  const [status, setStatus] = useState<TuitionCycleStatus>("PAYMENT_DUE");
  const [items, setItems] = useState<TuitionCycleListItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<TuitionCycleListItem[]>(`/api/tuition-cycles?status=${status}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [status]);
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Học phí
      </Typography>
      <Tabs
        value={status}
        onChange={(_e, value) => setStatus(value)}
        variant="fullWidth"
      >
        {statuses.map((item) => (
          <Tab key={item.value} label={item.label} value={item.value} />
        ))}
      </Tabs>
      {error && <Alert severity="warning">{error}</Alert>}
      {!items && !error ? (
        <LoadingState />
      ) : (
        items?.map((item) => (
          <Card
            key={item.id}
            component={Link}
            to={`/admin/tuition/${item.id}`}
            sx={{ textDecoration: "none" }}
          >
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.primary" sx={{ fontWeight: 800 }}>
                  {item.studentName}
                </Typography>
                <Chip size="small" label={item.status} />
              </Stack>
              <Typography color="text.secondary">
                {item.className} · Chu kỳ #{item.cycleNumber}
              </Typography>
              <Typography color="primary" sx={{ fontWeight: 800 }}>
                {item.packagePriceSnapshot.toLocaleString("vi-VN")}đ
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(item.progress / 8) * 100}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
