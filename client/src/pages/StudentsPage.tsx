import {
  Button,
  Alert,
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
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Typography color="text.primary" variant="subtitle1" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
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
              <ProgressCount value={item.currentProgress ?? 0} />
            )}
          </CardContent>
        </Card>
      ))}
      </Box>
      {items?.length === 0 && <EmptyState message="Chưa có học sinh. Chọn Thêm học sinh để bắt đầu." />}
    </Stack>
  );
}
