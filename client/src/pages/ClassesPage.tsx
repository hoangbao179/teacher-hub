import { Add } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
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
      {items?.map((item) => (
        <Card
          key={item.id}
          component={Link}
          to={`/admin/classes/${item.id}`}
          sx={{ textDecoration: "none" }}
        >
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Typography sx={{ fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }} color="text.primary">
                {item.name}
              </Typography>
              <StatusBadge status={item.status} />
            </Stack>
            <Typography color="text.secondary">
              {item.type === "ONE_TO_ONE" ? "1 kèm 1" : "Lớp nhóm"} ·{" "}
              {item.activeStudentCount} học sinh
            </Typography>
            <Typography color="primary" sx={{ fontWeight: 700 }}><CurrencyDisplay value={item.defaultPackagePrice} /> / 8 buổi</Typography>
          </CardContent>
        </Card>
      ))}
      {items?.length === 0 && <EmptyState message="Chưa có lớp học. Chọn Thêm lớp để bắt đầu." />}
    </Stack>
  );
}
