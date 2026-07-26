import {
  Archive,
  ArrowBack,
  ContentCopy,
  DeleteOutlined,
  Collections,
  ImageSearch,
  HideImage,
  Save,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  CreateVocabularySetRequest,
  LearningAgeBand,
  VocabularySetDetail,
  VocabularySetItemInput,
  VocabularySetSourceType,
  VocabularyIllustrationInput,
  VocabularyStoredMedia,
  VocabularyTopicListItem,
  VocabularyTopicSuggestionItem,
} from "@teacher/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  archiveVocabularySet,
  createVocabularySet,
  duplicateVocabularySet,
  getVocabularySet,
  importPublicUnitSnapshot,
  listVocabularyTopics,
  suggestVocabularyTopic,
  updateVocabularySet,
} from "../../../api/vocabulary";
import { ConfirmationDialog, PageHeader, StickyActionBar } from "../../../components/UiKit";
import { publishedUnits } from "../../learning/content/vocabularyCatalog";
import {
  ageBandOptions,
  parseVocabularyPaste,
  publicUnitSnapshot,
  vocabularyTopicIcon,
} from "../vocabularyEditor";
import { VocabularyImagePicker } from "../components/VocabularyImagePicker";
import { VocabularyBulkImageSuggestions } from "../components/VocabularyBulkImageSuggestions";
import { vocabularyMediaUrl } from "../../../api/vocabularyMedia";

type SourceMode = "TOPIC_CATALOG" | "MANUAL" | "PUBLIC_UNIT";

const emptyItem = (order: number): VocabularySetItemInput => ({
  displayOrder: order,
  word: "",
  meaningVi: "",
  tier: "CUSTOM",
  illustration: { kind: "NONE" },
  supportsImageGame: false,
});

