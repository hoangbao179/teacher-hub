import { AccountCircleOutlined, CheckCircleOutlined, Logout } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { uiTokens } from "../theme";

export function AccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = auth.user?.displayName.trim() || "Cô Vy";
  const username = auth.user?.username || "—";
  const initial = displayName.charAt(0).toLocaleUpperCase("vi-VN") || "V";

  async function logout() {
    setLoggingOut(true);
    await auth.logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }} data-testid="account-page" sx={{ width: "100%", maxWidth: 680, mx: "auto", minWidth: 0, overflowX: "clip" }}>
      <Box>
        <Typography component="h1" variant="h5">Tài khoản</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Thông tin đăng nhập của cô Vy.</Typography>
      </Box>

      <Card component="section" aria-labelledby="account-name" sx={{ borderColor: "#b8e8df", background: "linear-gradient(120deg, #ffffff 0%, #ecfbf7 100%)" }}>
        <CardContent><Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
            <Box aria-hidden="true" sx={{ display: "grid", placeItems: "center", width: 64, height: 64, flexShrink: 0, borderRadius: "50%", color: "common.white", background: "linear-gradient(145deg, #25b9ad, #0f8f83)", boxShadow: "0 8px 22px rgba(15,143,131,.2)", fontSize: 25, fontWeight: 700 }}>{initial}</Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography id="account-name" component="h2" variant="h6" sx={{ overflowWrap: "anywhere" }}>{displayName}</Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>Tên đăng nhập: {username}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,.76)" }}>
            <CheckCircleOutlined color="success" />
            <Box>
              <Typography variant="subtitle2">Đang đăng nhập</Typography>
              <Typography variant="body2" color="text.secondary">Tài khoản đang hoạt động trên thiết bị này.</Typography>
            </Box>
          </Stack>

          <Button fullWidth variant="outlined" startIcon={<Logout />} disabled={loggingOut} onClick={() => void logout()} sx={{ minHeight: 44 }}>
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </Button>
        </Stack></CardContent>
      </Card>

      <Card component="section" variant="outlined" sx={{ bgcolor: uiTokens.colors.subtleSurface }}>
        <CardContent><Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <AccountCircleOutlined aria-hidden="true" color="primary" sx={{ mt: 0.1, flexShrink: 0 }} />
          <Box>
            <Typography component="h2" variant="subtitle1">Cài đặt tài khoản đang được hoàn thiện</Typography>
            <Typography variant="body2" color="text.secondary">Đổi mật khẩu và cập nhật thông tin tài khoản sẽ được bổ sung sau.</Typography>
          </Box>
        </Stack></CardContent>
      </Card>
    </Stack>
  );
}
