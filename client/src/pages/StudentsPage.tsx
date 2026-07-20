import {
  Button,
  Alert,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StudentListItem } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
export function StudentsPage() {
  const [items, setItems] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<StudentListItem[]>("/api/students")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  if (!items && !error) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="h5" sx={{ fontWeight: 900 }}>Học sinh</Typography><Button component={Link} to="/admin/students/new" startIcon={<Add />} variant="contained">Thêm</Button></Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      {items?.map((item) => (
        <Card
          key={item.id}
          component={Link}
          to={`/admin/students/${item.id}`}
          sx={{ textDecoration: "none" }}
        >
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography color="text.primary" sx={{ fontWeight: 800 }}>
                {item.fullName}
              </Typography>
              <Chip
                size="small"
                color={item.hasPaymentDue ? "warning" : "default"}
                label={
                  item.tuitionMode === "FREE"
                    ? "Miễn phí"
                    : item.hasPaymentDue
                      ? "Cần thu"
                      : "Đang học"
                }
              />
            </Stack>
            <Typography color="text.secondary">
              {item.className ?? "Chưa có lớp"}
            </Typography>
            {item.tuitionMode !== "FREE" && (
              <LinearProgress
                variant="determinate"
                value={((item.currentProgress ?? 0) / 8) * 100}
                sx={{ mt: 1 }}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
