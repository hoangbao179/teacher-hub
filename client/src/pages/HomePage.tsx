import {
  AutoStories,
  ChatBubbleOutlined,
  CheckCircleOutlined,
  Facebook,
  LightbulbOutlined,
  LocationOnOutlined,
  MenuBook,
  PlayArrow,
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
const programTone = {
  mint: { background: "linear-gradient(145deg, #fff8cf 0%, #e9f9ef 100%)", border: "#cfe8d8", icon: "#1d8b61" },
  blue: { background: "linear-gradient(145deg, #eaf5ff 0%, #f0eaff 100%)", border: "#d4d8f5", icon: "#5f48d5" },
  coral: { background: "linear-gradient(145deg, #fff0e9 0%, #f2ebff 100%)", border: "#efd4d5", icon: "#c55b61" },
} as const;

export function HomePage() {
  return (
    <Box sx={{ bgcolor: "#fff", color: "text.primary", overflowX: "clip" }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: "56px !important", gap: 0.5 }}>
            <Box component="img" src={content.media.headerMark} alt="" width="32" height="32" sx={{ flexShrink: 0 }} />
            <Typography component="span" variant="subtitle1" noWrap sx={{ ml: 0.5, flexGrow: 1, fontWeight: 800 }}>{content.headerBrandName}</Typography>
            <Button component="a" href="#contact" size="small">Liên hệ</Button>
            <Button component={Link} to="/admin/login" size="small" color="inherit">Quản trị</Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main">
        <Box sx={{ background: "linear-gradient(135deg, #f7f0ff 0%, #edf8ff 54%, #effaf4 100%)" }}>
          <Container maxWidth="lg">
            <Box component="section" aria-labelledby="hero-heading" sx={{ ...sectionSx, pt: { xs: 4, md: 6 } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(360px, .95fr)" }, gap: { xs: 3, md: 5 }, alignItems: "center" }}>
                <Box>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>{content.hero.eyebrow}</Typography>
                  <Typography id="hero-heading" component="h1" variant="h3" sx={{ mt: 1, fontWeight: 800, fontSize: { xs: "2rem", md: "3rem" } }}>{content.hero.heading}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 650, fontSize: { md: "1.08rem" } }}>{content.hero.description}</Typography>
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

        <Container maxWidth="lg">
          <Box component="section" id="about" aria-labelledby="about-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">GIỚI THIỆU CÔ VY</Typography>
            <Typography id="about-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.teacherProfile.heading}</Typography>
            <Typography variant="h6" component="p" sx={{ mt: 2 }}>{content.teacherProfile.greeting}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 850 }}>{content.teacherProfile.biography}</Typography>
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

        <Box sx={{ bgcolor: "#faf8ff" }}>
          <Container maxWidth="lg">
            <Box component="section" id="programs" aria-labelledby="programs-heading" sx={sectionSx}>
              <Typography variant="overline" color="primary">CHƯƠNG TRÌNH HỌC</Typography>
              <Typography id="programs-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Các lớp tiếng Anh và luyện thi tại Huế</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
                {content.programs.map((program) => {
                  const tone = programTone[program.accent];
                  return (
                    <Card component="article" key={program.title} variant="outlined" sx={{ height: "100%", background: tone.background, borderColor: tone.border, borderRadius: 3, boxShadow: "0 8px 22px rgba(57,42,94,.06)" }}>
                      <CardContent>
                        <MenuBook aria-hidden="true" sx={{ color: tone.icon, fontSize: 30 }} />
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
          <Box component="section" id="method" aria-labelledby="method-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">PHƯƠNG PHÁP GIẢNG DẠY</Typography>
            <Typography id="method-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Rõ ràng, vừa sức và có mục tiêu</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3.5 }}>
              {content.methods.map((method, index) => {
                const Icon = [LightbulbOutlined, AutoStories, CheckCircleOutlined][index];
                return <Card component="article" key={method.title} variant="outlined" sx={{ height: "100%", bgcolor: ["#f6f1ff", "#eef7ff", "#eefaf5"][index], borderRadius: 3 }}><CardContent><Icon color="primary" /><Typography component="h3" variant="h6" sx={{ mt: 1.25 }}>{method.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{method.detail}</Typography></CardContent></Card>;
              })}
            </Box>
          </Box>

          <Box component="section" id="locations" aria-labelledby="locations-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">ĐỊA ĐIỂM HỌC</Typography>
            <Typography id="locations-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.locations.heading}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{content.locations.description}</Typography>
            <Box component="address" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 3, fontStyle: "normal" }}>
              {content.locations.items.map((location) => (
                <Card key={location} variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <LocationOnOutlined color="primary" aria-hidden="true" />
                    <Typography sx={{ fontWeight: 600 }}>{location}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>

          <Box component="section" id="videos" aria-labelledby="videos-heading" sx={sectionSx}>
            <Typography variant="overline" color="primary">VIDEO HỌC TẬP</Typography>
            <Typography id="videos-heading" component="h2" variant="h4" sx={{ mt: 1 }}>Xem thử cách tiếp cận bài học</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Một số video tham khảo giúp học sinh luyện nghe, nhắc lại và ghi nhớ từ vựng qua ngữ cảnh.</Typography>
            <Typography data-testid="video-swipe-hint" variant="caption" color="primary" sx={{ display: { xs: "block", md: "none" }, mt: 2.5, textAlign: "right", fontWeight: 600 }}>Vuốt để xem thêm →</Typography>
            <Box data-testid="learning-video-list" sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2.5 }, mt: { xs: 1, md: 3.5 }, overflowX: { xs: "auto", md: "visible" }, scrollSnapType: { xs: "x mandatory", md: "none" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {content.videos.map((video) => <Box key={video.url} sx={{ flex: { xs: "0 0 85vw", md: "initial" }, maxWidth: { xs: 560, md: "none" }, scrollSnapAlign: "start" }}><LearningVideo video={video} /></Box>)}
            </Box>
          </Box>
        </Container>

        <Container maxWidth="md" sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
          <Box component="section" id="contact" aria-labelledby="contact-heading" sx={{ px: { xs: 2, sm: 4 }, py: { xs: 3.5, sm: 4.5 }, scrollMarginTop: 72, textAlign: "center", border: "1px solid #ddd2f5", borderRadius: { xs: 3, sm: 4 }, background: "linear-gradient(135deg, #f5efff 0%, #edf8ff 52%, #effaf4 100%)", boxShadow: "0 12px 30px rgba(57,42,94,.08)" }}>
            <MenuBook color="primary" sx={{ fontSize: 38 }} />
            <Typography id="contact-heading" component="h2" variant="h4" sx={{ mt: 1 }}>{content.contact.heading}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680, mx: "auto" }}>{content.contact.description}</Typography>
            <Stack direction="row" useFlexGap sx={{ justifyContent: "center", flexWrap: "wrap", gap: 1, mt: 2 }}>{content.contact.highlights.map((item) => <Chip key={item} size="small" label={item} />)}</Stack>
            <Box data-testid="contact-actions" sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 3 }}>
              <Button component="a" href={content.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="contained" size="large" startIcon={<ChatBubbleOutlined />}>Nhắn Zalo</Button>
              <Button component="a" href={content.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={content.contact.facebookAriaLabel} variant="outlined" size="large" startIcon={<Facebook />}>{content.contact.facebookLabel}</Button>
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
