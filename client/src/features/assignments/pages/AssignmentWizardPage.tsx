import {
  ArrowBack,
  ArrowForward,
  Check,
  CloudDone,
  AutoStories,
  Create,
  MenuBook,
  Preview,
  Publish,
  Save,
} from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";
import type {
  AssignmentActivityInput,
  AssignmentAudienceType,
  AssignmentDetail,
  AssignmentDraftInput,
  AssignmentTemplateCode,
  AssignmentVocabularyItemInput,
  ClassListItem,
  LearningAgeBand,
  StudentListItem,
  VocabularySetDetail,
  VocabularySetListItem,
  VocabularyTopicListItem,
  VocabularyTopicSuggestionItem,
} from "@teacher/shared";
import { assignmentActivitiesForTemplate, hasPlayableImage } from "@teacher/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createAssignment,
  getAssignment,
  previewAssignment,
  publishAssignment,
  updateAssignment,
} from "../../../api/assignments";
import { api } from "../../../api/client";
import {
  createVocabularySet,
  getVocabularySet,
  importPublicUnitSnapshot,
  listVocabularySets,
  listVocabularyTopics,
  suggestVocabularyTopic,
} from "../../../api/vocabulary";
import {
  ConfirmationDialog,
  FormSection,
  PageHeader,
  StickyActionBar,
} from "../../../components/UiKit";
import { learningLevels, publishedUnits } from "../../learning/content/vocabularyCatalog";
import {
  ageBandLabel,
  ageBandOptions,
  levelSlugsByAgeBand,
  publicUnitSnapshot,
  suggestionItems,
  vocabularyTopicIcon,
} from "../../vocabulary/vocabularyEditor";
import {
  audienceLabels,
  gamePresentationLabels,
  templateLabels,
} from "../assignmentUi";

