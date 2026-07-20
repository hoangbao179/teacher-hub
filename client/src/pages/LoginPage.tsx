import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("teacher@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth.login({ email, password });
      navigate("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2 }}
    >
      <Paper
        component="form"
        onSubmit={submit}
        sx={{ p: 3, width: "100%", maxWidth: 420 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Đăng nhập cô giáo
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mt: 2 }}
        />
        <TextField
          fullWidth
          type="password"
          label="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mt: 2 }}
        />
        <Button
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mt: 3 }}
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </Paper>
    </Box>
  );
}
