import { AutoStoriesOutlined, ChatBubbleOutlined } from "@mui/icons-material";
import { Button, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../../../content/publicHome";
import { BookShell } from "../components/BookShell";

export function BookNotFoundContent() {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 8, md: 12 }, textAlign: "center" }}>
      <AutoStoriesOutlined aria-hidden="true" sx={{ fontSize: 72, color: "#159f98" }} />
      <Typography component="h1" sx={{ mt: 2, fontSize: { xs: 27, sm: 34 }, fontWeight: 800 }}>Chưa tìm thấy cuốn sách này</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>Sách có thể đang được cô Vy cập nhật. Em hãy quay lại Tủ sách để chọn một cuốn khác nhé.</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 3, justifyContent: "center" }}>
        <Button component={Link} to="/sach" variant="contained" sx={{ minHeight: 48, bgcolor: "#159f98" }}>Quay lại Tủ sách</Button>
        <Button component="a" href={publicHomeContent.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<ChatBubbleOutlined />} sx={{ minHeight: 48 }}>Hỏi cô Vy</Button>
      </Stack>
    </Container>
  );
}

export function BookNotFoundPage() {
  return <BookShell><BookNotFoundContent /></BookShell>;
}
