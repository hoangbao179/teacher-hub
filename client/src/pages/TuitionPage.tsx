import { FilterList, Search } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  { label: "Đang học", value: "ACCUMULATING" },
  { label: "Cần thu", value: "PAYMENT_DUE" },
  { label: "Đã thu", value: "PAID" },
  { label: "Dở dang", value: "INCOMPLETE" },
];

const defaultStatus: VisibleStatus = "PAYMENT_DUE";
const defaultSort: TuitionCycleSort = "OLDEST_DUE";

export function TuitionPage() {
  const [status, setStatus] = useState<VisibleStatus>(defaultStatus);
  const [items, setItems] = useState<TuitionCycleListItem[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [classId, setClassId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TuitionCycleSort>(defaultSort);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<VisibleStatus>(defaultStatus);
  const [pendingClassId, setPendingClassId] = useState("");
  const [pendingSort, setPendingSort] = useState<TuitionCycleSort>(defaultSort);
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
      sort,
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

  const beginReload = () => { setItems(null); setError(""); };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    beginReload();
    setPage(1);
    setSearch(searchDraft.trim());
  };
  const openFilters = () => {
    setPendingStatus(status);
    setPendingClassId(classId);
    setPendingSort(sort);
    setFilterOpen(true);
  };
  const applyFilters = () => {
    beginReload();
    setPage(1);
    setStatus(pendingStatus);
    setClassId(pendingClassId);
    setSort(pendingSort);
    setFilterOpen(false);
  };
  const updateDesktopStatus = (value: VisibleStatus) => {
    beginReload();
    setStatus(value);
    setPage(1);
    setSort(value === "PAYMENT_DUE" ? "OLDEST_DUE" : "NEWEST");
  };
  const appliedFilterCount = Number(status !== defaultStatus) + Number(Boolean(classId)) + Number(sort !== defaultSort);

  return (
    <Stack spacing={2} data-testid="tuition-list-page">
      <Typography component="h1" variant="h5">Học phí</Typography>
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <Tabs value={status} onChange={(_event, value: VisibleStatus) => updateDesktopStatus(value)} variant="fullWidth" aria-label="Trạng thái học phí">
          {statuses.map((item) => <Tab key={item.value} label={item.label} value={item.value} />)}
        </Tabs>
      </Box>

      <Stack component="form" onSubmit={submitSearch} direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="Tìm học sinh"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <Button type="submit" variant="outlined" sx={{ display: { xs: "none", sm: "inline-flex" } }}>Tìm</Button>
        <Button type="button" variant="outlined" startIcon={<FilterList />} onClick={openFilters} sx={{ display: { xs: "inline-flex", sm: "none" }, whiteSpace: "nowrap" }}>
          Lọc{appliedFilterCount ? ` (${appliedFilterCount})` : ""}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Lớp</InputLabel>
          <Select label="Lớp" value={classId} onChange={(event) => { beginReload(); setClassId(event.target.value); setPage(1); }}>
            <MenuItem value="">Tất cả lớp</MenuItem>
            {classes.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Sắp xếp</InputLabel>
          <Select label="Sắp xếp" value={sort} onChange={(event) => { beginReload(); setSort(event.target.value as TuitionCycleSort); setPage(1); }}>
            <MenuItem value="OLDEST_DUE">Cũ nhất cần thu</MenuItem>
            <MenuItem value="NEWEST">Mới nhất</MenuItem>
            <MenuItem value="STUDENT_NAME">Tên học sinh</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} fullWidth maxWidth="xs" aria-labelledby="tuition-filter-title" data-testid="tuition-filter-dialog">
        <DialogTitle id="tuition-filter-title">Lọc học phí</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth><InputLabel>Trạng thái</InputLabel><Select data-testid="tuition-status-filter" label="Trạng thái" value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value as VisibleStatus)}>
            {statuses.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </Select></FormControl>
          <FormControl fullWidth><InputLabel>Lớp</InputLabel><Select label="Lớp" value={pendingClassId} onChange={(event) => setPendingClassId(event.target.value)}>
            <MenuItem value="">Tất cả lớp</MenuItem>{classes.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
          </Select></FormControl>
          <FormControl fullWidth><InputLabel>Sắp xếp</InputLabel><Select label="Sắp xếp" value={pendingSort} onChange={(event) => setPendingSort(event.target.value as TuitionCycleSort)}>
            <MenuItem value="OLDEST_DUE">Cũ nhất cần thu</MenuItem><MenuItem value="NEWEST">Mới nhất</MenuItem><MenuItem value="STUDENT_NAME">Tên học sinh</MenuItem>
          </Select></FormControl>
        </Stack></DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button onClick={() => { setPendingStatus(defaultStatus); setPendingClassId(""); setPendingSort(defaultSort); }}>Xóa bộ lọc</Button>
          <Button variant="contained" onClick={applyFilters}>Áp dụng</Button>
        </DialogActions>
      </Dialog>

      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { beginReload(); setRetry((value) => value + 1); }}>Thử lại</Button>}>{error}</Alert>}
      {!items && !error && <LoadingState />}
      {items?.length === 0 && <EmptyState message="Không có đợt học phí phù hợp." />}
      <Box data-testid="tuition-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {items?.map((item) => (
          <Card key={item.id} data-testid="tuition-cycle-card">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" noWrap>{item.studentName}</Typography>
                  <Typography color="text.secondary" variant="body2">{item.className} · Đợt học phí {item.cycleNumber}</Typography>
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
                {item.activeNextCycleProgress != null ? ` · Đợt tiếp theo ${item.activeNextCycleProgress}/8` : ""}
              </Typography>
            </CardContent>
            <CardActions sx={{ pt: 0 }}>
              <Button component={Link} to={`/admin/tuition/${item.id}`} fullWidth variant="outlined">Xem chi tiết</Button>
              {item.status === "PAYMENT_DUE" && <Button component={Link} to={`/admin/tuition/${item.id}/mark-paid`} fullWidth variant="contained">Đánh dấu đã thu</Button>}
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

function money(value: number): string { return `${value.toLocaleString("vi-VN")}đ`; }
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
