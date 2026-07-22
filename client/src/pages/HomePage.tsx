import {
  AutoStories,
  ChatBubbleOutlined,
  CheckCircleOutlined,
  Facebook,
  FormatQuote,
  LightbulbOutlined,
  MenuBook,
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
import { useCallback, useEffect, useRef, useState } from "react";
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
    <Card component="article" variant="outlined" sx={{ overflow: "hidden", height: "100%", borderRadius: 3, display: "flex", flexDirection: "column" }}>
      <Box data-testid="learning-video-media" sx={{ position: "relative", aspectRatio: "16 / 9", flexShrink: 0, overflow: "hidden", bgcolor: "grey.100" }}>
        {id && playing ? (
          <Box
            component="iframe"
            title={video.title}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", border: 0 }}
          />
        ) : id && !thumbnailFailed ? (
          <>
          <Box
            component="img"
            src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
            alt=""
            width="1280"
            height="720"
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
          />
          <IconButton
            aria-label={`Phát video: ${video.title}`}
            onClick={() => setPlaying(true)}
            sx={{
              position: "absolute", inset: 0, m: "auto", width: 58, height: 58,
              bgcolor: "white", color: "primary.main", "&:hover": { bgcolor: "grey.100" },
            }}
          >
            <PlayArrow fontSize="large" />
          </IconButton>
          </>
        ) : (
        <Box role="status" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 2 }}>
          <Typography color="text.secondary">Video hiện chưa khả dụng.</Typography>
        </Box>
        )}
      </Box>
      <CardContent sx={{ flex: 1 }}>
        <Typography component="h3" variant="h6">{video.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>{video.description}</Typography>
      </CardContent>
    </Card>
  );
}

const sectionSx = { py: { xs: 4, sm: 5, md: 7 }, scrollMarginTop: 72 } as const;
const programTone = {
  mint: { background: "linear-gradient(145deg, #fff8cf 0%, #e9f9ef 100%)", border: "#cfe8d8", icon: "#1d8b61" },
  blue: { background: "linear-gradient(145deg, #eaf5ff 0%, #f0eaff 100%)", border: "#d4d8f5", icon: "#5f48d5" },
  coral: { background: "linear-gradient(145deg, #fff0e9 0%, #f2ebff 100%)", border: "#efd4d5", icon: "#c55b61" },
} as const;
const testimonialTone = [
  { background: "linear-gradient(145deg, #fff9df, #fffdf4)", border: "#eee0a8", accent: "#a36a00" },
  { background: "linear-gradient(145deg, #edf7ff, #f7fbff)", border: "#c8e1f5", accent: "#347aaa" },
  { background: "linear-gradient(145deg, #f2edff, #fbf9ff)", border: "#d9cef7", accent: "#7655c8" },
] as const;

