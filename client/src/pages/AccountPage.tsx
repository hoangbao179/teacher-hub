import {
  AccountCircleOutlined,
  BadgeOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  ColorLensOutlined,
  EventAvailableOutlined,
  LockOutlined,
  Logout,
  PaymentsOutlined,
  SchoolOutlined,
  ShieldOutlined,
  TuneOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { uiTokens } from "../theme";

interface SettingPreviewProps {
  icon: ReactNode;
  title: string;
  description: string;
  tone: "mint" | "sky" | "peach" | "cream";
}

const settingTone = {
  mint: { background: "#ecfaf5", border: uiTokens.colors.mintBorder, icon: "#168754", iconBackground: "#d7f5e7" },
  sky: { background: "#f0f8fe", border: uiTokens.colors.skyBorder, icon: "#247dae", iconBackground: "#dceffd" },
  peach: { background: "#fff8f0", border: uiTokens.colors.peachBorder, icon: "#a95418", iconBackground: "#ffe7ca" },
  cream: { background: "#fffaf5", border: "#efdcca", icon: "#b65f66", iconBackground: uiTokens.colors.coralSurface },
} as const;

function SettingPreview({ icon, title, description, tone }: SettingPreviewProps) {
  const colors = settingTone[tone];

  return (
    <Box
      component="article"
      sx={{
        minWidth: 0,
        p: { xs: 1.5, sm: 2 },
        border: "1px solid",
        borderColor: colors.border,
        borderRadius: 2,
        bgcolor: colors.background,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
        <Box
          aria-hidden="true"
          sx={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            bgcolor: colors.iconBackground,
            color: colors.icon,
            "& .MuiSvgIcon-root": { fontSize: 21 },
          }}
        >
          {icon}
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" useFlexGap sx={{ gap: 0.75, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
            <Chip label="Sắp mở" size="small" variant="outlined" sx={{ height: 24, bgcolor: "rgba(255,255,255,.7)", color: "text.secondary", borderColor: "rgba(100,116,139,.22)" }} />
          </Stack>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function AccountDetail({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0, py: 1.25 }}>
      <Box aria-hidden="true" sx={{ display: "grid", placeItems: "center", width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, bgcolor: uiTokens.colors.subtleSurface, color: "primary.dark", "& .MuiSvgIcon-root": { fontSize: 19 } }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
        <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
      </Box>
    </Stack>
  );
}

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
    <Stack spacing={{ xs: 1.5, md: 2.25 }} data-testid="account-page" sx={{ minWidth: 0, overflowX: "clip" }}>
      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h5">Tài khoản</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Thông tin quản trị và không gian cấu hình của lớp học.</Typography>
        </Box>
        <Chip icon={<TuneOutlined />} label="Bản xem trước" color="primary" variant="outlined" sx={{ bgcolor: "#f6fffc" }} />
      </Stack>

      <Card
        component="section"
        aria-labelledby="account-summary-title"
        sx={{
          position: "relative",
          overflow: "hidden",
          color: "text.primary",
          borderColor: "#b8e8df",
          background: "linear-gradient(120deg, #ffffff 0%, #ecfbf7 58%, #e4f5ff 100%)",
        }}
      >
        <Box aria-hidden="true" sx={{ position: "absolute", width: 180, height: 180, right: -64, top: -92, borderRadius: "50%", bgcolor: "rgba(255,255,255,.64)" }} />
        <Box aria-hidden="true" sx={{ position: "absolute", width: 84, height: 84, right: 92, bottom: -52, borderRadius: "50%", bgcolor: "rgba(20,184,166,.08)" }} />
        <CardContent sx={{ position: "relative", p: { xs: 2, sm: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2, sm: 2.5, md: 3 } } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.3fr) minmax(270px, .7fr)" }, gap: { xs: 2, md: 3 }, alignItems: "center" }}>
            <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: "center", minWidth: 0 }}>
              <Box
                aria-hidden="true"
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: { xs: 64, sm: 76 },
                  height: { xs: 64, sm: 76 },
                  flexShrink: 0,
                  border: "4px solid rgba(255,255,255,.88)",
                  borderRadius: "50%",
                  color: "common.white",
                  background: "linear-gradient(145deg, #25b9ad, #0f8f83)",
                  boxShadow: "0 8px 22px rgba(15,143,131,.2)",
                  fontSize: { xs: 25, sm: 30 },
                  fontWeight: 700,
                }}
              >
                {initial}
              </Box>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Chip label="Giáo viên quản trị" size="small" sx={{ alignSelf: "flex-start", bgcolor: uiTokens.colors.primarySurface, color: "primary.dark" }} />
                <Typography id="account-summary-title" component="h2" variant="h5" sx={{ fontSize: { xs: 19, sm: 22 }, overflowWrap: "anywhere" }}>{displayName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>@{username}</Typography>
              </Stack>
            </Stack>

            <Stack spacing={1.25} sx={{ p: 1.5, border: "1px solid rgba(20,184,166,.18)", borderRadius: 2, bgcolor: "rgba(255,255,255,.72)" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CheckCircleOutlined color="success" sx={{ fontSize: 21 }} />
                <Box>
                  <Typography variant="subtitle2">Phiên đang hoạt động</Typography>
                  <Typography variant="caption" color="text.secondary">Đã xác thực trên thiết bị này</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <ShieldOutlined color="primary" sx={{ fontSize: 21 }} />
                <Box>
                  <Typography variant="subtitle2">Quyền truy cập riêng tư</Typography>
                  <Typography variant="caption" color="text.secondary">Chỉ dành cho tài khoản quản trị</Typography>
                </Box>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(280px, .72fr) minmax(0, 1.28fr)" }, gap: { xs: 1.5, md: 2 }, alignItems: "start" }}>
        <Card component="section" aria-labelledby="account-info-title">
          <CardContent>
            <Stack spacing={0.25}>
              <Typography id="account-info-title" component="h2" variant="h6">Thông tin hiện tại</Typography>
              <Typography variant="body2" color="text.secondary">Thông tin lấy từ phiên đăng nhập.</Typography>
            </Stack>
            <Stack divider={<Divider flexItem />} sx={{ mt: 1.25 }}>
              <AccountDetail label="Tên hiển thị" value={displayName} icon={<BadgeOutlined />} />
              <AccountDetail label="Tên đăng nhập" value={username} icon={<AccountCircleOutlined />} />
              <AccountDetail label="Vai trò" value="Giáo viên quản trị" icon={<SchoolOutlined />} />
            </Stack>
            <Button fullWidth variant="outlined" color="primary" startIcon={<Logout />} disabled={loggingOut} onClick={() => void logout()} sx={{ mt: 1.5 }}>
              {loggingOut ? "Đang đăng xuất…" : "Đăng xuất trên thiết bị này"}
            </Button>
          </CardContent>
        </Card>

        <Card component="section" aria-labelledby="future-settings-title">
          <CardContent>
            <Stack spacing={0.25}>
              <Typography id="future-settings-title" component="h2" variant="h6">Không gian cấu hình</Typography>
              <Typography variant="body2" color="text.secondary">Các nhóm dưới đây là định hướng mở rộng, chưa có thao tác chỉnh sửa ở bản này.</Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25, mt: 2 }}>
              <SettingPreview icon={<ColorLensOutlined />} title="Hồ sơ & thương hiệu" description="Tên lớp, thông tin giới thiệu và nhận diện hiển thị." tone="mint" />
              <SettingPreview icon={<LockOutlined />} title="Bảo mật tài khoản" description="Đổi mật khẩu và quản lý các phiên đăng nhập." tone="sky" />
              <SettingPreview icon={<PaymentsOutlined />} title="Học phí mặc định" description="Thiết lập mức phí dùng khi tạo lớp học mới." tone="peach" />
              <SettingPreview icon={<EventAvailableOutlined />} title="Lịch & thời gian" description="Giờ dạy, múi giờ và quy ước hiển thị lịch." tone="mint" />
              <SettingPreview icon={<CloudOutlined />} title="Dữ liệu & tích hợp" description="Xuất dữ liệu và kết nối các dịch vụ hỗ trợ." tone="sky" />
              <SettingPreview icon={<TuneOutlined />} title="Tùy chọn hệ thống" description="Các thiết lập chung cho trải nghiệm quản trị." tone="cream" />
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: { xs: 1.5, sm: 2 }, border: "1px dashed", borderColor: "#b8dcd5", borderRadius: 2, bgcolor: "#f8fcfb", color: "text.secondary" }}>
        <ShieldOutlined aria-hidden="true" sx={{ mt: 0.1, flexShrink: 0, fontSize: 20, color: "primary.main" }} />
        <Typography variant="body2">Màn hình đang được ẩn khỏi điều hướng. Sau khi chốt nội dung, có thể mở đường vào mà không cần thay đổi lại bố cục.</Typography>
      </Box>
    </Stack>
  );
}
