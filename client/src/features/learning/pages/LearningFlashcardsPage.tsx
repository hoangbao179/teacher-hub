import { ArrowBack, ArrowForward, CheckCircle, Headphones, Replay, Star } from "@mui/icons-material";
import { Box, Button, Card, Chip, Container, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { audioStrategy, playPronunciation, stopPronunciation } from "../audio/pronunciation";
import { LearningShell } from "../components/LearningShell";
import { VocabularyIllustration } from "../components/VocabularyIllustration";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { markVocabularyItem, readLearningProgress, recordViewedItem, unitProgressFor } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningFlashcardsPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  const [index, setIndex] = useState(() => {
    if (!unit) return 0;
    const stored = readLearningProgress().units[unit.slug];
    return stored?.contentVersion === unit.contentVersion ? Math.min(stored.lastItemIndex, unit.vocabulary.length - 1) : 0;
  });
  const [progress, setProgress] = useState<LearningProgress>(() => readLearningProgress());
  const [audioMessage, setAudioMessage] = useState("");
  const touchStart = useRef<number | null>(null);

  const move = useCallback((delta: number) => {
    if (!unit) return;
    const nextIndex = Math.max(0, Math.min(index + delta, unit.vocabulary.length - 1));
    if (nextIndex === index) return;
    stopPronunciation();
    setAudioMessage("");
    setProgress(recordViewedItem(unit, unit.vocabulary[nextIndex].id, nextIndex));
    setIndex(nextIndex);
  }, [index, unit]);

  useEffect(() => {
    if (!unit) return;
    recordViewedItem(unit, unit.vocabulary[index].id, index);
    return stopPronunciation;
  }, [index, unit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  if (!level || !unit) return <LearningNotFoundPage />;
  const item = unit.vocabulary[index];
  const unitProgress = unitProgressFor(progress, unit);
  const strategy = audioStrategy(item);
  const remembered = unitProgress.rememberedItemIds.includes(item.id);
  const review = unitProgress.reviewItemIds.includes(item.id);
  const imageSize = level.group === "EARLY" ? { xs: 112, sm: 142 } : { xs: 92, sm: 118 };

  const play = async () => setAudioMessage(await playPronunciation(item) ? `Đang phát âm từ ${item.word}.` : "Thiết bị này hiện không phát được âm thanh.");
  const mark = (state: "REMEMBERED" | "REVIEW") => setProgress(markVocabularyItem(unit, item.id, state));
  const onTouchStart = (event: TouchEvent) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) >= 55) move(distance > 0 ? -1 : 1);
  };

  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(145deg,#eef9ff,${level.accent}18,#fff8e4)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} color="inherit" startIcon={<ArrowBack />} sx={{ minHeight: "44px !important" }}>{unit.title}</Button>
          <Typography aria-label={`Thẻ ${index + 1} trên ${unit.vocabulary.length}`} sx={{ flexShrink: 0, fontWeight: 800, color: "#6541c7" }}>{index + 1} / {unit.vocabulary.length}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={((index + 1) / unit.vocabulary.length) * 100} aria-label={`Tiến độ flashcard ${index + 1} trên ${unit.vocabulary.length}`} sx={{ mt: 1, height: 9, borderRadius: 8, bgcolor: "#e7e0f0", "& .MuiLinearProgress-bar": { bgcolor: level.accent, borderRadius: 8 } }} />

        <Card
          role="group"
          aria-label={`Flashcard từ ${item.word}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          variant="outlined"
          sx={{ maxWidth: 820, mx: "auto", mt: 2.5, p: { xs: 2.5, sm: 4 }, minHeight: { xs: 430, sm: 500 }, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", borderRadius: "24px", borderColor: `${level.accent}55`, boxShadow: "0 16px 38px rgba(61,44,108,.1)", touchAction: "pan-y" }}
        >
          <Stack direction="row" useFlexGap sx={{ minHeight: 28, alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 0.75 }}>
            {remembered && <Chip icon={<CheckCircle />} label="Đã nhớ" sx={{ bgcolor: "#e5f7ef", color: "#176e50" }} />}
            {review && <Chip icon={<Replay />} label="Cần ôn" sx={{ bgcolor: "#fff0eb", color: "#a4493e" }} />}
            {unitProgress.flashcardCompletedAt && <Chip icon={<Star />} label="Hoàn thành Unit" sx={{ bgcolor: "#fff2ba", color: "#6c5000", animation: "learningCelebrate 500ms ease-out", "@keyframes learningCelebrate": { "0%": { transform: "scale(.85)" }, "65%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)" } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }} />}
          </Stack>
          <VocabularyIllustration image={item.image} word={item.word} sx={{ width: imageSize, height: imageSize, mt: 2, display: "grid", placeItems: "center", borderRadius: "28px", bgcolor: level.group === "EARLY" ? "#fff2c9" : "#eef7ff", fontSize: level.group === "EARLY" ? { xs: 72, sm: 88 } : { xs: 60, sm: 74 } }} />
          <Typography component="h1" sx={{ mt: 2, fontSize: { xs: 34, sm: 44 }, lineHeight: 1.1, fontWeight: 800 }}>{item.word}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, fontSize: 16 }}>{item.phonetic}</Typography>
          <Typography sx={{ mt: 1.5, color: "#523a9d", fontSize: { xs: 19, sm: 22 }, fontWeight: 800 }}>{item.vietnameseMeaning}</Typography>
          {item.example && <Typography sx={{ mt: 1.25, p: 1.25, borderRadius: 2.5, bgcolor: "#f7f3ff", fontSize: 14.5 }}>Ví dụ: {item.example}</Typography>}
          <Tooltip title={strategy === "UNAVAILABLE" ? "Trình duyệt này không hỗ trợ phát âm" : ""}>
            <span><Button onClick={play} disabled={strategy === "UNAVAILABLE"} variant="outlined" startIcon={<Headphones />} aria-label={`Nghe phát âm từ ${item.word}`} sx={{ mt: 2, minHeight: "46px !important", borderRadius: 3 }}>Nghe từ</Button></span>
          </Tooltip>
          <Typography aria-live="polite" sx={{ minHeight: 22, mt: 0.75, color: "text.secondary", fontSize: 13 }}>{strategy === "UNAVAILABLE" ? "Âm thanh chưa khả dụng trên trình duyệt này." : audioMessage}</Typography>
        </Card>

        <Stack direction="row" spacing={1.25} sx={{ maxWidth: 820, mx: "auto", mt: 2, position: { xs: "sticky", sm: "static" }, bottom: 0, zIndex: 2, p: { xs: "10px 0 calc(10px + env(safe-area-inset-bottom, 0px))", sm: 0 }, bgcolor: { xs: "rgba(251,249,255,.96)", sm: "transparent" } }}>
          <Button onClick={() => move(-1)} disabled={index === 0} variant="outlined" aria-label="Thẻ trước" sx={{ minWidth: 52, minHeight: "48px !important" }}><ArrowBack /></Button>
          <Button onClick={() => mark("REVIEW")} variant={review ? "contained" : "outlined"} color="warning" startIcon={<Replay />} sx={{ flex: 1, minWidth: 0, minHeight: "48px !important" }}>Cần ôn</Button>
          <Button onClick={() => mark("REMEMBERED")} variant={remembered ? "contained" : "outlined"} color="success" startIcon={<CheckCircle />} sx={{ flex: 1, minWidth: 0, minHeight: "48px !important" }}>Đã nhớ</Button>
          <Button onClick={() => move(1)} disabled={index === unit.vocabulary.length - 1} variant="contained" aria-label="Thẻ tiếp theo" sx={{ minWidth: 52, minHeight: "48px !important", bgcolor: "#7455d9" }}><ArrowForward /></Button>
        </Stack>
        <Typography color="text.secondary" sx={{ display: { xs: "none", md: "block" }, mt: 1.5, textAlign: "center", fontSize: 13 }}>Dùng phím ← → để chuyển thẻ</Typography>
      </Container>
    </Box>
  </LearningShell>;
}
