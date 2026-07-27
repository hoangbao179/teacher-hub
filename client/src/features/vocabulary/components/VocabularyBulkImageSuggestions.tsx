import { Cancel, Collections, Refresh, UploadFile } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import type { VocabularyMediaSearchItem, VocabularySetItemInput, VocabularyStoredMedia } from "@teacher/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import { getVocabularyMediaStatus, importVocabularyMedia, uploadVocabularyMedia } from "../../../api/vocabularyMedia";
import { startSingleWorkerBatch, type BatchRun } from "../bulkImageSuggestionScheduler";
import { vocabularyMediaCooldownSeconds, vocabularyMediaErrorMessage } from "../vocabularyMediaErrors";
import { buildVocabularyImageStrategy, type VocabularyImageFilter, type VocabularyImageStrategy } from "../vocabularyImageStrategy";
import { searchVocabularyImageSuggestions } from "../vocabularyImageSearch";

export type SuggestionStatus = "PENDING" | "SEARCHING" | "FOUND" | "EMPTY" | "RATE_LIMITED" | "ERROR" | "SKIPPED";
interface Candidate { item: VocabularySetItemInput; index: number; strategy: VocabularyImageStrategy }
interface SuggestionState {
  status: SuggestionStatus;
  items: VocabularyMediaSearchItem[];
  error?: string;
  selectedAssetId?: string;
  confirmedAssetId?: string;
}
const BATCH_SIZE = 8;

