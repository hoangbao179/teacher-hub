import { AutoAwesome, BookOutlined, CheckCircleOutlined, ChevronLeft, ChevronRight, SaveOutlined, VisibilityOutlined } from "@mui/icons-material";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import type {
  AssignmentAudienceType, AssignmentDetail, AssignmentDraftInput,
  AssignmentTemplateCode, AssignmentVocabularyItemInput,
  ClassListItem, StudentListItem, VocabularySetListItem,
} from "@teacher/shared";
import { assignmentActivitiesForTemplate, hasPlayableImage } from "@teacher/shared";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createAssignment, getAssignment, previewAssignment, updateAssignment,
} from "../../../api/assignments";
import { listTeacherGameClasses, listTeacherGameStudents } from "../../../api/teacherGames";
import { getVocabularySet, listVocabularySets } from "../../../api/vocabulary";
import { ageBandOptions } from "../../vocabulary/vocabularyEditor";
import { TeacherGameShell } from "../TeacherGameShell";
import { teacherWordsFromPaste, teacherWordsToPaste } from "../teacherWordDraft";

const templateOptions: Array<{ value: AssignmentTemplateCode; title: string; detail: string }> = [
  { value: "YOUNG_BEGINNER", title: "Bé mới học", detail: "Thẻ từ, nghe, ghép cặp" },
  { value: "WORD_RECOGNITION", title: "Nhớ từ nhanh", detail: "Nhận diện từ, chọn nghĩa, ghép cặp" },
  { value: "SPELLING_REVIEW", title: "Luyện chính tả", detail: "Nghe, tìm chữ thiếu, xếp chữ" },
  { value: "PRE_TEST_REVIEW", title: "Ôn trước kiểm tra", detail: "Chọn nghĩa, nghe và viết từ" },
];

const initial: AssignmentDraftInput = {
  title: "", ageBand: "G2_G3", audienceType: "OPEN_LINK",
  templateCode: "WORD_RECOGNITION", answerFeedbackMode: "IMMEDIATE",
  shuffleQuestions: true, items: [], activities: [],
};

function itemsFromDetail(detail: AssignmentDetail): AssignmentVocabularyItemInput[] {
  return detail.items.map((item) => ({
    sourceVocabularyItemId: item.sourceVocabularyItemId,
    displayOrder: item.displayOrder,
    word: item.word, meaningVi: item.meaningVi, phonetic: item.phonetic,
    partOfSpeech: item.partOfSpeech, exampleEn: item.exampleEn,
    speechText: item.speechText, tier: item.tier,
    illustration: item.illustrationSnapshot, supportsImageGame: item.supportsImageGame,
    imageSearchTerms: item.imageSearchTerms,
  }));
}

