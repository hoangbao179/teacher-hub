import { ArrowBack, CheckCircleOutlined, NavigateBefore, NavigateNext, VolumeUp } from "@mui/icons-material";
import { Alert, Box, Button, Card, Chip, Container, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { audioStrategy, playPronunciation, stopPronunciation } from "../audio/pronunciation";
import { LearningShell } from "../components/LearningShell";
import { PronunciationRateControl, usePronunciationRateMode } from "../components/PronunciationRateControl";
import { VocabularyIllustration } from "../components/VocabularyIllustration";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { markReviewedAsRemembered, readLearningProgress, unitProgressFor } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningReviewPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  const [progress, setProgress] = useState<LearningProgress>(() => readLearningProgress());
  const [index, setIndex] = useState(0);
  const [audioMessage, setAudioMessage] = useState("");
  const [rateMode, setRateMode] = usePronunciationRateMode();
  const reviewItems = useMemo(() => unit ? [...new Set([...unitProgressFor(progress, unit).wrongItemIds, ...unitProgressFor(progress, unit).reviewItemIds])].flatMap((id) => unit.vocabulary.find((item) => item.id === id) ?? []) : [], [progress, unit]);
  useEffect(() => () => stopPronunciation(), []);
  if (!level || !unit) return <LearningNotFoundPage />;
  if (!reviewItems.length) return <LearningShell><Container component="main" maxWidth="sm" sx={{ py: { xs: 5, sm: 8 } }}><Alert severity="success" sx={{ borderRadius: 3 }}>Tuyệt lắm! Hiện không có từ nào cần ôn trong Unit này.</Alert><Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} sx={{ mt: 2 }}>Quay lại Unit</Button></Container></LearningShell>;
  const safeIndex = Math.min(index, reviewItems.length - 1);
  const item = reviewItems[safeIndex];
  const canPlay = audioStrategy(item) !== "UNAVAILABLE";
  const markRemembered = () => { stopPronunciation(); setProgress(markReviewedAsRemembered(unit, item.id)); setIndex((current) => Math.min(current, Math.max(reviewItems.length - 2, 0))); };
  const play = async () => setAudioMessage(await playPronunciation(item, rateMode) ? rateMode === "SLOW" ? `Đang phát chậm từ ${item.word}.` : `Đang phát từ ${item.word}.` : "Trình duyệt này chưa phát được âm thanh.");
  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(150deg,#f1fbff,${level.accent}14,#fff8ed)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 2.5, sm: 5 } }}>
        <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}/result`} color="inherit" startIcon={<ArrowBack />}>Kết quả</Button>
        <Box sx={{ maxWidth: 720, mx: "auto", mt: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography component="h1" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800 }}>Ôn lại từ cần nhớ</Typography><Chip label={`${safeIndex + 1} / ${reviewItems.length}`} /></Stack>
          <Card role="group" aria-label={`Thẻ ôn tập từ ${item.word}`} sx={{ mt: 2, p: { xs: 2.5, sm: 4 }, textAlign: "center", borderRadius: "24px", border: "1px solid #dfd4f4", boxShadow: "0 16px 36px rgba(70,52,120,.1)" }}>
            <VocabularyIllustration image={item.image} word={item.word} sx={{ width: 110, height: 110, mx: "auto", display: "grid", placeItems: "center", fontSize: 74 }} />
            <Typography sx={{ mt: 1, fontSize: { xs: 36, sm: 44 }, fontWeight: 800, color: "#5135a6" }}>{item.word}</Typography><Typography color="text.secondary">{item.phonetic}</Typography><Typography sx={{ mt: 1.5, fontSize: 20, fontWeight: 700 }}>{item.vietnameseMeaning}</Typography>
            <Box sx={{ width: "100%", mt: 2, display: "flex", justifyContent: "center" }}><PronunciationRateControl value={rateMode} onChange={(value) => { setAudioMessage(""); setRateMode(value); }} /></Box>
            <Tooltip title={canPlay ? "Nghe phát âm" : "Trình duyệt chưa hỗ trợ phát âm"}><span><Button onClick={play} disabled={!canPlay} startIcon={<VolumeUp />} aria-label={`Nghe phát âm từ ${item.word}`} sx={{ mt: 1.25 }}>Nghe từ</Button></span></Tooltip>
            <Typography role="status" aria-live="polite" color="text.secondary" sx={{ minHeight: 24 }}>{audioMessage}</Typography>
            <Button onClick={markRemembered} variant="contained" startIcon={<CheckCircleOutlined />} sx={{ mt: 1, minHeight: "50px !important", bgcolor: "#3f936d", borderRadius: 3 }}>Đã nhớ từ này</Button>
          </Card>
          <Stack direction="row" spacing={1.25} sx={{ mt: 2, justifyContent: "space-between" }}><Button onClick={() => { stopPronunciation(); setIndex((value) => Math.max(0, value - 1)); }} disabled={safeIndex === 0} startIcon={<NavigateBefore />} sx={{ minHeight: "48px !important" }}>Trước</Button><Button onClick={() => { stopPronunciation(); setIndex((value) => Math.min(reviewItems.length - 1, value + 1)); }} disabled={safeIndex === reviewItems.length - 1} endIcon={<NavigateNext />} sx={{ minHeight: "48px !important" }}>Tiếp</Button></Stack>
        </Box>
      </Container>
    </Box>
  </LearningShell>;
}
