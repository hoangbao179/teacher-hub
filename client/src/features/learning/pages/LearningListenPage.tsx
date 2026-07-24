import { ArrowBack, CheckCircle, Headphones, Replay, SentimentSatisfiedAlt } from "@mui/icons-material";
import { Alert, Box, Button, Card, Container, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { audioStrategy, playPronunciation, stopPronunciation } from "../audio/pronunciation";
import { LearningShell } from "../components/LearningShell";
import { levelBySlug, unitBySlugs } from "../content/vocabularyCatalog";
import { createListenQuestion, seededRandom } from "../listen/listenQuestions";
import { readLearningProgress, recordListenAnswer, unitProgressFor } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningListenPage() {
  const { levelSlug = "", unitSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const unit = unitBySlugs(levelSlug, unitSlug);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [progress, setProgress] = useState<LearningProgress>(() => readLearningProgress());
  const [audioMessage, setAudioMessage] = useState("");
  const question = useMemo(() => unit ? createListenQuestion(unit.vocabulary, index, seededRandom(index + unit.id.length)) : undefined, [index, unit]);

  useEffect(() => stopPronunciation, [index]);
  if (!level || !unit || !question) return <LearningNotFoundPage />;
  const strategy = audioStrategy(question.item);
  const answered = selected !== undefined;
  const correct = selected === question.correctMeaning;
  const unitProgress = unitProgressFor(progress, unit);

  const play = async () => setAudioMessage(await playPronunciation(question.item) ? "Đang phát từ. Con nghe kỹ nhé!" : "Thiết bị này hiện không phát được âm thanh.");
  const answer = (meaning: string) => {
    if (answered || strategy === "UNAVAILABLE") return;
    setSelected(meaning);
    setProgress(recordListenAnswer(unit, meaning === question.correctMeaning));
  };
  const next = () => { stopPronunciation(); setIndex((current) => (current + 1) % unit.vocabulary.length); setSelected(undefined); setAudioMessage(""); };

  return <LearningShell>
    <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", background: `linear-gradient(145deg,#eef9ff,${level.accent}18,#fff7eb)` }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Button component={Link} to={`/hoc/${level.slug}/${unit.slug}`} color="inherit" startIcon={<ArrowBack />} sx={{ minHeight: "44px !important" }}>{unit.title}</Button>
          <Typography sx={{ flexShrink: 0, fontWeight: 800, color: "#6541c7" }}>{index + 1} / {unit.vocabulary.length}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={((index + 1) / unit.vocabulary.length) * 100} aria-label={`Câu nghe ${index + 1} trên ${unit.vocabulary.length}`} sx={{ mt: 1, height: 9, borderRadius: 8, bgcolor: "#e7e0f0", "& .MuiLinearProgress-bar": { bgcolor: level.accent, borderRadius: 8 } }} />

        <Card variant="outlined" sx={{ maxWidth: 820, mx: "auto", mt: 2.5, p: { xs: 2.5, sm: 4 }, borderRadius: "24px", borderColor: `${level.accent}55`, boxShadow: "0 16px 38px rgba(61,44,108,.1)" }}>
          <Stack sx={{ alignItems: "center", textAlign: "center" }}>
            <Typography variant="overline" sx={{ color: level.accent }}>NGHE VÀ CHỌN NGHĨA</Typography>
            <Typography component="h1" sx={{ mt: 0.75, fontSize: { xs: 25, sm: 32 }, fontWeight: 800 }}>Con nghe thấy từ nào?</Typography>
            <Box aria-hidden="true" sx={{ mt: 2, width: { xs: 100, sm: 120 }, height: { xs: 100, sm: 120 }, display: "grid", placeItems: "center", borderRadius: "32px", bgcolor: "#f0eaff", color: "#7455d9" }}><Headphones sx={{ fontSize: { xs: 52, sm: 64 } }} /></Box>
            <Tooltip title={strategy === "UNAVAILABLE" ? "Trình duyệt này không hỗ trợ audio hoặc phát âm" : ""}>
              <span><Button onClick={play} disabled={strategy === "UNAVAILABLE"} variant="contained" startIcon={audioMessage ? <Replay /> : <Headphones />} aria-label={audioMessage ? "Nghe lại từ" : "Phát từ cần nghe"} sx={{ mt: 2, minHeight: "48px !important", bgcolor: "#7455d9", borderRadius: 3 }}>{audioMessage ? "Nghe lại" : "Phát từ"}</Button></span>
            </Tooltip>
            <Typography aria-live="polite" sx={{ minHeight: 23, mt: 0.75, color: "text.secondary", fontSize: 13 }}>{strategy === "UNAVAILABLE" ? "Trình duyệt này chưa phát được từ. Câu này không tính điểm." : audioMessage}</Typography>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 1.25, mt: 2.5 }}>
            {question.options.map((option, optionIndex) => {
              const isCorrect = answered && option === question.correctMeaning;
              const isWrongChoice = answered && option === selected && !correct;
              return <Button key={option} onClick={() => answer(option)} disabled={strategy === "UNAVAILABLE" || (answered && option !== selected && !isCorrect)} variant="outlined" aria-label={`Lựa chọn ${optionIndex + 1}: ${option}`} startIcon={isCorrect ? <CheckCircle /> : undefined} sx={{ justifyContent: "flex-start", minHeight: "54px !important", borderRadius: 3, px: 2, color: isCorrect ? "#176e50" : isWrongChoice ? "#a4493e" : "#302a42", borderColor: isCorrect ? "#62b99a" : isWrongChoice ? "#ed9b8e" : "#d7cdea", bgcolor: isCorrect ? "#e5f7ef" : isWrongChoice ? "#fff0eb" : "white", "&.Mui-disabled": { color: isCorrect ? "#176e50" : isWrongChoice ? "#a4493e" : "#777181", borderColor: isCorrect ? "#62b99a" : isWrongChoice ? "#ed9b8e" : "#e4dfe9", bgcolor: isCorrect ? "#e5f7ef" : isWrongChoice ? "#fff0eb" : "#fafafa" } }}>{option}</Button>;
            })}
          </Box>

          <Box aria-live="polite" sx={{ minHeight: 76, mt: 2 }}>
            {answered && <Alert severity={correct ? "success" : "info"} icon={correct ? <CheckCircle /> : <SentimentSatisfiedAlt />} sx={{ bgcolor: correct ? "#e5f7ef" : "#fff0eb", color: correct ? "#176e50" : "#8d453b" }}>{correct ? "Chính xác!" : "Gần đúng rồi!"} Từ vừa nghe là <strong>{question.item.word}</strong> — {question.correctMeaning}.</Alert>}
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>Trên thiết bị này: {unitProgress.listenCorrect}/{unitProgress.listenTotal} câu đúng</Typography>
            <Button onClick={next} disabled={!answered} variant="contained" endIcon={<ArrowBack sx={{ transform: "rotate(180deg)" }} />} sx={{ minHeight: "48px !important", bgcolor: "#7455d9", borderRadius: 3 }}>Tiếp theo</Button>
          </Stack>
        </Card>
      </Container>
    </Box>
  </LearningShell>;
}