export function VocabularyEditorPage() {
  const params = useParams();
  const setId = params.id ? Number(params.id) : null;
  const [query] = useSearchParams();
  const returnTo = query.get("returnTo");
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ageBand, setAgeBand] = useState<LearningAgeBand>("PRESCHOOL_G1");
  const [mode, setMode] = useState<SourceMode>("TOPIC_CATALOG");
  const [topicSlug, setTopicSlug] = useState(query.get("topic") ?? "");
  const [targetCount, setTargetCount] = useState(10);
  const [topics, setTopics] = useState<VocabularyTopicListItem[]>([]);
  const [suggested, setSuggested] = useState<VocabularyTopicSuggestionItem[]>([]);
  const [items, setItems] = useState<VocabularySetItemInput[]>([]);
  const [paste, setPaste] = useState("");
  const [publicUnitId, setPublicUnitId] = useState("");
  const [existing, setExisting] = useState<VocabularySetDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(setId));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [imagePickerIndex, setImagePickerIndex] = useState<number | null>(null);
  const [bulkImagesOpen, setBulkImagesOpen] = useState(false);
  const [illustrationOverrides, setIllustrationOverrides] = useState<Record<string, VocabularyIllustrationInput>>({});

  useEffect(() => {
    void listVocabularyTopics({ pageSize: 50 }).then((result) => setTopics(result.data)).catch((value: Error) => setError(value.message));
  }, []);

  useEffect(() => {
    if (!setId) return;
    void getVocabularySet(setId).then((value) => {
      setExisting(value);
      setTitle(value.title);
      setDescription(value.description ?? "");
      setAgeBand(value.ageBand);
      setItems(value.items);
      setMode(value.sourceType === "TOPIC_CATALOG" ? "TOPIC_CATALOG" : value.sourceType === "PUBLIC_UNIT" ? "PUBLIC_UNIT" : "MANUAL");
      setDirty(false);
    }).catch((value: Error) => setError(value.message)).finally(() => setLoading(false));
  }, [setId]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);

  useEffect(() => {
    if (setId || mode !== "TOPIC_CATALOG" || !topicSlug) return;
    void suggestVocabularyTopic({ topicSlug, ageBand, targetCount })
      .then((value) => {
        setSuggested(value.items);
        setTitle((current) => current || value.topic.titleVi);
        setDirty(true);
      })
      .catch((value: Error) => setError(value.message));
  }, [ageBand, mode, setId, targetCount, topicSlug]);

  const selectedSuggestions = useMemo(() => suggested.filter((item) => item.selected), [suggested]);
  const illustrationKey = (item: Pick<VocabularySetItemInput, "word" | "meaningVi">) =>
    `${item.word.normalize("NFKC").trim().toLowerCase()}\u0000${item.meaningVi.normalize("NFKC").trim().toLowerCase()}`;
  const applyIllustrationOverride = <T extends VocabularySetItemInput>(item: T): T => {
    const illustration = illustrationOverrides[illustrationKey(item)];
    return illustration ? {
      ...item,
      illustration,
      supportsImageGame: illustration.kind !== "NONE",
    } : item;
  };
  const currentItems = setId || mode === "MANUAL" ? items
    : mode === "TOPIC_CATALOG"
      ? selectedSuggestions.map((item, index) => applyIllustrationOverride({
        sourceTopicWordId: item.id,
        displayOrder: index + 1,
        word: item.word,
        meaningVi: item.meaningVi,
        phonetic: item.phonetic ?? undefined,
        partOfSpeech: item.partOfSpeech ?? undefined,
        exampleEn: item.exampleEn ?? undefined,
        speechText: item.speechText,
        tier: item.tier,
        illustration: { kind: "NONE" as const },
        supportsImageGame: item.supportsImageGame,
        imageSearchTerms: item.imageSearchTerms,
      }))
      : publicUnitId
        ? publicUnitSnapshot(publishedUnits.find((unit) => unit.id === publicUnitId)!, ageBand).items.map((item, index) => applyIllustrationOverride({
          displayOrder: index + 1,
          word: item.word,
          meaningVi: item.meaningVi,
          phonetic: item.phonetic,
          exampleEn: item.exampleEn,
          speechText: item.speechText,
          tier: "CUSTOM" as const,
          illustration: item.illustration,
          supportsImageGame: item.illustration.kind !== "NONE",
          imageSearchTerms: [item.word],
        }))
        : [];

  const archived = existing?.status === "ARCHIVED";
  const mark = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      let result: VocabularySetDetail;
      if (setId) {
        result = await updateVocabularySet(setId, { title, description, ageBand, items: currentItems });
      } else if (mode === "PUBLIC_UNIT") {
        const unit = publishedUnits.find((value) => value.id === publicUnitId);
        if (!unit) throw new Error("Hãy chọn một Unit công khai.");
        result = await importPublicUnitSnapshot({
          ...publicUnitSnapshot(unit, ageBand),
          title: title.trim() || unit.title,
          description: description.trim() || unit.description,
        });
      } else {
        const payload: CreateVocabularySetRequest = {
          title,
          description,
          ageBand,
          sourceType: mode as VocabularySetSourceType,
          ...(mode === "TOPIC_CATALOG" ? { sourceReference: { topicSlug } } : {}),
          items: currentItems,
        };
        result = await createVocabularySet(payload);
      }
      setDirty(false);
      navigate(
        returnTo
          ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}vocabularySetId=${result.id}`
          : `/admin/vocabulary/${result.id}`,
        { replace: true },
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể lưu bộ từ.");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!setId) return;
    setSaving(true);
    setError("");
    try {
      const copy = await duplicateVocabularySet(setId);
      navigate(`/admin/vocabulary/${copy.id}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể nhân bản.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!setId) return;
    setSaving(true);
    try {
      await archiveVocabularySet(setId);
      setArchiveOpen(false);
      setExisting((value) => value ? { ...value, status: "ARCHIVED" } : value);
      setNotice("Đã lưu trữ bộ từ. Dữ liệu lịch sử vẫn được giữ nguyên.");
      setDirty(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không thể lưu trữ.");
    } finally {
      setSaving(false);
    }
  };

  const applyPaste = () => {
    const preview = parseVocabularyPaste(paste);
    if (preview.invalidCount) {
      setError(`Có ${preview.invalidCount} dòng chưa đủ từ và nghĩa.`);
      return;
    }
    setItems(preview.rows.map((row, index) => ({ ...emptyItem(index + 1), word: row.word, meaningVi: row.meaningVi })));
    setDirty(true);
    setNotice(`Đã đọc ${preview.validCount} từ. Hãy kiểm tra trước khi lưu.`);
  };

  const changeIllustration = (
    index: number,
    illustration: VocabularyIllustrationInput,
  ) => {
    const item = currentItems[index];
    if (setId || mode === "MANUAL") {
      setItems((value) => value.map((current, itemIndex) =>
        itemIndex === index
          ? { ...current, illustration, supportsImageGame: illustration.kind !== "NONE" }
          : current));
    } else {
      setIllustrationOverrides((value) => ({
        ...value,
        [illustrationKey(item)]: illustration,
      }));
    }
    setDirty(true);
    setNotice("");
  };

  const applyStoredMedia = (index: number, media: VocabularyStoredMedia) => {
    changeIllustration(index, { kind: "STORED_MEDIA", mediaId: media.id });
  };

  if (loading) return <Stack sx={{ alignItems: "center", py: 8 }}><CircularProgress /></Stack>;
  return (
    <Stack spacing={2.25} data-testid={setId ? "vocabulary-detail-page" : "vocabulary-new-page"}>
      <Button component={Link} to="/admin/vocabulary" startIcon={<ArrowBack />} sx={{ alignSelf: "flex-start" }}>Kho từ vựng</Button>
      <PageHeader
        title={setId ? title || "Chi tiết bộ từ" : "Tạo bộ từ mới"}
        subtitle={archived ? "Bộ từ đã lưu trữ — chỉ có thể xem hoặc nhân bản." : dirty ? "Có thay đổi chưa lưu" : "Mọi thay đổi đã được lưu"}
        action={setId ? <Stack direction="row" sx={{ gap: 1 }}><Button startIcon={<ContentCopy />} onClick={() => void duplicate()} disabled={saving}>Nhân bản</Button>{!archived && <Button color="error" startIcon={<Archive />} onClick={() => setArchiveOpen(true)}>Lưu trữ</Button>}</Stack> : undefined}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      {!setId && (
        <Card variant="outlined"><CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>1. Chọn nguồn</Typography>
          <TextField select fullWidth label="Nguồn từ vựng" value={mode} onChange={(event) => { setMode(event.target.value as SourceMode); setItems([]); setSuggested([]); setDirty(true); }}>
            <MenuItem value="TOPIC_CATALOG">Chủ đề gợi ý</MenuItem>
            <MenuItem value="MANUAL">Nhập thủ công / dán danh sách</MenuItem>
            <MenuItem value="PUBLIC_UNIT">Unit công khai hiện có</MenuItem>
          </TextField>
        </CardContent></Card>
      )}

      <Card variant="outlined"><CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>{setId ? "Thông tin bộ từ" : "2. Thông tin bộ từ"}</Typography>
        <Stack spacing={1.5}>
          <TextField label="Tên bộ từ" value={title} disabled={archived} onChange={(event) => mark(setTitle)(event.target.value)} slotProps={{ htmlInput: { maxLength: 160 } }} required />
          <TextField label="Mô tả" value={description} disabled={archived} onChange={(event) => mark(setDescription)(event.target.value)} multiline minRows={2} />
          <TextField select label="Độ tuổi" value={ageBand} disabled={archived} onChange={(event) => mark(setAgeBand)(event.target.value as LearningAgeBand)}>
            {ageBandOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </Stack>
      </CardContent></Card>

      {!setId && mode === "TOPIC_CATALOG" && (
        <Card variant="outlined"><CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>3. Chọn từ theo chủ đề</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 180px" }, gap: 1.5 }}>
            <TextField select label="Chủ đề" value={topicSlug} onChange={(event) => { setTopicSlug(event.target.value); setDirty(true); }}>
              {topicSlug && !topics.some((topic) => topic.slug === topicSlug) && <MenuItem value={topicSlug}>{topicSlug}</MenuItem>}
              {topics.map((topic) => <MenuItem key={topic.slug} value={topic.slug}>{vocabularyTopicIcon(topic.iconKey)} {topic.titleVi}</MenuItem>)}
            </TextField>
            <TextField type="number" label="Số từ mục tiêu" value={targetCount} onChange={(event) => setTargetCount(Math.max(2, Math.min(40, Number(event.target.value))))} slotProps={{ htmlInput: { min: 2, max: 40 } }} />
          </Box>
          {(["CORE", "EXTENDED"] as const).map((tier) => {
            const values = suggested.filter((item) => item.tier === tier);
            return values.length ? <Box key={tier} sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{tier === "CORE" ? "Từ cốt lõi" : "Từ mở rộng"}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
                {values.map((item) => <FormControlLabel key={item.id} control={<Checkbox checked={item.selected} onChange={(event) => { setSuggested((current) => current.map((value) => value.id === item.id ? { ...value, selected: event.target.checked } : value)); setDirty(true); }} />} label={`${item.word} — ${item.meaningVi}`} />)}
              </Box>
            </Box> : null;
          })}
        </CardContent></Card>
      )}

      {!setId && mode === "PUBLIC_UNIT" && (
        <Card variant="outlined"><CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>3. Chọn Unit công khai</Typography>
          <TextField select fullWidth label="Unit" value={publicUnitId} onChange={(event) => {
            const id = event.target.value;
            const unit = publishedUnits.find((value) => value.id === id);
            setPublicUnitId(id);
            if (unit && !title) setTitle(unit.title);
            setDirty(true);
          }}>
            {publishedUnits.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.title} · {unit.vocabulary.length} từ</MenuItem>)}
          </TextField>
          <Alert severity="info" sx={{ mt: 1.5 }}>Nội dung được chụp thành snapshot khi lưu; thay đổi ở trang học công khai sau này không làm đổi bộ từ này.</Alert>
        </CardContent></Card>
      )}

      {!setId && mode === "MANUAL" && (
        <Card variant="outlined"><CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>3. Dán danh sách</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Mỗi dòng: từ tiếng Anh, dấu phẩy hoặc tab, nghĩa tiếng Việt.</Typography>
          <TextField fullWidth multiline minRows={5} value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={"apple, quả táo\nbanana, quả chuối"} />
          <Button sx={{ mt: 1 }} variant="outlined" onClick={applyPaste}>Đọc danh sách</Button>
        </CardContent></Card>
      )}

      <Box>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography component="h2" variant="h6">{setId ? "Các từ trong bộ" : "4. Kiểm tra từ"} <Chip size="small" label={`${currentItems.length}/100`} /></Typography>
          <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!archived && currentItems.some((item) => item.illustration.kind === "NONE") && <Button startIcon={<Collections />} onClick={() => setBulkImagesOpen(true)}>Gợi ý ảnh cho tất cả</Button>}
            {(setId || mode === "MANUAL") && !archived && <Button onClick={() => { setItems((value) => [...value, emptyItem(value.length + 1)]); setDirty(true); }}>Thêm từ</Button>}
          </Stack>
        </Stack>
        {currentItems.length === 0 && <Alert severity="info">Chưa có từ nào được chọn.</Alert>}
        <Stack spacing={1}>
          {currentItems.map((item, index) => (
            <VocabularyItemEditor
              key={`${"id" in item ? item.id ?? "new" : "sourceTopicWordId" in item ? item.sourceTopicWordId ?? "new" : "new"}-${index}`}
              item={item}
              index={index}
              readOnly={archived || (!setId && mode !== "MANUAL")}
              mediaReadOnly={archived}
              onFindImage={() => setImagePickerIndex(index)}
              onRemoveImage={() => changeIllustration(index, { kind: "NONE" })}
              onChange={(next) => { setItems((value) => value.map((current, itemIndex) => itemIndex === index ? next : current)); setDirty(true); }}
              onRemove={() => { setItems((value) => value.filter((_current, itemIndex) => itemIndex !== index).map((current, itemIndex) => ({ ...current, displayOrder: itemIndex + 1 }))); setDirty(true); }}
            />
          ))}
        </Stack>
      </Box>

      {!archived && <StickyActionBar><Button fullWidth={false} variant="contained" startIcon={<Save />} disabled={saving || currentItems.length === 0 || !title.trim()} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu bộ từ"}</Button></StickyActionBar>}
      {imagePickerIndex != null && currentItems[imagePickerIndex] && <VocabularyImagePicker
        open
        word={currentItems[imagePickerIndex].word}
        meaningVi={currentItems[imagePickerIndex].meaningVi}
        searchTerms={currentItems[imagePickerIndex].imageSearchTerms}
        onClose={() => setImagePickerIndex(null)}
        onSelect={(media) => applyStoredMedia(imagePickerIndex, media)}
      />}
      {bulkImagesOpen && <VocabularyBulkImageSuggestions
        open={bulkImagesOpen}
        items={currentItems}
        onClose={() => setBulkImagesOpen(false)}
        onSelect={applyStoredMedia}
      />}
      <ConfirmationDialog open={archiveOpen} title="Lưu trữ bộ từ?" confirmLabel="Lưu trữ" destructive busy={saving} onCancel={() => setArchiveOpen(false)} onConfirm={() => void archive()}>
        Bộ từ sẽ không thể chỉnh sửa, nhưng toàn bộ dữ liệu và lịch sử vẫn được giữ. Bạn vẫn có thể nhân bản để dùng lại.
      </ConfirmationDialog>
    </Stack>
  );
}

