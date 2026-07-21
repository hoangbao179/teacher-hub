import { Search } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type {
  ClassListItem,
  TuitionCycleListItem,
  TuitionCycleSort,
  TuitionCycleStatus,
} from "@teacher/shared";
import { api } from "../api/client";
import { listTuitionCycles } from "../api/tuition";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { TuitionStatusChip } from "../components/TuitionStatusChip";

type VisibleStatus = Exclude<TuitionCycleStatus, "CANCELLED">;
const statuses: Array<{ label: string; value: VisibleStatus }> = [
  { label: "Đang tích lũy", value: "ACCUMULATING" },
  { label: "Cần thu", value: "PAYMENT_DUE" },
  { label: "Đã thu", value: "PAID" },
  { label: "Chưa hoàn thành", value: "INCOMPLETE" },
];

export function TuitionPage() {
  const [status, setStatus] = useState<VisibleStatus>("PAYMENT_DUE");
  const [items, setItems] = useState<TuitionCycleListItem[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [classId, setClassId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TuitionCycleSort>("OLDEST_DUE");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pageSize = 8;

  useEffect(() => {
    api<ClassListItem[]>("/api/classes").then(setClasses).catch(() => setClasses([]));
  }, []);
  useEffect(() => {
    let active = true;
    void listTuitionCycles({
      status,
      classId: classId ? Number(classId) : undefined,
      search: search || undefined,
      sort: status === "PAYMENT_DUE" && sort === "OLDEST_DUE" ? "OLDEST_DUE" : sort,
      page,
      pageSize,
    }).then((result) => {
      if (!active) return;
      setItems(result.items);
      setTotal(result.total);
    }).catch((reason: Error) => {
      if (active) setError(reason.message);
    });
    return () => { active = false; };
  }, [status, classId, search, sort, page, retry]);

  const resetPage = () => setPage(1);
  const beginReload = () => { setItems(null); setError(""); };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    beginReload();
    resetPage();
    setSearch(searchDraft.trim());
  };
  return (
    <Stack spacing={2} data-testid="tuition-list-page">
      <Typography component="h1" variant="h5">Học phí</Typography>
      <Tabs
        value={status}
        onChange={(_event, value: VisibleStatus) => { beginReload(); setStatus(value); setPage(1); setSort(value === "PAYMENT_DUE" ? "OLDEST_DUE" : "NEWEST"); }}
        variant="scrollable"
        scrollButtons={false}
        aria-label="Trạng thái học phí"
        sx={{ maxWidth: "100%", "& .MuiTab-root": { minWidth: "max-content", px: 1.5 } }}
      >
        {statuses.map((item) => <Tab key={item.value} label={item.label} value={item.value} />)}
      </Tabs>

      <Stack component="form" onSubmit={submitSearch} direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="Tìm học sinh"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <Button type="submit" variant="outlined">Tìm</Button>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <FormControl size="small" fullWidth>
          <InputLabel>Lớp</InputLabel>
          <Select label="Lớp" value={classId} onChange={(event) => { beginReload(); setClassId(event.target.value); resetPage(); }}>
            <MenuItem value="">Tất cả lớp</MenuItem>
            {classes.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Sắp xếp</InputLabel>
          <Select label="Sắp xếp" value={sort} onChange={(event) => { beginReload(); setSort(event.target.value as TuitionCycleSort); resetPage(); }}>
            <MenuItem value="OLDEST_DUE">Cũ nhất cần thu</MenuItem>
            <MenuItem value="NEWEST">Mới nhất</MenuItem>
            <MenuItem value="STUDENT_NAME">Tên học sinh</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { beginReload(); setRetry((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
      {!items && !error && <LoadingState />}
      {items?.length === 0 && <EmptyState message="Không có chu kỳ học phí phù hợp." />}
      <Box data-testid="tuition-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {items?.map((item) => (
        <Card key={item.id} data-testid="tuition-cycle-card">
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>{item.studentName}</Typography>
                <Typography color="text.secondary" variant="body2">{item.className} · Chu kỳ #{item.cycleNumber}</Typography>
              </Stack>
              <TuitionStatusChip status={item.status} />
            </Stack>
            <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
              <Typography color="primary" variant="subtitle1">{money(item.packagePriceSnapshot)}</Typography>
              <Typography sx={{ fontWeight: 600 }}>{item.itemCount}/{item.targetCount}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={(item.itemCount / item.targetCount) * 100} sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {dateCaption(item)}
              {item.activeNextCycleProgress != null ? ` · Chu kỳ tiếp theo ${item.activeNextCycleProgress}/8` : ""}
            </Typography>
          </CardContent>
          <CardActions sx={{ pt: 0 }}>
            <Button component={Link} to={`/admin/tuition/${item.id}`} fullWidth variant="outlined">Xem chi tiết</Button>
            {item.status === "PAYMENT_DUE" && (
              <Button component={Link} to={`/admin/tuition/${item.id}/mark-paid`} fullWidth variant="contained">Đánh dấu đã thu</Button>
            )}
          </CardActions>
        </Card>
      ))}
      </Box>
      {items && total > 0 && (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Button disabled={page === 1} onClick={() => { beginReload(); setPage((value) => value - 1); }}>Trang trước</Button>
          <Typography variant="body2">Trang {page}/{Math.ceil(total / pageSize)} · {total} kết quả</Typography>
          <Button disabled={page * pageSize >= total} onClick={() => { beginReload(); setPage((value) => value + 1); }}>Trang sau</Button>
        </Stack>
      )}
    </Stack>
  );
}

function money(value: number): string {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function dateCaption(item: TuitionCycleListItem): string {
  if (item.status === "PAID") return `Đã thu ${displayDate(item.paidAt)}`;
  if (item.status === "PAYMENT_DUE") return `Đủ 8 buổi ${displayDate(item.reachedTargetAt)}`;
  return `Bắt đầu ${displayDate(item.startedAt)}`;
}
