import { CheckCircle, ImageSearch, Search, UploadFile } from "@mui/icons-material";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, MenuItem, Skeleton, Stack, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import type { VocabularyMediaSearchItem, VocabularyStoredMedia } from "@teacher/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import { getVocabularyMediaStatus, importVocabularyMedia, uploadVocabularyMedia } from "../../../api/vocabularyMedia";
import {
  buildVocabularyImageStrategy,
  type VocabularyImageFilter,
} from "../vocabularyImageStrategy";
import {
  appendUniqueVocabularyImages,
  VOCABULARY_IMAGE_LIMIT,
  VOCABULARY_IMAGE_PAGE_SIZE,
} from "../vocabularyImagePagination";
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
  const [selectedItem, setSelectedItem] = useState<VocabularyMediaSearchItem | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState("");
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const searchGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const uploadLock = useRef(false);
  const [uploadDraft, setUploadDraft] = useState<{ file: File; preview: string } | null>(null);

  const resetResults = () => {
    searchGeneration.current += 1;
    setItems([]);
    setSelectedItem(null);
    setPage(0);
    setTotal(0);
    setError("");
  };

  useEffect(() => {
    if (!open || strategy.publicAsset) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    void getVocabularyMediaStatus(controller.signal)
      .then((value) => setDisabled(!value.enabled))
      .catch((value: Error) => setError(value.message));
    return () => controller.abort();
  }, [open, strategy]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    const timer = globalThis.setInterval(update, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [cooldownUntil]);

  const search = useCallback(async (targetPage = 1) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const generation = searchGeneration.current;
    setLoading(true);
    setError("");
    try {
      const result = await searchVocabularyImageSuggestions({
        strategy, query, mediaType, page: targetPage, pageSize: VOCABULARY_IMAGE_PAGE_SIZE, signal: controller.signal,
      });
      if (generation !== searchGeneration.current) return;
      setItems((current) => targetPage === 1
        ? result.items.slice(0, VOCABULARY_IMAGE_LIMIT)
        : appendUniqueVocabularyImages(current, result.items));
      setPage(targetPage);
      setTotal(result.total);
      setDisabled(false);
    } catch (value) {
      if (generation !== searchGeneration.current) return;
      const message = value instanceof Error ? value.message : "Không thể tìm ảnh.";
      setError(message);
      setDisabled(message.includes("đang tắt"));
      if (value instanceof ApiError && value.status === 429) {
        const seconds = Math.max(1, value.retryAfterSeconds ?? 60);
        setCooldownSeconds(seconds);
        setCooldownUntil(Date.now() + seconds * 1_000);
      }
    } finally {
      if (generation === searchGeneration.current) setLoading(false);
    }
  }, [mediaType, query, strategy]);

  const changeQuery = (value: string) => {
    setQuery(value);
    resetResults();
  };

  const changeMediaType = (value: VocabularyImageFilter) => {
    setMediaType(value);
    resetResults();
  };

  const choose = async () => {
    if (!selectedItem) return;
    setImporting(selectedItem.providerAssetId);
    setError("");
    try {
      const media = await importVocabularyMedia({
        provider: selectedItem.provider,
        providerAssetId: selectedItem.providerAssetId,
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
  const close = () => { searchGeneration.current += 1; activeRequest.current?.abort(); onClose(); };
  const selectUpload = (file?: File) => {
    if (!file) return;
    if (uploadDraft) URL.revokeObjectURL(uploadDraft.preview);
    setUploadDraft({ file, preview: URL.createObjectURL(file) });
  };
  const upload = async () => {
    if (!uploadDraft || uploadLock.current) return;
    uploadLock.current = true; setImporting("USER_UPLOAD"); setError("");
    try {
      const media = await uploadVocabularyMedia(uploadDraft.file, `${word} — ${meaningVi}`.slice(0, 200));
      onSelect(media); URL.revokeObjectURL(uploadDraft.preview); setUploadDraft(null); close();
    } catch (value) { setError(value instanceof Error ? value.message : "Không thể tải ảnh lên."); }
    finally { uploadLock.current = false; setImporting(""); }
  };

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="md" data-testid="vocabulary-image-picker">
      <DialogTitle>Tìm ảnh cho “{word}”</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          {strategy.publicAsset ? <>
            <Alert severity="info">Từ này dùng hình chuẩn có sẵn, không gửi yêu cầu tới Pixabay.</Alert>
            <Button onClick={chooseLocal} aria-label={`Chọn hình chuẩn cho ${word}`} sx={{ p: 1, minWidth: 0, alignSelf: "flex-start", border: 1, borderColor: "divider", borderRadius: 2 }}>
              <Box component="img" src={strategy.publicAsset} alt={`${word} — ${meaningVi}`} sx={{ width: 180, maxWidth: "100%", aspectRatio: "1", objectFit: "contain" }} />
            </Button>
          </> : <>
            <Box component="form" onSubmit={(event) => { event.preventDefault(); void search(1); }} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) 160px auto" }, gap: 1, minWidth: 0 }}>
              <TextField autoFocus label="Từ khóa tìm ảnh" value={query} onChange={(event) => changeQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }, htmlInput: { maxLength: 100 } }} />
              <TextField select label="Loại ảnh" value={mediaType} onChange={(event) => changeMediaType(event.target.value as VocabularyImageFilter)}>
                <MenuItem value="ILLUSTRATION">Minh họa</MenuItem>
                <MenuItem value="PHOTO">Ảnh thật</MenuItem>
              </TextField>
              <Button type="submit" variant="contained" disabled={loading || disabled || cooldownSeconds > 0 || query.trim().length < 2} startIcon={loading && page === 0 ? <CircularProgress size={18} /> : <ImageSearch />}>Tìm</Button>
            </Box>
            {cooldownSeconds > 0 && <Alert severity="warning" aria-live="polite">Nguồn ảnh đang giới hạn tần suất. Có thể thử lại lúc {new Date(cooldownUntil).toLocaleTimeString("vi-VN")} ({cooldownSeconds} giây).</Alert>}
            {disabled && <Alert severity="info">Tìm ảnh đang tắt. Bạn vẫn có thể giữ emoji hoặc ảnh của Unit công khai.</Alert>}
            {error && <Alert severity="error" action={!disabled && cooldownSeconds === 0 ? <Button color="inherit" onClick={() => void search(Math.min(page + 1, 3))}>Thử lại</Button> : undefined}>{error}</Alert>}
            {loading && items.length === 0 && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} variant="rounded" height={150} />)}</Box>}
            {!loading && !disabled && !error && items.length === 0 && <Box sx={{ textAlign: "center", py: 5 }}><ImageSearch color="disabled" sx={{ fontSize: 48 }} /><Typography color="text.secondary">Kiểm tra từ khóa rồi bấm Tìm để xem ảnh an toàn cho trẻ em.</Typography></Box>}
            {items.length > 0 && <>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}><Typography variant="caption" color="text.secondary">Nguồn Pixabay · Ảnh chỉ được lưu sau khi cô chọn.</Typography><Typography variant="caption" sx={{ fontWeight: 700 }}>{items.length}/{VOCABULARY_IMAGE_LIMIT} ảnh</Typography></Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 1, minWidth: 0 }}>
                {items.map((item) => {
                  const selected = selectedItem?.providerAssetId === item.providerAssetId;
                  return <Button key={item.providerAssetId} onClick={() => setSelectedItem(item)} disabled={Boolean(importing)} aria-pressed={selected} aria-label={`Đánh dấu ảnh của ${item.contributorName}`} sx={{ p: 0, minWidth: 0, display: "block", overflow: "hidden", border: selected ? 3 : 1, borderColor: selected ? "primary.main" : "divider", borderRadius: 2, textTransform: "none", color: "text.primary" }}>
                  <Box component="img" src={item.thumbnailUrl} alt={`${word} — ${meaningVi}`} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                  <Stack direction="row" sx={{ p: 0.75, gap: 0.5, alignItems: "center", minWidth: 0 }}>{importing === item.providerAssetId && <CircularProgress size={14} />}<Typography variant="caption" noWrap>{item.contributorName}</Typography>{selected && <CheckCircle fontSize="small" color="primary" />}</Stack>
                </Button>;
                })}
              </Box>
              {page < 3 && items.length < Math.min(total, VOCABULARY_IMAGE_LIMIT) && <Button variant="outlined" disabled={loading || cooldownSeconds > 0} onClick={() => void search(page + 1)} startIcon={loading ? <CircularProgress size={18} /> : undefined}>Xem thêm 8 ảnh</Button>}
            </>}
          </>}
          <Button component="label" variant="outlined" startIcon={<UploadFile />}>Tải ảnh từ máy<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectUpload(event.target.files?.[0])} /></Button>
          {uploadDraft && <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><Box component="img" src={uploadDraft.preview} alt="Xem trước ảnh tải lên" sx={{ width: 112, height: 112, objectFit: "cover", borderRadius: 1 }} /><Button variant="contained" disabled={Boolean(importing)} onClick={() => void upload()}>{importing === "USER_UPLOAD" ? "Đang tải…" : "Dùng ảnh này"}</Button></Stack>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={close}>Đóng</Button>{!strategy.publicAsset && <Button variant="contained" disabled={!selectedItem || Boolean(importing)} onClick={() => void choose()} startIcon={importing ? <CircularProgress size={18} /> : <CheckCircle />}>Chọn ảnh</Button>}</DialogActions>
    </Dialog>
  );
}
