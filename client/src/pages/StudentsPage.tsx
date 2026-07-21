import {
  Button,
  Alert,
  Avatar,
  Card,
  CardContent,
  Chip,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StudentListItem } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { PageHeader, ProgressCount } from "../components/UiKit";
import { EmptyState } from "../components/EmptyState";

function studentStatus(item: StudentListItem): string {
  if (item.status === "INACTIVE") return "Ngừng hoạt động";
  if (!item.enrollmentStatus) return "Chưa có lớp";
  if (item.enrollmentStatus === "PAUSED") return "Tạm dừng";
  if (item.enrollmentStatus === "ENDED") return "Đã ngừng học";
  return "Đang học";
}

function studentInitial(name: string): string {
  const word = name.trim().split(/\s+/).reverse().find((part) => /^\p{L}/u.test(part));
  return word?.slice(0, 1).toLocaleUpperCase("vi-VN") || "?";
}

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
      <PageHeader title="Học sinh" action={<Button component={Link} to="/admin/students/new" startIcon={<Add />} variant="contained">Thêm học sinh</Button>} />
      {error && <Alert severity="warning">{error}</Alert>}
      <Box data-testid="student-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {items?.map((item) => (
        <Card
          key={item.id}
          component={Link}
          to={`/admin/students/${item.id}`}
          sx={{ textDecoration: "none" }}
        >
          <CardContent>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
              <Avatar sx={{ width: 38, height: 38, bgcolor: "#eee8ff", color: "primary.main", fontSize: 16, fontWeight: 700 }}>
                {studentInitial(item.fullName)}
              </Avatar>
              <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                <Typography color="text.primary" variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>
                  {item.fullName}
                </Typography>
                {item.nickname && <Typography variant="body2" color="text.secondary">Tên gọi: {item.nickname}</Typography>}
                <Typography variant="body2" color="text.secondary">{item.className ?? "Chưa có lớp"}</Typography>
              </Stack>
              <Stack spacing={0.5} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
                <Chip
                  size="small"
                  color={item.enrollmentStatus === "ACTIVE" && item.status === "ACTIVE" ? "success" : item.enrollmentStatus === "PAUSED" ? "warning" : "default"}
                  label={studentStatus(item)}
                />
                {(item.hasPaymentDue || item.tuitionMode === "FREE") && <Chip size="small" color={item.hasPaymentDue ? "warning" : "default"} variant="outlined" label={item.hasPaymentDue ? "Cần thu" : "Miễn phí"} />}
              </Stack>
            </Stack>
            {item.enrollmentStatus === "ACTIVE" && item.tuitionMode !== "FREE" && (
              <Box sx={{ mt: 1.25 }}><ProgressCount value={item.currentProgress ?? 0} /></Box>
            )}
          </CardContent>
        </Card>
      ))}
      </Box>
      {items?.length === 0 && <EmptyState message="Chưa có học sinh. Chọn Thêm học sinh để bắt đầu." />}
    </Stack>
  );
}
