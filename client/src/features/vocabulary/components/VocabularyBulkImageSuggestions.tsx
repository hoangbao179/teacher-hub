import { Cancel, Collections, Refresh } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import type { VocabularyMediaSearchItem, VocabularySetItemInput, VocabularyStoredMedia } from "@teacher/shared";
import { useEffect, useRef, useState } from "react";
import { getVocabularyMediaStatus, importVocabularyMedia } from "../../../api/vocabularyMedia";
import {
  buildVocabularyImageStrategy,
  type VocabularyImageFilter,
  type VocabularyImageStrategy,
} from "../vocabularyImageStrategy";
import { searchVocabularyImageSuggestions } from "../vocabularyImageSearch";

interface Candidate { item: VocabularySetItemInput; index: number; strategy: VocabularyImageStrategy }
interface SuggestionState { loading: boolean; skipped?: boolean; error?: string; items: VocabularyMediaSearchItem[] }

export function VocabularyBulkImageSuggestions({ open, items, onClose, onSelect, onSelectLocal }: {
  open: boolean;
  items: VocabularySetItemInput[];
  onClose: () => void;
  onSelect: (index: number, media: VocabularyStoredMedia) => void;
  onSelectLocal: (index: number, publicAsset: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const candidates = useRef<Candidate[]>(items.map((item, index) => ({
    item, index, strategy: buildVocabularyImageStrategy(item.word, item.imageSearchTerms),
  })).filter(({ item }) => item.illustration.kind === "NONE")).current;
  const [queries, setQueries] = useState<Record<number, string>>(() => Object.fromEntries(candidates.map(({ index, strategy }) => [index, strategy.query])));
  const initialQueries = useRef(queries).current;
  const [states, setStates] = useState<Record<number, SuggestionState>>(() => Object.fromEntries(candidates.map(({ index, strategy }) => [index, { loading: !strategy.publicAsset, items: [] }])));
  const [mediaType, setMediaType] = useState<VocabularyImageFilter>("ILLUSTRATION");
  const [importing, setImporting] = useState("");
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [providerError, setProviderError] = useState("");
  const cancelled = useRef(false);

  const find = async (candidate: Candidate, query: string, filter: VocabularyImageFilter) => {
    setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: true, error: undefined, items: [] } }));
    try {
      const result = await searchVocabularyImageSuggestions({ strategy: candidate.strategy, query, mediaType: filter, pageSize: 6 });
      if (!cancelled.current) setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: false, items: result.items.slice(0, 6) } }));
    } catch (value) {
      if (!cancelled.current) setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], loading: false, items: [], error: value instanceof Error ? value.message : "Không thể gợi ý ảnh." } }));
    }
  };

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    const remoteCandidates = candidates.filter(({ strategy }) => !strategy.publicAsset);
    setProviderError("");
    setStates(Object.fromEntries(candidates.map(({ index, strategy }) => [index, { loading: !strategy.publicAsset, items: [] }])));
    if (remoteCandidates.length === 0) return () => { cancelled.current = true; };
    let cursor = 0;
    const worker = async () => {
      while (!cancelled.current && cursor < remoteCandidates.length) {
        const candidate = remoteCandidates[cursor++];
        await find(candidate, initialQueries[candidate.index], mediaType);
      }
    };
    void getVocabularyMediaStatus().then((status) => {
      if (cancelled.current) return;
      if (!status.enabled) {
        setProviderDisabled(true);
        setStates((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, loading: false }])));
        return;
      }
      setProviderDisabled(false);
      void Promise.all(Array.from({ length: Math.min(2, remoteCandidates.length) }, () => worker()));
    }).catch((reason: Error) => {
      if (cancelled.current) return;
      setProviderError(reason.message);
      setStates((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, loading: false }])));
    });
    return () => { cancelled.current = true; };
  }, [candidates, initialQueries, mediaType, open]);

  const completed = Object.values(states).filter((value) => !value.loading).length;
  const select = async (index: number, result: VocabularyMediaSearchItem) => {
    const item = items[index];
    setImporting(`${index}-${result.providerAssetId}`);
    try {
      const media = await importVocabularyMedia({ provider: result.provider, providerAssetId: result.providerAssetId, altText: `${item.word} — ${item.meaningVi}`.slice(0, 200) });
      onSelect(index, media);
      setStates((current) => ({ ...current, [index]: { ...current[index], skipped: true } }));
    } catch (value) {
      setStates((current) => ({ ...current, [index]: { ...current[index], error: value instanceof Error ? value.message : "Không thể lưu ảnh." } }));
    } finally { setImporting(""); }
  };

  const selectLocal = (candidate: Candidate) => {
    if (!candidate.strategy.publicAsset) return;
    onSelectLocal(candidate.index, candidate.strategy.publicAsset);
    setStates((current) => ({ ...current, [candidate.index]: { ...current[candidate.index], skipped: true } }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg" data-testid="vocabulary-bulk-image-suggestions">
      <DialogTitle>Gợi ý ảnh cho tất cả</DialogTitle>
      <DialogContent dividers sx={{ overflowX: "hidden" }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) 180px" }, gap: 1, alignItems: "center" }}>
            <Box><Typography variant="body2">{completed}/{candidates.length} từ đã tìm xong · tối đa 2 yêu cầu đồng thời</Typography><LinearProgress variant={candidates.length ? "determinate" : "indeterminate"} value={candidates.length ? completed / candidates.length * 100 : 0} sx={{ mt: 0.75 }} /></Box>
            <TextField select size="small" label="Loại ảnh" value={mediaType} onChange={(event) => setMediaType(event.target.value as VocabularyImageFilter)}>
              <MenuItem value="ILLUSTRATION">Minh họa</MenuItem><MenuItem value="PHOTO">Ảnh thật</MenuItem>
            </TextField>
          </Box>
          {providerDisabled && <Alert severity="info">Pixabay đang tắt. Ảnh màu và thẻ số local vẫn dùng được.</Alert>}
          {providerError && <Alert severity="warning">{providerError}</Alert>}
          {candidates.length === 0 && <Alert severity="info">Mọi từ đã có hình. Bỏ hình ở từ cần thay rồi chạy gợi ý lại.</Alert>}
          {candidates.map((candidate) => {
            const { item, index, strategy } = candidate;
            const state = states[index] ?? { loading: true, items: [] };
            const local = strategy.publicAsset;
            return <Box key={`${item.word}-${index}`} sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, opacity: state.skipped ? 0.55 : 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 1 }}><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2">{item.word}</Typography><Typography variant="body2" color="text.secondary">{item.meaningVi}</Typography></Box><Button size="small" startIcon={<Cancel />} onClick={() => setStates((current) => ({ ...current, [index]: { ...state, skipped: true } }))}>Bỏ qua</Button></Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" }, gap: 1, mb: 1 }}>
                <TextField size="small" label="Từ khóa" value={queries[index]} disabled={Boolean(local)} onChange={(event) => setQueries((current) => ({ ...current, [index]: event.target.value }))} slotProps={{ htmlInput: { maxLength: 100 } }} />
                <Button variant="outlined" startIcon={<Refresh />} disabled={Boolean(local) || state.loading || providerDisabled || queries[index].trim().length < 2} onClick={() => { cancelled.current = false; void find(candidate, queries[index], mediaType); }}>Tìm lại</Button>
              </Box>
              {local && !state.skipped && <Button onClick={() => selectLocal(candidate)} aria-label={`Chọn hình chuẩn cho ${item.word}`} sx={{ p: 0, width: 120, maxWidth: "100%", overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1.5 }}><Box component="img" src={local} alt={`${item.word} — ${item.meaningVi}`} sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "contain" }} /></Button>}
              {!local && state.loading && <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><CircularProgress size={18} /><Typography variant="body2">Đang tìm…</Typography></Stack>}
              {!local && state.error && <Alert severity="warning">{state.error}</Alert>}
              {!local && !state.loading && !state.error && state.items.length === 0 && !providerDisabled && <Typography variant="body2" color="text.secondary">Không có ảnh phù hợp.</Typography>}
              {!local && !state.skipped && state.items.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" }, gap: 1, minWidth: 0 }}>
                {state.items.map((result) => <Button key={result.providerAssetId} onClick={() => void select(index, result)} disabled={Boolean(importing)} aria-label={`Chọn ảnh cho ${item.word}`} sx={{ p: 0, minWidth: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1.5 }}><Box component="img" src={result.thumbnailUrl} alt={`${item.word} — ${item.meaningVi}`} sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover" }} /></Button>)}
              </Box>}
            </Box>;
          })}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => { cancelled.current = true; onClose(); }}>Hủy</Button><Button variant="contained" startIcon={<Collections />} onClick={onClose}>Xong</Button></DialogActions>
    </Dialog>
  );
}