function VocabularyItemEditor({ item, index, readOnly, mediaReadOnly, onChange, onRemove, onFindImage, onRemoveImage }: {
  item: VocabularySetItemInput;
  index: number;
  readOnly: boolean;
  mediaReadOnly: boolean;
  onChange: (value: VocabularySetItemInput) => void;
  onRemove: () => void;
  onFindImage: () => void;
  onRemoveImage: () => void;
}) {
  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary>
        <Stack direction="row" sx={{ width: "100%", justifyContent: "space-between", gap: 1, pr: 1 }}>
          <Box sx={{ minWidth: 0 }}><Typography variant="subtitle2">{index + 1}. {item.word || "Từ mới"}</Typography><Typography variant="body2" color="text.secondary">{item.meaningVi || "Chưa có nghĩa"}</Typography></Box>
          <Chip size="small" label={item.tier === "CORE" ? "Cốt lõi" : item.tier === "EXTENDED" ? "Mở rộng" : "Tự nhập"} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Divider sx={{ mb: 1.5 }} />
        <Stack spacing={1.5}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "96px minmax(0, 1fr)", sm: "128px minmax(0, 1fr)" }, gap: 1.5, alignItems: "center" }}>
            <IllustrationPreview item={item} />
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">Hình minh họa</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.illustration.kind === "NONE" ? "Chưa có hình" : item.illustration.kind === "STORED_MEDIA" ? "Ảnh đã lưu an toàn" : item.illustration.kind === "EMOJI" ? "Emoji từ Unit công khai" : "Ảnh nội bộ từ Unit công khai"}
              </Typography>
              {!mediaReadOnly && <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" startIcon={<ImageSearch />} onClick={onFindImage}>{item.illustration.kind === "NONE" ? "Tìm ảnh" : "Đổi ảnh"}</Button>
                {item.illustration.kind !== "NONE" && <Button size="small" color="error" startIcon={<HideImage />} onClick={onRemoveImage}>Bỏ hình</Button>}
              </Stack>}
            </Stack>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField label="Từ tiếng Anh" value={item.word} disabled={readOnly} onChange={(event) => onChange({ ...item, word: event.target.value })} />
            <TextField label="Nghĩa tiếng Việt" value={item.meaningVi} disabled={readOnly} onChange={(event) => onChange({ ...item, meaningVi: event.target.value })} />
            <TextField label="Phiên âm" value={item.phonetic ?? ""} disabled={readOnly} onChange={(event) => onChange({ ...item, phonetic: event.target.value })} />
            <TextField label="Ví dụ tiếng Anh" value={item.exampleEn ?? ""} disabled={readOnly} onChange={(event) => onChange({ ...item, exampleEn: event.target.value })} />
          </Box>
          {!readOnly && <Button color="error" startIcon={<DeleteOutlined />} onClick={onRemove} sx={{ alignSelf: "flex-start" }}>Xóa khỏi bộ</Button>}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function IllustrationPreview({ item }: { item: VocabularySetItemInput }) {
  const illustration = item.illustration;
  const common = {
    width: "100%",
    aspectRatio: "1",
    borderRadius: 2,
    border: 1,
    borderColor: "divider",
    bgcolor: "action.hover",
  } as const;
  if (illustration.kind === "EMOJI")
    return <Box role="img" aria-label={`${item.word} — ${item.meaningVi}`} sx={{ ...common, display: "grid", placeItems: "center", fontSize: 44 }}>{illustration.value}</Box>;
  if (illustration.kind === "PUBLIC_ASSET" && illustration.value)
    return <Box component="img" src={illustration.value} alt={`${item.word} — ${item.meaningVi}`} sx={{ ...common, objectFit: "cover" }} />;
  if (illustration.kind === "STORED_MEDIA" && illustration.mediaId)
    return <Box component="img" src={vocabularyMediaUrl(illustration.mediaId, "THUMBNAIL")} alt={`${item.word} — ${item.meaningVi}`} sx={{ ...common, objectFit: "cover" }} />;
  return <Box aria-label="Chưa có hình minh họa" sx={{ ...common, display: "grid", placeItems: "center" }}><HideImage color="disabled" /></Box>;
}
