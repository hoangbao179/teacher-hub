import { Add, DeleteOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  ClassListItem,
  CombinedClassGroupMutationRequest,
  CombinedClassGroupScheduleInput,
  Weekday,
} from "@teacher/shared";
import { api } from "../api/client";
import { combinedClassGroupApi } from "../api/combinedClassGroups";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/UiKit";
import { todayInHoChiMinh } from "../utils/date";

const weekdays: Array<{ value: Weekday; label: string }> = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 7, label: "Chủ nhật" },
];

const emptySchedule = (): CombinedClassGroupScheduleInput => ({
  dayOfWeek: 1,
  startTime: "08:30",
  endTime: "11:00",
});

export function CombinedClassGroupFormPage() {
  const id = Number(useParams().id ?? 0);
  const editing = id > 0;
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [classIds, setClassIds] = useState<number[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(todayInHoChiMinh());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [schedules, setSchedules] = useState<CombinedClassGroupScheduleInput[]>([emptySchedule()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api<ClassListItem[]>("/api/classes"),
      editing ? combinedClassGroupApi.detail(id) : Promise.resolve(null),
    ]).then(([classItems, group]) => {
      setClasses(classItems.filter((item) => item.status === "ACTIVE" || group?.classes.some((entry) => entry.id === item.id)));
      if (group) {
        setName(group.name);
        setNameEdited(true);
        setClassIds(group.classes.map((item) => item.id));
        setEffectiveFrom(group.effectiveFrom);
        setEffectiveTo(group.effectiveTo ?? "");
        setSchedules(group.schedules);
      }
    }).catch((value: Error) => setError(value.message));
  }, [editing, id]);

  const selectedNames = useMemo(
    () => classIds.map((classId) => classes?.find((item) => item.id === classId)?.name).filter(Boolean) as string[],
    [classIds, classes],
  );

  const displayedName = nameEdited ? name : selectedNames.join(" + ");

  const toggleClass = (classId: number) => {
    setClassIds((current) => current.includes(classId)
      ? current.filter((item) => item !== classId)
      : [...current, classId]);
  };

  const updateSchedule = (index: number, patch: Partial<CombinedClassGroupScheduleInput>) => {
    setSchedules((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item));
  };

  const valid = displayedName.trim() && classIds.length >= 2 && schedules.length > 0 &&
    schedules.every((item) => item.endTime > item.startTime) &&
    (!effectiveTo || effectiveTo >= effectiveFrom);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    const input: CombinedClassGroupMutationRequest = {
      name: displayedName.trim(),
      classIds,
      effectiveFrom,
      effectiveTo: effectiveTo || undefined,
      schedules,
    };
    try {
      if (editing) await combinedClassGroupApi.update(id, input);
      else await combinedClassGroupApi.create(input);
      navigate("/admin/combined-class-groups");
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!classes && !error) return <LoadingState />;
  return <Stack spacing={2} sx={{ width: "100%", maxWidth: "var(--app-form-width)", mx: "auto", minWidth: 0 }} data-testid="combined-group-form">
    <PageHeader title={editing ? "Sửa nhóm học ghép" : "Tạo nhóm học ghép"} />
    {error && <Alert severity="error">{error}</Alert>}
    <Card variant="outlined"><CardContent><Stack spacing={2}>
      <TextField
        required
        label="Tên nhóm"
        value={displayedName}
        onChange={(event) => {
          setName(event.target.value);
          setNameEdited(true);
        }}
        helperText="Tên được gợi ý theo các lớp đã chọn và có thể sửa."
      />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Lớp tham gia (ít nhất 2)</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 0.5 }}>
          {classes?.map((item) => <FormControlLabel
            key={item.id}
            control={<Checkbox checked={classIds.includes(item.id)} onChange={() => toggleClass(item.id)} />}
            label={item.name}
            sx={{ minWidth: 0, m: 0, "& .MuiFormControlLabel-label": { overflowWrap: "anywhere" } }}
          />)}
        </Box>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          fullWidth
          required
          disabled={editing}
          type="date"
          label="Ngày bắt đầu áp dụng"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          type="date"
          label="Ngày kết thúc (không bắt buộc)"
          value={effectiveTo}
          onChange={(event) => setEffectiveTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
    </Stack></CardContent></Card>

    <Card variant="outlined"><CardContent><Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Lịch hằng tuần của nhóm</Typography>
        <Button
          startIcon={<Add />}
          onClick={() => setSchedules((current) => [...current, emptySchedule()])}
          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Thêm lịch
        </Button>
      </Stack>
      {schedules.map((schedule, index) => <Box
        key={`${schedule.id ?? "new"}-${index}`}
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr auto", sm: "1.2fr 1fr 1fr auto" }, gap: 1, alignItems: "center" }}
      >
        <TextField
          select
          label="Thứ"
          value={schedule.dayOfWeek}
          onChange={(event) => updateSchedule(index, { dayOfWeek: Number(event.target.value) as Weekday })}
          sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
        >
          {weekdays.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </TextField>
        <TextField
          type="time"
          label="Bắt đầu"
          value={schedule.startTime}
          onChange={(event) => updateSchedule(index, { startTime: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="time"
          label="Kết thúc"
          value={schedule.endTime}
          onChange={(event) => updateSchedule(index, { endTime: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
          error={schedule.endTime <= schedule.startTime}
        />
        <IconButton
          aria-label="Xóa lịch"
          disabled={schedules.length === 1}
          onClick={() => setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        >
          <DeleteOutlined />
        </IconButton>
      </Box>)}
    </Stack></CardContent></Card>

    {classIds.length >= 2 && <Alert severity="info" data-testid="combined-group-summary">
      Trong thời gian nhóm hoạt động, các lịch riêng bị trùng của {selectedNames.join(", ")} sẽ được thay bằng lịch nhóm. Bạn không cần xóa lịch cố định hiện tại.
    </Alert>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", pb: { xs: 10, sm: 2 } }}>
      <Button disabled={busy} onClick={() => navigate("/admin/combined-class-groups")}>Hủy</Button>
      <Button variant="contained" disabled={busy || !valid} onClick={() => void submit()}>
        {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo nhóm"}
      </Button>
    </Stack>
  </Stack>;
}
