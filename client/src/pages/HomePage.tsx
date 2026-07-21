import {
  ArrowForward,
  AutoStories,
  ChatBubbleOutlined,
  CheckCircleOutlined,
  ChevronLeft,
  ChevronRight,
  EditOutlined,
  Facebook,
  FormatQuote,
  LightbulbOutlined,
  MenuBook,
  PlayArrow,
  School,
  StarOutlined,
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
  useMediaQuery,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  isConfiguredExternalUrl,
  isDevelopmentContent,
  publicHomeContent as content,
  publishableTestimonials,
} from "../content/publicHome";

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
    <Card component="article" variant="outlined" sx={{ overflow: "hidden", height: "100%", borderRadius: 3 }}>
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
              position: "absolute", inset: 0, m: "auto", width: 58, height: 58,
              bgcolor: "white", color: "primary.main", "&:hover": { bgcolor: "grey.100" },
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

function HeroCarousel({ showZalo }: { showZalo: boolean }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => document.hidden);
  const pointerStart = useRef<number | null>(null);
  const slides = content.heroSlides;

  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const preload = window.setTimeout(() => {
      for (const slide of slides.slice(1)) {
        const mobile = new Image(); mobile.src = slide.mobileImage;
        const desktop = new Image(); desktop.src = slide.desktopImage;
      }
    }, 0);
    return () => window.clearTimeout(preload);
  }, [slides]);

  useEffect(() => {
    if (reduceMotion || paused || tabHidden) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), content.carouselIntervalMs);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, slides.length, tabHidden]);

  const slide = slides[active];
  return (
    <Box
      component="section"
      aria-roledescription="carousel"
      aria-label="Chương trình tiếng Anh của cô Vy"
      data-testid="hero-carousel"
      data-active-slide={slide.id}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        if (event.key === "Home") { event.preventDefault(); setActive(0); }
        if (event.key === "End") { event.preventDefault(); setActive(slides.length - 1); }
      }}
      onPointerDown={(event) => { pointerStart.current = event.clientX; }}
      onPointerUp={(event) => {
        if (pointerStart.current == null) return;
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(distance) >= 42) move(distance > 0 ? -1 : 1);
      }}
      sx={{
        position: "relative",
        height: { xs: "clamp(400px, calc(100vw + 20px), 450px)", sm: 480, md: 510 },
        display: "grid", alignItems: "end", color: "white", bgcolor: "#24173f", overflow: "hidden", outline: 0, touchAction: "pan-y",
      }}
    >
      {slides.map((item, index) => (
        <Box
          component="picture"
          key={item.id}
          aria-hidden={index !== active}
          sx={{
            position: "absolute", inset: 0, opacity: index === active ? 1 : 0,
            transition: reduceMotion ? "none" : "opacity 520ms ease",
          }}
        >
          <source media="(max-width: 720px)" srcSet={item.mobileImage} />
          <Box
            component="img"
            src={item.desktopImage}
            alt={index === active ? item.alt : ""}
            width="1440"
            height="900"
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            sx={{
              width: "100%", height: "100%", objectFit: "cover", objectPosition: item.focalPosition,
              transform: index === active && !reduceMotion ? "scale(1.015)" : "scale(1)",
              transition: reduceMotion ? "none" : "transform 5.5s ease-out",
            }}
          />
        </Box>
      ))}
      <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, background: { xs: "linear-gradient(0deg,rgba(22,12,42,.95) 2%,rgba(22,12,42,.5) 72%,rgba(22,12,42,.18))", md: "linear-gradient(90deg,rgba(22,12,42,.93),rgba(22,12,42,.52) 48%,rgba(22,12,42,.08) 78%)" } }} />

      <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, pointerEvents: "none", display: { xs: "none", sm: "block" } }}>
        <AutoStories sx={{ position: "absolute", right: "8%", top: "16%", color: "#ffe799", fontSize: 38, transform: "rotate(8deg)" }} />
        <StarOutlined sx={{ position: "absolute", right: "20%", top: "8%", color: "#d9ceff", fontSize: 26 }} />
        <EditOutlined sx={{ position: "absolute", right: "4%", bottom: "23%", color: "#a9e8ce", fontSize: 34, transform: "rotate(-12deg)" }} />
        <ChatBubbleOutlined sx={{ position: "absolute", left: "52%", top: "18%", color: "rgba(255,255,255,.75)", fontSize: 30 }} />
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", pb: { xs: 4.5, sm: 5.5 }, pt: { xs: 5, sm: 6 } }}>
        <Box role="group" aria-roledescription="slide" aria-label={`${active + 1} / ${slides.length}: ${slide.title}`} sx={{ maxWidth: 620 }}>
          <Typography sx={{ color: "#e8ddff", fontSize: { xs: 12.5, sm: 14 }, fontWeight: 700 }}>{slide.eyebrow}</Typography>
          <Typography id="hero-heading" component="h1" sx={{ fontSize: { xs: "1.9rem", sm: "3rem" }, lineHeight: 1.08, fontWeight: 800, mt: 0.75, maxWidth: 590 }}>{slide.title}</Typography>
          <Typography sx={{ mt: 1.25, fontSize: { xs: "0.95rem", sm: "1.14rem" }, fontWeight: 600, maxWidth: 560 }}>{slide.description}</Typography>
          {showZalo && (
            <Box sx={{ mt: { xs: 2, sm: 2.5 }, maxWidth: { sm: 360 } }}>
              <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" fullWidth endIcon={<ArrowForward />}>
                {content.contact.heroCtaLabel}
              </Button>
              <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "rgba(255,255,255,.86)", textAlign: "center" }}>{content.contact.heroCtaHint}</Typography>
            </Box>
          )}
        </Box>
      </Container>

      <IconButton aria-label="Slide trước" onClick={() => move(-1)} sx={{ position: "absolute", left: { xs: 8, sm: 18 }, top: { xs: "30%", sm: "42%" }, bgcolor: "rgba(255,255,255,.9)", color: "#4c2db7", "&:hover": { bgcolor: "white" } }}><ChevronLeft /></IconButton>
      <IconButton aria-label="Slide tiếp theo" onClick={() => move(1)} sx={{ position: "absolute", right: { xs: 8, sm: 18 }, top: { xs: "30%", sm: "42%" }, bgcolor: "rgba(255,255,255,.9)", color: "#4c2db7", "&:hover": { bgcolor: "white" } }}><ChevronRight /></IconButton>
      <Stack direction="row" spacing={0.75} sx={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)" }}>
        {slides.map((item, index) => (
          <IconButton
            key={item.id}
            aria-label={`Chuyển đến slide ${index + 1}: ${item.title}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => setActive(index)}
            sx={{ minWidth: 44, width: 44, height: 44, p: 0 }}
          >
            <Box sx={{ width: index === active ? 24 : 8, height: 8, borderRadius: 8, bgcolor: index === active ? "white" : "rgba(255,255,255,.58)", transition: reduceMotion ? "none" : "width 180ms ease" }} />
          </IconButton>
        ))}
      </Stack>
    </Box>
  );
}

export function HomePage() {
  const showZalo = isConfiguredExternalUrl(content.contact.zaloUrl, "zalo.me");
  const showFacebook = isConfiguredExternalUrl(content.contact.facebookUrl, "facebook.com");
  const verifiedTestimonials = publishableTestimonials(content.testimonials);
  const visibleTestimonials = isDevelopmentContent ? [...content.testimonials] : verifiedTestimonials;

  return (
    <Box sx={{ bgcolor: "#fff", color: "text.primary", overflowX: "clip" }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 64 }}>
            <School color="primary" aria-hidden="true" />
            <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>{content.brandName}</Typography>
            <Button component="a" href="#contact" size="small">Liên hệ</Button>
            <Button component={Link} to="/admin/login" size="small" color="inherit">Quản trị</Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main">
        <HeroCarousel showZalo={showZalo} />

        <Container maxWidth="lg">
          <Box component="section" id="about" aria-labelledby="about-heading" sx={sectionSx}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, .8fr) minmax(0, 1.2fr)" }, gap: { xs: 2.5, md: 4 }, alignItems: "center" }}>
              <Box component="img" src={content.media.teacherPhoto} alt={content.media.teacherPhotoAlt} loading="lazy" width="720" height="540" sx={{ width: "100%", maxHeight: { xs: 260, md: 330 }, objectFit: "cover", objectPosition: content.media.teacherPhotoFocalPosition, borderRadius: 3, boxShadow: "0 12px 30px rgba(55,40,90,.12)" }} />
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
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, mt: 3.5 }}>
              {content.videos.map((video) => <LearningVideo key={video.url} video={video} />)}
            </Box>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#f7f5ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="feedback" aria-labelledby="feedback-heading" sx={sectionSx}>
              <Typography variant="overline" color="primary">PHỤ HUYNH VÀ CÔ VY</Typography>
              <Typography id="feedback-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{visibleTestimonials.length ? "Phản hồi từ phụ huynh" : "Phụ huynh thường quan tâm"}</Typography>
              {visibleTestimonials.length ? (
                <Box data-testid="testimonial-list" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
                  {visibleTestimonials.map((item, index) => {
                    const tone = testimonialTone[index % testimonialTone.length];
                    return <Card component="figure" key={item.id} variant="outlined" sx={{ m: 0, borderRadius: 3, background: tone.background, borderColor: tone.border }}><CardContent>
                      <FormatQuote aria-hidden="true" sx={{ color: tone.accent, fontSize: 30, mb: 0.5 }} />
                      <Typography component="blockquote" sx={{ m: 0 }}>{item.quote}</Typography>
                      <Typography component="figcaption" variant="body2" color="text.secondary" sx={{ mt: 2, fontWeight: 600 }}>— {item.guardianLabel} · {item.studentLevel} · {item.location}</Typography>
                    </CardContent></Card>;
                  })}
                </Box>
              ) : (
                <Box data-testid="testimonial-fallback" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5, mt: 3 }}>
                  {content.parentTopics.map((topic, index) => <Card key={topic} variant="outlined" sx={{ borderRadius: 3, bgcolor: ["#fff9df", "#edf7ff", "#eefaf5"][index] }}><CardContent><ChatBubbleOutlined color="primary" aria-hidden="true" /><Typography component="h3" variant="subtitle1" sx={{ mt: 1 }}>{topic}</Typography></CardContent></Card>)}
                </Box>
              )}
            </Box>
          </Container>
        </Box>

        {(showZalo || showFacebook) && <Container maxWidth="md" sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
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
                {showZalo && <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" startIcon={<ChatBubbleOutlined />} sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap", background: "linear-gradient(105deg, #713bea, #268edc)" }}>{content.contact.zaloLabel}</Button>}
                {showFacebook && <Button component="a" href={content.contact.facebookUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" startIcon={<Facebook />} sx={{ minWidth: 0, px: 1, whiteSpace: "nowrap", color: "#174b77", background: "linear-gradient(105deg, #dcedff, #bfe2ff)", "&:hover": { background: "linear-gradient(105deg, #cfe6ff, #add9ff)" } }}>{content.contact.facebookLabel}</Button>}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{content.contact.followUp}</Typography>
            </Box>
          </Box>
        </Container>}
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", pt: 1, pb: "calc(8px + env(safe-area-inset-bottom, 0px))", bgcolor: "#faf9fd" }}>
        <Container maxWidth="lg"><Typography color="text.secondary" sx={{ textAlign: "center", fontSize: 12, lineHeight: 1.4 }}>{content.footer}</Typography></Container>
      </Box>
    </Box>
  );
}
