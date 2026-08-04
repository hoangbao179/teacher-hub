import { ArrowBack, AutoStories, Replay, Star, TrendingUp } from "@mui/icons-material";
import { Alert, Box, Button, Card, Chip, Container, Divider, Stack, Typography } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { readLearningProgress, restartQuiz, unitProgressFor } from "../storage/learningProgressStorage";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

const messageFor = (score: number) => score === 100 ? "Xuất sắc! Con đã chinh phục trọn Unit." : score >= 80 ? "Rất tốt! Chỉ còn một chút nữa thôi." : score >= 50 ? "Con đang tiến bộ từng bước rồi!" : "Mỗi lần luyện là một lần con giỏi hơn.";

export function LearningResultPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  if (!level || !unit) return <LearningNotFoundPage />;
  const progress = unitProgressFor(readLearningProgress(), unit);
  const attempt = progress.quizAttempts.at(-1);
  if (!attempt) return <LearningShell><Container component="main" maxWidth="sm" sx={{ py: { xs: 5, sm: 8 } }}><Alert severity="info" sx={{ borderRadius: 3 }}>Chưa có kết quả nào cho Unit này. Con hãy hoàn thành bài luyện tập trước nhé.</Alert><Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/quiz`} variant="contained" sx={{ mt: 2, minHeight: "48px !important" }}>Bắt đầu luyện tập</Button></Container></LearningShell>;
  const wrongItems = attempt.wrongItemIds.flatMap((id) => unit.vocabulary.find((item) => item.id === id) ?? []);
  const retry = () => restartQuiz(unit);
  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(150deg,#f0fff8,${level.accent}15,#fff8ed)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
        <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} color="inherit" startIcon={<ArrowBack />}>{unit.title}</Button>
        <Card sx={{ maxWidth: 780, mx: "auto", mt: 2, p: { xs: 2.5, sm: 4 }, textAlign: "center", borderRadius: "24px", border: "1px solid #cfeadd", boxShadow: "0 18px 40px rgba(45,105,80,.12)" }}>
          <Box className="learning-celebration" aria-hidden="true" sx={{ fontSize: 52, animation: "learning-celebrate 480ms ease-out both", "@keyframes learning-celebrate": { "0%": { transform: "scale(.85) rotate(-5deg)", opacity: .2 }, "70%": { transform: "scale(1.08) rotate(3deg)", opacity: 1 }, "100%": { transform: "scale(1)", opacity: 1 } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>🏆</Box>
          <Typography component="h1" sx={{ mt: 1, fontSize: { xs: 28, sm: 38 }, fontWeight: 800 }}>Hoàn thành bài luyện tập!</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>{messageFor(attempt.scorePercent)}</Typography>
          <Typography data-testid="result-score" sx={{ mt: 2, fontSize: { xs: 48, sm: 64 }, lineHeight: 1, fontWeight: 800, color: "#3c8a67" }}>{attempt.scorePercent}%</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center", flexWrap: "wrap" }}><Chip icon={<Star />} label={`${attempt.correctCount} đúng`} sx={{ bgcolor: "#e4f7ee", color: "#286f52" }} /><Chip label={`${attempt.totalQuestions - attempt.correctCount} cần luyện thêm`} sx={{ bgcolor: "#fff0ec", color: "#9b493e" }} /><Chip icon={<TrendingUp />} label={`Tốt nhất ${progress.bestScore ?? attempt.scorePercent}%`} /></Stack>
          <Divider sx={{ my: 3 }} />
          <Box sx={{ textAlign: "left" }}><Typography component="h2" sx={{ fontSize: 20, fontWeight: 800 }}>Từ cần ôn</Typography>{wrongItems.length ? <Stack spacing={1} sx={{ mt: 1.5 }}>{wrongItems.map((item) => <Box key={item.id} sx={{ p: 1.5, borderRadius: 3, bgcolor: "#fff7f4", border: "1px solid #ffd6cd" }}><Typography sx={{ fontWeight: 800 }}>{item.word} <Typography component="span" color="text.secondary" sx={{ fontWeight: 400 }}>· {item.vietnameseMeaning}</Typography></Typography></Box>)}</Stack> : <Alert severity="success" sx={{ mt: 1.5 }}>Không có từ sai — một lượt học thật tuyệt!</Alert>}</Box>
          <Stack spacing={1.25} sx={{ mt: 3 }}>
            {wrongItems.length > 0 && <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/review`} variant="contained" startIcon={<AutoStories />} sx={{ minHeight: "50px !important", borderRadius: 3 }}>Ôn lại từ sai</Button>}
            <Button component={Link} onClick={retry} to={`/hoc/${level.slug}/${unit.slug}/quiz`} variant="outlined" startIcon={<Replay />} sx={{ minHeight: "48px !important", borderRadius: 3 }}>Luyện lại Unit</Button>
            <Button component={Link} to={`/hoc/${level.slug}`} color="inherit">Chọn Unit khác</Button>
          </Stack>
        </Card>
      </Container>
    </Box>
  </LearningShell>;
}
