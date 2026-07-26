import { Cancel, Collections, Refresh } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import type { VocabularyMediaSearchItem, VocabularySetItemInput, VocabularyStoredMedia } from "@teacher/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import { getVocabularyMediaStatus, importVocabularyMedia } from "../../../api/vocabularyMedia";
import { startSingleWorkerBatch, type BatchRun } from "../bulkImageSuggestionScheduler";
import { buildVocabularyImageStrategy, type VocabularyImageFilter, type VocabularyImageStrategy } from "../vocabularyImageStrategy";
import {
  appendUniqueVocabularyImages,
  VOCABULARY_IMAGE_LIMIT,
  VOCABULARY_IMAGE_PAGE_SIZE,
} from "../vocabularyImagePagination";
import { searchVocabularyImageSuggestions } from "../vocabularyImageSearch";

interface Candidate { item: VocabularySetItemInput; index: number; strategy: VocabularyImageStrategy }
interface SuggestionState {
  loading: boolean;
  loadingMore?: boolean;
  skipped?: boolean;
  error?: string;
  items: VocabularyMediaSearchItem[];
  page: number;
  total: number;
  selectedAssetId?: string;
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
  const candidates = useRef<Candidate[]>(items.map((item, index) => ({ item, index, strategy: buildVocabularyImageStrategy(item.word, item.imageSearchTerms) })).filter(({ item }) => item.illustration.kind === "NONE")).current;
  const remoteCandidates = useRef(candidates.filter(({ strategy }) => !strategy.publicAsset)).current;
  const [queries, setQueries] = useState<Record<number, string>>(() => Object.fromEntries(candidates.map(({ index, strategy }) => [index, strategy.query])));
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  const [states, setStates] = useState<Record<number, SuggestionState>>(() => Object.fromEntries(candidates.map(({ index, strategy }) => [index, { loading: !strategy.publicAsset, items: [], page: 0, total: 0 }])));
  const [mediaType, setMediaType] = useState<VocabularyImageFilter>("ILLUSTRATION");
  const mediaTypeRef = useRef(mediaType);
  mediaTypeRef.current = mediaType;
  const [importing, setImporting] = useState("");
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const activeBatch = useRef<BatchRun | null>(null);

