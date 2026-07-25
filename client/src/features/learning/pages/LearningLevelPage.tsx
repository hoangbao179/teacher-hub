import { ArrowBack, ArrowForward, AutoStories, CheckCircle, HourglassTop } from "@mui/icons-material";
import { Box, Card, CardActionArea, Chip, Container, LinearProgress, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";
import { levelBySlug, unitsForLevel } from "../content/vocabularyCatalog";
import { readLearningProgress, rememberLearningLocation } from "../storage/learningProgressStorage";
import type { LearningProgress } from "../types";
import { LearningNotFoundPage } from "./LearningNotFoundPage";

export function LearningLevelPage() {
  const { levelSlug = "" } = useParams();
  const level = levelBySlug(levelSlug);
  const units = useMemo(() => unitsForLevel(levelSlug), [levelSlug]);
  const [progress] = useState<LearningProgress>(() => readLearningProgress());

  useEffect(() => {
    if (!level || !level.available || units.length === 0) return;
    rememberLearningLocation(level.slug);
  }, [level, units.length]);

  if (!level || !level.available || units.length === 0) return <LearningNotFoundPage />;

  const learned = units.reduce((total, unit) => total + (progress.units[unit.slug]?.rememberedItemIds.length ?? 0), 0);
  const total = units.reduce((sum, unit) => sum + unit.vocabulary.length, 0);
  const percent = total ? Math.round((learned / total) * 100) : 0;

  return (
    <LearningShell>
      <Box component="main">
        <Box sx={{ background: `linear-gradient(145deg, #edf9ff 0%, ${level.accent}24 62%, #f2edff 100%)`, borderBottom: "1px solid #e3d9f4" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 } }}>
            <Stack component="nav" aria-label="Breadcrumb" direction="row" spacing={0.5} sx={{ mb: 2, alignItems: "center" }}>
              <Typography component={Link} to="/hoc" color="inherit" sx={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 0.5, textDecoration: "none", fontSize: 13.5, fontWeight: 700 }}><ArrowBack fontSize="small" /> Góc học</Typography>
              <Typography aria-hidden="true" color="text.secondary">/</Typography><Typography color="text.secondary" sx={{ fontSize: 13.5 }}>{level.name}</Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 380px" }, alignItems: "center", gap: 3 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box aria-hidden="true" sx={{ width: { xs: 68, sm: 82 }, height: { xs: 68, sm: 82 }, display: "grid", placeItems: "center", borderRadius: "22px", bgcolor: "rgba(255,255,255,.8)", fontSize: { xs: 39, sm: 48 }, boxShadow: "0 10px 24px rgba(70,50,120,.1)" }}>{level.mascot}</Box>
                <Box><Typography variant="overline" sx={{ color: level.accent }}>TIẾNG ANH {level.name.toUpperCase()}</Typography><Typography component="h1" sx={{ fontSize: { xs: 29, sm: 36 }, fontWeight: 800 }}>Chọn bài học</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Mỗi Unit gồm một nhóm từ vựng cơ bản để con học và luyện tập.</Typography></Box>
              </Stack>
              <Card variant="outlined" sx={{ p: 2, borderRadius: "20px", bgcolor: "rgba(255,255,255,.86)", borderColor: `${level.accent}44` }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}><Typography sx={{ fontWeight: 800 }}>Tiến độ của con</Typography><Typography sx={{ fontSize: 13, color: "text.secondary" }}>{learned}/{total} từ</Typography></Stack>
                <LinearProgress variant="determinate" value={percent} aria-label={`Đã học ${percent}%`} sx={{ mt: 1.25, height: 9, borderRadius: 8, bgcolor: "#eeeaf4", "& .MuiLinearProgress-bar": { bgcolor: level.accent, borderRadius: 8 } }} />
                <Typography sx={{ mt: 0.75, fontSize: 12.5, color: "text.secondary" }}>{percent}% hoàn thành</Typography>
              </Card>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
          <Typography component="h2" sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800 }}>Chủ đề dành cho con</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>Chọn một chủ đề để học bằng flashcard hoặc luyện nghe.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2, mt: 3 }}>
            {units.map((unit, index) => {
              const unitProgress = progress.units[unit.slug];
              const count = unitProgress?.rememberedItemIds.length ?? 0;
              const state = unitProgress?.flashcardCompletedAt ? "Đã học" : (unitProgress?.viewedItemIds.length ?? 0) > 0 ? "Đang học" : "Chưa học";
              const StateIcon = unitProgress?.flashcardCompletedAt ? CheckCircle : (unitProgress?.viewedItemIds.length ?? 0) > 0 ? HourglassTop : AutoStories;
              return <Card component="article" key={unit.id} variant="outlined" sx={{ borderRadius: "22px", borderColor: `${level.accent}3d`, boxShadow: "0 8px 22px rgba(66,48,106,.06)" }}>
                <CardActionArea component={Link} to={`/hoc/${level.slug}/${unit.slug}`} aria-label={`Mở Unit ${unit.title}`} sx={{ p: { xs: 2, sm: 2.5 }, height: "100%", borderRadius: "22px" }}><Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                  <Box aria-hidden="true" sx={{ flex: "0 0 64px", height: 64, display: "grid", placeItems: "center", bgcolor: index % 2 ? "#eaf8f3" : "#fff3d8", borderRadius: "18px", fontSize: 32 }}>{unit.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="overline" color="text.secondary">UNIT {index + 1}</Typography>
                    <Typography component="h3" sx={{ mt: 0.25, fontSize: 18, fontWeight: 800 }}>{unit.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13.5 }}>{unit.description}</Typography>
                    <Stack direction="row" useFlexGap sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.75, alignItems: "center" }}><Chip icon={<StateIcon />} label={`${state} · ${count}/${unit.vocabulary.length} từ nhớ`} /><ArrowForward aria-hidden="true" sx={{ ml: "auto", color: level.accent }} /></Stack>
                  </Box>
                </Stack></CardActionArea>
              </Card>;
            })}
          </Box>
        </Container>
      </Box>
    </LearningShell>
  );
}
