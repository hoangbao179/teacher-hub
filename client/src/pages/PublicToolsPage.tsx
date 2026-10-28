import { ArrowBackRounded, ArrowForwardRounded, AutoStoriesRounded, LocalFloristRounded, SpaRounded } from "@mui/icons-material";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../content/publicHome";
import { PublicPdfTool } from "../components/PublicPdfTool";

/** Decorative, local vector artwork; all useful information remains in HTML. */
function GardenSprig() {
  return (
    <Box component="svg" viewBox="0 0 150 180" aria-hidden="true" focusable="false" sx={{ width: "100%", height: "100%" }}>
      <path d="M77 165 Q54 108 86 45 M73 139 Q114 125 120 94 M73 112 Q39 99 27 73" fill="none" stroke="#8aaf9a" strokeWidth="3" strokeLinecap="round" />
      <path d="M76 143 Q110 151 116 121 Q87 119 76 143 M71 119 Q38 124 35 96 Q62 95 71 119 M83 88 Q110 91 111 66 Q87 66 83 88" fill="#c1dfc9" />
      <g fill="#edbad1" transform="translate(86 40)">
        {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-14" rx="10" ry="16" transform={`rotate(${angle})`} />)}
        <circle r="9" fill="#f7d57f" />
      </g>
      <g fill="#d8c9ee" transform="translate(26 72)">
        {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-9" rx="7" ry="11" transform={`rotate(${angle})`} />)}
        <circle r="6" fill="#fff0b7" />
      </g>
    </Box>
  );
}

export function PublicToolsPage() {
  return (
    <Box data-testid="public-tools-page" sx={{ minHeight: "100svh", bgcolor: "#fffcf7", color: "#393348", display: "flex", flexDirection: "column" }}>
      <Container component="header" maxWidth="md" sx={{ pt: "max(16px, env(safe-area-inset-top))" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Button component={Link} to="/" startIcon={<ArrowBackRounded />} sx={{ minHeight: 48, color: "#5b4b75", borderRadius: 3 }}>Trang chủ</Button>
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#6b6077" }}>Lớp học cô Vy</Typography>
        </Stack>
      </Container>

      <Container component="main" maxWidth={false} sx={{ maxWidth: 1128, flex: 1, pt: { xs: 2, sm: 3 }, pb: 5 }}>
        <Box sx={{ textAlign: "center", position: "relative", px: { xs: 1, sm: 3 }, pb: 3 }}>
          <Box sx={{ position: "absolute", width: 64, height: 78, right: 0, top: -8, opacity: 0.7, pointerEvents: "none" }}><GardenSprig /></Box>
          <Box sx={{ display: "inline-flex", p: 1.5, borderRadius: "24px 24px 24px 8px", bgcolor: "#f9e0e9", color: "#b96d8d", mb: 1.5 }}>
            <LocalFloristRounded sx={{ fontSize: 32 }} aria-hidden="true" />
          </Box>
          <Typography sx={{ color: "#b96d8d", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", mb: 1.5 }}>CHUẨN BỊ BÀI, THÊM NIỀM VUI</Typography>
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 32, sm: 40 }, lineHeight: 1.3, letterSpacing: "-0.035em", textWrap: "balance" }}>Góc công cụ của cô Vy</Typography>
          <Typography data-testid="tools-description" sx={{ color: "#72677b", mt: 1.5, lineHeight: 1.8, mx: "auto" }}>Một góc nhỏ để việc chuẩn bị bài giảng nhẹ nhàng hơn, mỗi ngày một chút.</Typography>
        </Box>

        <PublicPdfTool />

        <Box component="section" aria-labelledby="explore-heading" sx={{ mt: 4, maxWidth: 600, mx: "auto" }}>
          <Typography id="explore-heading" component="h2" sx={{ fontWeight: 700, fontSize: 16, mb: 2, textAlign: "center", color: "#6d617a" }}>Khám phá thêm</Typography>
          <Stack spacing={1.5}>
            {[
              { to: "/hoc", title: "Góc học miễn phí", copy: "Cùng ôn từ vựng và luyện tiếng Anh", color: "#e8f5ef", icon: <SpaRounded /> },
              { to: "/sach", title: "Tủ sách tiếng Anh", copy: "Mở sách, tìm cảm hứng cho bài học", color: "#fff3d5", icon: <AutoStoriesRounded /> },
            ].map((item) => <Button key={item.to} component={Link} to={item.to} sx={{ justifyContent: "flex-start", textAlign: "left", bgcolor: item.color, color: "#51465f", p: 2, minHeight: 80, borderRadius: 3, gap: 1.5, "&:hover": { bgcolor: item.color, boxShadow: "inset 0 0 0 2px #b7a7c6" } }}>
              <Box aria-hidden="true" sx={{ display: "flex", flexShrink: 0 }}>{item.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="span" sx={{ display: "block", fontWeight: 700 }}>{item.title}</Typography><Typography component="span" sx={{ display: "block", fontSize: 12, fontWeight: 400, mt: 0.5 }}>{item.copy}</Typography></Box>
              <ArrowForwardRounded fontSize="small" aria-hidden="true" />
            </Button>)}
          </Stack>
        </Box>
      </Container>
      <Box component="footer" sx={{ textAlign: "center", bgcolor: "#fff1f5", px: 2, pt: 2, pb: "max(16px, env(safe-area-inset-bottom))" }}>
        <Typography sx={{ fontSize: 12, color: "#776884", lineHeight: 1.8 }}>{publicHomeContent.footer.copy}</Typography>
      </Box>
    </Box>
  );
}
