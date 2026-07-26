import {
  ArrowBack,
  ArrowForward,
  Check,
  CloudDone,
  Preview,
  Publish,
  Save,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
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
} from "@teacher/shared";
import { assignmentActivitiesForTemplate } from "@teacher/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createAssignment,
  getAssignment,
  previewAssignment,
  publishAssignment,
  updateAssignment,
} from "../../../api/assignments";
import { api } from "../../../api/client";
import { getVocabularySet, listVocabularySets } from "../../../api/vocabulary";
import {
  ConfirmationDialog,
  FormSection,
  PageHeader,
  StickyActionBar,
} from "../../../components/UiKit";
import { ageBandOptions } from "../../vocabulary/vocabularyEditor";
import { audienceLabels, templateLabels } from "../assignmentUi";

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
  { displayOrder: 2, mechanic: "SELECT_ONE", presentation: "LISTEN_PICK_WORD", required: true },
  { displayOrder: 3, mechanic: "MATCH_PAIRS", presentation: "MATCH_WORD_MEANING", required: true },
  { displayOrder: 4, mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD", required: true },
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
    items: detail.items.map(({ sourceVocabularyItemId, displayOrder, word, meaningVi, phonetic, partOfSpeech, exampleEn, speechText, tier, illustrationSnapshot, supportsImageGame }) => ({
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
  const editingId = params.id ? Number(params.id) : undefined;
  const [id, setId] = useState<number | undefined>(editingId);
  const [version, setVersion] = useState(1);
  const [form, setForm] = useState<AssignmentDraftInput>(initial);
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [sets, setSets] = useState<VocabularySetListItem[]>([]);
  const [loading, setLoading] = useState(Boolean(editingId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<ClassListItem[]>("/api/classes"),
      api<StudentListItem[]>("/api/students"),
      listVocabularySets({ pageSize: 50 }).then((result) => result.data),
    ]).then(([classItems, studentItems, vocabularySets]) => {
      setClasses(classItems.filter((item) => item.status === "ACTIVE"));
      setStudents(studentItems.filter((item) => item.status === "ACTIVE"));
      setSets(vocabularySets.filter((item) => item.status === "ACTIVE"));
    }).catch((reason: Error) => setError(reason.message));
    if (editingId) {
      void getAssignment(editingId).then((detail) => {
        if (detail.status !== "DRAFT") {
          navigate(`/admin/assignments/${editingId}`, { replace: true });
          return;
        }
        setForm(toInput(detail));
        setVersion(detail.version);
      }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
    }
  }, [editingId, navigate]);

  const templateResult = useMemo(() => assignmentActivitiesForTemplate(form.templateCode, {
    ageBand: form.ageBand,
    itemCount: form.items.length,
    imageItemCount: form.items.filter((item) => item.supportsImageGame).length,
    exampleItemCount: form.items.filter((item) => Boolean(item.exampleEn)).length,
  }), [form.ageBand, form.items, form.templateCode]);

  const patch = <K extends keyof AssignmentDraftInput>(key: K, value: AssignmentDraftInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseSet = async (setId: number) => {
    setSaving(true);
    setError("");
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
      }));
      const result = assignmentActivitiesForTemplate(form.templateCode, {
        ageBand: selected.ageBand,
        itemCount: mapped.length,
        imageItemCount: mapped.filter((item) => item.supportsImageGame).length,
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
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
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
      setError((reason as Error).message);
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
        setError((reason as Error).message);
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
      setError((reason as Error).message);
    } finally {
      setSaving(false);
      setPublishOpen(false);
    }
  };

  if (loading) return <LinearProgress aria-label="Đang tải bài tập" />;
  return (
    <Stack spacing={2.25} data-testid="assignment-wizard-page">
      <PageHeader title={id ? "Chỉnh sửa bài tập" : "Tạo bài tập từ vựng"} subtitle={`Bước ${step + 1}/${steps.length}: ${steps[step]}`} />
      <Stepper activeStep={step} alternativeLabel sx={{ display: { xs: "none", md: "flex" } }}>
        {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>
      <LinearProgress variant="determinate" value={((step + 1) / steps.length) * 100} sx={{ display: { md: "none" } }} />
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success" icon={<CloudDone />}>Đã lưu bản nháp.</Alert>}

      {step === 0 && <AudienceStep form={form} classes={classes} students={students} patch={patch} />}
      {step === 1 && <VocabularySetStep form={form} sets={sets} chooseSet={chooseSet} />}
      {step === 2 && <WordsStep form={form} patch={patch} />}
      {step === 3 && <ActivitiesStep form={form} warnings={templateResult.warnings} patch={patch} />}
      {step === 4 && <SettingsStep form={form} patch={patch} />}
      {step === 5 && <PreviewStep form={form} warnings={previewWarnings} />}

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

function AudienceStep({ form, classes, students, patch }: {
  form: AssignmentDraftInput; classes: ClassListItem[]; students: StudentListItem[]; patch: Patch;
}) {
  return <FormSection title="Ai sẽ nhận bài?">
    <TextField select label="Người nhận" value={form.audienceType ?? ""} onChange={(event) => patch("audienceType", event.target.value as AssignmentAudienceType)}>
      {Object.entries(audienceLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
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

function VocabularySetStep({ form, sets, chooseSet }: {
  form: AssignmentDraftInput; sets: VocabularySetListItem[]; chooseSet: (id: number) => Promise<void>;
}) {
  return <FormSection title="Chọn bộ từ" description="Nội dung sẽ được chụp lại khi giao để không bị đổi theo bộ từ gốc.">
    <TextField select label="Bộ từ vựng" value={form.vocabularySetId ?? ""} onChange={(event) => void chooseSet(Number(event.target.value))}>
      {sets.map((item) => <MenuItem key={item.id} value={item.id}>{item.title} · {item.itemCount} từ</MenuItem>)}
    </TextField>
    {form.vocabularySetId && <Alert severity="success" icon={<Check />}>Đã chọn {form.items.length} từ.</Alert>}
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
        label={<><strong>{item.word}</strong> — {item.meaningVi} {item.supportsImageGame && <Chip size="small" label="Có hình" />}</>}
      />)}
    </Stack>
    {form.items.length === 0 && <Alert severity="warning">Cần ít nhất một từ trước khi giao bài.</Alert>}
  </FormSection>;
}

function ActivitiesStep({ form, warnings, patch }: { form: AssignmentDraftInput; warnings: string[]; patch: Patch }) {
  const setTemplate = (code: AssignmentTemplateCode) => {
    const generated = assignmentActivitiesForTemplate(code, {
      ageBand: form.ageBand,
      itemCount: form.items.length,
      imageItemCount: form.items.filter((item) => item.supportsImageGame).length,
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
    {form.templateCode === "CUSTOM" && <Stack>
      {customActivities.map((activity) => <FormControlLabel key={activity.presentation} control={<Checkbox checked={form.activities.some((value) => value.presentation === activity.presentation)} onChange={() => toggleCustom(activity)} />} label={activity.presentation.replaceAll("_", " ")} />)}
    </Stack>}
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      {form.activities.map((item, index) => <Chip key={`${item.presentation}-${index}`} label={`${index + 1}. ${item.presentation.replaceAll("_", " ")}`} />)}
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

function PreviewStep({ form, warnings }: { form: AssignmentDraftInput; warnings: string[] }) {
  return <FormSection title="Xem trước trước khi giao" description="Đây chỉ là bản xem trước, không ghi lượt chơi hay kết quả.">
    <Alert severity="info" icon={<Preview />}>XEM TRƯỚC</Alert>
    <Typography variant="h5">{form.title}</Typography>
    <Typography color="text.secondary">{form.instruction || "Không có lời nhắn."}</Typography>
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      <Chip label={`${form.items.length} từ`} />
      <Chip label={`${form.activities.length} hoạt động`} />
      <Chip label={form.audienceType ? audienceLabels[form.audienceType] : "Chưa chọn người nhận"} />
    </Stack>
    {warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
  </FormSection>;
}