export function VocabularyBulkImageSuggestions({ open, items, onClose, onSelect, onSelectLocal }: {
  open: boolean;
  items: VocabularySetItemInput[];
  onClose: () => void;
  onSelect: (index: number, media: VocabularyStoredMedia) => void;
  onSelectLocal: (index: number, publicAsset: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const candidates = useRef<Candidate[]>(items
    .map((item, index) => ({ item, index, strategy: buildVocabularyImageStrategy(item.word, item.imageSearchTerms) }))
    .filter(({ item }) => item.illustration.kind === "NONE")).current;
  const remote = useRef(candidates.filter(({ strategy }) => !strategy.publicAsset)).current;
  const initialStates = useCallback(() => Object.fromEntries(candidates.map((candidate) => [
    candidate.index,
    { status: candidate.strategy.publicAsset ? "FOUND" : "PENDING", items: [] } satisfies SuggestionState,
  ])), [candidates]);
  const [queries, setQueries] = useState<Record<number, string>>(() =>
    Object.fromEntries(candidates.map((candidate) => [candidate.index, candidate.strategy.query])));
  const [states, setStates] = useState<Record<number, SuggestionState>>(initialStates);
  const [mediaType, setMediaType] = useState<VocabularyImageFilter>("ILLUSTRATION");
  const [running, setRunning] = useState(false);
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [importing, setImporting] = useState("");
  const [uploadDraft, setUploadDraft] = useState<{ index: number; file: File; preview: string } | null>(null);

  const queriesRef = useRef(queries); queriesRef.current = queries;
  const mediaTypeRef = useRef(mediaType); mediaTypeRef.current = mediaType;
  const cooldownUntilRef = useRef(cooldownUntil); cooldownUntilRef.current = cooldownUntil;
  const cursor = useRef(0);
  const activeBatch = useRef<BatchRun | null>(null);
  const candidateLocks = useRef(new Set<number>());
  const candidateControllers = useRef(new Map<number, AbortController>());
  const importLocks = useRef(new Set<number>());
  const uploadLocks = useRef(new Set<number>());
  const editedQueries = useRef(new Set<number>());

  const applyCooldown = (error: unknown) => {
    const seconds = vocabularyMediaCooldownSeconds(error);
    if (seconds === undefined) return false;
    setCooldownSeconds(seconds);
    setCooldownUntil(Date.now() + seconds * 1_000);
    return true;
  };

  const startNextBatch = useCallback(() => {
    if (activeBatch.current || cooldownUntilRef.current > Date.now() || cursor.current >= remote.length) return;
    const batchItems = remote.slice(cursor.current, cursor.current + BATCH_SIZE);
    setAwaitingStart(false);
    setRunning(true);
    const batch = startSingleWorkerBatch({
      items: batchItems,
      delayMs: 500,
      beforeRun: async (signal) => {
        const status = await getVocabularyMediaStatus(signal);
        setProviderDisabled(!status.enabled);
        if (status.cooldownUntil && Date.parse(status.cooldownUntil) > Date.now()) {
          const until = Date.parse(status.cooldownUntil);
          setCooldownUntil(until);
          setCooldownSeconds(Math.max(1, Math.ceil((until - Date.now()) / 1_000)));
          return false;
        }
        return status.enabled;
      },
      runItem: async (candidate, signal) => {
        const query = queriesRef.current[candidate.index];
        setStates((current) => ({ ...current, [candidate.index]: {
          ...current[candidate.index], status: "SEARCHING", items: [], error: undefined,
          selectedAssetId: undefined, confirmedAssetId: undefined,
        } }));
        const result = await searchVocabularyImageSuggestions({
          strategy: candidate.strategy,
          query,
          mediaType: mediaTypeRef.current,
          page: 1,
          pageSize: 12,
          signal,
          allowFallback: !editedQueries.current.has(candidate.index) && query === candidate.strategy.query,
        });
        if (signal.aborted || queriesRef.current[candidate.index] !== query) return;
        setStates((current) => ({ ...current, [candidate.index]: {
          ...current[candidate.index], status: result.items.length ? "FOUND" : "EMPTY",
          items: result.items.slice(0, 12), error: undefined,
        } }));
        cursor.current += 1;
      },
      rateLimitSeconds: (error) => error instanceof ApiError && [
        "VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED",
      ].includes(error.code) ? Math.max(1, error.retryAfterSeconds ?? 60) : undefined,
      onCooldown: (seconds) => {
        setCooldownSeconds(seconds);
        setCooldownUntil(Date.now() + seconds * 1_000);
      },
      onError: (error, candidate) => {
        const message = vocabularyMediaErrorMessage(error, "Không thể gợi ý ảnh.");
        if (!candidate) { setProviderError(message); return; }
        const limited = error instanceof ApiError && [
          "VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED",
        ].includes(error.code);
        setStates((current) => ({ ...current, [candidate.index]: {
          ...current[candidate.index], status: limited ? "RATE_LIMITED" : "ERROR", error: message,
        } }));
        if (!limited) cursor.current += 1;
        setProviderError(limited ? message : "");
      },
      onFinish: () => { activeBatch.current = null; setRunning(false); },
    });
    activeBatch.current = batch;
  }, [remote]);

  useEffect(() => {
    const controllers = candidateControllers.current;
    if (!open) {
      activeBatch.current?.cancel();
      activeBatch.current = null;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      return;
    }
    startNextBatch();
    return () => {
      activeBatch.current?.cancel();
      activeBatch.current = null;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, [open, startNextBatch]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) { setCooldownSeconds(0); return; }
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    update();
    const timer = globalThis.setInterval(update, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [cooldownUntil]);

  const changeMediaType = (next: VocabularyImageFilter) => {
    activeBatch.current?.cancel();
    activeBatch.current = null;
    candidateControllers.current.forEach((controller) => controller.abort());
    candidateControllers.current.clear();
    candidateLocks.current.clear();
    cursor.current = 0;
    mediaTypeRef.current = next;
    setMediaType(next);
    setRunning(false);
    setAwaitingStart(true);
    setProviderError("");
    setStates(initialStates());
  };

  const retryCandidate = async (candidate: Candidate) => {
    if (running || candidateLocks.current.has(candidate.index) || cooldownUntilRef.current > Date.now()) return;
    candidateLocks.current.add(candidate.index);
    candidateControllers.current.get(candidate.index)?.abort();
    const controller = new AbortController();
    candidateControllers.current.set(candidate.index, controller);
    const query = queriesRef.current[candidate.index];
    setStates((current) => ({ ...current, [candidate.index]: {
      ...current[candidate.index], status: "SEARCHING", items: [], error: undefined,
      selectedAssetId: undefined, confirmedAssetId: undefined,
    } }));
    try {
      const result = await searchVocabularyImageSuggestions({
        strategy: candidate.strategy, query, mediaType: mediaTypeRef.current,
        page: 1, pageSize: 12, signal: controller.signal, allowFallback: false,
      });
      if (controller.signal.aborted || queriesRef.current[candidate.index] !== query) return;
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index], status: result.items.length ? "FOUND" : "EMPTY",
        items: result.items.slice(0, 12), error: undefined,
      } }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const limited = applyCooldown(error);
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index], status: limited ? "RATE_LIMITED" : "ERROR",
        error: vocabularyMediaErrorMessage(error, "Không thể tìm lại ảnh."),
      } }));
    } finally {
      if (candidateControllers.current.get(candidate.index) === controller) {
        candidateLocks.current.delete(candidate.index);
        candidateControllers.current.delete(candidate.index);
      }
    }
  };

  const choose = async (candidate: Candidate) => {
    const state = states[candidate.index];
    const result = state.items.find((item) => item.providerAssetId === state.selectedAssetId);
    if (!result || importLocks.current.has(candidate.index)) return;
    importLocks.current.add(candidate.index);
    setImporting(`${candidate.index}-${result.providerAssetId}`);
    try {
      const media = await importVocabularyMedia({
        provider: result.provider, providerAssetId: result.providerAssetId,
        altText: `${candidate.item.word} — ${candidate.item.meaningVi}`.slice(0, 200),
      });
      onSelect(candidate.index, media);
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index], confirmedAssetId: result.providerAssetId, error: undefined,
      } }));
    } catch (error) {
      applyCooldown(error);
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index],
        error: vocabularyMediaErrorMessage(error, "Không thể lưu ảnh."),
      } }));
    } finally {
      importLocks.current.delete(candidate.index);
      setImporting("");
    }
  };

  const selectFile = (index: number, file?: File) => {
    if (!file) return;
    if (uploadDraft) URL.revokeObjectURL(uploadDraft.preview);
    setUploadDraft({ index, file, preview: URL.createObjectURL(file) });
  };
  const upload = async (candidate: Candidate) => {
    if (!uploadDraft || uploadDraft.index !== candidate.index || uploadLocks.current.has(candidate.index)) return;
    uploadLocks.current.add(candidate.index);
    setImporting(`upload-${candidate.index}`);
    try {
      const media = await uploadVocabularyMedia(uploadDraft.file,
        `${candidate.item.word} — ${candidate.item.meaningVi}`.slice(0, 200));
      onSelect(candidate.index, media);
      URL.revokeObjectURL(uploadDraft.preview);
      setUploadDraft(null);
    } catch (error) {
      applyCooldown(error);
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index], error: vocabularyMediaErrorMessage(error, "Không thể tải ảnh lên."),
      } }));
    } finally {
      uploadLocks.current.delete(candidate.index);
      setImporting("");
    }
  };
  const close = () => { activeBatch.current?.cancel(); activeBatch.current = null; onClose(); };

  const completed = Object.values(states).filter((state) =>
    ["FOUND", "EMPTY", "ERROR", "SKIPPED"].includes(state.status)).length;
  const processing = Object.values(states).filter((state) => state.status === "SEARCHING").length;
  const startLabel = cursor.current === 0
    ? mediaType === "PHOTO" ? "Bắt đầu tìm ảnh thật" : "Tìm batch đầu"
    : states[remote[cursor.current]?.index]?.status === "RATE_LIMITED"
      ? "Tiếp tục tìm các từ còn lại" : "Tìm tiếp";

  return <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="lg"
    data-testid="vocabulary-bulk-image-suggestions">
    <DialogTitle>Gợi ý ảnh cho tất cả</DialogTitle>
    <DialogContent dividers sx={{ overflowX: "hidden" }}><Stack spacing={2}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 180px" }, gap: 1 }}>
        <Box><Typography variant="body2">{completed}/{candidates.length} từ đã xử lý · {processing} từ đang xử lý · batch tối đa 8 từ</Typography>
          <LinearProgress variant="determinate" value={candidates.length ? completed / candidates.length * 100 : 0} /></Box>
        <TextField select size="small" label="Loại ảnh" value={mediaType}
          onChange={(event) => changeMediaType(event.target.value as VocabularyImageFilter)}>
          <MenuItem value="ILLUSTRATION">Minh họa</MenuItem><MenuItem value="PHOTO">Ảnh thật</MenuItem>
        </TextField>
      </Box>
      {cooldownSeconds > 0 && <Alert severity="warning">Có thể tiếp tục lúc {new Date(cooldownUntil).toLocaleTimeString("vi-VN")} ({cooldownSeconds} giây). Bạn vẫn có thể tải ảnh từ máy.</Alert>}
      {providerDisabled && <Alert severity="info">Pixabay đang tắt. Bạn vẫn có thể tải ảnh từ máy.</Alert>}
      {providerError && <Alert severity="warning">{providerError}</Alert>}
      {candidates.map((candidate) => {
        const state = states[candidate.index];
        const local = candidate.strategy.publicAsset;
        return <Box key={candidate.index} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}><Box><Typography variant="subtitle2">{candidate.item.word}</Typography><Typography variant="body2" color="text.secondary">{candidate.item.meaningVi}</Typography></Box>
            <Button size="small" startIcon={<Cancel />} onClick={() => setStates((current) => ({ ...current, [candidate.index]: { ...state, status: "SKIPPED" } }))}>Bỏ qua</Button></Stack>
          {local && <Button onClick={() => { onSelectLocal(candidate.index, local); setStates((current) => ({ ...current, [candidate.index]: { ...state, status: "SKIPPED" } })); }}><Box component="img" src={local} alt={candidate.item.word} sx={{ width: 120 }} /></Button>}
          {!local && <Stack spacing={1}>
            <TextField size="small" label="Từ khóa" value={queries[candidate.index]}
              onChange={(event) => {
                editedQueries.current.add(candidate.index);
                setQueries((current) => ({ ...current, [candidate.index]: event.target.value }));
              }} />
            {state.status === "PENDING" && <Typography color="text.secondary">Chưa tìm</Typography>}
            {state.status === "SEARCHING" && <Typography><CircularProgress size={16} /> Đang tìm…</Typography>}
            {state.status === "EMPTY" && <Typography color="text.secondary">Không có ảnh phù hợp.</Typography>}
            {state.error && <Alert severity="warning">{state.error}</Alert>}
            {state.items.length > 0 && <><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(6,1fr)" }, gap: 1 }}>
              {state.items.map((item) => <Button key={item.providerAssetId}
                onClick={() => setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], selectedAssetId: item.providerAssetId } }))}
                sx={{ p: 0, border: state.selectedAssetId === item.providerAssetId ? 3 : 1 }}>
                <Box component="img" src={item.thumbnailUrl} alt={candidate.item.word} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              </Button>)}</Box>
              <Button variant="contained" disabled={!state.selectedAssetId || importLocks.current.has(candidate.index)}
                onClick={() => void choose(candidate)}>
                {importing.startsWith(`${candidate.index}-`) ? "Đang nhập…" : "Chọn ảnh"}
              </Button></>}
            <Button component="label" variant="outlined" startIcon={<UploadFile />}>Tải ảnh từ máy
              <input hidden type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectFile(candidate.index, event.target.files?.[0])} />
            </Button>
            {uploadDraft?.index === candidate.index && <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
              <Box component="img" src={uploadDraft.preview} alt="Xem trước ảnh tải lên"
                sx={{ width: 96, height: 96, objectFit: "cover" }} />
              <Button variant="contained" disabled={uploadLocks.current.has(candidate.index)} onClick={() => void upload(candidate)}>
                {importing === `upload-${candidate.index}` ? "Đang tải…" : "Dùng ảnh này"}
              </Button></Stack>}
            <Button variant="text" startIcon={<Refresh />}
              disabled={running || candidateLocks.current.has(candidate.index) || cooldownSeconds > 0 || queries[candidate.index].trim().length < 2}
              onClick={() => void retryCandidate(candidate)}>Tìm lại</Button>
          </Stack>}
        </Box>;
      })}
      {(awaitingStart || cursor.current < remote.length) && <Button variant="outlined"
        disabled={running || cooldownSeconds > 0 || providerDisabled} onClick={startNextBatch}>{startLabel}</Button>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={close}>Hủy</Button><Button variant="contained" startIcon={<Collections />} onClick={close}>Xong</Button></DialogActions>
  </Dialog>;
}
