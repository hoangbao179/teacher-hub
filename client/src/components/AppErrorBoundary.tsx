import { Box, Button, Stack, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { failed: boolean };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("React render failure", error, info);
    else console.error("React render failure", { name: error.name });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const adminRoute = window.location.pathname.startsWith("/admin");
    return <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default" }}>
      <Stack spacing={2} sx={{ width: "100%", maxWidth: 520, p: { xs: 2.5, sm: 4 }, border: 1, borderColor: "divider", borderRadius: 3, bgcolor: "background.paper", textAlign: "center", boxShadow: "0 12px 36px rgba(15,23,42,.08)" }} role="alert" data-testid="app-error-fallback">
        <Typography component="h1" variant="h5">Trang này đang gặp sự cố</Typography>
        <Typography color="text.secondary">Bạn có thể tải lại trang để thử lại. Nếu lỗi vẫn còn, hãy quay về trang chính và tiếp tục sau.</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "center" }}>
          <Button variant="contained" onClick={() => window.location.reload()}>Tải lại trang</Button>
          <Button variant="outlined" component="a" href={adminRoute ? "/admin" : "/"}>{adminRoute ? "Về trang quản trị" : "Về trang chủ"}</Button>
        </Stack>
      </Stack>
    </Box>;
  }
}
