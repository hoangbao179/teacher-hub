import {
  ArrowBack,
  School,
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
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getRememberedEmail, getRememberPreference } from "../auth/authStorage";

function friendlyLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Không thể đăng nhập. Vui lòng thử lại.";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "Không thể kết nối máy chủ. Vui lòng thử lại.";
  if (error.code === "INVALID_CREDENTIALS") return "Sai email hoặc mật khẩu.";
  if (error.code === "ACCOUNT_INACTIVE") return "Tài khoản hiện không hoạt động.";
  if (error.status === 429) return "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.";
  return "Không thể đăng nhập. Vui lòng thử lại.";
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(getRememberPreference);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    auth.clearSessionMessage();
    try {
      await auth.login({ email, password }, remember);
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith("/admin") ? destination : "/admin", { replace: true });
    } catch (caught) {
      setError(friendlyLoginError(caught));
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
      <Stack sx={{ position: "relative", width: "100%", maxWidth: 460, minHeight: { xs: "auto", sm: "calc(100svh - 40px)" }, mx: "auto", justifyContent: { xs: "flex-start", sm: "center" } }}>
        <Button component={Link} to="/" startIcon={<ArrowBack />} color="inherit" sx={{ alignSelf: "flex-start", mb: { xs: 1.5, sm: 2 } }}>
          Về trang chủ
        </Button>
        <Paper component="form" aria-labelledby="login-title" onSubmit={submit} elevation={3} sx={{ p: { xs: 2.5, sm: 3.5 }, width: "100%", border: "1px solid", borderColor: "rgba(109,61,245,.14)", borderRadius: 3 }}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: 2.5, color: "primary.main", bgcolor: "#eee8ff" }}>
              <School aria-hidden="true" sx={{ fontSize: 29 }} />
            </Box>
            <Typography id="login-title" component="h1" variant="h5">Lớp học tiếng Anh cô Vy</Typography>
            <Typography color="text.secondary">Quản lý lớp học, buổi học và học phí</Typography>
          </Stack>

          <Typography component="h2" variant="subtitle1" sx={{ mt: 3 }}>Đăng nhập cô giáo</Typography>
          {(error || auth.sessionMessage) && <Alert severity="error" sx={{ mt: 1.5 }}>{error || auth.sessionMessage}</Alert>}
          <TextField
            fullWidth
            required
            name="email"
            autoComplete="username"
            inputMode="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 2.5 }}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2 }}>
            Ứng dụng chỉ ghi nhớ phiên và email theo lựa chọn của cô. Trình duyệt có thể đề nghị lưu mật khẩu an toàn trên thiết bị này.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
