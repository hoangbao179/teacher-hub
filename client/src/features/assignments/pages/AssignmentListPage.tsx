import { Add, Search } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  AssignmentAudienceType,
  AssignmentListItem,
  AssignmentStatus,
  LearningAgeBand,
} from "@teacher/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAssignments } from "../../../api/assignments";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingCards } from "../../../components/LoadingCards";
import { PageHeader } from "../../../components/UiKit";
import { ageBandLabel, ageBandOptions } from "../../vocabulary/vocabularyEditor";
import {
  audienceLabels,
  formatDateTime,
  statusLabels,
} from "../assignmentUi";

export function AssignmentListPage() {
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [audienceType, setAudienceType] = useState<AssignmentAudienceType | "">("");
  const [ageBand, setAgeBand] = useState<LearningAgeBand | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void listAssignments({
        search,
        status: status || undefined,
        audienceType: audienceType || undefined,
        ageBand: ageBand || undefined,
        pageSize: 50,
      }).then((result) => setItems(result.data))
        .catch((reason: Error) => setError(reason.message))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [ageBand, audienceType, search, status]);

  return (
    <Stack spacing={2.25} data-testid="assignment-list-page">
      <PageHeader
        title="Bài tập từ vựng"
        subtitle="Tạo, giao và quản lý bài luyện từ vựng cho lớp hoặc từng học sinh."
        action={<Button component={Link} to="/admin/assignments/new" variant="contained" startIcon={<Add />}>Tạo bài tập</Button>}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "minmax(260px, 1fr) repeat(3, 190px)" }, gap: 1 }}>
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm bài tập…"
          sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <TextField select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as AssignmentStatus | "")}>
          <MenuItem value="">Tất cả</MenuItem>
          {Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField select label="Người nhận" value={audienceType} onChange={(event) => setAudienceType(event.target.value as AssignmentAudienceType | "")}>
          <MenuItem value="">Tất cả</MenuItem>
          {Object.entries(audienceLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField select label="Khối tuổi" value={ageBand} onChange={(event) => setAgeBand(event.target.value as LearningAgeBand | "")}>
          <MenuItem value="">Tất cả</MenuItem>
          {ageBandOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LoadingCards />}
      {!loading && !error && items.length === 0 && <EmptyState message="Chưa có bài tập phù hợp." />}
      {!loading && !error && (
        <Stack spacing={1}>
          {items.map((item) => <AssignmentCard key={item.id} item={item} />)}
        </Stack>
      )}
    </Stack>
  );
}

function AssignmentCard({ item }: { item: AssignmentListItem }) {
  const statusColor = item.status === "PUBLISHED" ? "success" : item.status === "CLOSED" ? "default" : "warning";
  return (
    <Card variant="outlined">
      <CardActionArea component={Link} to={`/admin/assignments/${item.id}`}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="subtitle1">{item.title}</Typography>
                <Chip size="small" color={statusColor} label={statusLabels[item.status]} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {item.audienceType ? audienceLabels[item.audienceType] : "Chưa chọn người nhận"} · {ageBandLabel(item.ageBand)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.itemCount} từ · {item.recipientCount} người nhận · Hạn {formatDateTime(item.dueAt)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
