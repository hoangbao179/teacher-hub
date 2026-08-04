import { ArrowBack, CheckCircleOutlined, NavigateNext } from "@mui/icons-material";
import { Alert, Box, Button, Card, Container, LinearProgress, Radio, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { createQuizQuestions, quizItemOrder } from "../quiz/quizQuestions";
import { completeQuiz, readLearningProgress, recordQuizAnswer, startOrResumeQuiz, unitProgressFor } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningQuizPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  const navigate = useNavigate();
  const defaultIds = useMemo(() => unit ? quizItemOrder(unit.vocabulary) : [], [unit]);
  const [progress, setProgress] = useState<LearningProgress>(() => {
    const initial = readLearningProgress();
    return unit && !unitProgressFor(initial, unit).activeQuiz && defaultIds.length ? startOrResumeQuiz(unit, defaultIds) : initial;
  });
  const storedSession = unit ? unitProgressFor(progress, unit).activeQuiz : undefined;
  const itemIds = storedSession?.questionItemIds ?? defaultIds;
  const questions = useMemo(() => unit ? createQuizQuestions(unit.vocabulary, itemIds) : [], [itemIds, unit]);
  const initialIndex = Math.min(storedSession?.answers.length ?? 0, Math.max(questions.length - 1, 0));
  const [questionIndex, setQuestionIndex] = useState(initialIndex);
  const existingAnswer = storedSession?.answers[questionIndex];
  const [selected, setSelected] = useState<string | null>(existingAnswer?.selectedValue ?? null);
  const [graded, setGraded] = useState<boolean | null>(existingAnswer?.correct ?? null);

  if (!level || !unit) return <LearningNotFoundPage />;
  const question = questions[questionIndex];
  if (!question) return <LearningShell><Container component="main" maxWidth="sm" sx={{ py: 8 }}><Alert severity="info">Unit này chưa đủ lựa chọn hợp lệ để tạo bài luyện tập.</Alert><Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} sx={{ mt: 2 }}>Quay lại Unit</Button></Container></LearningShell>;

  const checkAnswer = () => {
    if (!selected || graded !== null) return;
    const correct = selected === question.correctValue;
    setProgress(recordQuizAnswer(unit, { itemId: question.itemId, selectedValue: selected, correct }));
    setGraded(correct);
  };
  const next = () => {
    if (graded === null) return;
    if (questionIndex === questions.length - 1) {
      completeQuiz(unit);
      navigate(`/hoc/${level.slug}/${unit.slug}/result`);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelected(null);
    setGraded(null);
  };

  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(150deg,#f1fbff,${level.accent}15,#fff8ed)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 2.5, sm: 5 } }}>
        <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} color="inherit" startIcon={<ArrowBack />} sx={{ minHeight: "44px !important" }}>{unit.title}</Button>
        <Box sx={{ maxWidth: 780, mx: "auto", mt: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>Câu {questionIndex + 1} / {questions.length}</Typography><Typography color="text.secondary" sx={{ fontSize: 14 }}>Điểm được tính sau khi hoàn thành</Typography></Stack>
          <LinearProgress variant="determinate" value={((questionIndex + 1) / questions.length) * 100} aria-label={`Câu ${questionIndex + 1} trên ${questions.length}`} aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={questionIndex + 1} sx={{ mt: 1, height: 10, borderRadius: 8, "& .MuiLinearProgress-bar": { borderRadius: 8 } }} />
          <Card variant="outlined" sx={{ mt: 2.5, p: { xs: 2.25, sm: 4 }, borderRadius: "24px", borderColor: "#dcd0f5", boxShadow: "0 16px 36px rgba(70,52,120,.1)" }}>
            <Typography color="text.secondary" sx={{ fontWeight: 700 }}>{question.direction === "WORD_TO_MEANING" ? "Từ này có nghĩa là gì?" : "Từ tiếng Anh nào đúng với nghĩa này?"}</Typography>
            <Typography component="h1" sx={{ mt: 1, mb: 3, fontSize: { xs: 30, sm: 40 }, fontWeight: 800, color: "#5135a6" }}>{question.prompt}</Typography>
            <Stack role="radiogroup" aria-label="Các lựa chọn trả lời" spacing={1.25}>
              {question.options.map((option) => {
                const isSelected = selected === option;
                const isCorrect = graded !== null && option === question.correctValue;
                const isWrong = graded === false && isSelected;
                return <Button key={option} role="radio" aria-checked={isSelected} onClick={() => graded === null && setSelected(option)} disabled={graded !== null} startIcon={<Radio checked={isSelected} />} sx={{ justifyContent: "flex-start", minHeight: "52px !important", px: 2, border: "2px solid", borderColor: isCorrect ? "#58a985" : isWrong ? "#e77b6c" : isSelected ? "primary.main" : "divider", color: "text.primary", bgcolor: isCorrect ? "#e4f7ee" : isWrong ? "#fff0ec" : isSelected ? "#eaf5ff" : "white", borderRadius: 3, textTransform: "none", "&.Mui-disabled": { color: "text.primary", opacity: 1 }, "&:hover": { bgcolor: "#eaf8f3" } }} aria-label={`Lựa chọn: ${option}`}>{option}</Button>;
              })}
            </Stack>
            <Box aria-live="polite" aria-atomic="true" sx={{ minHeight: 70, mt: 2 }}>
              {graded !== null && <Alert severity={graded ? "success" : "info"} icon={graded ? <CheckCircleOutlined /> : undefined} sx={{ bgcolor: graded ? "#e4f7ee" : "#fff0ec", color: "#3b3047", "& .MuiAlert-icon": { color: graded ? "#33805e" : "#c45d4e" } }}>{graded ? "Chính xác — tuyệt lắm!" : `Chưa đúng lần này. Đáp án là “${question.correctValue}”.`}</Alert>}
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 1, justifyContent: "flex-end" }}>
              {graded === null ? <Button variant="contained" onClick={checkAnswer} disabled={!selected} startIcon={<CheckCircleOutlined />} sx={{ minHeight: "50px !important", borderRadius: 3 }}>Kiểm tra</Button> : <Button variant="contained" onClick={next} endIcon={<NavigateNext />} sx={{ minHeight: "50px !important", borderRadius: 3 }}>{questionIndex === questions.length - 1 ? "Xem kết quả" : "Câu tiếp theo"}</Button>}
            </Stack>
          </Card>
        </Box>
      </Container>
    </Box>
  </LearningShell>;
}
