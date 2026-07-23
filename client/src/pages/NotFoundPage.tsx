import { ArrowBack, ChatBubbleOutlined, Home } from "@mui/icons-material";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../content/publicHome";

export function NotFoundPage({ admin = false }: { admin?: boolean }) {
  if (admin) {
    return <Stack component="main" spacing={2} sx={{ minHeight: 320, alignItems: "center", justifyContent: "center", p: 3, textAlign: "center" }}>
      <Typography component="p" color="primary" sx={{ fontWeight: 700 }}>404</Typography>
      <Typography component="h1" variant="h4">Không tìm thấy trang</Typography>
      <Typography color="text.secondary">Đường dẫn này không tồn tại hoặc đã được thay đổi.</Typography>
      <Button component={Link} to="/admin" variant="contained" startIcon={<ArrowBack />}>Về trang Hôm nay</Button>
    </Stack>;
  }

  return (
    <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", overflowX: "clip", p: { xs: 2, sm: 3 }, background: "linear-gradient(145deg, #f7f0ff 0%, #edf8ff 52%, #effaf4 100%)" }}>
      <Container maxWidth="sm">
        <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center", p: { xs: 3, sm: 5 }, border: "1px solid #ddd2f5", borderRadius: 4, bgcolor: "rgba(255,255,255,.88)", boxShadow: "0 16px 40px rgba(57,42,94,.1)" }}>
          <Box aria-hidden="true" sx={{ position: "relative", width: 150, height: 92 }}>
            <Box sx={{ position: "absolute", left: 16, bottom: 5, width: 118, height: 62, bgcolor: "#fff8cf", border: "3px solid #6d3df5", borderRadius: "8px 8px 16px 16px", transform: "rotate(-3deg)" }} />
            <Typography sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "primary.main", fontSize: 42, fontWeight: 900, transform: "rotate(-3deg)" }}>ABC</Typography>
            <Box sx={{ position: "absolute", right: 5, top: 2, width: 48, height: 3, bgcolor: "#e87812", borderRadius: 2, transform: "rotate(-32deg)", transformOrigin: "right center" }} />
          </Box>
          <Typography component="p" color="primary" sx={{ fontSize: { xs: 48, sm: 60 }, lineHeight: 1, fontWeight: 900 }}>404</Typography>
          <Typography component="h1" variant="h4">Ôi, trang này đi lạc rồi!</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 460 }}>
            Có vẻ trang bạn tìm chưa nằm trong giáo án của cô Vy. Mình cùng quay lại lớp học nhé.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Button component={Link} to="/" variant="contained" startIcon={<Home />}>Về trang chủ</Button>
            <Button component="a" href={publicHomeContent.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<ChatBubbleOutlined />}>Nhắn Zalo</Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
