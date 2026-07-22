import { Add, FilterList, Search } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { StudentListItem } from "@teacher/shared";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader, ProgressCount } from "../components/UiKit";

type StudentFilter = "ALL" | "ACTIVE" | "PAUSED" | "ENDED" | "FREE" | "DUE";
type StudentSort = "AZ" | "ZA";

function studentStatus(item: StudentListItem): string {
  if (item.status === "INACTIVE") return "Đã nghỉ";
  if (!item.enrollmentStatus) return "Chưa có lớp";
  if (item.enrollmentStatus === "PAUSED") return "Tạm dừng";
  if (item.enrollmentStatus === "ENDED") return "Đã nghỉ";
  return "Đang học";
}

function studentInitial(name: string): string {
  const word = name.trim().split(/\s+/).reverse().find((part) => /^\p{L}/u.test(part));
  return word?.slice(0, 1).toLocaleUpperCase("vi-VN") || "?";
}

function normalized(value: string | null): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN").trim();
}

function matchesFilter(item: StudentListItem, filter: StudentFilter): boolean {
  if (filter === "ACTIVE") return item.status === "ACTIVE" && item.enrollmentStatus === "ACTIVE";
  if (filter === "PAUSED") return item.enrollmentStatus === "PAUSED";
  if (filter === "ENDED") return item.status === "INACTIVE" || item.enrollmentStatus === "ENDED";
  if (filter === "FREE") return item.tuitionMode === "FREE";
  if (filter === "DUE") return item.hasPaymentDue;
  return true;
}

const avatarTones = [
  { bg: "#eee8ff", text: "#6d3df5" },
  { bg: "#e4f5ec", text: "#168754" },
  { bg: "#e7f3ff", text: "#087ca7" },
  { bg: "#fff0df", text: "#b85c00" },
] as const;

const filterOptions: Array<{ value: StudentFilter; label: string }> = [
  { value: "ALL", label: "Tất cả học sinh" },
  { value: "ACTIVE", label: "Đang học" },
  { value: "PAUSED", label: "Tạm dừng" },
  { value: "ENDED", label: "Đã nghỉ" },
  { value: "FREE", label: "Miễn phí" },
  { value: "DUE", label: "Cần thu" },
];

