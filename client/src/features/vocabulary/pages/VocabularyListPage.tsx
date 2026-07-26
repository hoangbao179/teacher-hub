import {
  Add,
  AutoStories,
  ContentCopy,
  Edit,
  Inventory2,
  Search,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type {
  LearningAgeBand,
  VocabularySetListItem,
  VocabularyTopicListItem,
} from "@teacher/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listVocabularySets,
  listVocabularyTopics,
} from "../../../api/vocabulary";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingCards } from "../../../components/LoadingCards";
import { PageHeader } from "../../../components/UiKit";
import { ageBandLabel, ageBandOptions } from "../vocabularyEditor";

type View = "topics" | "sets";

export function VocabularyListPage() {
  const [view, setView] = useState<View>("topics");
  const [search, setSearch] = useState("");
  const [ageBand, setAgeBand] = useState<LearningAgeBand | "">("");
  const [topics, setTopics] = useState<VocabularyTopicListItem[]>([]);
  const [sets, setSets] = useState<VocabularySetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const values = { search, ageBand: ageBand || undefined, pageSize: 50 };
      const request = view === "topics"
        ? listVocabularyTopics(values).then((result) => setTopics(result.data))
        : listVocabularySets(values).then((result) => setSets(result.data));
      void request.catch((value: Error) => setError(value.message)).finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [ageBand, reload, search, view]);

  const results = view === "topics" ? topics : sets;
  return (
    <Stack spacing={2.25} data-testid="vocabulary-list-page">
      <PageHeader
        title="Kho từ vựng"
        subtitle="Chọn chủ đề có sẵn hoặc quản lý bộ từ riêng cho lớp học."
        action={<Button component={Link} to="/admin/vocabulary/new" variant="contained" startIcon={<Add />}>Tạo bộ từ</Button>}
      />

      <Tabs value={view} onChange={(_event, value: View) => setView(value)} aria-label="Nội dung kho từ vựng">
        <Tab value="topics" icon={<AutoStories />} iconPosition="start" label="Chủ đề gợi ý" />
        <Tab value="sets" icon={<Inventory2 />} iconPosition="start" label="Bộ từ của tôi" />
      </Tabs>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 220px" }, gap: 1 }}>
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={view === "topics" ? "Tìm chủ đề…" : "Tìm bộ từ…"}
          slotProps={{ htmlInput: { "aria-label": "Tìm kiếm từ vựng" }, input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <TextField
          select
          label="Độ tuổi"
          value={ageBand}
          onChange={(event) => setAgeBand(event.target.value as LearningAgeBand | "")}
        >
          <MenuItem value="">Tất cả độ tuổi</MenuItem>
          {ageBandOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
      </Box>

      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setReload((value) => value + 1)}>Thử lại</Button>}>{error}</Alert>}
      {loading && <LoadingCards />}
      {!loading && !error && results.length === 0 && <EmptyState message={view === "topics" ? "Không tìm thấy chủ đề phù hợp." : "Chưa có bộ từ nào. Hãy tạo bộ đầu tiên."} />}

      {!loading && !error && view === "topics" && (
        <Box data-testid="vocabulary-topic-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {topics.map((topic) => (
            <Card key={topic.id} variant="outlined" sx={{ minWidth: 0 }}>
              <CardActionArea component={Link} to={`/admin/vocabulary/new?topic=${encodeURIComponent(topic.slug)}`} sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography aria-hidden sx={{ fontSize: { xs: 28, sm: 34 }, mb: 0.5 }}>{topic.iconKey}</Typography>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.25 }}>{topic.titleVi}</Typography>
                  <Typography variant="caption" color="text.secondary">{topic.coreWordCount} từ cốt lõi · {topic.extendedWordCount} mở rộng</Typography>
                  <Stack direction="row" sx={{ gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                    {topic.ageBands.slice(0, 2).map((value) => <Chip key={value} size="small" label={ageBandLabel(value)} />)}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {!loading && !error && view === "sets" && (
        <Stack spacing={1}>
          {sets.map((set) => <SetCard key={set.id} value={set} />)}
        </Stack>
      )}
    </Stack>
  );
}

function SetCard({ value }: { value: VocabularySetListItem }) {
  return (
    <Card variant="outlined">
      <CardActionArea component={Link} to={`/admin/vocabulary/${value.id}`}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="subtitle1">{value.title}</Typography>
                {value.status === "ARCHIVED" && <Chip size="small" label="Đã lưu trữ" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">{ageBandLabel(value.ageBand)} · {value.itemCount} từ</Typography>
            </Box>
            {value.sourceType === "COPIED" ? <ContentCopy color="action" /> : <Edit color="action" />}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
