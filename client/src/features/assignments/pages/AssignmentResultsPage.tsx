import {
  ArrowBack,
  AssignmentTurnedIn,
  People,
  Replay,
  School,
  Visibility,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  LinearProgress,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type {
  AssignmentRecipientResult,
  AssignmentRecipientResultDetail,
  AssignmentResultSummary,
  AssignmentVocabularyResult,
  VocabularyMasteryStatus,
  StudentGoogleSheetState,
} from "@teacher/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createVocabularyReviewDraft,
  getAssignmentRecipientResult,
  getAssignmentResultSummary,
  listAssignmentResultRecipients,
  listAssignmentResultVocabulary,
} from "../../../api/assignments";
import { PageHeader } from "../../../components/UiKit";
import {
  getStudentGoogleSheet,
  resyncStudentGoogleSheet,
} from "../../../api/students";
import { gameMechanicLabels } from "../assignmentUi";

const masteryLabel: Record<VocabularyMasteryStatus, string> = {
  MASTERED: "🟢 Đã nhớ",
  LEARNING: "🟡 Đang học",
  NEEDS_REVIEW: "🔴 Cần ôn",
  NOT_SEEN: "⚪ Chưa gặp",
};
const statusLabel: Record<AssignmentRecipientResult["status"], string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang làm",
  COMPLETED: "Đã hoàn thành",
};

function Percent({ value, label }: { value: number | null; label: string }) {
  return <Stack spacing={0.4}>
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography variant="caption">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{value == null ? "—" : `${value}%`}</Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={value ?? 0}
      aria-label={`${label}: ${value == null ? "chưa có dữ liệu" : `${value}%`}`}
    />
  </Stack>;
}