export function HomePage() {
  const testimonialListRef = useRef<HTMLDivElement>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [testimonialsInView, setTestimonialsInView] = useState(false);

  const scrollToTestimonial = useCallback((index: number) => {
    const list = testimonialListRef.current;
    const card = list?.children.item(index) as HTMLElement | null;
    if (!list || !card) return;
    const left = card.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    list.scrollTo({ left, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const list = testimonialListRef.current;
    if (!list) return;
    const observer = new IntersectionObserver(([entry]) => setTestimonialsInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!testimonialsInView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 899.95px)").matches && !document.hidden) {
        scrollToTestimonial((activeTestimonial + 1) % content.testimonials.length);
      }
    }, 4_200);
    return () => window.clearTimeout(timer);
  }, [activeTestimonial, scrollToTestimonial, testimonialsInView]);

  const updateActiveTestimonial = () => {
    const list = testimonialListRef.current;
    if (!list) return;
    const listLeft = list.getBoundingClientRect().left;
    const closestIndex = [...list.children].reduce((closest, card, index) => {
      const currentDistance = Math.abs(card.getBoundingClientRect().left - listLeft);
      const closestDistance = Math.abs(list.children.item(closest)!.getBoundingClientRect().left - listLeft);
      return currentDistance < closestDistance ? index : closest;
    }, 0);
    setActiveTestimonial(closestIndex);
  };

  return (
    <Box sx={{ bgcolor: "#fff", color: "text.primary", overflowX: "clip" }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 64 }}>
            <School color="primary" aria-hidden="true" />
            <Typography component="h1" variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>{content.brandName}</Typography>
            <Button component="a" href="#contact" size="small">Liên hệ</Button>
            <Button component={Link} to="/admin/login" size="small" color="inherit">Quản trị</Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main">
        <Container maxWidth="lg">
          <Box component="section" id="about" aria-labelledby="about-heading" sx={sectionSx}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, .8fr) minmax(0, 1.2fr)" }, gap: { xs: 2.5, md: 4 }, alignItems: "center" }}>
              <Box component="img" src={content.media.teacherPhoto} alt={content.media.teacherPhotoAlt} loading="lazy" width="1448" height="1086" sx={{ width: "100%", height: { xs: 260, md: 330 }, objectFit: "cover", objectPosition: content.media.teacherPhotoFocalPosition, borderRadius: 3, boxShadow: "0 12px 30px rgba(55,40,90,.12)" }} />
              <Box>
                <Typography variant="overline" color="primary">GIỚI THIỆU CÔ VY</Typography>
                <Typography id="about-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.teacherProfile.greeting}</Typography>
                <Typography color="text.secondary" sx={{ mt: 2 }}>{content.teacherProfile.biography}</Typography>
                <Stack spacing={1.25} sx={{ mt: 2.5 }}>
                  {content.teacherProfile.highlights.map((item) => (
                    <Stack key={item} direction="row" spacing={1} sx={{ alignItems: "center" }}><CheckCircleOutlined color="success" /><Typography variant="subtitle2">{item}</Typography></Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#faf8ff", position: "relative" }}>
          <Container maxWidth="lg">
            <Box component="section" id="programs" aria-labelledby="programs-heading" sx={sectionSx}>
              <Typography variant="overline" color="primary">CHƯƠNG TRÌNH HỌC</Typography>
              <Typography id="programs-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Tiếng Anh lớp 1–9 theo từng mục tiêu</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
                {content.programs.map((program) => {
                  const tone = programTone[program.accent];
                  return <Card component="article" key={program.title} variant="outlined" sx={{ height: "100%", background: tone.background, borderColor: tone.border, borderRadius: 3, boxShadow: "0 8px 22px rgba(57,42,94,.06)" }}><CardContent>
                    <MenuBook aria-hidden="true" sx={{ color: tone.icon, fontSize: 30 }} />
                    <Typography component="h3" variant="h6" sx={{ mt: 1 }}>{program.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{program.summary}</Typography>
                    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", pl: 0, mb: 0, mt: 2 }}>
                      {program.topics.map((topic) => <Stack component="li" direction="row" spacing={0.8} key={topic} sx={{ alignItems: "center" }}><CheckCircleOutlined aria-hidden="true" sx={{ color: tone.icon, fontSize: 18 }} /><Typography variant="body2">{topic}</Typography></Stack>)}
                    </Stack>
                  </CardContent></Card>;
                })}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="method" aria-labelledby="method-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">PHƯƠNG PHÁP GIẢNG DẠY</Typography>
            <Typography id="method-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Rõ ràng, vừa sức và có mục tiêu</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
              {content.methods.map((method, index) => {
                const Icon = [LightbulbOutlined, AutoStories, CheckCircleOutlined][index];
                return <Card key={method.title} variant="outlined" sx={{ height: "100%", bgcolor: ["#f6f1ff", "#eef7ff", "#eefaf5"][index], borderRadius: 3 }}><CardContent><Icon color="primary" /><Typography component="h3" variant="h6" sx={{ mt: 1.25 }}>{method.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{method.detail}</Typography></CardContent></Card>;
              })}
            </Box>
          </Box>

          <Box component="section" id="videos" aria-labelledby="videos-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">VIDEO HỌC TẬP</Typography>
            <Typography id="videos-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Xem thử cách tiếp cận bài học</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Player chỉ được tải sau khi bạn chọn phát video.</Typography>
            <Typography data-testid="video-swipe-hint" variant="caption" color="primary" sx={{ display: { xs: "block", md: "none" }, mt: 2.5, textAlign: "right", fontWeight: 600 }}>Vuốt để xem thêm →</Typography>
            <Box data-testid="learning-video-list" sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2.5 }, mt: { xs: 1, md: 3.5 }, overflowX: { xs: "auto", md: "visible" }, scrollSnapType: { xs: "x mandatory", md: "none" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {content.videos.map((video) => <Box key={video.url} sx={{ flex: { xs: "0 0 85vw", md: "initial" }, maxWidth: { xs: 560, md: "none" }, scrollSnapAlign: "start" }}><LearningVideo video={video} /></Box>)}
            </Box>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#f7f5ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="feedback" aria-labelledby="feedback-heading" sx={sectionSx}>
              <Typography variant="overline" color="primary">PHỤ HUYNH CHIA SẺ</Typography>
              <Typography id="feedback-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Những phản hồi dành cho cô Vy</Typography>
              <Box ref={testimonialListRef} onScroll={updateActiveTestimonial} data-testid="testimonial-list" sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "repeat(3, minmax(0, 1fr))" }, alignItems: "stretch", gap: 2, mt: 3.5, overflowX: { xs: "auto", md: "visible" }, scrollBehavior: "smooth", scrollSnapType: { xs: "x mandatory", md: "none" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                  {content.testimonials.map((item, index) => {
                    const tone = testimonialTone[index % testimonialTone.length];
                    return <Card component="figure" key={item.id} variant="outlined" sx={{ m: 0, flex: { xs: "0 0 100%", md: "initial" }, height: "100%", scrollSnapAlign: "start", borderRadius: 3, background: tone.background, borderColor: tone.border, boxShadow: "0 8px 22px rgba(57,42,94,.06)" }}><CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <FormatQuote aria-hidden="true" sx={{ color: tone.accent, fontSize: 30, mb: 0.5 }} />
                      <Typography component="blockquote" sx={{ m: 0, flexGrow: 1 }}>{item.quote}</Typography>
                      <Box component="figcaption" sx={{ mt: 2.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.guardianLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.studentLevel}</Typography>
                      </Box>
                    </CardContent></Card>;
                  })}
              </Box>
              <Box aria-label="Chọn phản hồi phụ huynh" sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mt: 1 }}>
                {content.testimonials.map((item, index) => (
                  <IconButton key={item.id} aria-label={`Xem phản hồi ${index + 1}`} aria-current={activeTestimonial === index ? "true" : undefined} onClick={() => scrollToTestimonial(index)} sx={{ width: 44, height: 44 }}>
                    <Box component="span" sx={{ width: activeTestimonial === index ? 22 : 8, height: 8, borderRadius: 4, bgcolor: activeTestimonial === index ? "primary.main" : "grey.400", transition: "width 240ms ease, background-color 240ms ease", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }} />
                  </IconButton>
                ))}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="md" sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
          <Box component="section" id="contact" aria-labelledby="contact-heading" sx={{
            px: { xs: 2, sm: 4 }, py: { xs: 3.5, sm: 4.5 }, scrollMarginTop: 72, textAlign: "center",
            border: "1px solid #ddd2f5", borderRadius: { xs: 3, sm: 4 },
            background: "radial-gradient(circle at 8% 18%, rgba(255,255,255,.9) 0 7px, transparent 8px), radial-gradient(circle at 92% 82%, rgba(109,61,245,.1) 0 18px, transparent 19px), linear-gradient(135deg, #f5efff 0%, #edf8ff 52%, #effaf4 100%)",
            boxShadow: "0 12px 30px rgba(57,42,94,.08)",
          }}>
            <MenuBook color="primary" sx={{ fontSize: 38 }} />
            <Typography id="contact-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.contact.heading}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680, mx: "auto" }}>{content.contact.description}</Typography>
            <Stack direction="row" useFlexGap sx={{ justifyContent: "center", flexWrap: "wrap", gap: 1, mt: 2 }}>{content.contact.highlights.map((item) => <Chip key={item} size="small" label={item} />)}</Stack>
            <Box sx={{ mt: 3, maxWidth: 580, mx: "auto" }}>
              <Box data-testid="contact-actions" sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" startIcon={<ChatBubbleOutlined />} sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap", background: "linear-gradient(105deg, #713bea, #268edc)" }}>{content.contact.zaloLabel}</Button>
                <Button component="a" href={content.contact.facebookUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" startIcon={<Facebook />} sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap", color: "#174b77", background: "linear-gradient(105deg, #dcedff, #bfe2ff)", "&:hover": { background: "linear-gradient(105deg, #cfe6ff, #add9ff)" } }}>{content.contact.facebookLabel}</Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{content.contact.followUp}</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", pt: 1, pb: "calc(8px + env(safe-area-inset-bottom, 0px))", bgcolor: "#faf9fd" }}>
        <Container maxWidth="lg"><Typography color="text.secondary" sx={{ textAlign: "center", fontSize: 12, lineHeight: 1.4 }}>{content.footer}</Typography></Container>
      </Box>
    </Box>
  );
}
