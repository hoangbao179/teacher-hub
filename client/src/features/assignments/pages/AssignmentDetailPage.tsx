import {
  ContentCopy,
  Edit,
  Link as LinkIcon,
  LockReset,
  Assessment,
  StopCircle,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  AssignmentDetail,
  AssignmentRecipient,
  AssignmentShare,
} from "@teacher/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  changeAssignmentDueDate,
  closeAssignment,
  duplicateAssignment,
  getAssignment,
  listAssignmentRecipients,
  regenerateAssignmentAccess,
  revokeAssignmentAccess,
} from "../../../api/assignments";
import {
  ConfirmationDialog,
  PageHeader,
  StickyActionBar,
} from "../../../components/UiKit";
import {
  audienceLabels,
  formatDateTime,
  statusLabels,
  templateLabels,
} from "../assignmentUi";

interface LocationState {
  success?: string;
  shares?: AssignmentShare[];
}

export function AssignmentDetailPage() {
  const id = Number(useParams().id);
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state as LocationState | null;
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [recipients, setRecipients] = useState<AssignmentRecipient[]>([]);
  const [shares, setShares] = useState<AssignmentShare[]>(initialState?.shares ?? []);
  const [success, setSuccess] = useState(initialState?.success ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [dueAt, setDueAt] = useState("");

  const load = useCallback(() => {
    return getAssignment(id).then(async (detail) => {
      setAssignment(detail);
      setDueAt(detail.dueAt ? localInput(detail.dueAt) : "");
      if (detail.status !== "DRAFT" && detail.audienceType !== "OPEN_LINK")
        setRecipients(await listAssignmentRecipients(id));
    }).catch((reason: Error) => setError(reason.message));
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const duplicate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await duplicateAssignment(id);
      navigate(`/admin/assignments/${result.id}/edit`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (recipientId?: number) => {
    setBusy(true);
    setError("");
    try {
      const share = await regenerateAssignmentAccess(id, { recipientId });
      setShares((current) => [
        ...current.filter((item) => item.recipientId !== share.recipientId),
        share,
      ]);
      setSuccess("Đã tạo liên kết mới. Liên kết cũ không còn hiệu lực.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (recipientId?: number) => {
    setBusy(true);
    setError("");
    try {
      await revokeAssignmentAccess(id, { recipientId });
      setShares((current) => current.filter((item) => item.recipientId !== recipientId));
      setSuccess("Đã thu hồi liên kết truy cập.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveDueDate = async () => {
    setBusy(true);
    try {
      const result = await changeAssignmentDueDate(id, dueAt ? new Date(dueAt).toISOString() : null);
      setAssignment(result);
      setSuccess("Đã cập nhật hạn nộp.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      await closeAssignment(id);
      setCloseOpen(false);
      setSuccess("Đã đóng bài tập.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!assignment) return error ? <Alert severity="error">{error}</Alert> : <Typography>Đang tải…</Typography>;
  return (
    <Stack spacing={2.25} data-testid="assignment-detail-page">
      <PageHeader
        title={assignment.title}
        subtitle={`${statusLabels[assignment.status]} · ${assignment.audienceType ? audienceLabels[assignment.audienceType] : "Chưa chọn người nhận"}`}
        action={assignment.status === "DRAFT"
          ? <Button component={Link} to={`/admin/assignments/${id}/edit`} variant="contained" startIcon={<Edit />}>Tiếp tục soạn</Button>
          : undefined}
      />
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined"><CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
            <Chip label={statusLabels[assignment.status]} color={assignment.status === "PUBLISHED" ? "success" : "default"} />
            <Chip label={templateLabels[assignment.templateCode]} />
            <Chip label={`${assignment.itemCount} từ`} />
            <Chip label={`${assignment.activities.length} hoạt động`} />
          </Stack>
          <Typography>{assignment.instruction || "Không có lời nhắn cho học sinh."}</Typography>
          <Typography variant="body2" color="text.secondary">
            Mở từ {formatDateTime(assignment.availableFrom)} · Hạn {formatDateTime(assignment.dueAt)}
          </Typography>
          {assignment.publicCode && <Typography variant="body2">Mã công khai: <strong>{assignment.publicCode}</strong></Typography>}
        </Stack>
      </CardContent></Card>

      {assignment.status !== "DRAFT" && (
        <Card variant="outlined"><CardContent>
          <Stack spacing={1.5}>
            <Typography component="h2" variant="h6">Liên kết chia sẻ</Typography>
            <Alert severity="info">Mã truy cập chỉ hiển thị lúc vừa tạo hoặc tạo lại. Hệ thống chỉ lưu bản băm an toàn.</Alert>
            {assignment.audienceType === "OPEN_LINK" && (
              <Button variant="outlined" startIcon={<LockReset />} disabled={busy} onClick={() => void regenerate()}>
                {shares.length ? "Tạo lại liên kết mở" : "Hiển thị liên kết mới"}
              </Button>
            )}
            {shares.map((share) => <ShareCard key={`${share.recipientId ?? "open"}-${share.accessToken}`} share={share} />)}
            {assignment.audienceType !== "OPEN_LINK" && recipients.map((recipient) => {
              const currentShare = shares.find((item) => item.recipientId === recipient.id);
              return <Box key={recipient.id}>
                <Divider sx={{ mb: 1.25 }} />
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1, alignItems: { sm: "center" } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{recipient.studentName}</Typography>
                    <Typography variant="caption" color="text.secondary">{recipient.tokenRevokedAt ? "Đã thu hồi" : "Đang có quyền truy cập"}</Typography>
                  </Box>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    <Button size="small" startIcon={<LockReset />} disabled={busy} onClick={() => void regenerate(recipient.id)}>Tạo lại</Button>
                    {!recipient.tokenRevokedAt && <Button size="small" color="error" disabled={busy} onClick={() => void revoke(recipient.id)}>Thu hồi</Button>}
                  </Stack>
                </Stack>
                {currentShare && <ShareCard share={currentShare} />}
              </Box>;
            })}
          </Stack>
        </CardContent></Card>
      )}

      {assignment.status !== "DRAFT" && <Card variant="outlined"><CardContent>
        <Stack spacing={1.25}>
          <Typography component="h2" variant="h6">Hạn nộp</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField fullWidth label="Hạn nộp" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <Button variant="outlined" disabled={busy} onClick={() => void saveDueDate()}>Cập nhật</Button>
          </Stack>
        </Stack>
      </CardContent></Card>}

      <Card variant="outlined"><CardContent>
        <Typography component="h2" variant="h6">Kết quả học tập</Typography>
        <Typography color="text.secondary">Kết quả và lượt làm sẽ được triển khai ở milestone tiếp theo.</Typography>
      </CardContent></Card>

      <StickyActionBar>
        {assignment.status !== "DRAFT" && (
          <Button
            component={Link}
            to={`/admin/assignments/${id}/results`}
            startIcon={<Assessment />}
          >
            Xem kết quả
          </Button>
        )}
        <Button startIcon={<ContentCopy />} disabled={busy} onClick={() => void duplicate()}>Nhân bản</Button>
        {assignment.status === "PUBLISHED" && <Button color="error" startIcon={<StopCircle />} disabled={busy} onClick={() => setCloseOpen(true)}>Đóng bài</Button>}
      </StickyActionBar>
      <ConfirmationDialog
        open={closeOpen}
        title="Đóng bài tập?"
        confirmLabel="Đóng bài"
        destructive
        busy={busy}
        onCancel={() => setCloseOpen(false)}
        onConfirm={() => void close()}
      >
        <Typography>Học sinh sẽ không thể bắt đầu lượt làm mới. Dữ liệu đã tạo vẫn được giữ lại.</Typography>
      </ConfirmationDialog>
    </Stack>
  );
}

function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function ShareCard({ share }: { share: AssignmentShare }) {
  const copy = async () => navigator.clipboard.writeText(share.shareUrl);
  return <Box sx={{ mt: 1.25, p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, alignItems: { sm: "center" } }}>
      <Box
        component="img"
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(share.qrSvg)}`}
        alt={`Mã QR ${share.studentName ?? "liên kết mở"}`}
        sx={{ width: 116, height: 116, alignSelf: { xs: "center", sm: "auto" } }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {share.studentName && <Typography sx={{ fontWeight: 600 }}>{share.studentName}</Typography>}
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{share.shareUrl}</Typography>
        <Button size="small" startIcon={<LinkIcon />} onClick={() => void copy()}>Sao chép liên kết</Button>
      </Box>
    </Stack>
  </Box>;
}
