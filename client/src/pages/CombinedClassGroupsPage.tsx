import { Add, EditOutlined, StopCircleOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CombinedClassGroup } from "@teacher/shared";
import { combinedClassGroupApi } from "../api/combinedClassGroups";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { PageHeader } from "../components/UiKit";
import { displayDate, todayInHoChiMinh } from "../utils/date";
import { formatClassSchedule } from "../utils/classSchedule";

export function CombinedClassGroupsPage() {
  const [items, setItems] = useState<CombinedClassGroup[] | null>(null);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState<CombinedClassGroup | null>(null);
  const [effectiveTo, setEffectiveTo] = useState(todayInHoChiMinh());
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError("");
    combinedClassGroupApi.list().then(setItems).catch((value: Error) => setError(value.message));
  };
  useEffect(() => {
    combinedClassGroupApi.list().then(setItems).catch((value: Error) => setError(value.message));
  }, []);

  const endGroup = async () => {
    if (!ending) return;
    setBusy(true);
    try {
      await combinedClassGroupApi.end(ending.id, {
        effectiveTo,
        reason: "Kết thúc nhóm học ghép",
      });
      setEnding(null);
      load();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <Stack spacing={2} sx={{ minWidth: 0 }} data-testid="combined-group-list">
    <PageHeader
      title="Nhóm học ghép"
      action={<Button component={Link} to="/admin/combined-class-groups/new" variant="contained" startIcon={<Add />}>
        Tạo nhóm
      </Button>}
    />
    <Alert severity="info">
      Lịch nhóm chỉ thay thế các lịch riêng bị trùng giờ trong thời gian có hiệu lực. Lịch cố định gốc của từng lớp vẫn được giữ nguyên.
    </Alert>
    {error && <Alert severity="error">{error}</Alert>}
    {!items && !error && <LoadingCards />}
    {items?.length === 0 && <EmptyState message="Chưa có nhóm học ghép." />}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {items?.map((item) => <Card key={item.id} variant="outlined" data-testid="combined-group-card">
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>{item.name}</Typography>
            <Chip
              size="small"
              color={item.status === "ACTIVE" ? "success" : "default"}
              label={item.status === "ACTIVE" ? "Đang hoạt động" : "Đã kết thúc"}
            />
          </Stack>
          <Typography sx={{ mt: 1 }}>{item.classes.map((entry) => entry.name).join(" · ")}</Typography>
          <Typography color="text.secondary">{formatClassSchedule(item.schedules)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Từ {displayDate(item.effectiveFrom)}
            {item.effectiveTo ? ` đến ${displayDate(item.effectiveTo)}` : " · chưa đặt ngày kết thúc"}
          </Typography>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button component={Link} to={`/admin/combined-class-groups/${item.id}/edit`} startIcon={<EditOutlined />}>
            Sửa
          </Button>
          {item.status === "ACTIVE" && <Button
            color="warning"
            startIcon={<StopCircleOutlined />}
            onClick={() => {
              setEffectiveTo(todayInHoChiMinh());
              setEnding(item);
            }}
          >
            Kết thúc nhóm
          </Button>}
        </CardActions>
      </Card>)}
    </Box>
    <Dialog open={Boolean(ending)} onClose={() => !busy && setEnding(null)} fullWidth maxWidth="xs">
      <DialogTitle>Kết thúc {ending?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Alert severity="info">Các lớp sẽ tự động quay lại lịch cố định riêng sau ngày này.</Alert>
          <TextField
            type="date"
            label="Ngày kết thúc"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setEnding(null)}>Hủy</Button>
        <Button variant="contained" color="warning" disabled={busy || !effectiveTo} onClick={() => void endGroup()}>
          {busy ? "Đang lưu…" : "Kết thúc nhóm"}
        </Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
