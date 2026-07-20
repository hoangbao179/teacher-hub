import {
  ArrowForward,
  AutoStories,
  CheckCircleOutlined,
  Facebook,
  LightbulbOutlined,
  MenuBook,
  Phone,
  PlayArrow,
  School,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { publicHomeContent as content } from "../content/publicHome";

function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.endsWith("youtube.com")) return parsed.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

function LearningVideo({ video }: { video: (typeof content.videos)[number] }) {
  const id = youtubeId(video.url);
  const [playing, setPlaying] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  return (
    <Card component="article" variant="outlined" sx={{ overflow: "hidden", height: "100%" }}>
      {id && playing ? (
        <Box
          component="iframe"
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sx={{ width: "100%", aspectRatio: "16 / 9", display: "block", border: 0 }}
        />
      ) : id && !thumbnailFailed ? (
        <Box sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: "grey.900" }}>
          <Box
            component="img"
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            width="480"
            height="360"
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.86 }}
          />
          <IconButton
            aria-label={`Phát video: ${video.title}`}
            onClick={() => setPlaying(true)}
            sx={{
              position: "absolute",
              inset: 0,
              m: "auto",
              width: 58,
              height: 58,
              bgcolor: "white",
              color: "primary.main",
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            <PlayArrow fontSize="large" />
          </IconButton>
        </Box>
      ) : (
        <Box role="status" sx={{ aspectRatio: "16 / 9", display: "grid", placeItems: "center", bgcolor: "grey.100", p: 2 }}>
          <Typography color="text.secondary">Video hiện chưa khả dụng.</Typography>
        </Box>
      )}
      <CardContent>
        <Typography component="h3" variant="h6" sx={{ fontWeight: 800 }}>{video.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>{video.description}</Typography>
      </CardContent>
    </Card>
  );
}

const sectionSx = { py: { xs: 6, sm: 8 }, scrollMarginTop: 72 } as const;

