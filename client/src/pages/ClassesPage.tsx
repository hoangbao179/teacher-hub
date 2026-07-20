import { Add } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ClassListItem } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
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
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Lớp học
        </Typography>
        <Button startIcon={<Add />} variant="contained" component={Link} to="/admin/classes/new">
          Thêm lớp
        </Button>
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      {items?.map((item) => (
        <Card
          key={item.id}
          component={Link}
          to={`/admin/classes/${item.id}`}
          sx={{ textDecoration: "none" }}
        >
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 800 }} color="text.primary">
                {item.name}
              </Typography>
              <Chip size="small" label={item.status} />
            </Stack>
            <Typography color="text.secondary">
              {item.type === "ONE_TO_ONE" ? "1 kèm 1" : "Lớp nhóm"} ·{" "}
              {item.activeStudentCount} học sinh
            </Typography>
            <Typography color="primary" sx={{ fontWeight: 700 }}>
              {item.defaultPackagePrice.toLocaleString("vi-VN")}đ / 8 buổi
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