export function TeacherGameBuilderPage() {
  const routeId = useParams().id;
  const editingId = routeId ? Number(routeId) : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const [id, setId] = useState<number | undefined>(editingId);
  const [version, setVersion] = useState(1);
  const [form, setForm] = useState<AssignmentDraftInput>(initial);
  const [paste, setPaste] = useState("");
  const [previousItems, setPreviousItems] = useState<AssignmentVocabularyItemInput[]>([]);
  const [sourceMode, setSourceMode] = useState<"PASTE" | "SET">("PASTE");
  const [sets, setSets] = useState<VocabularySetListItem[]>([]);
  const [setsError, setSetsError] = useState("");
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [rosterError, setRosterError] = useState("");
  const [loading, setLoading] = useState(Boolean(editingId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(() => {
    const state = location.state as { savedNotice?: unknown } | null;
    return typeof state?.savedNotice === "string" ? state.savedNotice : "";
  });
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let canceled = false;
    void listVocabularySets({ pageSize: 50 }).then((response) => {
      if (!canceled) setSets(response.data);
    }).catch(() => { if (!canceled) setSetsError("Không tải được kho từ. Cô vẫn có thể dán từ thủ công."); });
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    let canceled = false;
    void listTeacherGameClasses().then((allClasses) => {
      if (!canceled) setClasses(allClasses);
    }).catch(() => { if (!canceled) setRosterError("Không tải được lớp học. Cô có thể lưu bài chưa phân lớp và thử lại."); });
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (form.audienceType !== "SELECTED_STUDENTS") return;
    let canceled = false;
    void listTeacherGameStudents().then((allStudents) => {
      if (!canceled) setStudents(allStudents.filter((item) => item.status === "ACTIVE"));
    }).catch(() => { if (!canceled) setRosterError("Không tải được danh sách học sinh."); });
    return () => { canceled = true; };
  }, [form.audienceType]);

  useEffect(() => {
    if (!editingId) return;
    let canceled = false;
    void getAssignment(editingId).then((detail) => {
      if (canceled) return;
      if (detail.status !== "DRAFT") {
        navigate("/admin/games", { replace: true });
        return;
      }
      const loadedItems = itemsFromDetail(detail);
      setId(detail.id);
      setVersion(detail.version);
      setPreviousItems(loadedItems);
      setPaste(teacherWordsToPaste(loadedItems));
      setSourceMode(detail.vocabularySetId ? "SET" : "PASTE");
      setForm({
        title: detail.title,
        teachingClassId: detail.teachingClassId ?? undefined,
        textbookName: detail.textbookName ?? undefined,
        lessonName: detail.lessonName ?? undefined,
        instruction: detail.instruction ?? undefined,
        vocabularySetId: detail.vocabularySetId ?? undefined,
        ageBand: detail.ageBand,
        audienceType: detail.audienceType ?? "OPEN_LINK",
        classId: detail.classId ?? undefined,
        selectedStudentIds: detail.selectedStudentIds,
        templateCode: detail.templateCode,
        availableFrom: detail.availableFrom ?? undefined,
        dueAt: detail.dueAt ?? undefined,
        maxAttempts: detail.maxAttempts ?? undefined,
        passScore: detail.passScore ?? undefined,
        answerFeedbackMode: detail.answerFeedbackMode,
        shuffleQuestions: detail.shuffleQuestions,
        items: loadedItems,
        activities: detail.activities.map(({ displayOrder, mechanic, presentation, required, config }) =>
          ({ displayOrder, mechanic, presentation, required, config })),
      });
    }).catch((caught) => { if (!canceled) setError(caught instanceof Error ? caught.message : "Không mở được bài nháp."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [editingId, navigate]);

  const wordDraft = useMemo(() => teacherWordsFromPaste(paste, previousItems), [paste, previousItems]);
  const activities = useMemo(() => form.templateCode === "CUSTOM" ? form.activities
    : assignmentActivitiesForTemplate(form.templateCode, {
      ageBand: form.ageBand, itemCount: wordDraft.items.length,
      imageItemCount: wordDraft.items.filter(hasPlayableImage).length,
      exampleItemCount: wordDraft.items.filter((item) => Boolean(item.exampleEn)).length,
    }).activities, [form.ageBand, form.activities, form.templateCode, wordDraft.items]);
  const warnings = useMemo(() => form.templateCode === "CUSTOM" ? [] :
    assignmentActivitiesForTemplate(form.templateCode, {
      ageBand: form.ageBand, itemCount: wordDraft.items.length,
      imageItemCount: wordDraft.items.filter(hasPlayableImage).length,
      exampleItemCount: wordDraft.items.filter((item) => Boolean(item.exampleEn)).length,
    }).warnings, [form.ageBand, form.templateCode, wordDraft.items]);

  const cannotSave = !form.title.trim() || form.title.length > 160 || wordDraft.errors.length > 0
    || activities.length === 0 || busy
    || (form.audienceType === "CLASS" && !form.classId);

  const chooseSet = async (raw: string) => {
    if (!raw) return;
    setBusy(true);
    setError("");
    try {
      const selected = await getVocabularySet(Number(raw));
      const mapped: AssignmentVocabularyItemInput[] = selected.items.map((item, index) => ({
        sourceVocabularyItemId: item.id, displayOrder: index + 1,
        word: item.word, meaningVi: item.meaningVi, phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech, exampleEn: item.exampleEn,
        speechText: item.speechText, tier: item.tier, illustration: item.illustration,
        supportsImageGame: item.illustration.kind !== "NONE", imageSearchTerms: item.imageSearchTerms,
      }));
      setPreviousItems(mapped);
      setPaste(teacherWordsToPaste(mapped));
      setForm((current) => ({ ...current, vocabularySetId: selected.id,
        ageBand: selected.ageBand, title: current.title || selected.title }));
      setCardIndex(0);
      setFlipped(false);
      setSavedNotice("");
      setServerWarnings([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở bộ từ.");
    } finally {
      setBusy(false);
    }
  };

  const changePaste = (value: string) => {
    setPaste(value);
    setSourceMode("PASTE");
    setForm((current) => ({ ...current, vocabularySetId: undefined }));
    setCardIndex(0);
    setFlipped(false);
    setSavedNotice("");
    setServerWarnings([]);
  };

  const save = async () => {
    if (cannotSave) return;
    setBusy(true);
    setError("");
    setSavedNotice("");
    setServerWarnings([]);
    try {
      const request: AssignmentDraftInput = {
        ...form,
        title: form.title.trim(),
        vocabularySetId: form.vocabularySetId,
        selectedStudentIds: form.audienceType === "SELECTED_STUDENTS" ? (form.selectedStudentIds ?? []) : [],
        classId: form.audienceType === "CLASS" ? form.classId : undefined,
        items: wordDraft.items,
        activities,
      };
      const detail = id
        ? await updateAssignment(id, { ...request, version })
        : await createAssignment(request);
      setId(detail.id);
      setVersion(detail.version);
      const updatedItems = itemsFromDetail(detail);
      setPreviousItems(updatedItems);
      setPaste(teacherWordsToPaste(updatedItems));
      const savedMessage = "Đã lưu bản nháp. Cô có thể quay lại sửa bất kỳ lúc nào.";
      setSavedNotice(savedMessage);
      try {
        const preview = await previewAssignment(detail.id);
        setServerWarnings(preview.warnings);
      } catch {
        setServerWarnings(["Đã lưu bài nhưng chưa kiểm tra được bản xem trước từ máy chủ."]);
      }
      if (!editingId) navigate(`/admin/games/${detail.id}/edit`, { replace: true, state: { savedNotice: savedMessage } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu bài nháp.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <TeacherGameShell title="Đang mở bài…" subtitle="Tải bản nháp đã lưu."><CircularProgress /></TeacherGameShell>;

  const visibleCard = wordDraft.items[Math.min(cardIndex, Math.max(0, wordDraft.items.length - 1))];
  return <TeacherGameShell title={id ? "Chỉnh sửa bài từ vựng" : "Tạo trò chơi từ vựng"}
    subtitle="Một trang soạn bài đơn giản theo Unit hoặc Lesson. Ảnh là tùy chọn, không cần tìm trên Internet.">
    <Stack spacing={2.25} data-testid="teacher-game-builder-page">
      {error && <Alert severity="error">{error}</Alert>}
      {savedNotice && <Alert severity="success" icon={<CheckCircleOutlined />}>{savedNotice}</Alert>}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent><Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <BookOutlined color="primary" />
            <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>1. Bài học của cô</Typography>
          </Stack>
          <TextField fullWidth required label="Tên bài ôn tập" data-testid="teacher-game-title"
            placeholder="Ví dụ: Food & Drinks"
            value={form.title} onChange={(event) => { setForm((current) => ({ ...current, title: event.target.value })); setSavedNotice(""); }}
            slotProps={{ htmlInput: { maxLength: 160 } }} />
          <TextField fullWidth label="Giáo trình (tùy chọn)" data-testid="teacher-game-textbook"
            placeholder="Ví dụ: Family and Friends"
            value={form.textbookName ?? ""} onChange={(event) => { setForm((current) => ({ ...current, textbookName: event.target.value })); setSavedNotice(""); }}
            slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField fullWidth label="Unit / Bài học (tùy chọn)" data-testid="teacher-game-lesson"
            placeholder="Ví dụ: Unit 4 – Lesson 2"
            value={form.lessonName ?? ""} onChange={(event) => { setForm((current) => ({ ...current, lessonName: event.target.value })); setSavedNotice(""); }}
            slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField select fullWidth label="Lưu bài vào lớp" data-testid="teacher-game-teaching-class"
            value={form.teachingClassId ?? ""}
            onChange={(event) => { setForm((current) => ({ ...current, teachingClassId: event.target.value ? Number(event.target.value) : undefined })); setSavedNotice(""); }}>
            <MenuItem value="">Bài dùng chung / Chưa phân lớp</MenuItem>
            {classes.map((item) => <MenuItem key={item.id} value={item.id} disabled={item.status !== "ACTIVE" && item.id !== form.teachingClassId}>
              {item.name}{item.status !== "ACTIVE" ? " (đã ngừng)" : ""}
            </MenuItem>)}
          </TextField>
          {rosterError && <Alert severity="warning">{rosterError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Lớp này dùng để sắp xếp và tìm lại bài. Cô vẫn có thể giao bài bằng link chung hoặc nhân bản sang lớp khác.
          </Typography>
          <TextField select fullWidth label="Nhóm lớp" value={form.ageBand}
            onChange={(event) => { setForm((current) => ({ ...current, ageBand: event.target.value as AssignmentDraftInput["ageBand"] })); setSavedNotice(""); }}>
            {ageBandOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </Stack></CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent><Stack spacing={1.5}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>2. Từ vựng</Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            <Button variant={sourceMode === "PASTE" ? "contained" : "outlined"}
              onClick={() => setSourceMode("PASTE")} sx={{ minHeight: 44 }}>Dán từ bên ngoài</Button>
            <Button variant={sourceMode === "SET" ? "contained" : "outlined"}
              onClick={() => setSourceMode("SET")} sx={{ minHeight: 44 }}>Dùng bộ từ đã lưu</Button>
          </Stack>
          {sourceMode === "SET" && <TextField select fullWidth label="Chọn bộ từ" value={form.vocabularySetId ?? ""}
            onChange={(event) => void chooseSet(String(event.target.value))}>
            {sets.map((item) => <MenuItem value={item.id} key={item.id}>{item.title} · {item.itemCount} từ</MenuItem>)}
          </TextField>}
          {sourceMode === "SET" && setsError && <Alert severity="warning">{setsError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Dán từ từ Word, Excel hoặc tài liệu: mỗi dòng một từ tiếng Anh và nghĩa Việt, ngăn bằng dấu phẩy, tab, chấm phẩy hoặc " - ".
          </Typography>
          <TextField fullWidth multiline minRows={5} maxRows={13} data-testid="teacher-game-words"
            label="Danh sách từ vựng" placeholder={"apple - quả táo\nbanana - quả chuối\nhungry - đói"}
            value={paste} onChange={(event) => changePaste(event.target.value)} />
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Chip color={wordDraft.errors.length ? "default" : "success"} label={`${wordDraft.items.length} từ hợp lệ`} />
            <Chip variant="outlined" label={`${wordDraft.items.filter(hasPlayableImage).length} từ có hình/emoji`} />
          </Stack>
          {wordDraft.errors.map((message) => <Alert severity="warning" key={message}>{message}</Alert>)}
          {!wordDraft.errors.length && <Alert severity="success">Danh sách hợp lệ. Từ không có hình vẫn được tạo hoạt động chữ/nghĩa.</Alert>}
          {wordDraft.items.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
            {wordDraft.items.slice(0, 12).map((item, index) => <Box key={index} sx={{ border: "1px solid #dfece6", borderRadius: 2, p: 1.25, display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Typography aria-hidden="true" sx={{ width: 32, textAlign: "center", fontSize: 25 }}>
                {item.illustration.kind === "EMOJI" ? item.illustration.value : "•"}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{item.word}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{item.meaningVi}</Typography>
              </Box>
            </Box>)}
            {wordDraft.items.length > 12 && <Typography variant="body2" color="text.secondary">Và {wordDraft.items.length - 12} từ nữa…</Typography>}
          </Box>}
        </Stack></CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent><Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <AutoAwesome color="primary" />
            <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>3. Kiểu luyện tập</Typography>
          </Stack>
          <Typography color="text.secondary" variant="body2">Hệ thống tạo lộ trình từ danh sách của cô. Không cần tự viết từng câu hỏi.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
            {templateOptions.map((option) => <Button key={option.value} variant={form.templateCode === option.value ? "contained" : "outlined"}
              aria-pressed={form.templateCode === option.value}
              onClick={() => { setForm((current) => ({ ...current, templateCode: option.value })); setSavedNotice(""); }}
              sx={{ minHeight: 77, textAlign: "left", justifyContent: "flex-start", alignItems: "flex-start", flexDirection: "column", borderRadius: 2, textTransform: "none", px: 2, py: 1.25 }}>
              <Typography sx={{ color: "inherit", fontWeight: 800 }}>{option.title}</Typography>
              <Typography variant="caption" sx={{ color: "inherit", opacity: 0.85 }}>{option.detail}</Typography>
            </Button>)}
          </Box>
          {form.templateCode === "CUSTOM" && <Alert severity="info">Bài cũ đang dùng lộ trình tùy chỉnh. Cô có thể giữ nguyên hoặc chọn mẫu luyện tập mới ở trên.</Alert>}
          <Chip label={`${activities.length} hoạt động được đề xuất`} sx={{ alignSelf: "flex-start" }} />
          {warnings.length > 0 && <Typography variant="caption" color="text.secondary">
            {warnings.join(" ")} Không bắt buộc cô đi tìm ảnh.
          </Typography>}
        </Stack></CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent><Stack spacing={1.5}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>4. Dự định giao cho ai?</Typography>
          <TextField select fullWidth label="Người nhận" value={form.audienceType ?? "OPEN_LINK"}
            onChange={(event) => {
              setForm((current) => ({ ...current, audienceType: event.target.value as AssignmentAudienceType,
                classId: event.target.value === "CLASS" ? current.teachingClassId : undefined, selectedStudentIds: [] }));
              setSavedNotice("");
              setRosterError("");
            }}>
            <MenuItem value="OPEN_LINK">Mọi người có link/QR</MenuItem>
            <MenuItem value="CLASS">Một lớp đang học</MenuItem>
            <MenuItem value="SELECTED_STUDENTS">Một số học sinh</MenuItem>
          </TextField>
          {form.audienceType === "CLASS" && <TextField select fullWidth label="Chọn lớp" value={form.classId ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, classId: Number(event.target.value) }))}>
            {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>}
          {form.audienceType === "SELECTED_STUDENTS" && <Box sx={{ maxHeight: 240, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: 2, p: 1 }}>
            {students.length === 0 && <Typography variant="body2" color="text.secondary">Chưa có học sinh hoặc danh sách đang tải.</Typography>}
            {students.map((student) => <FormControlLabel key={student.id} sx={{ display: "flex", m: 0 }}
              label={student.fullName}
              control={<Checkbox checked={(form.selectedStudentIds ?? []).includes(student.id)}
                onChange={(_event, checked) => setForm((current) => ({
                  ...current, selectedStudentIds: checked
                    ? [...(current.selectedStudentIds ?? []), student.id]
                    : (current.selectedStudentIds ?? []).filter((value) => value !== student.id),
                }))} />} />)}
          </Box>}
          <Alert severity="info">Cô đang soạn bản nháp. Link và QR sẽ được tạo ở giai đoạn mở chức năng giao bài; hiện chưa gửi gì đến học sinh.</Alert>
        </Stack></CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "flex-end" }}>
        <Button variant="outlined" size="large" startIcon={<VisibilityOutlined />}
          disabled={wordDraft.items.length === 0}
          onClick={() => { setShowPreview((value) => !value); setCardIndex(0); setFlipped(false); }}
          sx={{ minHeight: 48 }}>{showPreview ? "Ẩn xem trước" : "Xem thử thẻ học"}</Button>
        <Button variant="contained" size="large" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SaveOutlined />}
          disabled={cannotSave} onClick={() => void save()} sx={{ minHeight: 48 }}
          data-testid="teacher-game-save">{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button>
      </Stack>

      {showPreview && visibleCard && <Card variant="outlined" data-testid="teacher-game-preview" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <CardContent><Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
          <Chip label="XEM THỬ NỘI DUNG • Không ghi kết quả học sinh" />
          <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>Thẻ học từ vựng</Typography>
          <Button onClick={() => setFlipped((value) => !value)}
            aria-label="Lật thẻ xem từ hoặc nghĩa"
            sx={{ width: "100%", minHeight: 180, p: 2, border: "2px solid #bfebd9", borderRadius: 3, bgcolor: "#eefbf4",
              display: "flex", flexDirection: "column", gap: 1, textTransform: "none" }}>
            {visibleCard.illustration.kind === "EMOJI" && <Typography aria-hidden="true" sx={{ fontSize: 54 }}>{visibleCard.illustration.value}</Typography>}
            <Typography variant="h5" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
              {flipped ? visibleCard.meaningVi : visibleCard.word}
            </Typography>
            <Typography variant="caption">Chạm để lật thẻ</Typography>
          </Button>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button aria-label="Thẻ trước" disabled={cardIndex === 0} onClick={() => { setCardIndex((value) => value - 1); setFlipped(false); }}><ChevronLeft /></Button>
            <Typography>{cardIndex + 1}/{wordDraft.items.length}</Typography>
            <Button aria-label="Thẻ sau" disabled={cardIndex >= wordDraft.items.length - 1} onClick={() => { setCardIndex((value) => value + 1); setFlipped(false); }}><ChevronRight /></Button>
          </Stack>
          {serverWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ width: "100%" }}>{warning}</Alert>)}
        </Stack></CardContent>
      </Card>}
    </Stack>
  </TeacherGameShell>;
}