export function AssignmentResultsPage() {
  const assignmentId = Number(useParams().id);
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AssignmentResultSummary | null>(null);
  const [recipients, setRecipients] = useState<AssignmentRecipientResult[]>([]);
  const [words, setWords] = useState<AssignmentVocabularyResult[]>([]);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AssignmentRecipientResultDetail | null>(null);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleState, setGoogleState] = useState<StudentGoogleSheetState | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await getAssignmentResultSummary(assignmentId));
      if (tab === 0) {
        const result = await listAssignmentResultRecipients(assignmentId, {
          page, pageSize: 20, search, sort: "LAST_ACTIVITY", direction: "DESC",
        });
        setRecipients(result.data);
        setTotal(Number(result.meta?.total ?? result.data.length));
      } else {
        const result = await listAssignmentResultVocabulary(assignmentId, {
          page, pageSize: 20, search, sort: "MASTERY", direction: "DESC",
        });
        setWords(result.data);
        setTotal(Number(result.meta?.total ?? result.data.length));
      }
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, [assignmentId, page, search, tab]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reviewWordCandidates = useMemo(
    () => words.filter((word) => word.mastery === "NEEDS_REVIEW"),
    [words],
  );

  const openReview = async (wordId?: number) => {
    setError("");
    try {
      const [allWords, allRecipients] = await Promise.all([
        listAssignmentResultVocabulary(assignmentId, {
          page: 1, pageSize: 50, mastery: "NEEDS_REVIEW", sort: "NAME", direction: "ASC",
        }),
        listAssignmentResultRecipients(assignmentId, {
          page: 1, pageSize: 50, sort: "NAME", direction: "ASC",
        }),
      ]);
      setWords(allWords.data);
      setRecipients(allRecipients.data);
      setSelectedWords(wordId ? [wordId] : allWords.data.map((word) => word.assignmentItemId));
      setSelectedRecipients(allRecipients.data
        .filter((recipient) => recipient.needsReviewWords > 0)
        .map((recipient) => recipient.recipientId));
      setReviewOpen(true);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const createReview = async () => {
    setBusy(true);
    try {
      const draft = await createVocabularyReviewDraft(assignmentId, {
        assignmentItemIds: selectedWords,
        recipientIds: selectedRecipients,
      });
      navigate(`/admin/assignments/${draft.id}/edit`, {
        state: { success: "Đã tạo bài ôn ở trạng thái nháp. Hãy kiểm tra trước khi giao." },
      });
    } catch (reason) {
      setError((reason as Error).message);
      setReviewOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (recipient: AssignmentRecipientResult) => {
    setError("");
    try {
      const [recipientDetail, sheetState] = await Promise.all([
        getAssignmentRecipientResult(assignmentId, recipient.recipientId),
        getStudentGoogleSheet(recipient.studentId),
      ]);
      setDetail(recipientDetail);
      setGoogleState(sheetState);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const googleStatus = !googleState?.enabled
    ? "Google sync đang tắt"
    : !googleState.sheet || googleState.sheet.status !== "ACTIVE"
      ? "Chưa có Google Sheet"
      : googleState.deadCount > 0
        ? "Lỗi đồng bộ"
        : googleState.retryCount > 0
          ? "Đang thử lại"
          : googleState.pendingCount > 0
            ? "Đang chờ"
            : googleState.lastSuccessfulSyncAt
              ? "Đã đồng bộ" : "Đang chờ";

  if (!summary && !error) return <Typography>Đang tải kết quả…</Typography>;
  return <Stack spacing={2.25} data-testid="assignment-results-page">
    <PageHeader
      title="Kết quả từ vựng"
      subtitle={summary?.assignmentStatus === "CLOSED"
        ? "Bài đã đóng · lịch sử kết quả vẫn được giữ nguyên"
        : "Dữ liệu học sinh và lượt khách được tách riêng"}
      action={<Button component={Link} to={`/admin/assignments/${assignmentId}`} startIcon={<ArrowBack />}>
        Về bài tập
      </Button>}
    />
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
    {summary && <>
      <Grid container spacing={1.25}>
        {[
          ["Được giao", summary.assigned, <People />],
          ["Đã hoàn thành", summary.completed, <AssignmentTurnedIn />],
          ["Đã nhớ", summary.masteredWords, <School />],
          ["Cần ôn", summary.needsReviewWords, <Replay />],
        ].map(([label, value, icon]) => (
          <Grid size={{ xs: 6, md: 3 }} key={String(label)}>
            <Card variant="outlined" sx={{ height: "100%" }}><CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box aria-hidden>{icon}</Box>
                <Box><Typography variant="caption">{label}</Typography>
                  <Typography variant="h5">{String(value)}</Typography></Box>
              </Stack>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Card variant="outlined"><CardContent>
        <Percent value={summary.completionPercent} label="Tỷ lệ hoàn thành" />
        <Typography variant="body2" sx={{ mt: 1 }}>
          {summary.totalAttempts} lượt làm
          {summary.averageScore == null ? "" : ` · điểm gần nhất trung bình ${summary.averageScore}%`}
          {summary.passedCount == null ? "" : ` · ${summary.passedCount} học sinh đạt`}
        </Typography>
        {summary.guest.attempts > 0 && <Alert severity="info" sx={{ mt: 1.5 }}>
          Lượt khách OPEN_LINK (không phải kết quả học sinh): {summary.guest.completed}/
          {summary.guest.attempts} lượt hoàn thành, {summary.guest.gradedExposures} câu chấm điểm.
        </Alert>}
      </CardContent></Card>
    </>}
    <Card variant="outlined">
      <Tabs
        value={tab}
        onChange={(_, value: number) => { setTab(value); setPage(1); }}
        aria-label="Chọn cách xem kết quả"
        variant="fullWidth"
      >
        <Tab label="Theo học sinh" />
        <Tab label="Theo từ" />
      </Tabs>
      <CardContent>
        <Stack spacing={1.5}>
          <TextField
            label={tab === 0 ? "Tìm học sinh" : "Tìm từ"}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            slotProps={{ htmlInput: {
              "aria-label": tab === 0 ? "Tìm học sinh" : "Tìm từ",
            } }}
          />
          {tab === 0 ? recipients.map((recipient) => (
            <Card variant="outlined" key={recipient.recipientId}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
                    <Box><Typography sx={{ fontWeight: 700 }}>{recipient.studentName}</Typography>
                      <Chip size="small" label={statusLabel[recipient.status]} /></Box>
                    <Button
                      onClick={() => void openDetail(recipient)}
                      startIcon={<Visibility />}
                      sx={{ minHeight: 44 }}
                    >Xem chi tiết</Button>
                  </Stack>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 12, sm: 6 }}><Percent value={recipient.firstTryPercent} label="Đúng lần đầu" /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Percent value={recipient.finalCorrectPercent} label="Sau hỗ trợ" /></Grid>
                  </Grid>
                  <Typography variant="body2">
                    {recipient.attemptCount} lượt · {recipient.needsReviewWords} từ cần ôn
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )) : words.map((word) => (
            <Card variant="outlined" key={word.assignmentItemId}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                    <Box><Typography sx={{ fontWeight: 700 }}>{word.word}</Typography>
                      <Typography variant="body2" color="text.secondary">{word.meaningVi}</Typography></Box>
                    <Chip
                      label={masteryLabel[word.mastery]}
                      color={word.mastery === "NEEDS_REVIEW" ? "warning"
                        : word.mastery === "MASTERED" ? "success" : "default"}
                    />
                  </Stack>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 12, sm: 6 }}><Percent value={word.evidence.firstTryPercent} label="Đúng lần đầu" /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Percent value={word.evidence.finalCorrectPercent} label="Sau hỗ trợ" /></Grid>
                  </Grid>
                  <Typography variant="caption">{word.evidence.reason}</Typography>
                  {word.mastery === "NEEDS_REVIEW" && summary?.audienceType !== "OPEN_LINK" &&
                    <Button onClick={() => void openReview(word.assignmentItemId)} sx={{ minHeight: 44 }}>
                      Giao lại từ này
                    </Button>}
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!total && <Typography color="text.secondary">Chưa có dữ liệu phù hợp.</Typography>}
          {total > 20 && <Pagination
            page={page}
            count={Math.ceil(total / 20)}
            onChange={(_, value) => setPage(value)}
            sx={{ alignSelf: "center" }}
          />}
        </Stack>
      </CardContent>
    </Card>
    {summary?.needsReviewWords ? <Button
      variant="contained"
      startIcon={<Replay />}
      onClick={() => void openReview()}
      disabled={summary.audienceType === "OPEN_LINK"}
      sx={{ minHeight: 48, alignSelf: { sm: "flex-start" } }}
    >Giao lại các từ cần ôn</Button> : null}

    <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
      <DialogTitle>Kết quả của {detail?.studentName}</DialogTitle>
      <DialogContent dividers><Stack spacing={1}>
        {googleState && <Alert severity={
          googleStatus === "Đã đồng bộ" ? "success"
            : googleStatus === "Lỗi đồng bộ" ? "error" : "info"
        } action={
          googleState.sheet?.status === "ACTIVE"
            && (googleState.deadCount > 0 || googleState.retryCount > 0)
            ? <Button color="inherit" onClick={() => void resyncStudentGoogleSheet(detail!.studentId)
              .then(() => getStudentGoogleSheet(detail!.studentId))
              .then(setGoogleState)}>Đồng bộ lại</Button>
            : undefined
        }>
          Google Sheet: {googleStatus}
        </Alert>}
        {detail?.attempts.map((attempt) => <Card variant="outlined" key={attempt.attemptId}>
          <CardContent>
            <Typography sx={{ fontWeight: 700 }}>
              Lượt {attempt.attemptNumber} · {attempt.status === "COMPLETED"
                ? "Đã hoàn thành" : attempt.status === "IN_PROGRESS" ? "Đang làm" : "Bỏ dở"}
            </Typography>
            <Typography variant="body2">
              {new Date(attempt.startedAt).toLocaleString("vi-VN")} ·
              {" "}{attempt.scorePercent == null ? "Chưa có điểm" : `${attempt.scorePercent}%`}
            </Typography>
          </CardContent>
        </Card>)}
        {detail?.activities.map((activity) => <Typography variant="body2" key={activity.mechanic}>
          {gameMechanicLabels[activity.mechanic as keyof typeof gameMechanicLabels] ?? "Hoạt động"}: {activity.correctFirstTry}/{activity.gradedExposures} đúng lần đầu,
          {" "}{activity.correctAfterRetry} đúng sau thử lại, {activity.reviewCorrect} đúng khi ôn lại
        </Typography>)}
        {detail?.words.map((word) => <Card variant="outlined" key={word.assignmentItemId}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
              <Box><Typography sx={{ fontWeight: 700 }}>{word.word}</Typography>
                <Typography variant="body2">{word.meaningVi}</Typography></Box>
              <Chip label={masteryLabel[word.mastery]} />
            </Stack>
            <Typography variant="caption">{word.evidence.reason}</Typography>
          </CardContent>
        </Card>)}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDetail(null)}>Đóng</Button></DialogActions>
    </Dialog>

    <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Tạo bài ôn nháp</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Alert severity="info">Bài mới chỉ được lưu nháp, không tự giao.</Alert>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Từ cần ôn</Typography>
          {(reviewWordCandidates.length ? reviewWordCandidates : words).map((word) => (
            <FormControlLabel key={word.assignmentItemId} control={<Checkbox
              checked={selectedWords.includes(word.assignmentItemId)}
              onChange={() => setSelectedWords((current) => current.includes(word.assignmentItemId)
                ? current.filter((id) => id !== word.assignmentItemId)
                : [...current, word.assignmentItemId])}
            />} label={`${word.word} — ${word.meaningVi}`} />
          ))}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Học sinh</Typography>
          {recipients.map((recipient) => <FormControlLabel key={recipient.recipientId}
            control={<Checkbox
              checked={selectedRecipients.includes(recipient.recipientId)}
              onChange={() => setSelectedRecipients((current) =>
                current.includes(recipient.recipientId)
                  ? current.filter((id) => id !== recipient.recipientId)
                  : [...current, recipient.recipientId])}
            />} label={recipient.studentName} />)}
        </Box>
      </Stack></DialogContent>
      <DialogActions>
        <Button onClick={() => setReviewOpen(false)}>Hủy</Button>
        <Button
          variant="contained"
          disabled={busy || !selectedWords.length || !selectedRecipients.length}
          onClick={() => void createReview()}
        >Tạo bài nháp</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
