import {
  AutoStories,
  ArrowBack,
  School,
  StarOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getRememberedUsername, getRememberPreference } from "../auth/authStorage";

function friendlyLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Không thể đăng nhập. Vui lòng thử lại.";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "Không thể kết nối máy chủ. Vui lòng thử lại.";
  if (error.code === "INVALID_CREDENTIALS") return "Sai tên đăng nhập hoặc mật khẩu.";
  if (error.code === "ACCOUNT_INACTIVE") return "Tài khoản hiện không hoạt động.";
  return "Không thể đăng nhập. Vui lòng thử lại.";
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(getRememberedUsername);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(getRememberPreference);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [blockedSeconds, setBlockedSeconds] = useState(0);
  const [retryFallback, setRetryFallback] = useState(false);

  useEffect(() => {
    if (blockedSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setBlockedSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [blockedSeconds]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blockedSeconds > 0) return;
    setLoading(true);
    setError("");
    auth.clearSessionMessage();
    try {
      await auth.login({ username, password }, remember);
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith("/admin") ? destination : "/admin", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setBlockedSeconds(Math.max(1, caught.retryAfterSeconds ?? 60));
        setRetryFallback(caught.retryAfterSeconds === undefined);
      } else {
        setError(friendlyLoginError(caught));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100svh",
        overflowX: "clip",
        overflowY: "auto",
        bgcolor: "#f5f1ff",
        background: "linear-gradient(145deg, #f6f1ff 0%, #edf6ff 72%, #eefaf5 100%)",
        px: 2,
        pt: "max(16px, env(safe-area-inset-top))",
        pb: "max(20px, env(safe-area-inset-bottom))",
      }}
    >
      <Box aria-hidden="true" sx={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", bgcolor: "rgba(109,61,245,.08)", top: -80, right: -70 }} />
      <Box aria-hidden="true" sx={{ position: "absolute", width: 120, height: 120, borderRadius: "32%", bgcolor: "rgba(63,169,245,.08)", bottom: 30, left: -70, transform: "rotate(18deg)" }} />
      <Typography aria-hidden="true" sx={{ position: "absolute", top: { xs: 76, sm: "16%" }, right: { xs: 14, sm: "8%" }, color: "rgba(109,61,245,.2)", fontWeight: 800, letterSpacing: ".08em", fontSize: { xs: 18, sm: 24 } }}>ABC</Typography>
      <AutoStories aria-hidden="true" sx={{ position: "absolute", left: { xs: 12, sm: "8%" }, top: { xs: "70%", sm: "62%" }, color: "rgba(24,145,103,.18)", fontSize: { xs: 30, sm: 42 }, transform: "rotate(-8deg)" }} />
      <StarOutlined aria-hidden="true" sx={{ position: "absolute", right: { xs: 18, sm: "12%" }, bottom: { xs: 26, sm: "18%" }, color: "rgba(234,151,27,.2)", fontSize: 34 }} />
      <Stack sx={{ position: "relative", width: "100%", maxWidth: 460, minHeight: { xs: "auto", sm: "calc(100svh - 40px)" }, mx: "auto", justifyContent: { xs: "flex-start", sm: "center" } }}>
        <Button component={Link} to="/" startIcon={<ArrowBack />} color="inherit" sx={{ alignSelf: "flex-start", mb: { xs: 1.5, sm: 2 } }}>
          Về trang chủ
        </Button>
        <Paper component="form" aria-labelledby="login-title" onSubmit={submit} elevation={3} sx={{ p: { xs: 2.5, sm: 3.5 }, width: "100%", border: "1px solid", borderColor: "rgba(109,61,245,.14)", borderRadius: 3 }}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: 2.5, color: "primary.main", bgcolor: "#eee8ff" }}>
              <School aria-hidden="true" sx={{ fontSize: 29 }} />
            </Box>
            <Typography variant="overline" color="primary">LỚP HỌC CÔ VY</Typography>
            <Typography id="login-title" component="h1" variant="h5">Chào mừng cô Vy trở lại</Typography>
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>Tiếng Anh lớp 1–9</Typography>
          </Stack>

          <Typography component="h2" variant="subtitle1" sx={{ mt: 2.5 }}>Đăng nhập</Typography>
          {blockedSeconds > 0 && (
            <Alert severity="warning" aria-live="polite" sx={{ mt: 1.5 }}>
              {retryFallback
                ? `Bạn đã nhập sai quá nhiều lần. Máy chủ không gửi thời gian chờ; có thể thử lại sau khoảng ${blockedSeconds} giây.`
                : `Bạn đã nhập sai quá nhiều lần. Có thể thử lại sau ${blockedSeconds} giây.`}
            </Alert>
          )}
          {(error || auth.sessionMessage) && blockedSeconds === 0 && <Alert severity="error" sx={{ mt: 1.5 }}>{error || auth.sessionMessage}</Alert>}
          <TextField
            fullWidth
            required
            name="username"
            autoComplete="username"
            label="Tên đăng nhập"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            required
            name="password"
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            label="Mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            sx={{ mt: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControlLabel
            sx={{ mt: 1.25, alignItems: "flex-start", "& .MuiFormControlLabel-label": { pt: 1 } }}
            control={<Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} />}
            label="Ghi nhớ đăng nhập trên thiết bị này"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4.75 }}>
            Không chọn khi đăng nhập trên thiết bị dùng chung.
          </Typography>
          <Button fullWidth type="submit" variant="contained" size="large" disabled={loading || blockedSeconds > 0} sx={{ mt: 2.5 }}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2 }}>
            Ứng dụng chỉ ghi nhớ phiên và tên đăng nhập theo lựa chọn của cô. Trình duyệt có thể đề nghị lưu mật khẩu an toàn trên thiết bị này.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
