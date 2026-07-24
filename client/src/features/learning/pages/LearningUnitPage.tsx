import { ArrowBack, AutoStories, DeleteOutlined, Headphones, Quiz, Star } from "@mui/icons-material";
import { Box, Button, Card, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { readLearningProgress, rememberLearningLocation, resetUnitProgress, unitProgressFor } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningUnitPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  const [progress, setProgress] = useState<LearningProgress>(() => readLearningProgress());
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { if (unit) rememberLearningLocation(unit.levelSlug, unit.slug); }, [unit]);
  if (!level || !unit) return <LearningNotFoundPage />;

  const unitProgress = unitProgressFor(progress, unit);
  const viewed = unitProgress.viewedItemIds.length;
  const percent = Math.round((viewed / unit.vocabulary.length) * 100);
  const reset = () => { setProgress(resetUnitProgress(unit.slug)); setConfirmReset(false); };

  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(145deg,#eef9ff,${level.accent}18,#faf7ff)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5, md: 6 } }}>
        <Button component={Link} to={`/hoc/${level.slug}`} color="inherit" startIcon={<ArrowBack />} sx={{ minHeight: "44px !important" }}>Danh sách Unit</Button>
        <Card variant="outlined" sx={{ mt: 2, p: { xs: 2.5, sm: 4 }, borderRadius: "24px", borderColor: `${level.accent}44`, boxShadow: "0 14px 34px rgba(65,48,110,.09)" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
            <Box aria-hidden="true" sx={{ width: { xs: 76, sm: 92 }, height: { xs: 76, sm: 92 }, display: "grid", placeItems: "center", borderRadius: "24px", bgcolor: "#fff3d8", fontSize: { xs: 40, sm: 50 } }}>{unit.icon}</Box>
            <Box sx={{ flex: 1 }}><Typography variant="overline" sx={{ color: level.accent }}>{level.name} · {unit.vocabulary.length} TỪ</Typography><Typography component="h1" sx={{ mt: 0.5, fontSize: { xs: 28, sm: 36 }, fontWeight: 800 }}>{unit.title}</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>{unit.description}</Typography></Box>
            <Typography aria-hidden="true" sx={{ display: { xs: "none", sm: "block" }, fontSize: 54 }}>{level.mascot}</Typography>
          </Stack>

          <Box sx={{ mt: 3, p: 2, borderRadius: "18px", bgcolor: "#f7f3ff" }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography sx={{ fontWeight: 800 }}>Tiến độ Flashcard</Typography>{unitProgress.flashcardCompletedAt && <Chip icon={<Star />} label="Đã hoàn thành" sx={{ bgcolor: "#fff1bc", color: "#674c00" }} />}</Stack>
            <LinearProgress variant="determinate" value={percent} aria-label={`Đã xem ${viewed} trên ${unit.vocabulary.length} từ`} sx={{ mt: 1.5, height: 10, borderRadius: 8, bgcolor: "#e8e2f0", "& .MuiLinearProgress-bar": { bgcolor: level.accent, borderRadius: 8 } }} />
            <Typography color="text.secondary" sx={{ mt: 0.75, fontSize: 13 }}>{viewed}/{unit.vocabulary.length} từ đã xem · {unitProgress.rememberedItemIds.length} đã nhớ · {unitProgress.reviewItemIds.length} cần ôn</Typography>
          </Box>

          <Stack spacing={1.25} sx={{ mt: 3 }}>
            <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/flashcards`} variant="contained" size="large" startIcon={<AutoStories />} sx={{ minHeight: "50px !important", bgcolor: "#7455d9", borderRadius: 3 }}>Học bằng Flashcard</Button>
            <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/listen`} variant="outlined" size="large" startIcon={<Headphones />} sx={{ minHeight: "50px !important", borderRadius: 3 }}>Nghe và chọn nghĩa</Button>
            <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/quiz`} variant="outlined" size="large" startIcon={<Quiz />} sx={{ minHeight: "50px !important", borderRadius: 3, borderColor: "#7455d9", color: "#5c3fbd" }}>{unitProgress.activeQuiz ? "Tiếp tục luyện tập" : "Luyện tập chọn nghĩa"}</Button>
            <Button onClick={() => setConfirmReset(true)} color="inherit" startIcon={<DeleteOutlined />} sx={{ alignSelf: "center", mt: 1 }}>Xóa tiến độ Unit này</Button>
          </Stack>
        </Card>
      </Container>
    </Box>
    <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} aria-labelledby="reset-unit-title">
      <DialogTitle id="reset-unit-title">Xóa tiến độ “{unit.title}”?</DialogTitle>
      <DialogContent><Typography color="text.secondary">Chỉ tiến độ của Unit này bị xóa. Các Unit khác vẫn được giữ nguyên.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmReset(false)} color="inherit">Giữ lại</Button><Button onClick={reset} color="error" variant="contained">Xóa tiến độ</Button></DialogActions>
    </Dialog>
  </LearningShell>;
}
