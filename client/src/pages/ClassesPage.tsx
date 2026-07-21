import { Add, Groups, Person } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ClassListItem } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, PageHeader, StatusBadge } from "../components/UiKit";
import { EmptyState } from "../components/EmptyState";
import { classColor } from "../utils/classColor";
export function ClassesPage() {
  const [items, setItems] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<ClassListItem[]>("/api/classes")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  if (!items && !error) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <PageHeader title="Lớp học" action={<Button startIcon={<Add />} variant="contained" component={Link} to="/admin/classes/new">
          Thêm lớp
        </Button>} />
      {error && <Alert severity="warning">{error}</Alert>}
      <Box data-testid="class-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {items?.map((item) => { const tone = classColor(item.id); return (
        <Card
          key={item.id}
          component={Link}
          to={`/admin/classes/${item.id}`}
          data-class-tone={item.id % 5}
          sx={{ textDecoration: "none", borderLeft: "4px solid", borderLeftColor: tone.accent, boxShadow: "0 3px 12px rgba(36,29,62,.07)" }}
        >
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: "center" }}>
                <Box sx={{ display: "grid", placeItems: "center", width: 32, height: 32, flexShrink: 0, borderRadius: 2, bgcolor: tone.soft, color: tone.text }}>{item.type === "ONE_TO_ONE" ? <Person sx={{ fontSize: 19 }} /> : <Groups sx={{ fontSize: 19 }} />}</Box>
                <Typography variant="subtitle1" sx={{ minWidth: 0, overflowWrap: "anywhere" }} color="text.primary">{item.name}</Typography>
              </Stack>
              <StatusBadge status={item.status} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {item.type === "ONE_TO_ONE" ? "1 kèm 1" : "Lớp nhóm"} ·{" "}
              {item.activeStudentCount} học sinh
            </Typography>
            <Typography color="primary" sx={{ fontWeight: 700 }}><CurrencyDisplay value={item.defaultPackagePrice} /> / 8 buổi</Typography>
          </CardContent>
        </Card>
      ); })}
      </Box>
      {items?.length === 0 && <EmptyState message="Chưa có lớp học. Chọn Thêm lớp để bắt đầu." />}
    </Stack>
  );
}
