import {
  Cancel,
  Collections,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type {
  VocabularyMediaSearchItem,
  VocabularySetItemInput,
  VocabularyStoredMedia,
} from "@teacher/shared";
import { useEffect, useRef, useState } from "react";
import {
  getVocabularyMediaStatus,
  importVocabularyMedia,
  searchVocabularyMedia,
} from "../../../api/vocabularyMedia";

interface SuggestionState {
  loading: boolean;
  skipped?: boolean;
  error?: string;
  items: VocabularyMediaSearchItem[];
}

export function VocabularyBulkImageSuggestions({ open, items, onClose, onSelect }: {
  open: boolean;
  items: VocabularySetItemInput[];
  onClose: () => void;
  onSelect: (index: number, media: VocabularyStoredMedia) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const candidates = useRef(items.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.illustration.kind === "NONE")).current;
  const [states, setStates] = useState<Record<number, SuggestionState>>(
    () => Object.fromEntries(candidates.map(({ index }) => [
      index,
      { loading: true, items: [] },
    ])),
  );
  const [importing, setImporting] = useState("");
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [providerError, setProviderError] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    let cursor = 0;
    const worker = async () => {
      while (!cancelled.current && cursor < candidates.length) {
        const candidate = candidates[cursor];
        cursor += 1;
        try {
          const result = await searchVocabularyMedia({
            query: candidate.item.imageSearchTerms?.[0] || candidate.item.word,
            mediaType: "ALL",
            pageSize: 6,
          });
          if (!cancelled.current)
            setStates((current) => ({ ...current, [candidate.index]: { loading: false, items: result.items.slice(0, 3) } }));
        } catch (value) {
          if (!cancelled.current)
            setStates((current) => ({ ...current, [candidate.index]: { loading: false, items: [], error: value instanceof Error ? value.message : "Không thể gợi ý ảnh." } }));
        }
      }
    };
    void getVocabularyMediaStatus().then((status) => {
      if (cancelled.current) return;
      if (!status.enabled) {
        setProviderDisabled(true);
        setStates((current) => Object.fromEntries(Object.entries(current).map(
          ([key, value]) => [key, { ...value, loading: false }],
        )));
        return;
      }
      setProviderDisabled(false);
      void Promise.all(Array.from({ length: Math.min(2, candidates.length) }, () => worker()));
    }).catch((reason: Error) => {
      if (cancelled.current) return;
      setProviderError(reason.message);
      setStates((current) => Object.fromEntries(Object.entries(current).map(
        ([key, value]) => [key, { ...value, loading: false }],
      )));
    });
    return () => { cancelled.current = true; };
  }, [candidates, open]);

  const completed = Object.values(states).filter((value) => !value.loading).length;
  const select = async (index: number, result: VocabularyMediaSearchItem) => {
    const item = items[index];
    setImporting(`${index}-${result.providerAssetId}`);
    try {
      const media = await importVocabularyMedia({
        provider: result.provider,
        providerAssetId: result.providerAssetId,
        altText: `${item.word} — ${item.meaningVi}`.slice(0, 200),
      });
      onSelect(index, media);
      setStates((current) => ({ ...current, [index]: { ...current[index], skipped: true } }));
    } catch (value) {
      setStates((current) => ({ ...current, [index]: { ...current[index], error: value instanceof Error ? value.message : "Không thể lưu ảnh." } }));
    } finally {
      setImporting("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg" data-testid="vocabulary-bulk-image-suggestions">
      <DialogTitle>Gợi ý ảnh cho tất cả</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2">{completed}/{candidates.length} từ đã tìm xong · tối đa 2 yêu cầu đồng thời</Typography>
            <LinearProgress variant={candidates.length ? "determinate" : "indeterminate"} value={candidates.length ? completed / candidates.length * 100 : 0} sx={{ mt: 0.75 }} />
          </Box>
          {providerDisabled && <Alert severity="info">Pixabay đang tắt. Hãy cấu hình provider ở server trước khi gợi ý ảnh hàng loạt.</Alert>}
          {providerError && <Alert severity="warning">{providerError}</Alert>}
          {candidates.length === 0 && <Alert severity="info">Mọi từ đã có hình. Bỏ hình ở từ cần thay rồi chạy gợi ý lại.</Alert>}
          {!providerDisabled && !providerError && candidates.map(({ item, index }) => {
            const state = states[index] ?? { loading: true, items: [] };
            return <Box key={`${item.word}-${index}`} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, opacity: state.skipped ? 0.55 : 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 1 }}>
                <Box><Typography variant="subtitle2">{item.word}</Typography><Typography variant="body2" color="text.secondary">{item.meaningVi}</Typography></Box>
                <Button size="small" startIcon={<Cancel />} onClick={() => setStates((current) => ({ ...current, [index]: { ...state, skipped: true } }))}>Bỏ qua</Button>
              </Stack>
              {state.loading && <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><CircularProgress size={18} /><Typography variant="body2">Đang tìm…</Typography></Stack>}
              {state.error && <Alert severity="warning">{state.error}</Alert>}
              {!state.loading && !state.error && state.items.length === 0 && <Typography variant="body2" color="text.secondary">Không có ảnh phù hợp.</Typography>}
              {!state.skipped && state.items.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 120px))", gap: 1 }}>
                {state.items.map((result) => <Button key={result.providerAssetId} onClick={() => void select(index, result)} disabled={Boolean(importing)} aria-label={`Chọn ảnh cho ${item.word}`} sx={{ p: 0, minWidth: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                  <Box component="img" src={result.thumbnailUrl} alt={`${item.word} — ${item.meaningVi}`} sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                </Button>)}
              </Box>}
            </Box>;
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { cancelled.current = true; onClose(); }}>Hủy</Button>
        <Button variant="contained" startIcon={<Collections />} onClick={onClose}>Xong</Button>
      </DialogActions>
    </Dialog>
  );
}
