import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { OutstandingMakeupItem } from "@teacher/shared";
import { scheduleApi } from "../api/schedule";
import { EmptyState } from "../components/EmptyState";
import { LoadingCards } from "../components/LoadingCards";
import { PageHeader } from "../components/UiKit";
import { displayDate } from "../utils/date";

export function OutstandingMakeupsPage() {
  const [items, setItems] = useState<OutstandingMakeupItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { scheduleApi.outstandingMakeups().then(setItems).catch((value: Error) => setError(value.message)); }, []);
  return <Stack spacing={2} data-testid="outstanding-makeup-list">
    <PageHeader title="Buổi cần học bù" />
    <Typography color="text.secondary">Danh sách giữ theo từng học sinh và không hết hạn sau 60 ngày.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{!items && !error && <LoadingCards />}
    {items?.length === 0 && <EmptyState message="Không còn học sinh chờ học bù." />}
    {items?.map((item) => <Card key={item.sourceOccurrenceKey} variant="outlined"><CardContent><Stack spacing={1}>
      <Typography variant="subtitle1">{item.className}</Typography>
      <Typography variant="body2">Buổi gốc: {displayDate(item.originalDate)} · {item.originalStartTime}–{item.originalEndTime}</Typography>
      {item.replacementDate && <Typography variant="body2">Lịch thay thế đã nghỉ: {displayDate(item.replacementDate)} · {item.replacementStartTime}–{item.replacementEndTime}</Typography>}
      {item.reason && <Typography variant="body2" color="text.secondary">Lý do: {item.reason}</Typography>}
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }}>
        <Chip size="small" color="warning" label={`${item.openCount} còn chờ`} /><Chip size="small" label={`${item.reservedCount} đang giữ`} /><Chip size="small" color="success" label={`${item.fulfilledCount} đã hoàn tất`} /><Chip size="small" label={`${item.waivedCount} được miễn`} />
      </Stack>
      <Button component={Link} variant="contained" to={`/admin/lessons/new?classId=${item.classId}&type=MAKEUP&source=${encodeURIComponent(item.sourceOccurrenceKey)}`}>Tạo buổi học bù</Button>
    </Stack></CardContent></Card>)}
  </Stack>;
}
