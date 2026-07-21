import { Add, Groups, Person, Search } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Box,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ClassListItem } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";
import { CurrencyDisplay, PageHeader, StatusBadge } from "../components/UiKit";
import { EmptyState } from "../components/EmptyState";
import { classColor } from "../utils/classColor";

type ClassFilter = "MANAGED" | "ACTIVE" | "PAUSED" | "CLOSED" | "ALL";

export function ClassesPage() {
  const [items, setItems] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClassFilter>("MANAGED");
  useEffect(() => {
    api<ClassListItem[]>("/api/classes")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  const closedCount = items?.filter((item) => item.status === "CLOSED").length ?? 0;
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return items?.filter((item) => {
      const matchesStatus = filter === "ALL" || (filter === "MANAGED" ? item.status !== "CLOSED" : item.status === filter);
      return matchesStatus && (!normalizedQuery || item.name.toLocaleLowerCase("vi").includes(normalizedQuery));
    }) ?? [];
  }, [filter, items, query]);
  if (!items && !error) return <LoadingState />;
  return (
    <Stack spacing={2}>
      <PageHeader title="Lớp học" action={<Button startIcon={<Add />} variant="contained" component={Link} to="/admin/classes/new">
          Thêm lớp
        </Button>} />
      {error && <Alert severity="warning">{error}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ maxWidth: "var(--app-form-width)" }}>
        <TextField
          fullWidth
          label="Tìm theo tên lớp"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
        />
        <TextField
          select
          fullWidth
          label="Hiển thị"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ClassFilter)}
        >
          <MenuItem value="MANAGED">Đang quản lý</MenuItem>
          <MenuItem value="ACTIVE">Đang dạy</MenuItem>
          <MenuItem value="PAUSED">Tạm dừng</MenuItem>
          <MenuItem value="CLOSED">Đã đóng{closedCount ? ` (${closedCount})` : ""}</MenuItem>
          <MenuItem value="ALL">Tất cả</MenuItem>
        </TextField>
      </Stack>
      <Box data-testid="class-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {visibleItems.map((item) => { const tone = classColor(item.id); return (
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
      {items && items.length > 0 && visibleItems.length === 0 && <EmptyState message="Không có lớp phù hợp với tìm kiếm và bộ lọc đã chọn." />}
    </Stack>
  );
}
