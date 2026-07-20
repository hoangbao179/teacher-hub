import { ArrowBack, Home } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

export function NotFoundPage({ admin = false }: { admin?: boolean }) {
  return <Stack component="main" spacing={2} sx={{ minHeight: admin ? 320 : "100dvh", alignItems: "center", justifyContent: "center", p: 3, textAlign: "center" }}>
    <Typography component="p" color="primary" sx={{ fontWeight: 900 }}>404</Typography>
    <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>Không tìm thấy trang</Typography>
    <Typography color="text.secondary">Đường dẫn này không tồn tại hoặc đã được thay đổi.</Typography>
    <Button component={Link} to={admin ? "/admin" : "/"} variant="contained" startIcon={admin ? <ArrowBack /> : <Home />}>
      {admin ? "Về trang Hôm nay" : "Về trang chủ"}
    </Button>
  </Stack>;
}
