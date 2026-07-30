import { Cancel, CheckCircle, Collections, Refresh, UploadFile } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import type {
  VocabularyMediaSearchItem,
  VocabularyMediaSearchResponse,
  VocabularySetItemInput,
  VocabularyStoredMedia,
} from "@teacher/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import {
  getVocabularyMediaStatus,
  importVocabularyMedia,
  searchVocabularyMedia,
  uploadVocabularyMedia,
} from "../../../api/vocabularyMedia";
import { startSingleWorkerBatch, type BatchRun } from "../bulkImageSuggestionScheduler";
import { vocabularyMediaCooldownSeconds, vocabularyMediaErrorMessage } from "../vocabularyMediaErrors";
import {
  buildVocabularyImageStrategy,
  type VocabularyImageFilter,
  type VocabularyImageStrategy,
} from "../vocabularyImageStrategy";
import { searchVocabularyImageSuggestions } from "../vocabularyImageSearch";

export type SuggestionStatus =
  | "SEARCH_PENDING"
  | "SEARCHING"
  | "FOUND"
  | "SELECTED"
  | "APPLYING"
  | "APPLIED"
  | "EMPTY"
  | "ERROR"
  | "SKIPPED";

interface Candidate {
  item: VocabularySetItemInput;
  index: number;
  strategy: VocabularyImageStrategy;
}

interface SuggestionState {
  status: SuggestionStatus;
  items: VocabularyMediaSearchItem[];
  error?: string;
  selectedAssetId?: string;
  selectedMedia?: VocabularyStoredMedia;
}

const BATCH_SIZE = 5;
const SEARCH_DELAY_MS = 1_000;
const PROVIDER_UNAVAILABLE_SECONDS = 30;

function providerUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === "IMAGE_PROVIDER_UNAVAILABLE";
}

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
    .map((item, index) => ({
      item,
      index,
      strategy: buildVocabularyImageStrategy(item.word, item.imageSearchTerms),
    }))
    .filter(({ item }) => item.illustration.kind === "NONE")).current;
  const remote = useRef(candidates.filter(({ strategy }) => !strategy.publicAsset)).current;
  const initialStates = useCallback(() => Object.fromEntries(candidates.map((candidate) => [
    candidate.index,
    {
      status: candidate.strategy.publicAsset ? "SELECTED" : "SEARCH_PENDING",
      items: [],
    } satisfies SuggestionState,
  ])), [candidates]);
  const [queries, setQueries] = useState<Record<number, string>>(() =>
    Object.fromEntries(candidates.map((candidate) => [candidate.index, candidate.strategy.query])));
  const [states, setStates] = useState<Record<number, SuggestionState>>(initialStates);
  const [mediaType, setMediaType] = useState<VocabularyImageFilter>("ILLUSTRATION");
  const [running, setRunning] = useState(false);
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState({ completed: 0, total: 0 });
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [providerInterrupted, setProviderInterrupted] = useState(false);
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
  const uploadLocks = useRef(new Set<number>());
  const editedQueries = useRef(new Set<number>());
  const searchCache = useRef(new Map<string, Promise<VocabularyMediaSearchResponse>>());

  const cachedSearch = useCallback((
    values: Parameters<typeof searchVocabularyMedia>[0],
    signal?: AbortSignal,
  ) => {
    const key = JSON.stringify(values);
    const cached = searchCache.current.get(key);
    if (cached) return cached;
    const request = searchVocabularyMedia(values, signal).catch((error) => {
      searchCache.current.delete(key);
      throw error;
    });
    searchCache.current.set(key, request);
    return request;
  }, []);

  const applyCooldown = useCallback((error: unknown) => {
    const seconds = vocabularyMediaCooldownSeconds(error);
    if (seconds === undefined) return false;
    setCooldownSeconds(seconds);
    setCooldownUntil(Date.now() + seconds * 1_000);
    return true;
  }, []);

  const selectSearchResult = useCallback((candidateIndex: number, result: VocabularyMediaSearchResponse) => {
    const resultItems = result.items.slice(0, 12);
    setStates((current) => ({
      ...current,
      [candidateIndex]: {
        ...current[candidateIndex],
        status: resultItems.length ? "SELECTED" : "EMPTY",
        items: resultItems,
        selectedAssetId: resultItems[0]?.providerAssetId,
        selectedMedia: undefined,
        error: undefined,
      },
    }));
  }, []);

  const startNextBatch = useCallback(() => {
    if (activeBatch.current || cooldownUntilRef.current > Date.now() || cursor.current >= remote.length) return;
    const batchItems = remote.slice(cursor.current, cursor.current + BATCH_SIZE);
    setAwaitingStart(false);
    setRunning(true);
    setProviderError("");
    setProviderInterrupted(false);
    const batch = startSingleWorkerBatch({
      items: batchItems,
      delayMs: SEARCH_DELAY_MS,
      beforeRun: async (signal) => {
        const status = await getVocabularyMediaStatus(signal);
        setProviderDisabled(!status.enabled);
        setPhotoEnabled(status.providers.some((provider) =>
          provider.provider === "PIXABAY" && provider.enabled));
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
        setStates((current) => ({
          ...current,
          [candidate.index]: {
            ...current[candidate.index],
            status: "SEARCHING",
            items: [],
            error: undefined,
            selectedAssetId: undefined,
            selectedMedia: undefined,
          },
        }));
        const result = await searchVocabularyImageSuggestions({
          strategy: candidate.strategy,
          query,
          mediaType: mediaTypeRef.current,
          page: 1,
          pageSize: 12,
          signal,
          allowFallback: !editedQueries.current.has(candidate.index) && query === candidate.strategy.query,
          search: cachedSearch,
        });
        if (signal.aborted || queriesRef.current[candidate.index] !== query) return;
        selectSearchResult(candidate.index, result);
        cursor.current += 1;
      },
      rateLimitSeconds: (error) => error instanceof ApiError && [
        "VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED",
      ].includes(error.code) ? Math.max(1, error.retryAfterSeconds ?? 60) : undefined,
      onCooldown: (seconds) => {
        setCooldownSeconds(seconds);
        setCooldownUntil(Date.now() + seconds * 1_000);
      },
      stopOnError: providerUnavailable,
      onError: (error, candidate) => {
        const message = vocabularyMediaErrorMessage(error, "Không thể gợi ý ảnh.");
        if (!candidate) {
          setProviderError(message);
          return;
        }
        const unavailable = providerUnavailable(error);
        const limited = error instanceof ApiError && [
          "VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED",
        ].includes(error.code);
        setStates((current) => ({
          ...current,
          [candidate.index]: {
            ...current[candidate.index],
            status: "ERROR",
            error: unavailable ? undefined : message,
          },
        }));
        if (unavailable) {
          const seconds = error instanceof ApiError
            ? Math.max(1, error.retryAfterSeconds ?? PROVIDER_UNAVAILABLE_SECONDS)
            : PROVIDER_UNAVAILABLE_SECONDS;
          setCooldownSeconds(seconds);
          setCooldownUntil(Date.now() + seconds * 1_000);
          setProviderInterrupted(true);
          setProviderError("Nguồn hình minh họa đang tạm gián đoạn. Các từ chưa tìm vẫn được giữ lại.");
          return;
        }
        if (!limited) cursor.current += 1;
        setProviderError(limited ? message : "");
      },
      onFinish: () => {
        activeBatch.current = null;
        setRunning(false);
      },
    });
    activeBatch.current = batch;
  }, [cachedSearch, remote, selectSearchResult]);

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
    if (cooldownUntil <= Date.now()) {
      setCooldownSeconds(0);
      return;
    }
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    update();
    const timer = globalThis.setInterval(update, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => () => {
    if (uploadDraft) URL.revokeObjectURL(uploadDraft.preview);
  }, [uploadDraft]);

  const changeMediaType = (next: VocabularyImageFilter) => {
    activeBatch.current?.cancel();
    activeBatch.current = null;
    candidateControllers.current.forEach((controller) => controller.abort());
    candidateControllers.current.clear();
    candidateLocks.current.clear();
    searchCache.current.clear();
    cursor.current = 0;
    mediaTypeRef.current = next;
    setMediaType(next);
    setRunning(false);
    setAwaitingStart(true);
    setProviderError("");
    setProviderInterrupted(false);
    setStates(initialStates());
  };

  const retryCandidate = async (candidate: Candidate) => {
    if (running || applying || candidateLocks.current.has(candidate.index) || cooldownUntilRef.current > Date.now()) return;
    candidateLocks.current.add(candidate.index);
    candidateControllers.current.get(candidate.index)?.abort();
    const controller = new AbortController();
    candidateControllers.current.set(candidate.index, controller);
    const query = queriesRef.current[candidate.index];
    setStates((current) => ({
      ...current,
      [candidate.index]: {
        ...current[candidate.index],
        status: "SEARCHING",
        items: [],
        error: undefined,
        selectedAssetId: undefined,
        selectedMedia: undefined,
      },
    }));
    try {
      const result = await searchVocabularyImageSuggestions({
        strategy: candidate.strategy,
        query,
        mediaType: mediaTypeRef.current,
        page: 1,
        pageSize: 12,
        signal: controller.signal,
        allowFallback: false,
        search: cachedSearch,
      });
      if (controller.signal.aborted || queriesRef.current[candidate.index] !== query) return;
      selectSearchResult(candidate.index, result);
    } catch (error) {
      if (controller.signal.aborted) return;
      applyCooldown(error);
      const unavailable = providerUnavailable(error);
      if (unavailable) {
        setProviderInterrupted(true);
        setProviderError("Nguồn hình minh họa đang tạm gián đoạn. Các từ chưa tìm vẫn được giữ lại.");
      }
      setStates((current) => ({
        ...current,
        [candidate.index]: {
          ...current[candidate.index],
          status: "ERROR",
          error: unavailable ? undefined : vocabularyMediaErrorMessage(error, "Không thể tìm lại ảnh."),
        },
      }));
    } finally {
      if (candidateControllers.current.get(candidate.index) === controller) {
        candidateLocks.current.delete(candidate.index);
        candidateControllers.current.delete(candidate.index);
      }
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
      const media = await uploadVocabularyMedia(
        uploadDraft.file,
        `${candidate.item.word} — ${candidate.item.meaningVi}`.slice(0, 200),
      );
      setStates((current) => ({
        ...current,
        [candidate.index]: {
          ...current[candidate.index],
          status: "SELECTED",
          selectedAssetId: undefined,
          selectedMedia: media,
          error: undefined,
        },
      }));
      URL.revokeObjectURL(uploadDraft.preview);
      setUploadDraft(null);
    } catch (error) {
      applyCooldown(error);
      setStates((current) => ({
        ...current,
        [candidate.index]: {
          ...current[candidate.index],
          status: "ERROR",
          error: vocabularyMediaErrorMessage(error, "Không thể tải ảnh lên."),
        },
      }));
    } finally {
      uploadLocks.current.delete(candidate.index);
      setImporting("");
    }
  };

  const skip = (candidate: Candidate) => {
    if (uploadDraft?.index === candidate.index) {
      URL.revokeObjectURL(uploadDraft.preview);
      setUploadDraft(null);
    }
    setStates((current) => ({
      ...current,
      [candidate.index]: {
        ...current[candidate.index],
        status: "SKIPPED",
        selectedAssetId: undefined,
        selectedMedia: undefined,
        error: undefined,
      },
    }));
  };

  const selectedCandidates = candidates.filter((candidate) => {
    const state = states[candidate.index];
    if (state.status === "APPLIED" || state.status === "APPLYING" || state.status === "SKIPPED") return false;
    return Boolean(candidate.strategy.publicAsset || state.selectedAssetId || state.selectedMedia);
  });

  const applySelections = async () => {
    if (!selectedCandidates.length || running || applying || importing) return;
    setApplying(true);
    setApplyProgress({ completed: 0, total: selectedCandidates.length });
    const importedByAsset = new Map<string, Promise<VocabularyStoredMedia>>();
    let failures = 0;
    let completed = 0;
    for (const candidate of selectedCandidates) {
      const state = states[candidate.index];
      setStates((current) => ({
        ...current,
        [candidate.index]: { ...current[candidate.index], status: "APPLYING", error: undefined },
      }));
      try {
        if (candidate.strategy.publicAsset) {
          onSelectLocal(candidate.index, candidate.strategy.publicAsset);
        } else if (state.selectedMedia) {
          onSelect(candidate.index, state.selectedMedia);
        } else {
          const result = state.items.find((item) => item.providerAssetId === state.selectedAssetId);
          if (!result) throw new Error("Ảnh đã chọn không còn khả dụng.");
          const dedupeKey = `${result.provider}:${result.providerAssetId}`;
          let request = importedByAsset.get(dedupeKey);
          if (!request) {
            request = importVocabularyMedia({
              provider: result.provider,
              providerAssetId: result.providerAssetId,
              altText: `${candidate.item.word} — ${candidate.item.meaningVi}`.slice(0, 200),
            });
            importedByAsset.set(dedupeKey, request);
          }
          onSelect(candidate.index, await request);
        }
        setStates((current) => ({
          ...current,
          [candidate.index]: { ...current[candidate.index], status: "APPLIED", error: undefined },
        }));
      } catch (error) {
        failures += 1;
        applyCooldown(error);
        setStates((current) => ({
          ...current,
          [candidate.index]: {
            ...current[candidate.index],
            status: "ERROR",
            error: vocabularyMediaErrorMessage(error, "Không thể áp dụng ảnh."),
          },
        }));
      } finally {
        completed += 1;
        setApplyProgress({ completed, total: selectedCandidates.length });
      }
    }
    setApplying(false);
    if (failures === 0) onClose();
  };

  const close = () => {
    if (applying) return;
    activeBatch.current?.cancel();
    activeBatch.current = null;
    candidateControllers.current.forEach((controller) => controller.abort());
    candidateControllers.current.clear();
    if (uploadDraft) URL.revokeObjectURL(uploadDraft.preview);
    onClose();
  };

  const processed = candidates.filter((candidate) => candidate.strategy.publicAsset || ![
    "SEARCH_PENDING", "SEARCHING",
  ].includes(states[candidate.index].status)).length;
  const found = candidates.filter((candidate) =>
    Boolean(candidate.strategy.publicAsset || states[candidate.index].items.length)).length;
  const selected = candidates.filter((candidate) => {
    const state = states[candidate.index];
    return state.status !== "SKIPPED" && Boolean(
      candidate.strategy.publicAsset || state.selectedAssetId || state.selectedMedia,
    );
  }).length;
  const applied = Object.values(states).filter((state) => state.status === "APPLIED").length;
  const errors = Object.values(states).filter((state) => state.status === "ERROR").length;
  const processing = Object.values(states).filter((state) => state.status === "SEARCHING").length;
  const busy = applying || running || processing > 0 || Boolean(importing);
  const startLabel = providerInterrupted
    ? "Thử tiếp"
    : cursor.current === 0
      ? mediaType === "PHOTO" ? "Bắt đầu tìm ảnh thật" : "Tìm batch đầu"
      : "Tìm tiếp";
  const applyErrors = selectedCandidates.filter((candidate) => states[candidate.index].status === "ERROR").length;
  const applyLabel = applyErrors > 0
    ? `Thử lại ${applyErrors} ảnh lỗi`
    : `Áp dụng ${selectedCandidates.length} ảnh`;

  return <Dialog
    open={open}
    onClose={() => { if (!applying) close(); }}
    fullScreen={fullScreen}
    fullWidth
    maxWidth="lg"
    data-testid="vocabulary-bulk-image-suggestions"
  >
    <DialogTitle>Gợi ý ảnh cho tất cả</DialogTitle>
    <DialogContent dividers sx={{ overflowX: "hidden" }}><Stack spacing={2}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 180px" }, gap: 1 }}>
        <Box>
          <Typography variant="body2">Tìm thấy: {found}/{candidates.length} · Đã chọn: {selected}/{candidates.length} · Đã áp dụng: {applied}/{candidates.length} · Lỗi: {errors}</Typography>
          <Typography variant="caption" color="text.secondary">Mỗi batch tối đa {BATCH_SIZE} từ.</Typography>
          <LinearProgress variant="determinate" value={candidates.length ? processed / candidates.length * 100 : 0} />
        </Box>
        <TextField select size="small" label="Loại ảnh" value={mediaType} disabled={busy}
          onChange={(event) => changeMediaType(event.target.value as VocabularyImageFilter)}>
          <MenuItem value="ILLUSTRATION">Minh họa</MenuItem>
          {photoEnabled && <MenuItem value="PHOTO">Ảnh thật</MenuItem>}
        </TextField>
      </Box>
      {applying && <Alert severity="info">Đang áp dụng {applyProgress.completed}/{applyProgress.total} ảnh.</Alert>}
      {cooldownSeconds > 0 && <Alert severity="warning">Có thể thử tiếp lúc {new Date(cooldownUntil).toLocaleTimeString("vi-VN")} ({cooldownSeconds} giây). Bạn vẫn có thể tải ảnh từ máy.</Alert>}
      {providerDisabled && <Alert severity="info">Nguồn hình minh họa đang tắt. Bạn vẫn có thể tải ảnh từ máy.</Alert>}
      {providerError && <Alert severity="warning">{providerError}</Alert>}
      {candidates.map((candidate) => {
        const state = states[candidate.index];
        const local = candidate.strategy.publicAsset;
        return <Box key={candidate.index} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
            <Box>
              <Typography variant="subtitle2">{candidate.item.word}</Typography>
              <Typography variant="body2" color="text.secondary">{candidate.item.meaningVi}</Typography>
            </Box>
            <Button size="small" startIcon={<Cancel />} disabled={applying || state.status === "APPLIED"}
              onClick={() => skip(candidate)}>Bỏ qua</Button>
          </Stack>
          {local && <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
            <Box component="img" src={local} alt={candidate.item.word} sx={{ width: 120, maxWidth: "100%" }} />
            <Typography color="success.main" variant="body2"><CheckCircle sx={{ fontSize: 16, verticalAlign: "text-bottom" }} /> {state.status === "APPLIED" ? "Đã áp dụng" : state.status === "SKIPPED" ? "Đã bỏ qua" : "Đã chọn"}</Typography>
          </Stack>}
          {!local && <Stack spacing={1}>
            <TextField size="small" label="Từ khóa" value={queries[candidate.index]} disabled={applying}
              onChange={(event) => {
                editedQueries.current.add(candidate.index);
                setQueries((current) => ({ ...current, [candidate.index]: event.target.value }));
              }} />
            {state.status === "SEARCH_PENDING" && <Typography color="text.secondary">Chưa tìm</Typography>}
            {state.status === "SEARCHING" && <Typography><CircularProgress size={16} /> Đang tìm…</Typography>}
            {state.status === "EMPTY" && <Typography color="text.secondary">Không có ảnh phù hợp.</Typography>}
            {state.error && <Alert severity="warning">{state.error}</Alert>}
            {state.status === "APPLIED" && <Alert icon={<CheckCircle />} severity="success">Ảnh đã được áp dụng.</Alert>}
            {state.status === "SELECTED" && (state.selectedAssetId || state.selectedMedia) && <Typography color="success.main" variant="body2">Đã chọn</Typography>}
            {state.items.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(6,minmax(0,1fr))" }, gap: 1 }}>
              {state.items.map((item) => <Button key={item.providerAssetId}
                aria-label={`Chọn ảnh ${candidate.item.word} ${item.providerAssetId}`}
                disabled={applying || state.status === "APPLIED"}
                onClick={() => setStates((current) => ({
                  ...current,
                  [candidate.index]: {
                    ...current[candidate.index],
                    status: "SELECTED",
                    selectedAssetId: item.providerAssetId,
                    selectedMedia: undefined,
                    error: undefined,
                  },
                }))}
                sx={{ p: 0, minWidth: 0, border: state.selectedAssetId === item.providerAssetId ? 3 : 1 }}>
                <Box component="img" src={item.thumbnailUrl} alt={candidate.item.word}
                  sx={{ width: "100%", aspectRatio: "1", objectFit: item.provider === "ARASAAC" ? "contain" : "cover", bgcolor: item.provider === "ARASAAC" ? "grey.50" : undefined }} />
              </Button>)}
            </Box>}
            <Button component="label" variant="outlined" startIcon={<UploadFile />} disabled={applying || state.status === "APPLIED"}>Tải ảnh từ máy
              <input hidden type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectFile(candidate.index, event.target.files?.[0])} />
            </Button>
            {uploadDraft?.index === candidate.index && <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Box component="img" src={uploadDraft.preview} alt="Xem trước ảnh tải lên"
                sx={{ width: 96, height: 96, objectFit: "cover" }} />
              <Button variant="contained" disabled={uploadLocks.current.has(candidate.index)} onClick={() => void upload(candidate)}>
                {importing === `upload-${candidate.index}` ? "Đang tải…" : "Chọn ảnh tải lên"}
              </Button>
            </Stack>}
            <Button variant="text" startIcon={<Refresh />}
              disabled={running || applying || candidateLocks.current.has(candidate.index) || cooldownSeconds > 0 || queries[candidate.index].trim().length < 2 || state.status === "APPLIED"}
              onClick={() => void retryCandidate(candidate)}>Tìm lại</Button>
          </Stack>}
        </Box>;
      })}
      {(awaitingStart || cursor.current < remote.length) && <Button variant="outlined"
        disabled={busy || cooldownSeconds > 0 || providerDisabled} onClick={startNextBatch}>{startLabel}</Button>}
      {Object.values(states).some((state) => state.items.some((item) => item.provider === "ARASAAC")) && <Typography variant="caption" color="text.secondary">Pictogram: Sergio Palao / ARASAAC · Government of Aragón · CC BY-NC-SA.</Typography>}
    </Stack></DialogContent>
    <DialogActions sx={{ flexWrap: "wrap" }}>
      <Button onClick={close} disabled={applying}>Hủy</Button>
      <Button variant="contained" startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <Collections />}
        disabled={!selectedCandidates.length || busy} onClick={() => void applySelections()}>
        {applying ? `Đang áp dụng ${applyProgress.completed}/${applyProgress.total} ảnh` : applyLabel}
      </Button>
    </DialogActions>
  </Dialog>;
}
