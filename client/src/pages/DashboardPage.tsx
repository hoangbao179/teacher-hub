import { CalendarMonth, CheckCircle, Payments } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardResponse } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<DashboardResponse>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (!data && !error) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Hôm nay
      </Typography>
      {error && <Alert severity="warning">{error}</Alert>}
      <Grid container spacing={2}>
        <Grid size={12}>
          <Card component={Link} to="/admin/tuition" sx={{ bgcolor: "primary.main", color: "white", textDecoration: "none" }}>
            <CardContent>
              <Payments />
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {data?.paymentDueCount ?? 0} học sinh cần thu
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={6}>
          <Card component={Link} to="/admin/unrecorded" sx={{ textDecoration: "none", color: "inherit" }}>
            <CardContent>
              <CheckCircle color="success" />
              <Typography sx={{ fontWeight: 800 }}>
                {data?.recentUnrecordedSessions.length ?? 0} buổi chưa ghi
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={6}>
          <Card component={Link} to="/admin/calendar" sx={{ textDecoration: "none", color: "inherit" }}>
            <CardContent>
              <CalendarMonth color="info" />
              <Typography sx={{ fontWeight: 800 }}>
                {data?.todayClasses.length ?? 0} lớp hôm nay
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Typography sx={{ fontWeight: 800 }}>Lớp hôm nay</Typography>
      {data?.todayClasses.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Typography sx={{ fontWeight: 800 }}>{item.name}</Typography>
            <Typography color="text.secondary">
              {item.activeStudentCount} học sinh
            </Typography>
            <Button
              disabled
              sx={{ mt: 1 }}
            >
              Ghi nhận · Chưa triển khai (M2)
            </Button>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
