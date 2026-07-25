import { ArrowForward, AutoStories, Headphones, Replay } from "@mui/icons-material";
import { Box, Card, CardActionArea, Chip, Container, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";
import { learningLevels, unitsForLevel } from "../content/vocabularyCatalog";
import { readLearningProgress, rememberLearningLocation } from "../storage/learningProgressStorage";
import type { LearningLevel, LearningLevelGroup, LearningLevelSlug } from "../types";

const groups: readonly { id: LearningLevelGroup; title: string; description: string }[] = [
  { id: "EARLY", title: "Mầm non", description: "Hình ảnh, âm thanh và từ thật gần gũi" },
  { id: "PRIMARY", title: "Tiểu học", description: "Từ vựng vừa sức cho lớp 1–5" },
  { id: "SECONDARY", title: "THCS", description: "Chủ đề gọn, rõ cho lớp 6–9" },
];

function LevelCard({ level, onSelect }: { level: LearningLevel; onSelect: (slug: LearningLevelSlug) => void }) {
  const available = level.available && unitsForLevel(level.slug).length > 0;
  const body = (
    <Stack sx={{ minHeight: { xs: 92, sm: 112 }, height: "100%", p: { xs: 1.5, sm: 2 }, justifyContent: "space-between", alignItems: "center", textAlign: "center", position: "relative" }}>
      <Typography aria-hidden="true" sx={{ fontSize: { xs: 29, sm: 36 }, lineHeight: 1 }}>{level.mascot}</Typography>
      <Typography component="h3" sx={{ mt: 1, color: "#2d2840", fontWeight: 800, fontSize: { xs: 13, sm: 15 } }}>{level.name}</Typography>
      {available ? <ArrowForward aria-hidden="true" sx={{ position: "absolute", right: 8, top: 8, fontSize: 17, color: level.accent }} /> : <Chip label="Sắp có" size="small" sx={{ mt: 1, height: 22, bgcolor: "rgba(255,255,255,.75)", color: "#5d576b", fontSize: 10.5 }} />}
    </Stack>
  );
  return (
    <Card component="article" variant="outlined" sx={{ height: "100%", borderRadius: "20px", borderColor: `${level.accent}55`, background: `linear-gradient(145deg, #fff, ${level.accent}18)`, boxShadow: "0 8px 20px rgba(78,55,130,.07)" }}>
      {available ? <CardActionArea component={Link} to={`/hoc/${level.slug}`} onClick={() => onSelect(level.slug)} aria-label={`Mở bài học ${level.name}`} sx={{ height: "100%", borderRadius: "20px" }}>{body}</CardActionArea> : body}
    </Card>
  );
}

export function LearningHubPage() {
  const [recentLevel, setRecentLevel] = useState<LearningLevelSlug | undefined>(() => readLearningProgress().lastLevelSlug);
  const selectLevel = (slug: LearningLevelSlug) => { rememberLearningLocation(slug); setRecentLevel(slug); };
  const recent = recentLevel ? learningLevels.find((level) => level.slug === recentLevel && level.available) : undefined;

  return (
    <LearningShell>
      <Box component="main">
        <Box sx={{ background: "linear-gradient(135deg, #eff9ff 0%, #f7f0ff 55%, #fff4f6 100%)", borderBottom: "1px solid #e8dff7" }}>
          <Container maxWidth="lg">
            <Box component="section" aria-labelledby="learning-hero-heading" sx={{ minHeight: { md: 300 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr .9fr" }, alignItems: "center", gap: 3, py: { xs: 4, sm: 5, md: 6 }, position: "relative" }}>
              <Box sx={{ maxWidth: 680, position: "relative", zIndex: 1 }}>
                <Chip label="GÓC HỌC MIỄN PHÍ" sx={{ bgcolor: "#ff7d75", color: "white", fontWeight: 800 }} />
                <Typography id="learning-hero-heading" component="h1" sx={{ mt: 2, color: "#6541c7", fontSize: { xs: 29, sm: 38, md: 46 }, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-.03em" }}>Góc học tiếng Anh miễn phí cùng cô Vy</Typography>
                <Typography sx={{ mt: 1.5, color: "#504966", fontSize: { xs: 15, sm: 17 } }}>Học vui mỗi ngày qua những bài từ vựng ngắn, dễ nhớ và phù hợp từng độ tuổi.</Typography>
                {recent && <Chip component={Link} clickable to={`/hoc/${recent.slug}`} label={`Học tiếp ${recent.name}`} onClick={() => selectLevel(recent.slug)} sx={{ mt: 2.25, minHeight: 44, px: 0.5, bgcolor: "#7455d9", color: "white", fontWeight: 700, "&:hover": { bgcolor: "#6144bf" } }} />}
              </Box>
              <Box aria-hidden="true" sx={{ pointerEvents: "none", position: "relative", minHeight: { xs: 150, md: 210 }, display: "grid", placeItems: "center" }}>
                <Typography sx={{ fontSize: { xs: 92, sm: 112, md: 138 }, filter: "drop-shadow(0 14px 14px rgba(72,53,126,.15))" }}>📖</Typography>
                <Typography sx={{ position: "absolute", top: "8%", left: "12%", fontSize: 28 }}>✨</Typography><Typography sx={{ position: "absolute", right: "10%", top: "18%", fontSize: 34 }}>⭐</Typography>
                <Box sx={{ position: "absolute", left: "5%", bottom: "14%", width: 80, height: 28, bgcolor: "white", borderRadius: "50%", opacity: .85 }} />
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
          <Box component="section" aria-labelledby="levels-heading">
            <Stack sx={{ alignItems: "center", textAlign: "center" }}>
              <Typography id="levels-heading" component="h2" sx={{ fontSize: { xs: 22, sm: 27 }, fontWeight: 800 }}>Chọn cấp độ phù hợp với con</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>Mầm non đến lớp 9 — con có thể bắt đầu từ nội dung vừa sức nhất.</Typography>
            </Stack>
            <Stack spacing={3} sx={{ mt: 3.5 }}>
              {groups.map((group) => {
                const levels = learningLevels.filter((level) => level.group === group.id);
                return <Box key={group.id} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: "24px", bgcolor: group.id === "EARLY" ? "#fff8df" : group.id === "PRIMARY" ? "#edfaf5" : "#f3efff", border: "1px solid", borderColor: group.id === "EARLY" ? "#f1dda0" : group.id === "PRIMARY" ? "#bfe7d8" : "#d9cdf3" }}>
                  <Typography component="h3" sx={{ fontSize: 17, fontWeight: 800 }}>{group.title}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: 13.5 }}>{group.description}</Typography>
                  <Box data-testid={`level-group-${group.id.toLowerCase()}`} sx={{ display: "grid", gridTemplateColumns: { xs: levels.length === 1 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", sm: `repeat(${Math.min(levels.length, 5)}, minmax(0, 1fr))` }, gap: { xs: 1.25, sm: 1.5 }, mt: 2 }}>
                    {levels.map((level) => <LevelCard key={level.slug} level={level} onSelect={selectLevel} />)}
                  </Box>
                </Box>;
              })}
            </Stack>
          </Box>

          <Box component="section" aria-labelledby="benefits-heading" sx={{ mt: { xs: 4, md: 6 } }}>
            <Typography id="benefits-heading" component="h2" sx={{ textAlign: "center", fontSize: { xs: 21, sm: 25 }, fontWeight: 800 }}>Mỗi bài học là một bước tiến nhỏ</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 2, mt: 3 }}>
              {[
                [AutoStories, "Học bằng flashcard", "Hình ảnh sinh động, từ và nghĩa rõ ràng.", "#fff1c9"],
                [Headphones, "Nghe và chọn nghĩa", "Rèn kỹ năng nghe, phản xạ tự nhiên.", "#e8f3ff"],
                [Replay, "Ôn lại từ sai", "Ghi nhớ những từ chưa chắc để tiến bộ.", "#fdebf3"],
              ].map(([Icon, title, description, color]) => <Card component="article" key={String(title)} variant="outlined" sx={{ p: 2.5, borderRadius: "22px", bgcolor: String(color), borderColor: "rgba(98,72,160,.16)" }}><Stack direction="row" spacing={2} sx={{ alignItems: "center" }}><Box sx={{ flex: "0 0 52px", height: 52, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "white", color: "#6541c7" }}><Icon aria-hidden="true" /></Box><Box><Typography component="h3" sx={{ fontWeight: 800 }}>{String(title)}</Typography><Typography color="text.secondary" sx={{ mt: 0.4, fontSize: 13.5 }}>{String(description)}</Typography></Box></Stack></Card>)}
            </Box>
          </Box>
          <Typography component="p" color="text.secondary" sx={{ mt: 3, mx: "auto", maxWidth: 720, textAlign: "center", fontSize: 12.5, lineHeight: 1.6 }}>
            Nội dung luyện tập do cô Vy biên soạn, tham khảo chủ đề Global Success và không phải học liệu chính thức.
          </Typography>
        </Container>
      </Box>
    </LearningShell>
  );
}
