import { CheckCircle, ImageSearch, Search } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, MenuItem, Skeleton, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import type { VocabularyMediaSearchItem, VocabularyStoredMedia } from "@teacher/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getVocabularyMediaStatus, importVocabularyMedia } from "../../../api/vocabularyMedia";
import {
  buildVocabularyImageStrategy,
  type VocabularyImageFilter,
} from "../vocabularyImageStrategy";
import { searchVocabularyImageSuggestions } from "../vocabularyImageSearch";

export function VocabularyImagePicker({ open, word, meaningVi, searchTerms = [], onClose, onSelect, onSelectLocal }: {
  open: boolean;
  word: string;
  meaningVi: string;
  searchTerms?: string[];
  onClose: () => void;
  onSelect: (media: VocabularyStoredMedia) => void;
  onSelectLocal: (publicAsset: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const strategy = useMemo(() => buildVocabularyImageStrategy(word, searchTerms), [searchTerms, word]);
  const [query, setQuery] = useState(strategy.query);
  const [mediaType, setMediaType] = useState<VocabularyImageFilter>("ILLUSTRATION");
  const [items, setItems] = useState<VocabularyMediaSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState("");
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!open || strategy.publicAsset) return;
    void getVocabularyMediaStatus()
      .then((value) => setDisabled(!value.enabled))
      .catch((value: Error) => setError(value.message));
  }, [open, strategy]);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await searchVocabularyImageSuggestions({ strategy, query, mediaType, pageSize: 20 });
      setItems(result.items);
      setDisabled(false);
    } catch (value) {
      const message = value instanceof Error ? value.message : "Không thể tìm ảnh.";
      setError(message);
      setDisabled(message.includes("đang tắt"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mediaType, query, strategy]);

  const choose = async (item: VocabularyMediaSearchItem) => {
    setImporting(item.providerAssetId);
    setError("");
    try {
      const media = await importVocabularyMedia({
        provider: item.provider,
        providerAssetId: item.providerAssetId,
        altText: `${word} — ${meaningVi}`.slice(0, 200),
      });
      onSelect(media);
      onClose();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể lưu ảnh.");
    } finally {
      setImporting("");
    }
  };

  const chooseLocal = () => {
    if (!strategy.publicAsset) return;
    onSelectLocal(strategy.publicAsset);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" data-testid="vocabulary-image-picker">
      <DialogTitle>Tìm ảnh cho “{word}”</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          {strategy.publicAsset ? <>
            <Alert severity="info">Từ này dùng hình chuẩn có sẵn, không gửi yêu cầu tới Pixabay.</Alert>
            <Button onClick={chooseLocal} aria-label={`Chọn hình chuẩn cho ${word}`} sx={{ p: 1, minWidth: 0, alignSelf: "flex-start", border: 1, borderColor: "divider", borderRadius: 2 }}>
              <Box component="img" src={strategy.publicAsset} alt={`${word} — ${meaningVi}`} sx={{ width: 180, maxWidth: "100%", aspectRatio: "1", objectFit: "contain" }} />
            </Button>
          </> : <>
            <Box component="form" onSubmit={(event) => { event.preventDefault(); void search(); }} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) 160px auto" }, gap: 1, minWidth: 0 }}>
              <TextField autoFocus label="Từ khóa tìm ảnh" value={query} onChange={(event) => setQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }, htmlInput: { maxLength: 100 } }} />
              <TextField select label="Loại ảnh" value={mediaType} onChange={(event) => setMediaType(event.target.value as VocabularyImageFilter)}>
                <MenuItem value="ILLUSTRATION">Minh họa</MenuItem>
                <MenuItem value="PHOTO">Ảnh thật</MenuItem>
              </TextField>
              <Button type="submit" variant="contained" disabled={loading || disabled || query.trim().length < 2} startIcon={loading ? <CircularProgress size={18} /> : <ImageSearch />}>Tìm</Button>
            </Box>
            {disabled && <Alert severity="info">Tìm ảnh đang tắt. Bạn vẫn có thể giữ emoji hoặc ảnh của Unit công khai.</Alert>}
            {error && <Alert severity="error" action={!disabled ? <Button color="inherit" onClick={() => void search()}>Thử lại</Button> : undefined}>{error}</Alert>}
            {loading && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} variant="rounded" height={150} />)}</Box>}
            {!loading && !disabled && !error && items.length === 0 && <Box sx={{ textAlign: "center", py: 5 }}><ImageSearch color="disabled" sx={{ fontSize: 48 }} /><Typography color="text.secondary">Kiểm tra từ khóa rồi bấm Tìm để xem ảnh an toàn cho trẻ em.</Typography></Box>}
            {!loading && items.length > 0 && <>
              <Typography variant="caption" color="text.secondary">Nguồn Pixabay · Ảnh chỉ được lưu sau khi cô chọn.</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1, minWidth: 0 }}>
                {items.map((item) => <Button key={item.providerAssetId} onClick={() => void choose(item)} disabled={Boolean(importing)} aria-label={`Chọn ảnh của ${item.contributorName}`} sx={{ p: 0, minWidth: 0, display: "block", overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 2, textTransform: "none", color: "text.primary" }}>
                  <Box component="img" src={item.thumbnailUrl} alt={`${word} — ${meaningVi}`} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  <Stack direction="row" sx={{ p: 0.75, gap: 0.5, alignItems: "center", minWidth: 0 }}>{importing === item.providerAssetId && <CircularProgress size={14} />}<Typography variant="caption" noWrap>{item.contributorName}</Typography>{importing === item.providerAssetId && <CheckCircle fontSize="small" color="primary" />}</Stack>
                </Button>)}
              </Box>
            </>}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
    </Dialog>
  );
}