  const startBatch = useCallback((batchItems: Candidate[], queryValues: Record<number, string>): BatchRun => {
    activeBatch.current?.cancel();
    setProviderError("");
    const batch = startSingleWorkerBatch({
      items: batchItems,
      delayMs: 800,
      beforeRun: async (signal, runId) => {
        const status = await getVocabularyMediaStatus(signal);
        if (signal.aborted || activeBatch.current?.runId !== runId) return false;
        setProviderDisabled(!status.enabled);
        return status.enabled;
      },
      runItem: async (candidate, signal, runId) => {
        if (activeBatch.current?.runId !== runId) return;
        const requestedQuery = queryValues[candidate.index];
        if (queriesRef.current[candidate.index] !== requestedQuery) return;
        setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: true, error: undefined } }));
        const result = await searchVocabularyImageSuggestions({ strategy: candidate.strategy, query: requestedQuery, mediaType, page: 1, pageSize: VOCABULARY_IMAGE_PAGE_SIZE, signal });
        if (signal.aborted || activeBatch.current?.runId !== runId) return;
        if (queriesRef.current[candidate.index] !== requestedQuery) return;
        setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: false, error: undefined, items: result.items.slice(0, VOCABULARY_IMAGE_LIMIT), page: 1, total: result.total } }));
      },
      rateLimitSeconds: (error) => error instanceof ApiError && ["VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED"].includes(error.code) ? Math.max(1, error.retryAfterSeconds ?? 60) : undefined,
      stopOnError: (error) => error instanceof ApiError && error.code === "VOCABULARY_SEARCH_RATE_LIMITED",
      onCooldown: (seconds, runId) => {
        if (activeBatch.current?.runId !== runId) return;
        setCooldownSeconds(seconds);
        setCooldownUntil(Date.now() + seconds * 1_000);
      },
      onError: (error, candidate, runId) => {
        if (activeBatch.current?.runId !== runId) return;
        const message = error instanceof Error ? error.message : "Không thể gợi ý ảnh.";
        if (error instanceof ApiError && ["VOCABULARY_SEARCH_RATE_LIMITED", "IMAGE_PROVIDER_RATE_LIMITED"].includes(error.code)) setProviderError(message);
        else if (candidate) setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: false, error: message } }));
        else setProviderError(message);
      },
      onFinish: (runId) => {
        if (activeBatch.current?.runId !== runId) return;
        setStates((current) => ({ ...current, ...Object.fromEntries(batchItems.map(({ index }) => [index, { ...current[index], loading: false }])) }));
      },
    });
    activeBatch.current = batch;
    return batch;
  }, [mediaType]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    const timer = globalThis.setInterval(update, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!open || remoteCandidates.length === 0) return;
    const batch = startBatch(remoteCandidates, queriesRef.current);
    return () => batch.cancel();
  }, [mediaType, open, remoteCandidates, startBatch]);

  const completed = Object.values(states).filter((value) => !value.loading).length;
  const select = async (index: number, result: VocabularyMediaSearchItem) => {
    const item = items[index];
    setImporting(`${index}-${result.providerAssetId}`);
    try {
      const media = await importVocabularyMedia({ provider: result.provider, providerAssetId: result.providerAssetId, altText: `${item.word} — ${item.meaningVi}`.slice(0, 200) });
      onSelect(index, media);
      setStates((current) => ({ ...current, [index]: { ...current[index], selectedAssetId: result.providerAssetId } }));
    } catch (value) {
      setStates((current) => ({ ...current, [index]: { ...current[index], error: value instanceof Error ? value.message : "Không thể lưu ảnh." } }));
    } finally { setImporting(""); }
  };
  const selectLocal = (candidate: Candidate) => {
    if (!candidate.strategy.publicAsset) return;
    onSelectLocal(candidate.index, candidate.strategy.publicAsset);
    setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], skipped: true } }));
  };
  const changeQuery = (index: number, value: string) => {
    setQueries((current) => ({ ...current, [index]: value }));
    setStates((current) => ({
      ...current,
      [index]: { ...current[index], loading: false, loadingMore: false, error: undefined, items: [], page: 0, total: 0 },
    }));
  };
  const changeMediaType = (value: VocabularyImageFilter) => {
    setStates((current) => Object.fromEntries(Object.entries(current).map(([index, state]) => [index, {
      ...state, loading: !candidates.find((candidate) => candidate.index === Number(index))?.strategy.publicAsset,
      loadingMore: false, error: undefined, items: [], page: 0, total: 0,
    }])));
    setMediaType(value);
  };
  const searchAgain = (candidate: Candidate) => {
    setStates((current) => ({
      ...current,
      [candidate.index]: { ...current[candidate.index], loading: true, loadingMore: false, error: undefined, items: [], page: 0, total: 0 },
    }));
    void startBatch([candidate], queries).done;
  };
  const loadMore = async (candidate: Candidate) => {
    const currentState = states[candidate.index];
    if (!currentState || currentState.loadingMore || cooldownSeconds > 0 || currentState.page >= 3) return;
    const nextPage = currentState.page + 1;
    const requestedQuery = queries[candidate.index];
    const requestedMediaType = mediaType;
    setProviderError("");
    setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loadingMore: true, error: undefined } }));
    try {
      const result = await searchVocabularyImageSuggestions({
        strategy: candidate.strategy,
        query: requestedQuery,
        mediaType: requestedMediaType,
        page: nextPage,
        pageSize: VOCABULARY_IMAGE_PAGE_SIZE,
      });
      if (queriesRef.current[candidate.index] !== requestedQuery || mediaTypeRef.current !== requestedMediaType) return;
      setStates((current) => ({ ...current, [candidate.index]: {
        ...current[candidate.index], loadingMore: false, items: appendUniqueVocabularyImages(current[candidate.index].items, result.items), page: nextPage, total: result.total,
      } }));
    } catch (value) {
      const message = value instanceof Error ? value.message : "Không thể gợi ý ảnh.";
      if (value instanceof ApiError && value.status === 429) {
        const seconds = Math.max(1, value.retryAfterSeconds ?? 60);
        setCooldownSeconds(seconds);
        setCooldownUntil(Date.now() + seconds * 1_000);
        setProviderError(message);
      }
      setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loadingMore: false, error: message } }));
    }
  };
  const close = () => { activeBatch.current?.cancel(); onClose(); };

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="lg" data-testid="vocabulary-bulk-image-suggestions">
      <DialogTitle>Gợi ý ảnh cho tất cả</DialogTitle>
      <DialogContent dividers sx={{ overflowX: "hidden" }}><Stack spacing={2} sx={{ minWidth: 0 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) 180px" }, gap: 1, alignItems: "center" }}>
          <Box><Typography variant="body2">{completed}/{candidates.length} từ đã tìm xong · tối đa 1 yêu cầu đồng thời</Typography><LinearProgress variant={candidates.length ? "determinate" : "indeterminate"} value={candidates.length ? completed / candidates.length * 100 : 0} sx={{ mt: 0.75 }} /></Box>
          <TextField select size="small" label="Loại ảnh" value={mediaType} disabled={cooldownSeconds > 0} onChange={(event) => changeMediaType(event.target.value as VocabularyImageFilter)}><MenuItem value="ILLUSTRATION">Minh họa</MenuItem><MenuItem value="PHOTO">Ảnh thật</MenuItem></TextField>
        </Box>
        {cooldownSeconds > 0 && <Alert severity="warning" aria-live="polite">Nguồn ảnh đang giới hạn tần suất. Có thể thử lại lúc {new Date(cooldownUntil).toLocaleTimeString("vi-VN")} ({cooldownSeconds} giây).</Alert>}
        {providerDisabled && <Alert severity="info">Pixabay đang tắt. Ảnh màu và thẻ số local vẫn dùng được.</Alert>}
        {providerError && <Alert severity="warning">{providerError}</Alert>}
        {candidates.length === 0 && <Alert severity="info">Mọi từ đã có hình. Bỏ hình ở từ cần thay rồi chạy gợi ý lại.</Alert>}
        {candidates.map((candidate) => {
          const { item, index, strategy } = candidate;
          const state = states[index] ?? { loading: true, items: [], page: 0, total: 0 };
          const local = strategy.publicAsset;
          return <Box key={`${item.word}-${index}`} sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, opacity: state.skipped ? 0.55 : 1 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 1 }}><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2">{item.word}</Typography><Typography variant="body2" color="text.secondary">{item.meaningVi}</Typography></Box><Button size="small" startIcon={<Cancel />} onClick={() => setStates((current) => ({ ...current, [index]: { ...state, skipped: true } }))}>Bỏ qua</Button></Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" }, gap: 1, mb: 1 }}><TextField size="small" label="Từ khóa" value={queries[index]} disabled={Boolean(local)} onChange={(event) => changeQuery(index, event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} /><Button variant="outlined" startIcon={<Refresh />} disabled={Boolean(local) || state.loading || providerDisabled || cooldownSeconds > 0 || queries[index].trim().length < 2} onClick={() => searchAgain(candidate)}>Tìm lại</Button></Box>
            {local && !state.skipped && <Button onClick={() => selectLocal(candidate)} aria-label={`Chọn hình chuẩn cho ${item.word}`} sx={{ p: 0, width: 120, maxWidth: "100%", overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1.5 }}><Box component="img" src={local} alt={`${item.word} — ${item.meaningVi}`} sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "contain" }} /></Button>}
            {!local && state.loading && <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><CircularProgress size={18} /><Typography variant="body2">Đang tìm…</Typography></Stack>}
            {!local && state.error && <Alert severity="warning">{state.error}</Alert>}
            {!local && !state.loading && !state.error && state.items.length === 0 && !providerDisabled && <Typography variant="body2" color="text.secondary">Không có ảnh phù hợp.</Typography>}
            {!local && !state.skipped && state.items.length > 0 && <Stack spacing={1}>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}><Typography variant="caption" sx={{ fontWeight: 700 }}>{state.items.length}/{VOCABULARY_IMAGE_LIMIT} ảnh</Typography></Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" }, gap: 1, minWidth: 0 }}>{state.items.map((result) => {
                const selected = state.selectedAssetId === result.providerAssetId || importing === `${index}-${result.providerAssetId}`;
                return <Button key={result.providerAssetId} onClick={() => void select(index, result)} disabled={Boolean(importing)} aria-pressed={selected} aria-label={`Chọn ảnh cho ${item.word}`} sx={{ p: 0, minWidth: 0, overflow: "hidden", border: selected ? 3 : 1, borderColor: selected ? "primary.main" : "divider", borderRadius: 1.5 }}><Box component="img" src={result.thumbnailUrl} alt={`${item.word} — ${item.meaningVi}`} sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover" }} /></Button>;
              })}</Box>
              {state.page < 3 && state.items.length < Math.min(state.total, VOCABULARY_IMAGE_LIMIT) && <Button variant="outlined" disabled={Boolean(importing) || state.loadingMore || cooldownSeconds > 0} onClick={() => void loadMore(candidate)} startIcon={state.loadingMore ? <CircularProgress size={18} /> : undefined}>Xem thêm 8 ảnh</Button>}
            </Stack>}
          </Box>;
        })}
      </Stack></DialogContent>
      <DialogActions><Button onClick={close}>Hủy</Button><Button variant="contained" startIcon={<Collections />} onClick={close}>Xong</Button></DialogActions>
    </Dialog>
  );
}
