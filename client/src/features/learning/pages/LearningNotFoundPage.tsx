import { ArrowBack, SearchOff } from "@mui/icons-material";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { LearningShell } from "../components/LearningShell";

export function LearningNotFoundPage() {
  return (
    <LearningShell>
      <Box component="main" sx={{ minHeight: "calc(100dvh - 130px)", display: "grid", placeItems: "center", py: 5, background: "linear-gradient(145deg,#f2f9ff,#f8f2ff,#fff7df)" }}>
        <Container maxWidth="sm">
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", p: { xs: 3, sm: 5 }, border: "1px solid #ded2f5", borderRadius: "24px", bgcolor: "rgba(255,255,255,.9)", boxShadow: "0 14px 36px rgba(70,50,120,.1)" }}>
            <Box aria-hidden="true" sx={{ width: 76, height: 76, display: "grid", placeItems: "center", borderRadius: "24px", bgcolor: "#ddf7f1", color: "primary.main" }}><SearchOff sx={{ fontSize: 38 }} /></Box>
            <Typography component="p" sx={{ color: "primary.main", fontWeight: 800 }}>404 · GÓC HỌC</Typography>
            <Typography component="h1" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800 }}>Bài học này chưa có trong cặp sách</Typography>
            <Typography color="text.secondary">Đường dẫn không hợp lệ hoặc cấp độ này chưa có nội dung. Mình quay lại chọn một bài đang mở nhé.</Typography>
            <Button component={Link} to="/hoc" variant="contained" startIcon={<ArrowBack />} sx={{ borderRadius: 3 }}>Về góc học</Button>
          </Stack>
        </Container>
      </Box>
    </LearningShell>
  );
}