export function StudentsPage() {
  const [items, setItems] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StudentFilter>("ALL");
  const [sort, setSort] = useState<StudentSort>("AZ");
  const [pendingFilter, setPendingFilter] = useState<StudentFilter>("ALL");
  const [pendingSort, setPendingSort] = useState<StudentSort>("AZ");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    api<StudentListItem[]>("/api/students").then(setItems).catch((reason: Error) => setError(reason.message));
  }, []);

  const visibleItems = useMemo(() => {
    const query = normalized(search);
    const collator = new Intl.Collator("vi-VN", { sensitivity: "base" });
    return [...(items ?? [])]
      .filter((item) => !query || [item.fullName, item.nickname, item.className].some((value) => normalized(value).includes(query)))
      .filter((item) => matchesFilter(item, filter))
      .sort((left, right) => (sort === "AZ" ? 1 : -1) * collator.compare(left.fullName, right.fullName));
  }, [filter, items, search, sort]);

  const openFilters = () => {
    setPendingFilter(filter);
    setPendingSort(sort);
    setFilterOpen(true);
  };

  if (!items && !error) return <LoadingState />;
  return (
    <Stack spacing={2} data-testid="student-list-page">
      <PageHeader title="Học sinh" action={<Button component={Link} to="/admin/students/new" startIcon={<Add />} variant="contained">Thêm học sinh</Button>} />
      {error && <Alert severity="warning">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ width: "100%", maxWidth: { md: 700 } }}>
        <TextField
          fullWidth
          size="small"
          sx={{ width: { md: 620 }, flex: { md: "0 1 620px" } }}
          label="Tìm tên, tên gọi hoặc lớp"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <Button variant="outlined" startIcon={<FilterList />} onClick={openFilters} sx={{ display: { xs: "inline-flex", md: "none" }, whiteSpace: "nowrap" }}>
          Lọc{filter !== "ALL" || sort !== "AZ" ? " •" : ""}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" }, width: "100%", maxWidth: 580 }}>
        <FormControl size="small" sx={{ width: 280 }}><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={filter} onChange={(event) => setFilter(event.target.value as StudentFilter)}>
          {filterOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </Select></FormControl>
        <FormControl size="small" sx={{ width: 280 }}><InputLabel>Sắp xếp</InputLabel><Select label="Sắp xếp" value={sort} onChange={(event) => setSort(event.target.value as StudentSort)}>
          <MenuItem value="AZ">Tên A–Z</MenuItem><MenuItem value="ZA">Tên Z–A</MenuItem>
        </Select></FormControl>
      </Stack>

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} fullWidth maxWidth="xs" aria-labelledby="student-filter-title">
        <DialogTitle id="student-filter-title">Lọc và sắp xếp</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={pendingFilter} onChange={(event) => setPendingFilter(event.target.value as StudentFilter)}>
            {filterOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </Select></FormControl>
          <FormControl fullWidth><InputLabel>Sắp xếp</InputLabel><Select label="Sắp xếp" value={pendingSort} onChange={(event) => setPendingSort(event.target.value as StudentSort)}>
            <MenuItem value="AZ">Tên A–Z</MenuItem><MenuItem value="ZA">Tên Z–A</MenuItem>
          </Select></FormControl>
        </Stack></DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button onClick={() => { setPendingFilter("ALL"); setPendingSort("AZ"); }}>Xóa bộ lọc</Button>
          <Button variant="contained" onClick={() => { setFilter(pendingFilter); setSort(pendingSort); setFilterOpen(false); }}>Áp dụng</Button>
        </DialogActions>
      </Dialog>

      <Box data-testid="student-card-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {visibleItems.map((item) => (
          <Card key={item.id} component={Link} to={`/admin/students/${item.id}`} sx={{ textDecoration: "none", boxShadow: "0 3px 12px rgba(36,29,62,.06)" }}>
            <CardContent>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                <Avatar sx={{ width: 38, height: 38, bgcolor: avatarTones[item.id % avatarTones.length].bg, color: avatarTones[item.id % avatarTones.length].text, fontSize: 16, fontWeight: 700 }}>{studentInitial(item.fullName)}</Avatar>
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography color="text.primary" variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>{item.fullName}</Typography>
                  {item.nickname && <Typography variant="body2" color="text.secondary">Tên gọi: {item.nickname}</Typography>}
                  <Typography variant="body2" color="text.secondary">{item.className ?? "Chưa có lớp"}</Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
                  <Chip size="small" color={item.enrollmentStatus === "ACTIVE" && item.status === "ACTIVE" ? "success" : item.enrollmentStatus === "PAUSED" ? "warning" : "default"} label={studentStatus(item)} />
                  {(item.hasPaymentDue || item.tuitionMode === "FREE") && <Chip size="small" color={item.hasPaymentDue ? "warning" : "default"} variant="outlined" label={item.hasPaymentDue ? "Cần thu" : "Miễn phí"} />}
                </Stack>
              </Stack>
              {item.enrollmentStatus === "ACTIVE" && item.tuitionMode !== "FREE" && <Box sx={{ mt: 1.25 }}><ProgressCount value={item.currentProgress ?? 0} /></Box>}
            </CardContent>
          </Card>
        ))}
      </Box>
      {items?.length === 0 && <EmptyState message="Chưa có học sinh. Chọn Thêm học sinh để bắt đầu." />}
      {items && items.length > 0 && visibleItems.length === 0 && <EmptyState message="Không có học sinh phù hợp với tìm kiếm và bộ lọc." />}
    </Stack>
  );
}
