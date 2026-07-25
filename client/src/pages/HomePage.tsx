import {
  AutoStories,
  ArrowForward,
  ChatBubbleOutlined,
  CheckCircleOutlined,
  CastForEducationOutlined,
  DirectionsOutlined,
  Facebook,
  FormatQuote,
  GroupOutlined,
  HomeWorkOutlined,
  LightbulbOutlined,
  LocationOnOutlined,
  MapOutlined,
  MenuBook,
  OpenInNewOutlined,
  PlayArrow,
  SchoolOutlined,
  TrackChangesOutlined,
  WorkspacePremiumOutlined,
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
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
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
            loading="lazy"
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
              sx={{ position: "absolute", inset: 0, m: "auto", width: 58, height: 58, bgcolor: "white", color: "primary.main", "&:hover": { bgcolor: "grey.100" } }}
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
const compactSectionSx = { ...sectionSx, py: { xs: 4, sm: 5, md: 4 } } as const;
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
const headerLinkSx = {
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: 0,
  "@media (max-width:599.95px)": {
    minHeight: "unset",
    px: 0.75,
    py: 0,
    fontSize: 13,
    lineHeight: 1.4,
  },
} as const;
const actionButtonSx = {
  minHeight: 48,
  minWidth: 0,
  px: { xs: 1.25, sm: 2 },
  whiteSpace: "nowrap",
  fontSize: { xs: 13, sm: 14 },
  borderRadius: 2.5,
  "& .MuiButton-startIcon, & .MuiButton-endIcon": { flexShrink: 0 },
} as const;

const trustIcons = {
  experience: SchoolOutlined,
  vstep: WorkspacePremiumOutlined,
  tesol: CastForEducationOutlined,
  "learning-format": GroupOutlined,
} as const;

function LocationMapPanel() {
  const [mapFailed, setMapFailed] = useState(false);
  const location = content.locations.primary;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  const showEmbed = Boolean(apiKey) && !mapFailed;

  return (
    <Card data-testid="homepage-map-panel" variant="outlined" sx={{ minHeight: { xs: 280, md: "100%" }, overflow: "hidden", borderRadius: 3, borderColor: "#d7dced", background: "linear-gradient(145deg, #edf7ff 0%, #f5f0ff 58%, #fff9e7 100%)" }}>
      {showEmbed ? (
        <Box
          component="iframe"
          title="Bản đồ Lớp tiếng Anh cô Vy"
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${location.latitude}%2C${location.longitude}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setMapFailed(true)}
          sx={{ display: "block", width: "100%", height: "100%", minHeight: { xs: 320, md: 440 }, border: 0 }}
        />
      ) : (
        <CardContent sx={{ minHeight: { xs: 280, md: 440 }, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", p: { xs: 3, sm: 4 } }}>
          <Box sx={{ width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: "rgba(109,61,245,.1)", color: "primary.main" }}>
            <MapOutlined aria-hidden="true" sx={{ fontSize: 38 }} />
          </Box>
          <Typography component="h3" variant="h6" sx={{ mt: 2 }}>{location.name}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 420 }}>{location.address}</Typography>
          <Button data-testid="google-maps-fallback-link" component="a" href={location.placeUrl} target="_blank" rel="noopener noreferrer" variant="outlined" endIcon={<OpenInNewOutlined />} sx={{ ...actionButtonSx, mt: 2.5 }}>
            Mở Google Maps
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export function HomePage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  useEffect(() => {
    if (isDesktop || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % content.testimonials.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isDesktop]);

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        color: "text.primary",
        overflowX: "clip",
        "& h1, & h2, & h3, & h4, & h5, & h6": { textWrap: "balance" },
        "& p, & blockquote": { textWrap: "pretty" },
      }}
    >
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: "56px !important", gap: { xs: 0.25, sm: 0.5 } }}>
            <Box data-testid="header-logo" component="img" src={content.media.headerMark} alt="" width="32" height="32" sx={{ width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 }, flexShrink: 0 }} />
            <Typography data-testid="header-brand" component="span" variant="subtitle1" sx={{ ml: { xs: 0.25, sm: 0.5 }, minWidth: 0, flexGrow: 1, fontWeight: 800, fontSize: { xs: 14, sm: 15 }, whiteSpace: "nowrap", overflow: "visible", textOverflow: "clip" }}>{content.headerBrandName}</Typography>
            <Button data-testid="header-contact" component="a" href="#contact" size="small" sx={headerLinkSx}>Liên hệ</Button>
            <Button data-testid="header-admin" component={Link} to="/admin/login" size="small" color="inherit" sx={headerLinkSx}>Quản trị</Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main">
        <Box sx={{ background: "linear-gradient(135deg, #f7f0ff 0%, #edf8ff 54%, #effaf4 100%)" }}>
          <Container maxWidth="lg">
            <Box component="section" id="hero" aria-labelledby="hero-heading" sx={{ ...sectionSx, pt: { xs: 4, md: 6 } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(360px, .95fr)" }, gap: { xs: 3, md: 5 }, alignItems: "center" }}>
                <Box>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>{content.hero.eyebrow}</Typography>
                  <Typography id="hero-heading" component="h1" variant="h3" sx={{ mt: 1, fontWeight: 800, fontSize: { xs: "2rem", md: "3rem" } }}>{content.hero.heading}</Typography>
                   <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 650, fontSize: { md: "1.08rem" } }}>{content.hero.description}</Typography>
                   <Box data-testid="homepage-hero-actions" sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 3, "@media (min-width:390px)": { flexDirection: "row" } }}>
                     <Button component="a" href="#contact" variant="contained" sx={{ ...actionButtonSx, height: 48, px: 2 }}>Trao đổi về lớp học</Button>
                     <Button component={Link} to="/hoc" variant="outlined" endIcon={<ArrowForward />} sx={{ ...actionButtonSx, height: 48, px: 2 }}>Góc học miễn phí</Button>
                   </Box>
                </Box>
                <Box component="picture">
                  {content.media.teacherPhotoSources.map((source) => <source key={source.type} srcSet={source.srcSet} type={source.type} />)}
                  <Box
                    component="img"
                    src={content.media.teacherPhoto}
                    alt={content.media.teacherPhotoAlt}
                    width="1448"
                    height="1086"
                    fetchPriority="high"
                    sx={{ display: "block", width: "100%", height: { xs: 280, sm: 390, md: 410 }, objectFit: "cover", objectPosition: content.media.teacherPhotoFocalPosition, borderRadius: 3, boxShadow: "0 12px 30px rgba(55,40,90,.14)" }}
                  />
                </Box>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box component="section" id="trust" aria-label="Thông tin tin cậy" data-testid="homepage-trust-strip" sx={{ bgcolor: "#fff", py: { xs: 2.5, md: 3 } }}>
          <Container maxWidth="lg">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
              {content.trustItems.map((item, index) => {
                const Icon = trustIcons[item.id];
                return (
                  <Box key={item.id} data-testid={`homepage-trust-item-${item.id}`} sx={{ minWidth: 0, p: { xs: 1.5, sm: 2 }, textAlign: "center", border: "1px solid", borderColor: ["#d8e8f6", "#ddd3f5", "#d5ebdf", "#f0dfbd"][index], borderRadius: 3, bgcolor: ["#f1f8ff", "#f6f1ff", "#f1faf5", "#fff9e9"][index] }}>
                    <Icon aria-hidden="true" color="primary" sx={{ fontSize: { xs: 27, sm: 30 } }} />
                    <Typography sx={{ mt: 0.75, fontWeight: 800, fontSize: { xs: 13, sm: 14.5 }, lineHeight: 1.35 }}>{item.label}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: { xs: 11.5, sm: 12.5 }, lineHeight: 1.35 }}>{item.detail}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="about" aria-labelledby="about-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">GIỚI THIỆU</Typography>
            <Typography id="about-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.teacherProfile.heading}</Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 850 }}>{content.teacherProfile.biography}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 3.5 }}>
              {[
                { heading: "Kinh nghiệm giảng dạy", items: content.teacherProfile.experience },
                { heading: "Bằng cấp và chứng chỉ", items: content.teacherProfile.qualifications },
              ].map((group) => (
                <Card component="article" key={group.heading} variant="outlined" sx={{ borderRadius: 3, bgcolor: "#faf9ff" }}>
                  <CardContent>
                    <Typography component="h3" variant="h6">{group.heading}</Typography>
                    <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", pl: 0, mb: 0, mt: 2 }}>
                      {group.items.map((item) => <Stack component="li" direction="row" spacing={1} key={item} sx={{ alignItems: "flex-start" }}><CheckCircleOutlined aria-hidden="true" color="success" sx={{ mt: "2px", flexShrink: 0 }} /><Typography variant="body2">{item}</Typography></Stack>)}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        </Container>

        <Box sx={{ bgcolor: "#f8f4ff" }}>
          <Container maxWidth="lg">
            <Box component="section" aria-labelledby="free-learning-heading" data-testid="homepage-learning-cta" sx={{ py: { xs: 4, sm: 5 } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto" }, gap: 2.5, alignItems: "center", p: { xs: 2.5, sm: 3.5 }, border: "1px solid #d9cdf3", borderRadius: 3, background: "linear-gradient(135deg,#f1ebff 0%,#eaf7ff 55%,#fff3d8 100%)", boxShadow: "0 10px 24px rgba(57,42,94,.07)" }}>
                <Box>
                  <Typography variant="overline" color="primary">GÓC HỌC MIỄN PHÍ</Typography>
                  <Typography id="free-learning-heading" component="h2" variant="h4" sx={{ mt: 0.75 }}>Học tiếng Anh cùng cô Vy</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.75 }}>Chọn cấp độ, làm quen từ mới và xây thói quen học vui mỗi ngày.</Typography>
                </Box>
                <Button component={Link} to="/hoc" variant="contained" endIcon={<ArrowForward />} sx={{ minWidth: { sm: 156 }, borderRadius: 3 }}>Bắt đầu học</Button>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box sx={{ bgcolor: "#faf8ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="programs" aria-labelledby="programs-heading" sx={sectionSx}>
              <Typography variant="overline" color="primary">CHƯƠNG TRÌNH HỌC</Typography>
              <Typography id="programs-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Ba nhóm chương trình</Typography>
              <Box data-testid="program-list" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, alignItems: "stretch", gap: 2, mt: 3.5 }}>
                {content.programs.map((program, index) => {
                  const tone = programTone[program.accent];
                  const Icon = [AutoStories, SchoolOutlined, TrackChangesOutlined][index];
                  return (
                    <Card component="article" key={program.title} variant="outlined" sx={{ height: "100%", background: tone.background, borderColor: tone.border, borderRadius: 3, boxShadow: "0 8px 22px rgba(57,42,94,.06)" }}>
                      <CardContent>
                        <Icon aria-hidden="true" sx={{ color: tone.icon, fontSize: 30 }} />
                        <Typography component="h3" variant="h6" sx={{ mt: 1 }}>{program.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{program.summary}</Typography>
                        <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", pl: 0, mb: 0, mt: 2 }}>
                          {program.topics.map((topic) => <Stack component="li" direction="row" spacing={0.8} key={topic} sx={{ alignItems: "center" }}><CheckCircleOutlined aria-hidden="true" sx={{ color: tone.icon, fontSize: 18 }} /><Typography variant="body2">{topic}</Typography></Stack>)}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" id="method" aria-labelledby="method-heading" sx={{ ...sectionSx, pb: { xs: 4, sm: 5, md: 4 } }}>
            <Typography variant="overline" color="primary">PHƯƠNG PHÁP GIẢNG DẠY</Typography>
            <Typography id="method-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Rõ ràng, vừa sức, đúng mục tiêu</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
              {content.methods.map((method, index) => {
                const Icon = [LightbulbOutlined, AutoStories, CheckCircleOutlined][index];
                return <Card component="article" key={method.title} variant="outlined" sx={{ height: "100%", bgcolor: ["#f6f1ff", "#eef7ff", "#eefaf5"][index], borderRadius: 3 }}><CardContent><Icon color="primary" /><Typography component="h3" variant="h6" sx={{ mt: 1.25 }}>{method.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{method.detail}</Typography></CardContent></Card>;
              })}
            </Box>
          </Box>

          <Box component="section" id="locations" aria-labelledby="locations-heading" data-testid="homepage-location-section" sx={compactSectionSx}>
            <Typography variant="overline" color="primary">{content.locations.eyebrow}</Typography>
            <Typography id="locations-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.locations.heading}</Typography>
            <Box data-testid="homepage-location-layout" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 2.5 }, alignItems: "stretch", mt: 3 }}>
              <Card data-testid="homepage-location-card" component="article" variant="outlined" sx={{ borderRadius: 3, background: "linear-gradient(145deg, #faf9ff 0%, #f4f0ff 55%, #fffaf0 100%)", borderColor: "#ded5f0" }}>
                <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, "&:last-child": { pb: { xs: 2.5, sm: 3.5 } } }}>
                  <Chip label={content.locations.primary.badge} color="primary" size="small" sx={{ fontWeight: 700 }} />
                  <Stack component="address" direction="row" spacing={1.25} sx={{ mt: 2, alignItems: "flex-start", fontStyle: "normal" }}>
                    <LocationOnOutlined color="primary" aria-hidden="true" sx={{ flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography component="h3" variant="h6">{content.locations.primary.name}</Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.75 }}>{content.locations.primary.address}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.25} sx={{ mt: 2.5, p: 2, alignItems: "flex-start", borderRadius: 2.5, bgcolor: "rgba(255,255,255,.72)", border: "1px solid #e1dcf0" }}>
                    <HomeWorkOutlined color="primary" aria-hidden="true" sx={{ flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{content.locations.homeTeaching.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{content.locations.homeTeaching.description}</Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2.25 }}>{content.locations.note}</Typography>
                  <Box data-testid="homepage-location-actions" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, mt: 2.5 }}>
                    <Button data-testid="google-maps-place-link" component="a" href={content.locations.primary.placeUrl} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<LocationOnOutlined />} endIcon={<OpenInNewOutlined />} sx={{ ...actionButtonSx, flex: 1, height: 48 }}>Xem trên Google Maps</Button>
                    <Button data-testid="google-maps-directions-link" component="a" href={content.locations.primary.directionsUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<DirectionsOutlined />} sx={{ ...actionButtonSx, flex: 1, height: 48 }}>Chỉ đường</Button>
                  </Box>
                </CardContent>
              </Card>
              <LocationMapPanel />
            </Box>
          </Box>

          <Box component="section" id="videos" aria-labelledby="videos-heading" sx={compactSectionSx}>
            <Typography variant="overline" color="primary">VIDEO HỌC TẬP</Typography>
            <Typography id="videos-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Xem thử cách tiếp cận bài học</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Video tham khảo để luyện nghe và ghi nhớ từ vựng qua ngữ cảnh.</Typography>
            <Box data-testid="learning-video-list" sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2.5 }, mt: 3.5, overflowX: { xs: "auto", md: "visible" }, scrollSnapType: { xs: "x mandatory", md: "none" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {content.videos.map((video) => <Box key={video.url} sx={{ flex: { xs: "0 0 85vw", md: "initial" }, maxWidth: { xs: 560, md: "none" }, scrollSnapAlign: "start" }}><LearningVideo video={video} /></Box>)}
            </Box>
          </Box>

          <Box component="section" id="feedback" aria-label="Phản hồi phụ huynh" sx={{ ...sectionSx, position: "relative", pt: { xs: 4, sm: 4, md: 2 }, pb: { xs: 4, sm: 4, md: 4 } }}>
            <Typography variant="overline" color="primary">PHỤ HUYNH CHIA SẺ</Typography>
            <Typography component="h2" variant="h4" sx={{ display: { xs: "none", md: "block" }, mt: 1 }}>Những thay đổi phụ huynh nhận thấy</Typography>
            <Box data-testid="testimonial-list" sx={{ width: "100%", maxWidth: 1152, mt: { xs: 2, md: 3 }, mx: "auto", overflow: "hidden", borderRadius: 3 }}>
              <Box
                data-testid="testimonial-track"
                sx={{
                  display: { xs: "flex", md: "grid" },
                  gridTemplateColumns: { md: "repeat(3, minmax(0, 1fr))" },
                  gap: { md: 2.5 },
                  alignItems: "stretch",
                  transform: { xs: `translateX(-${activeTestimonial * 100}%)`, md: "none" },
                  transition: { xs: "transform 420ms ease", md: "none" },
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                }}
              >
                {content.testimonials.map((item, index) => {
                  const tone = testimonialTone[index % testimonialTone.length];
                  return (
                    <Card component="figure" aria-hidden={isDesktop ? undefined : index !== activeTestimonial} key={item.id} variant="outlined" sx={{ m: 0, flex: { xs: "0 0 100%", md: "initial" }, minWidth: 0, height: { md: "100%" }, borderRadius: 3, background: tone.background, borderColor: tone.border, boxShadow: "0 8px 22px rgba(57,42,94,.06)" }}>
                      <CardContent sx={{ width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", p: { xs: 2.5, md: 4 }, "&:last-child": { pb: { xs: 2.5, md: 4 } } }}>
                        <FormatQuote aria-hidden="true" sx={{ color: tone.accent, fontSize: 30, mb: 0.5 }} />
                        <Typography component="blockquote" sx={{ m: 0, fontSize: { xs: 16, md: "inherit" }, lineHeight: { xs: 1.55, md: "inherit" } }}>{item.quote}</Typography>
                        <Box component="figcaption" sx={{ mt: 2.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.guardianLabel}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.studentLevel}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
            <Stack data-testid="testimonial-dots" direction="row" aria-hidden="true" sx={{ display: { xs: "flex", md: "none" }, width: "100%", maxWidth: 1152, mx: "auto", justifyContent: "center", gap: 0.75, mt: 1.5 }}>
              {content.testimonials.map((item, index) => (
                <Box key={item.id} sx={{ width: index === activeTestimonial ? 20 : 7, height: 7, borderRadius: 4, bgcolor: index === activeTestimonial ? "primary.main" : "action.disabled", transition: "width 200ms ease", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }} />
              ))}
            </Stack>
          </Box>

          <Box component="section" id="contact" aria-labelledby="contact-heading" data-testid="contact-section" sx={{ ...compactSectionSx, pt: { xs: 2, sm: 3, md: 2 }, scrollMarginTop: 72 }}>
            <Box sx={{ width: "100%", maxWidth: 1152, boxSizing: "border-box", mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 4 }, textAlign: { sm: "center" }, border: "1px solid #ddd2f5", borderRadius: 3, background: "linear-gradient(135deg, #f5efff 0%, #edf8ff 52%, #effaf4 100%)", boxShadow: "0 10px 24px rgba(57,42,94,.07)" }}>
              <MenuBook color="primary" sx={{ fontSize: 30 }} />
              <Typography id="contact-heading" component="h2" variant="h4" sx={{ mt: 0.75 }}>{content.contact.heading}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>{content.contact.description}</Typography>
              <Stack direction="row" useFlexGap sx={{ justifyContent: { sm: "center" }, flexWrap: "wrap", gap: 0.75, mt: 2 }}>{content.contact.highlights.map((item) => <Chip key={item} size="small" label={item} />)}</Stack>
              <Box data-testid="contact-actions" sx={{ display: "flex", gap: 1, mt: 2.5, maxWidth: 440, mx: "auto" }}>
                <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<ChatBubbleOutlined />} sx={{ flex: 1, minWidth: 0, minHeight: 44, px: 1, fontSize: 14, whiteSpace: "nowrap", "& .MuiButton-startIcon": { flexShrink: 0 } }}>Nhắn Zalo</Button>
                <Button component="a" href={content.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={content.contact.facebookAriaLabel} variant="outlined" startIcon={<Facebook />} sx={{ flex: 1, minWidth: 0, minHeight: 44, px: 1, fontSize: 14, whiteSpace: "nowrap", "& .MuiButton-startIcon": { flexShrink: 0 } }}>{content.contact.facebookLabel}</Button>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", pt: 1, pb: "calc(8px + env(safe-area-inset-bottom, 0px))", bgcolor: "#faf9fd" }}>
        <Container maxWidth="lg">
          <Typography color="text.secondary" sx={{ textAlign: "center", fontSize: 12, lineHeight: 1.4 }}>{content.footer.copy}</Typography>
        </Container>
      </Box>
    </Box>
  );
}
