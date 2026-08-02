import { ChatBubbleOutlined, HeadphonesOutlined } from "@mui/icons-material";
import { Box, Breadcrumbs, Button, Chip, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { publicHomeContent } from "../../../content/publicHome";
import { BookShell } from "../components/BookShell";
import { BookViewer } from "../components/BookViewer";
import { findPublicBook } from "../content/publicBookCatalog";
import { BookNotFoundContent } from "./BookNotFoundPage";

export function BookPreviewPage() {
  const { bookSlug = "" } = useParams();
  const book = findPublicBook(bookSlug);
  if (!book) return <BookShell><BookNotFoundContent /></BookShell>;
  const openFullscreen = async () => {
    const viewer = document.querySelector<HTMLElement>('[data-testid="book-viewer"]');
    if (viewer?.requestFullscreen) await viewer.requestFullscreen();
    else window.open(book.previewUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <BookShell>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 }, pb: { xs: 2, sm: 4 } }}>
        <Breadcrumbs aria-label="Đường dẫn Tủ sách" sx={{ mb: 2, fontSize: 13 }}>
          <MuiLink component={Link} to="/sach" underline="hover" color="inherit">Tủ sách</MuiLink>
          <MuiLink component={Link} to={`/sach?grade=${book.grade}`} underline="hover" color="inherit">Lớp {book.grade}</MuiLink>
          {book.volume && <Typography color="text.secondary" sx={{ fontSize: 13 }}>Tập {book.volume}</Typography>}
        </Breadcrumbs>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "88px minmax(0,1fr)", sm: "140px minmax(0,1fr)" }, gap: { xs: 1.5, sm: 3 }, alignItems: "start", mb: 2.5 }}>
          <Box component="img" src={book.coverUrl} alt={`Bìa minh họa ${book.title}`} width="280" height="374" sx={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 2 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: "#087a72", fontWeight: 800 }}>GLOBAL SUCCESS</Typography>
            <Typography component="h1" sx={{ mt: 0.5, fontSize: { xs: 21, sm: 31, md: 38 }, lineHeight: 1.2, fontWeight: 800 }}>{book.title}</Typography>
            <Stack direction="row" useFlexGap sx={{ mt: 1.25, flexWrap: "wrap", gap: 0.75 }}>
              <Chip size="small" label={`Lớp ${book.grade}`} />
              {book.volume && <Chip size="small" label={`Tập ${book.volume}`} />}
              <Chip size="small" icon={<HeadphonesOutlined />} label="Có bài nghe tương tác" sx={{ bgcolor: "#fff1df", color: "#a64b09", fontWeight: 700 }} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1.5, display: { xs: "none", sm: "block" } }}>Nhấn biểu tượng loa ngay trên trang sách để nghe. Viewer còn hỗ trợ lật trang, phóng to và toàn màn hình.</Typography>
          </Box>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 1.5, display: { xs: "block", sm: "none" }, fontSize: 14 }}>Nhấn biểu tượng loa trong sách để nghe.</Typography>
        <BookViewer book={book} />
      </Container>
      <Box sx={{ display: { xs: "grid", sm: "none" }, gridTemplateColumns: "1fr 1fr", gap: 1, position: "fixed", zIndex: 1200, left: 0, right: 0, bottom: 0, p: 1.25, pb: "calc(10px + env(safe-area-inset-bottom, 0px))", bgcolor: "rgba(255,255,255,.97)", borderTop: "1px solid #d6e4e8" }}>
        <Button onClick={openFullscreen} variant="contained" sx={{ minHeight: 48, bgcolor: "#159f98" }}>Toàn màn hình</Button>
        <Button component="a" href={publicHomeContent.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<ChatBubbleOutlined />} sx={{ minHeight: 48 }}>Hỏi cô Vy</Button>
      </Box>
    </BookShell>
  );
}