const steps = ["Người nhận", "Bộ từ", "Từ vựng", "Hoạt động", "Thiết lập", "Xem trước"];
const templates: AssignmentTemplateCode[] = [
  "YOUNG_BEGINNER",
  "WORD_RECOGNITION",
  "SPELLING_REVIEW",
  "PRE_TEST_REVIEW",
  "CUSTOM",
];
const customActivities: AssignmentActivityInput[] = [
  { displayOrder: 1, mechanic: "EXPLORE_CARD", presentation: "FLASHCARD", required: true },
  { displayOrder: 2, mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_IMAGE", required: true },
  { displayOrder: 3, mechanic: "SELECT_ONE", presentation: "IMAGE_PICK_WORD", required: true },
  { displayOrder: 4, mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD", required: true },
  { displayOrder: 5, mechanic: "MATCH_PAIRS", presentation: "MATCH_WORD_MEANING", required: true },
  { displayOrder: 6, mechanic: "MEMORY_PAIRS", presentation: "MEMORY_WORD_MEANING", required: true },
  { displayOrder: 7, mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD", required: true },
  { displayOrder: 8, mechanic: "BUILD_WORD", presentation: "MISSING_LETTER", required: true },
  { displayOrder: 9, mechanic: "SELECT_ONE", presentation: "FEED_MONSTER", required: true },
  { displayOrder: 10, mechanic: "SELECT_ONE", presentation: "POP_BALLOON", required: true },
  { displayOrder: 11, mechanic: "SELECT_ONE", presentation: "OPEN_TREASURE", required: true },
  { displayOrder: 12, mechanic: "SELECT_ONE", presentation: "CHOOSE_TRAIN_CARRIAGE", required: true },
];

const initial: AssignmentDraftInput = {
  title: "",
  ageBand: "G2_G3",
  templateCode: "WORD_RECOGNITION",
  answerFeedbackMode: "IMMEDIATE",
  shuffleQuestions: true,
  items: [],
  activities: [],
};

function toInput(detail: AssignmentDetail): AssignmentDraftInput {
  return {
    title: detail.title,
    instruction: detail.instruction ?? undefined,
    vocabularySetId: detail.vocabularySetId ?? undefined,
    ageBand: detail.ageBand,
    audienceType: detail.audienceType ?? undefined,
    classId: detail.classId ?? undefined,
    selectedStudentIds: detail.selectedStudentIds,
    templateCode: detail.templateCode,
    availableFrom: detail.availableFrom ?? undefined,
    dueAt: detail.dueAt ?? undefined,
    maxAttempts: detail.maxAttempts ?? undefined,
    passScore: detail.passScore ?? undefined,
    answerFeedbackMode: detail.answerFeedbackMode,
    shuffleQuestions: detail.shuffleQuestions,
    items: detail.items.map(({ sourceVocabularyItemId, displayOrder, word, meaningVi, phonetic, partOfSpeech, exampleEn, speechText, tier, illustrationSnapshot, supportsImageGame, imageSearchTerms }) => ({
      sourceVocabularyItemId,
      displayOrder,
      word,
      meaningVi,
      phonetic,
      partOfSpeech,
      exampleEn,
      speechText,
      tier,
      illustration: illustrationSnapshot,
      supportsImageGame,
      imageSearchTerms,
    })),
    activities: detail.activities.map(({ displayOrder, mechanic, presentation, required, config }) => ({
      displayOrder, mechanic, presentation, required, config,
    })),
  };
}

function dateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoOrUndefined(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function AssignmentWizardPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = params.id ? Number(params.id) : undefined;
  const [id, setId] = useState<number | undefined>(editingId);
  const [version, setVersion] = useState(1);
  const [form, setForm] = useState<AssignmentDraftInput>(initial);
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [studentsError, setStudentsError] = useState("");
  const [loading, setLoading] = useState(Boolean(editingId));
  const [saving, setSaving] = useState(false);
  const [assignmentSaveError, setAssignmentSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    void api<ClassListItem[]>("/api/classes")
      .then((items) => setClasses(items.filter((item) => item.status === "ACTIVE")))
      .catch((reason: Error) => setClassesError(reason.message))
      .finally(() => setClassesLoading(false));
    void api<StudentListItem[]>("/api/students")
      .then((items) => setStudents(items.filter((item) => item.status === "ACTIVE")))
      .catch((reason: Error) => setStudentsError(reason.message))
      .finally(() => setStudentsLoading(false));
    if (editingId) {
      void getAssignment(editingId).then((detail) => {
        if (detail.status !== "DRAFT") {
          navigate(`/admin/assignments/${editingId}`, { replace: true });
          return;
        }
        setForm(toInput(detail));
        setVersion(detail.version);
      }).catch((reason: Error) => setAssignmentSaveError(reason.message)).finally(() => setLoading(false));
    }
  }, [editingId, navigate]);

  const templateResult = useMemo(() => assignmentActivitiesForTemplate(form.templateCode, {
    ageBand: form.ageBand,
    itemCount: form.items.length,
    imageItemCount: form.items.filter(hasPlayableImage).length,
    exampleItemCount: form.items.filter((item) => Boolean(item.exampleEn)).length,
  }), [form.ageBand, form.items, form.templateCode]);

  const patch = <K extends keyof AssignmentDraftInput>(key: K, value: AssignmentDraftInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseSet = async (setId: number) => {
    setSaving(true);
    setAssignmentSaveError("");
    try {
      const selected: VocabularySetDetail = await getVocabularySet(setId);
      const mapped: AssignmentVocabularyItemInput[] = selected.items.map((item, index) => ({
        sourceVocabularyItemId: item.id,
        displayOrder: index + 1,
        word: item.word,
        meaningVi: item.meaningVi,
        phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech,
        exampleEn: item.exampleEn,
        speechText: item.speechText,
        tier: item.tier,
        illustration: item.illustration,
        supportsImageGame: item.supportsImageGame,
        imageSearchTerms: item.imageSearchTerms,
      }));
      const result = assignmentActivitiesForTemplate(form.templateCode, {
        ageBand: selected.ageBand,
        itemCount: mapped.length,
        imageItemCount: mapped.filter(hasPlayableImage).length,
        exampleItemCount: mapped.filter((item) => Boolean(item.exampleEn)).length,
      });
      setForm((current) => ({
        ...current,
        vocabularySetId: selected.id,
        ageBand: selected.ageBand,
        title: current.title || selected.title,
        items: mapped,
        activities: current.templateCode === "CUSTOM" ? current.activities : result.activities,
      }));
      setSaved(false);
    } catch (reason) {
      setAssignmentSaveError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setAssignmentSaveError("");
    try {
      const normalized = {
        ...form,
        title: form.title.trim() || "Bài tập chưa đặt tên",
        selectedStudentIds: form.audienceType === "SELECTED_STUDENTS" ? form.selectedStudentIds : [],
        classId: form.audienceType === "CLASS" ? form.classId : undefined,
      };
      const detail = id
        ? await updateAssignment(id, { ...normalized, version })
        : await createAssignment(normalized);
      setId(detail.id);
      setVersion(detail.version);
      setForm(toInput(detail));
      setSaved(true);
      if (!editingId) window.history.replaceState(null, "", `/admin/assignments/${detail.id}/edit`);
      return detail;
    } catch (reason) {
      setAssignmentSaveError((reason as Error).message);
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const detail = await save();
    if (!detail) return;
    if (step === 4) {
      try {
        const preview = await previewAssignment(detail.id);
        setPreviewWarnings(preview.warnings);
      } catch (reason) {
        setAssignmentSaveError((reason as Error).message);
        return;
      }
    }
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const publish = async () => {
    const detail = await save();
    if (!detail) return;
    setSaving(true);
    try {
      const result = await publishAssignment(detail.id, { version: detail.version });
      navigate(`/admin/assignments/${detail.id}`, {
        replace: true,
        state: {
          success: "Đã giao bài và tạo liên kết truy cập an toàn.",
          shares: result.shares,
        },
      });
    } catch (reason) {
      setAssignmentSaveError((reason as Error).message);
    } finally {
      setSaving(false);
      setPublishOpen(false);
    }
  };

  const editImages = async () => {
    const detail = await save();
    if (!detail || !form.vocabularySetId) return;
    navigate(
      `/admin/vocabulary/${form.vocabularySetId}?returnTo=${encodeURIComponent(`/admin/assignments/${detail.id}/edit`)}`,
    );
  };

  if (loading) return <LinearProgress aria-label="Đang tải bài tập" />;
  return (
    <Stack spacing={2.25} data-testid="assignment-wizard-page">
      <PageHeader title={id ? "Chỉnh sửa bài tập" : "Tạo bài tập từ vựng"} subtitle={`Bước ${step + 1}/${steps.length}: ${steps[step]}`} />
      <Stepper activeStep={step} alternativeLabel sx={{ display: { xs: "none", md: "flex" } }}>
        {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>
      <LinearProgress variant="determinate" value={((step + 1) / steps.length) * 100} sx={{ display: { md: "none" } }} />
      {assignmentSaveError && <Alert severity="error">{assignmentSaveError}</Alert>}
      {saved && <Alert severity="success" icon={<CloudDone />}>Đã lưu bản nháp.</Alert>}

      {step === 0 && <AudienceStep
        form={form}
        classes={classes}
        students={students}
        classesLoading={classesLoading}
        studentsLoading={studentsLoading}
        classesError={classesError}
        studentsError={studentsError}
        patch={patch}
      />}
      {step === 1 && <VocabularySetStep
        form={form}
        initialSetId={Number(searchParams.get("vocabularySetId")) || undefined}
        chooseSet={chooseSet}
        createManual={async () => {
          const detail = await save();
          if (!detail) return;
          navigate(
            `/admin/vocabulary/new?returnTo=${encodeURIComponent(`/admin/assignments/${detail.id}/edit`)}`,
          );
        }}
      />}
      {step === 2 && <WordsStep form={form} patch={patch} />}
      {step === 3 && <ActivitiesStep form={form} warnings={templateResult.warnings} patch={patch} editImages={editImages} />}
      {step === 4 && <SettingsStep form={form} patch={patch} />}
      {step === 5 && <PreviewStep form={form} warnings={previewWarnings} editImages={editImages} />}

      <StickyActionBar>
        {step > 0 && <Button startIcon={<ArrowBack />} disabled={saving} onClick={() => setStep((value) => value - 1)}>Quay lại</Button>}
        <Button startIcon={<Save />} disabled={saving} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu nháp"}</Button>
        {step < steps.length - 1
          ? <Button variant="contained" endIcon={<ArrowForward />} disabled={saving} onClick={() => void next()}>Tiếp tục</Button>
          : <Button variant="contained" startIcon={<Publish />} disabled={saving} onClick={() => setPublishOpen(true)}>Giao bài</Button>}
      </StickyActionBar>
      <ConfirmationDialog
        open={publishOpen}
        title="Giao bài tập?"
        confirmLabel="Giao bài"
        busy={saving}
        onCancel={() => setPublishOpen(false)}
        onConfirm={() => void publish()}
      >
        <Typography>Bản chụp từ vựng và danh sách người nhận sẽ được cố định. Sau khi giao, nội dung bài không thể sửa.</Typography>
      </ConfirmationDialog>
    </Stack>
  );
}

type Patch = <K extends keyof AssignmentDraftInput>(key: K, value: AssignmentDraftInput[K]) => void;

function AudienceStep({ form, classes, students, classesLoading, studentsLoading, classesError, studentsError, patch }: {
  form: AssignmentDraftInput; classes: ClassListItem[]; students: StudentListItem[]; patch: Patch;
  classesLoading: boolean; studentsLoading: boolean; classesError: string; studentsError: string;
}) {
  return <FormSection title="Ai sẽ nhận bài?">
    <TextField select label="Người nhận" value={form.audienceType ?? ""} onChange={(event) => patch("audienceType", event.target.value as AssignmentAudienceType)}>
      {Object.entries(audienceLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
    {classesLoading && form.audienceType === "CLASS" && <LinearProgress aria-label="Đang tải lớp" />}
    {studentsLoading && form.audienceType === "SELECTED_STUDENTS" && <LinearProgress aria-label="Đang tải học sinh" />}
    {classesError && form.audienceType === "CLASS" && <Alert severity="error">Không tải được lớp: {classesError}</Alert>}
    {studentsError && form.audienceType === "SELECTED_STUDENTS" && <Alert severity="error">Không tải được học sinh: {studentsError}</Alert>}
    {form.audienceType === "CLASS" && <TextField select label="Lớp" value={form.classId ?? ""} onChange={(event) => patch("classId", Number(event.target.value))}>
      {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} ({item.activeStudentCount})</MenuItem>)}
    </TextField>}
    {form.audienceType === "SELECTED_STUDENTS" && <TextField
      select
      label="Học sinh"
      value={form.selectedStudentIds ?? []}
      onChange={(event) => patch("selectedStudentIds", event.target.value as unknown as number[])}
      slotProps={{ select: { multiple: true } }}
    >
      {students.map((item) => <MenuItem key={item.id} value={item.id}><Checkbox checked={(form.selectedStudentIds ?? []).includes(item.id)} />{item.fullName}</MenuItem>)}
    </TextField>}
    {form.audienceType === "OPEN_LINK" && <Alert severity="info">Bất kỳ ai có liên kết bí mật đều có thể mở bài. Không tạo danh sách người nhận.</Alert>}
  </FormSection>;
}

type VocabularySourceTab = "SETS" | "TOPICS" | "UNITS";

function TopicIcon({ iconKey }: { iconKey: string }) {
  return <Typography aria-hidden sx={{ fontSize: 30 }}>
    {vocabularyTopicIcon(iconKey)}
  </Typography>;
}

function VocabularySetStep({ form, initialSetId, chooseSet, createManual }: {
  form: AssignmentDraftInput;
  initialSetId?: number;
  chooseSet: (id: number) => Promise<void>;
  createManual: () => Promise<void>;
}) {
  const [tab, setTab] = useState<VocabularySourceTab>("SETS");
  const [sets, setSets] = useState<VocabularySetListItem[]>([]);
  const [topics, setTopics] = useState<VocabularyTopicListItem[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [setsError, setSetsError] = useState("");
  const [topicsError, setTopicsError] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [unitError, setUnitError] = useState("");
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState<LearningAgeBand | "">("");
  const [ageBand, setAgeBand] = useState<LearningAgeBand>(form.ageBand);
  const [topicSlug, setTopicSlug] = useState("");
  const [suggestions, setSuggestions] = useState<VocabularyTopicSuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const loadSets = useCallback(async () => {
    setSetsLoading(true);
    setSetsError("");
    try {
      const result = await listVocabularySets({ pageSize: 50 });
      setSets(result.data.filter((item) => item.status === "ACTIVE"));
    } catch (reason) {
      setSetsError(reason instanceof Error ? reason.message : "Không tải được bộ từ.");
    } finally {
      setSetsLoading(false);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setTopicsError("");
    try {
      const result = await listVocabularyTopics({ pageSize: 50, ageBand });
      setTopics(result.data);
    } catch (reason) {
      setTopicsError(reason instanceof Error ? reason.message : "Không tải được chủ đề.");
    } finally {
      setTopicsLoading(false);
    }
  }, [ageBand]);

  useEffect(() => {
    void Promise.resolve().then(loadSets);
  }, [loadSets]);

  useEffect(() => {
    if (tab === "TOPICS") void Promise.resolve().then(loadTopics);
  }, [loadTopics, tab]);

  useEffect(() => {
    if (!initialSetId || form.vocabularySetId === initialSetId) return;
    void chooseSet(initialSetId);
  }, [chooseSet, form.vocabularySetId, initialSetId]);

  useEffect(() => {
    if (!topicSlug) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return undefined;
      setSuggestionsLoading(true);
      setSuggestionError("");
      return suggestVocabularyTopic({ topicSlug, ageBand, targetCount: 10 });
    }).then((result) => {
      if (active && result) setSuggestions(result.items);
    }).catch((reason: Error) => {
      if (active) setSuggestionError(reason.message);
    }).finally(() => {
      if (active) setSuggestionsLoading(false);
    });
    return () => { active = false; };
  }, [ageBand, topicSlug]);

  const compatibleUnits = useMemo(() => {
    const compatibleSlugs = levelSlugsByAgeBand[ageBand] as readonly string[];
    return publishedUnits.filter((unit) => compatibleSlugs.includes(unit.levelSlug));
  }, [ageBand]);
  const selectedUnit = compatibleUnits.find((unit) => unit.id === unitId) ?? null;
  const changeAgeBand = (value: LearningAgeBand) => {
    setAgeBand(value);
    const unit = publishedUnits.find((item) => item.id === unitId);
    if (unit && !(levelSlugsByAgeBand[value] as readonly string[]).includes(unit.levelSlug))
      setUnitId("");
  };

  const filteredSets = sets.filter((item) =>
    (!search || `${item.title} ${item.description ?? ""}`
      .toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))
    && (!ageFilter || item.ageBand === ageFilter));
  const selectedSuggestions = suggestions.filter((item) => item.selected);
  const suggestedPreviewItems = selectedSuggestions.map(() => ({
    illustration: { kind: "NONE" as const },
  }));
  const imageCount = suggestedPreviewItems.filter(hasPlayableImage).length;

  const createFromTopic = async () => {
    const topic = topics.find((item) => item.slug === topicSlug);
    if (!topic || !selectedSuggestions.length || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setSuggestionError("");
    try {
      const created = await createVocabularySet({
        title: topic.titleVi,
        sourceType: "TOPIC_CATALOG",
        sourceReference: { topicSlug },
        ageBand,
        items: suggestionItems({
          topic,
          ageBand,
          targetCount: 10,
          items: suggestions,
          selectedCount: selectedSuggestions.length,
        }),
      });
      await loadSets();
      await chooseSet(created.id);
      setTab("SETS");
    } catch (reason) {
      setSuggestionError(reason instanceof Error ? reason.message : "Không tạo được bộ từ.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const importUnit = async () => {
    const unit = publishedUnits.find((item) => item.id === unitId);
    if (!unit || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setUnitError("");
    try {
      const created = await importPublicUnitSnapshot(publicUnitSnapshot(unit));
      await loadSets();
      await chooseSet(created.id);
      setTab("SETS");
    } catch (reason) {
      setUnitError(reason instanceof Error ? reason.message : "Không import được Unit.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  return <FormSection
    title="Chọn nguồn từ vựng"
    description="Bộ từ sẽ được chụp lại khi giao để nội dung bài không bị đổi."
  >
    <Tabs
      value={tab}
      onChange={(_event, value: VocabularySourceTab) => {
        setTab(value);
        setTopicsError("");
        setSuggestionError("");
        setUnitError("");
      }}
      variant="scrollable"
      allowScrollButtonsMobile
    >
      <Tab value="SETS" label="Bộ từ của tôi" />
      <Tab value="TOPICS" label="Chủ đề có sẵn" />
      <Tab value="UNITS" label="Unit công khai" />
    </Tabs>

    {tab === "SETS" && <Stack spacing={1.5}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 220px" }, gap: 1 }}>
        <TextField label="Tìm bộ từ" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField select label="Khối tuổi" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as LearningAgeBand | "")}>
          <MenuItem value="">Tất cả</MenuItem>
          {ageBandOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </TextField>
      </Box>
      {setsLoading && <LinearProgress aria-label="Đang tải bộ từ" />}
      {setsError && <Alert severity="error" action={<Button color="inherit" onClick={() => void loadSets()}>Thử lại</Button>}>{setsError}</Alert>}
      {!setsLoading && !setsError && filteredSets.length === 0 && <Stack spacing={1.25}>
        <Alert severity="info">Cô chưa có bộ từ nào.</Alert>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button variant="contained" startIcon={<AutoStories />} onClick={() => setTab("TOPICS")}>Tạo từ chủ đề</Button>
          <Button variant="outlined" startIcon={<Create />} onClick={() => void createManual()}>Tạo bộ từ thủ công</Button>
          <Button variant="outlined" startIcon={<MenuBook />} onClick={() => setTab("UNITS")}>Dùng Unit có sẵn</Button>
        </Stack>
      </Stack>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>
        {filteredSets.map((item) => <Card key={item.id} variant="outlined">
          <CardActionArea onClick={() => void chooseSet(item.id)} sx={{ minHeight: 72 }}>
            <CardContent>
              <Typography variant="subtitle1">{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">{item.itemCount} từ · {ageBandLabel(item.ageBand)}</Typography>
            </CardContent>
          </CardActionArea>
        </Card>)}
      </Box>
    </Stack>}

    {tab === "TOPICS" && <Stack spacing={1.5}>
      <TextField select label="Khối tuổi" value={ageBand} onChange={(event) => changeAgeBand(event.target.value as LearningAgeBand)}>
        {ageBandOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      {topicsLoading && <LinearProgress aria-label="Đang tải chủ đề" />}
      {topicsError && <Alert severity="error" action={<Button color="inherit" onClick={() => void loadTopics()}>Thử lại</Button>}>{topicsError}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
        {topics.map((topic) => <Card key={topic.id} variant="outlined" sx={topic.slug === topicSlug ? {
          borderColor: "primary.main",
          borderWidth: 2,
          bgcolor: "action.selected",
        } : undefined}>
          <CardActionArea onClick={() => {
            setSuggestions([]);
            setSuggestionError("");
            setTopicSlug(topic.slug);
          }} sx={{ minHeight: 96 }}>
            <CardContent sx={{ p: 1.25 }}>
              <TopicIcon iconKey={topic.iconKey} />
              <Typography variant="subtitle2">{topic.titleVi}</Typography>
            </CardContent>
          </CardActionArea>
        </Card>)}
      </Box>
      {suggestionsLoading && <Stack aria-label="Đang gợi ý từ" spacing={0.75}>
        <Skeleton variant="rounded" height={38} />
        <Skeleton variant="rounded" height={38} />
        <Skeleton variant="rounded" height={38} />
      </Stack>}
      {suggestionError && <Alert severity="error">{suggestionError}</Alert>}
      {!suggestionsLoading && !suggestionError && topicSlug && suggestions.length === 0 &&
        <Alert severity="info">Chủ đề này chưa có từ phù hợp.</Alert>}
      {suggestions.length > 0 && <>
        {(["CORE", "EXTENDED"] as const).map((tier) => <Stack key={tier} data-tier={tier} spacing={0.5}>
          <Typography variant="subtitle2">{tier === "CORE" ? "Từ cơ bản" : "Từ mở rộng"}</Typography>
          {suggestions.filter((item) => item.tier === tier).map((item) => <FormControlLabel
            key={item.id}
            control={<Checkbox checked={item.selected} onChange={(event) => setSuggestions((current) =>
              current.map((value) => value.id === item.id ? { ...value, selected: event.target.checked } : value))} />}
            label={<><strong>{item.word}</strong> — {item.meaningVi}</>}
          />)}
        </Stack>)}
        <Alert severity="info">
          Đã chọn {selectedSuggestions.length} từ · {imageCount} từ hỗ trợ game hình ảnh · khoảng {Math.max(3, Math.ceil(selectedSuggestions.length * 0.5))} phút
        </Alert>
        <Button variant="contained" disabled={creating || !selectedSuggestions.length} onClick={() => void createFromTopic()}>
          {creating ? "Đang tạo…" : "Tạo bộ từ và sử dụng"}
        </Button>
      </>}
    </Stack>}

    {tab === "UNITS" && <Stack spacing={1.5}>
      <TextField select label="Khối tuổi" value={ageBand} onChange={(event) => changeAgeBand(event.target.value as LearningAgeBand)}>
        {ageBandOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      {unitError && <Alert severity="error">{unitError}</Alert>}
      <Autocomplete
        value={selectedUnit}
        options={compatibleUnits}
        onChange={(_event, unit) => {
          setUnitError("");
          setUnitId(unit?.id ?? "");
        }}
        groupBy={(unit) => learningLevels.find((level) => level.slug === unit.levelSlug)?.name ?? unit.levelSlug}
        getOptionLabel={(unit) => unit.levelSlug === "mam-non"
          ? `Mầm non · ${unit.title}`
          : `Lớp ${unit.levelSlug.slice(4)} · ${unit.title}`}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        slotProps={{ listbox: { sx: { maxHeight: 340 } } }}
        renderOption={(props, unit) => <Box component="li" {...props} key={unit.id}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {unit.levelSlug === "mam-non" ? "Mầm non" : `Lớp ${unit.levelSlug.slice(4)}`} · {unit.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">{unit.vocabulary.length} từ</Typography>
          </Box>
        </Box>}
        renderInput={(params) => <TextField {...params} label="Tìm Unit công khai" />}
      />
      <Alert severity="info">Unit sẽ được gửi lên server dưới dạng snapshot, giữ emoji, ảnh công khai, phát âm, nghĩa và ví dụ.</Alert>
      <Button variant="contained" disabled={creating || !unitId} onClick={() => void importUnit()}>
        {creating ? "Đang import…" : "Import Unit và sử dụng"}
      </Button>
    </Stack>}

    {form.vocabularySetId && <Alert severity="success" icon={<Check />}>
      Đã chọn {form.items.length} từ.
    </Alert>}
  </FormSection>;
}

function WordsStep({ form, patch }: { form: AssignmentDraftInput; patch: Patch }) {
  return <FormSection title="Rà soát từ vựng" description="Bỏ chọn từ chưa phù hợp với bài này.">
    <TextField select label="Khối tuổi" value={form.ageBand} onChange={(event) => patch("ageBand", event.target.value as LearningAgeBand)}>
      {ageBandOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
    </TextField>
    <Stack spacing={0.5}>
      {form.items.map((item) => <FormControlLabel
        key={`${item.sourceVocabularyItemId}-${item.displayOrder}`}
        control={<Checkbox checked onChange={() => patch("items", form.items.filter((value) => value !== item).map((value, index) => ({ ...value, displayOrder: index + 1 })))} />}
        label={<><strong>{item.word}</strong> — {item.meaningVi} {hasPlayableImage(item)
          ? <Chip size="small" label="Có hình" />
          : item.supportsImageGame && <Chip size="small" label="Có thể gợi ý ảnh" />}</>}
      />)}
    </Stack>
    {form.items.length === 0 && <Alert severity="warning">Cần ít nhất một từ trước khi giao bài.</Alert>}
  </FormSection>;
}

function ActivitiesStep({ form, warnings, patch, editImages }: {
  form: AssignmentDraftInput; warnings: string[]; patch: Patch; editImages: () => Promise<void>;
}) {
  const setTemplate = (code: AssignmentTemplateCode) => {
    const generated = assignmentActivitiesForTemplate(code, {
      ageBand: form.ageBand,
      itemCount: form.items.length,
      imageItemCount: form.items.filter(hasPlayableImage).length,
      exampleItemCount: form.items.filter((item) => Boolean(item.exampleEn)).length,
    });
    patch("templateCode", code);
    patch("activities", code === "CUSTOM" ? [] : generated.activities);
  };
  const toggleCustom = (activity: AssignmentActivityInput) => {
    const exists = form.activities.some((value) => value.presentation === activity.presentation);
    const next = exists ? form.activities.filter((value) => value.presentation !== activity.presentation) : [...form.activities, activity];
    patch("activities", next.map((value, index) => ({ ...value, displayOrder: index + 1 })));
  };
  return <FormSection title="Chọn lộ trình hoạt động">
    <TextField select label="Mẫu bài" value={form.templateCode} onChange={(event) => setTemplate(event.target.value as AssignmentTemplateCode)}>
      {templates.map((value) => <MenuItem key={value} value={value}>{templateLabels[value]}</MenuItem>)}
    </TextField>
    {warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
    {form.items.filter(hasPlayableImage).length < 2 && <Button
      variant="outlined"
      onClick={() => void editImages()}
    >Quay về chọn ảnh</Button>}
    {form.templateCode === "CUSTOM" && <Stack>
      {customActivities.map((activity) => {
        const metadata = gamePresentationLabels[activity.presentation];
        const imageUnavailable = Boolean(metadata.requiresImages)
          && form.items.filter(hasPlayableImage).length < 2;
        return <FormControlLabel
          key={activity.presentation}
          disabled={imageUnavailable}
          control={<Checkbox checked={form.activities.some((value) => value.presentation === activity.presentation)} onChange={() => toggleCustom(activity)} />}
          label={`${metadata.label} — ${imageUnavailable ? "Cần ít nhất 2 từ có hình" : metadata.description}`}
        />;
      })}
    </Stack>}
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      {form.activities.map((item, index) => <Chip key={`${item.presentation}-${index}`} label={`${index + 1}. ${gamePresentationLabels[item.presentation].label}`} />)}
    </Stack>
  </FormSection>;
}

function SettingsStep({ form, patch }: { form: AssignmentDraftInput; patch: Patch }) {
  return <Stack spacing={2}>
    <FormSection title="Tên và hướng dẫn">
      <TextField label="Tên bài tập" value={form.title} onChange={(event) => patch("title", event.target.value)} required />
      <TextField label="Lời nhắn cho học sinh" multiline minRows={2} value={form.instruction ?? ""} onChange={(event) => patch("instruction", event.target.value || undefined)} />
    </FormSection>
    <FormSection title="Thời gian và chấm điểm">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
        <TextField label="Mở từ" type="datetime-local" value={dateTimeLocal(form.availableFrom)} onChange={(event) => patch("availableFrom", isoOrUndefined(event.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Hạn nộp" type="datetime-local" value={dateTimeLocal(form.dueAt)} onChange={(event) => patch("dueAt", isoOrUndefined(event.target.value))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Số lượt tối đa" type="number" value={form.maxAttempts ?? ""} onChange={(event) => patch("maxAttempts", event.target.value ? Number(event.target.value) : undefined)} />
        <TextField label="Điểm đạt (%)" type="number" value={form.passScore ?? ""} onChange={(event) => patch("passScore", event.target.value ? Number(event.target.value) : undefined)} />
      </Box>
      <TextField select label="Hiển thị đáp án" value={form.answerFeedbackMode} onChange={(event) => patch("answerFeedbackMode", event.target.value as AssignmentDraftInput["answerFeedbackMode"])}>
        <MenuItem value="IMMEDIATE">Ngay sau mỗi câu</MenuItem>
        <MenuItem value="AFTER_COMPLETION">Sau khi hoàn thành</MenuItem>
      </TextField>
      <FormControlLabel control={<Checkbox checked={form.shuffleQuestions} onChange={(event) => patch("shuffleQuestions", event.target.checked)} />} label="Xáo trộn câu hỏi" />
    </FormSection>
  </Stack>;
}

function PreviewStep({ form, warnings, editImages }: {
  form: AssignmentDraftInput; warnings: string[]; editImages: () => Promise<void>;
}) {
  const imageActivities = form.activities.filter(
    (activity) => gamePresentationLabels[activity.presentation].requiresImages,
  );
  const imageCount = form.items.filter(hasPlayableImage).length;
  const estimatedMinutes = Math.max(3, Math.ceil((form.items.length * form.activities.length) / 8));
  return <FormSection title="Xem trước trước khi giao" description="Đây chỉ là bản xem trước, không ghi lượt chơi hay kết quả.">
    <Alert severity="info" icon={<Preview />}>XEM TRƯỚC</Alert>
    <Typography variant="h5">{form.title}</Typography>
    <Typography color="text.secondary">{form.instruction || "Không có lời nhắn."}</Typography>
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      <Chip label={`${form.items.length} từ`} />
      <Chip label={`${form.activities.length} hoạt động`} />
      <Chip label={form.maxAttempts == null ? "Không giới hạn lượt" : `${form.maxAttempts} lượt tối đa`} />
      <Chip label={`Khoảng ${estimatedMinutes} phút`} />
      <Chip label={imageActivities.length ? `${imageActivities.length} game cần ảnh` : "Không bắt buộc ảnh"} />
      <Chip label={form.audienceType ? audienceLabels[form.audienceType] : "Chưa chọn người nhận"} />
    </Stack>
    <Stack spacing={0.75}>
      {form.activities.map((activity) => <Typography key={`${activity.displayOrder}-${activity.presentation}`} variant="body2">
        {activity.displayOrder}. {gamePresentationLabels[activity.presentation].label}
      </Typography>)}
    </Stack>
    {imageActivities.length > 0 && imageCount < 2 && <Alert severity="warning" action={
      <Button color="inherit" onClick={() => void editImages()}>Chọn ảnh</Button>
    }>Game dùng hình cần ít nhất 2 từ có ảnh; hệ thống sẽ dùng hoạt động chữ/nghĩa thay thế.</Alert>}
    {warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
  </FormSection>;
}
