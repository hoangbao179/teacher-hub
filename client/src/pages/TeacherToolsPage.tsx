import { ArrowBack, Logout, PictureAsPdf, LinkOutlined } from "@mui/icons-material";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminTheme } from "../theme";
import { ThemeProvider } from "@mui/material";

/** A deliberately small landing page. Tools will be exposed when ready. */
export function TeacherToolsPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await auth.logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <ThemeProvider theme={adminTheme}>
      <Box data-testid="teacher-tools-page" sx={{ minHeight: "100svh", bgcolor: "#f5faf8", px: 2, pt: "max(16px, env(safe-area-inset-top))", pb: "max(24px, env(safe-area-inset-bottom))" }}>
        <Container maxWidth="sm" disableGutters>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Button component={Link} to="/" startIcon={<ArrowBack />} sx={{ minHeight: 48 }}>Trang chủ</Button>
            <Button onClick={() => void logout()} startIcon={<Logout />} color="inherit" sx={{ minHeight: 48 }}>Đăng xuất</Button>
          </Stack>
          <Stack spacing={2} sx={{ mt: { xs: 4, sm: 7 }, textAlign: "center", alignItems: "center" }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 68, height: 68, borderRadius: 3, bgcolor: "#def5ed", color: "#0f766e" }}>
              <PictureAsPdf sx={{ fontSize: 34 }} aria-hidden="true" />
            </Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.8rem", sm: "2.15rem" } }}>Công cụ cho cô Vy</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 330, lineHeight: 1.65 }}>Một nơi đơn giản để chuẩn bị tài liệu giảng dạy và in ấn.</Typography>
          </Stack>
          <Box sx={{ mt: 4, p: { xs: 2.5, sm: 3 }, borderRadius: 3, bgcolor: "#fff", border: "1px solid #d5e9e2", textAlign: "center" }}>
            <LinkOutlined aria-hidden="true" sx={{ fontSize: 32, color: "#0f766e" }} />
            <Typography variant="h6" component="h2" sx={{ mt: 1, fontWeight: 700 }}>Tải tài liệu từ liên kết</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>Tính năng này đang được chuẩn bị. Khi hoàn thành, cô chỉ cần dán liên kết để lấy tài liệu có quyền tải xuống.</Typography>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