export function HomePage() {
  return (
    <Box sx={{ bgcolor: "#fff", color: "text.primary", pb: { xs: 9, sm: 0 }, overflowX: "clip" }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 64 }}>
            <School color="primary" aria-hidden="true" />
            <Typography sx={{ ml: 1, flexGrow: 1, fontWeight: 900 }}>{content.brandName}</Typography>
            <Button component="a" href="#contact" size="small">Liên hệ</Button>
            <Button component={Link} to="/admin/login" size="small" color="inherit">Quản trị</Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main">
        <Box component="section" aria-labelledby="hero-heading" sx={{ position: "relative", minHeight: { xs: 610, sm: 620 }, display: "grid", alignItems: "end", color: "white", bgcolor: "#24173f" }}>
          <Box component="picture" sx={{ position: "absolute", inset: 0 }}>
            <source media="(max-width: 720px)" srcSet="/images/teacher-hero-720.webp" />
            <Box component="img" src="/images/teacher-hero-1440.webp" alt={`${content.teacherName} chuẩn bị bài giảng tại bàn học`} width="1440" height="900" fetchPriority="high" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: { xs: "62% center", md: "center" } }} />
          </Box>
          <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, background: { xs: "linear-gradient(0deg,rgba(22,12,42,.94) 5%,rgba(22,12,42,.45) 68%,rgba(22,12,42,.15))", md: "linear-gradient(90deg,rgba(22,12,42,.92),rgba(22,12,42,.54) 47%,rgba(22,12,42,.08) 75%)" } }} />
          <Container maxWidth="lg" sx={{ position: "relative", pb: { xs: 6, sm: 9 }, pt: 12 }}>
            <Box sx={{ maxWidth: 610 }}>
              <Typography color="#e8ddff" sx={{ fontWeight: 800 }}>{content.teacherName}</Typography>
              <Typography id="hero-heading" component="h1" sx={{ fontSize: { xs: "2.35rem", sm: "3.75rem" }, lineHeight: 1.08, fontWeight: 950, mt: 1 }}>{content.subjectLine}</Typography>
              <Typography sx={{ mt: 2, fontSize: { xs: "1rem", sm: "1.15rem" }, maxWidth: 560 }}>{content.description}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3, alignItems: "stretch" }}>
                <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" endIcon={<ArrowForward />}>Nhắn Zalo cho cô</Button>
                <Button component="a" href={content.contact.phoneHref} variant="outlined" size="large" startIcon={<Phone />} sx={{ color: "white", borderColor: "rgba(255,255,255,.72)", "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,.08)" } }}>Gọi {content.contact.phoneDisplay}</Button>
              </Stack>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="about" aria-labelledby="about-heading" sx={sectionSx}>
            <Typography color="primary" sx={{ fontWeight: 800 }}>VỀ CÔ GIÁO</Typography>
            <Typography id="about-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Học đúng cách trước khi học thật nhiều</Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 760, fontSize: "1.08rem" }}>{content.introduction}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
              {["Theo sát năng lực", "Lộ trình rõ ràng", "Phản hồi sau từng buổi"].map((item) => (
                <Stack key={item} direction="row" spacing={1} sx={{ flex: 1, alignItems: "center" }}><CheckCircleOutlined color="success" /><Typography sx={{ fontWeight: 700 }}>{item}</Typography></Stack>
              ))}
            </Stack>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#f7f5ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="method" aria-labelledby="method-heading" sx={sectionSx}>
              <Typography color="primary" sx={{ fontWeight: 800 }}>PHƯƠNG PHÁP GIẢNG DẠY</Typography>
              <Typography id="method-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Nhẹ nhàng, rõ ràng và có mục tiêu</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 4 }}>
                {content.methods.map((method, index) => {
                  const Icon = [LightbulbOutlined, AutoStories, CheckCircleOutlined][index];
                  return <Card key={method.title} variant="outlined" sx={{ height: "100%" }}><CardContent sx={{ p: 3 }}><Icon color="primary" fontSize="large" /><Typography component="h3" variant="h6" sx={{ mt: 2, fontWeight: 800 }}>{method.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{method.detail}</Typography></CardContent></Card>;
                })}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="programs" aria-labelledby="programs-heading" sx={sectionSx}>
            <Typography color="primary" sx={{ fontWeight: 800 }}>CHƯƠNG TRÌNH HỌC</Typography>
            <Typography id="programs-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Phù hợp từng giai đoạn và mục tiêu</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 4 }}>
              {content.programs.map((program) => <Card key={program.title} variant="outlined"><CardContent sx={{ p: 3 }}><Chip label={program.level} color="primary" variant="outlined" /><Typography component="h3" variant="h6" sx={{ mt: 2, fontWeight: 800 }}>{program.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{program.detail}</Typography></CardContent></Card>)}
            </Box>
          </Box>

          <Box component="section" id="videos" aria-labelledby="videos-heading" sx={sectionSx}>
            <Typography color="primary" sx={{ fontWeight: 800 }}>VIDEO HỌC TẬP</Typography>
            <Typography id="videos-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Xem thử cách tiếp cận bài học</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Player chỉ được tải sau khi bạn chọn phát video.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, mt: 4 }}>
              {content.videos.map((video) => <LearningVideo key={video.url} video={video} />)}
            </Box>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#f7f5ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="feedback" aria-labelledby="feedback-heading" sx={sectionSx}>
              <Typography color="primary" sx={{ fontWeight: 800 }}>PHỤ HUYNH CHIA SẺ</Typography>
              <Typography id="feedback-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Tiến bộ nhìn thấy qua từng buổi học</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, mt: 4 }}>
                {content.testimonials.map((item) => <Card component="figure" key={item.attribution} variant="outlined" sx={{ m: 0 }}><CardContent sx={{ p: 3 }}><Typography component="blockquote" sx={{ m: 0, fontSize: "1.08rem" }}>“{item.quote}”</Typography><Typography component="figcaption" color="text.secondary" sx={{ mt: 2, fontWeight: 700 }}>— {item.attribution}</Typography></CardContent></Card>)}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="contact" aria-labelledby="contact-heading" sx={{ ...sectionSx, textAlign: "center" }}>
            <MenuBook color="primary" sx={{ fontSize: 48 }} />
            <Typography id="contact-heading" component="h2" variant="h4" sx={{ mt: 1, fontWeight: 900 }}>Trao đổi về mục tiêu học của con</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Ưu tiên nhắn Zalo; cô sẽ phản hồi khi kết thúc giờ dạy.</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3, justifyContent: "center" }}>
              <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large">Nhắn Zalo</Button>
              <Button component="a" href={content.contact.phoneHref} variant="outlined" size="large" startIcon={<Phone />}>Gọi điện</Button>
              <Button component="a" href={content.contact.facebookUrl} target="_blank" rel="noopener noreferrer" variant="outlined" size="large" startIcon={<Facebook />}>Facebook</Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 3 }}>
        <Container maxWidth="lg"><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Typography color="text.secondary">© {new Date().getFullYear()} {content.brandName}</Typography><Button component={Link} to="/admin/login" size="small" color="inherit">Đăng nhập quản trị</Button></Stack></Container>
      </Box>

      <Box sx={{ display: { xs: "grid", sm: "none" }, gridTemplateColumns: "1.25fr 1fr", gap: 1, position: "fixed", zIndex: 30, left: 0, right: 0, bottom: 0, p: 1, pb: "calc(8px + env(safe-area-inset-bottom))", bgcolor: "rgba(255,255,255,.96)", borderTop: 1, borderColor: "divider", backdropFilter: "blur(10px)" }}>
        <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained">Nhắn Zalo</Button>
        <Button component="a" href={content.contact.phoneHref} variant="outlined" startIcon={<Phone />}>Gọi điện</Button>
      </Box>
    </Box>
  );
}
