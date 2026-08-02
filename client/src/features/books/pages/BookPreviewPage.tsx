import { HeadphonesOutlined } from "@mui/icons-material";
import { Box, Breadcrumbs, Chip, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { BookShell } from "../components/BookShell";
import { BookViewer } from "../components/BookViewer";
import { findPublicBook } from "../content/publicBookCatalog";
import { BookNotFoundContent } from "./BookNotFoundPage";

export function BookPreviewPage() {
  const { bookSlug = "" } = useParams();
  const book = findPublicBook(bookSlug);
  if (!book) return <BookShell><BookNotFoundContent /></BookShell>;

  return (
    <BookShell>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 } }}>
        <Breadcrumbs aria-label="Đường dẫn Tủ sách" sx={{ mb: { xs: 1.5, sm: 2 }, fontSize: 13 }}>
          <MuiLink component={Link} to="/sach" underline="hover" color="inherit">Tủ sách</MuiLink>
          <MuiLink component={Link} to={`/sach?grade=${book.grade}`} underline="hover" color="inherit">Lớp {book.grade}</MuiLink>
          {book.volume && <Typography color="text.secondary" sx={{ fontSize: 13 }}>Tập {book.volume}</Typography>}
        </Breadcrumbs>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "76px minmax(0,1fr)", sm: "112px minmax(0,1fr)" }, gap: { xs: 1.5, sm: 2.5 }, alignItems: "start", mb: { xs: 1.5, sm: 2 } }}>
          <Box component="img" src={book.coverUrl} alt={`Bìa minh họa ${book.title}`} sx={{ display: "block", width: "100%", height: "auto", aspectRatio: "3 / 4", objectFit: "contain", borderRadius: 1.75 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: "#087a72", fontWeight: 800 }}>{book.seriesName}</Typography>
            <Typography component="h1" sx={{ mt: 0.25, fontSize: { xs: 20, sm: 28, md: 34 }, lineHeight: 1.2, fontWeight: 800 }}>{book.title}</Typography>
            <Stack direction="row" useFlexGap sx={{ mt: 1, flexWrap: "wrap", gap: 0.625 }}>
              <Chip size="small" label={`Lớp ${book.grade}`} />
              {book.volume && <Chip size="small" label={`Tập ${book.volume}`} />}
              <Chip size="small" icon={<HeadphonesOutlined />} label="Có bài nghe tương tác" sx={{ bgcolor: "#fff1df", color: "#a64b09", fontWeight: 700 }} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1.25, display: { xs: "none", sm: "block" } }}>Nhấn biểu tượng loa ngay trên trang sách để nghe. Viewer còn hỗ trợ lật trang, phóng to và toàn màn hình.</Typography>
          </Box>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 1.5, display: { xs: "block", sm: "none" }, fontSize: 14 }}>Nhấn biểu tượng loa trong sách để nghe.</Typography>
        <BookViewer book={book} />
      </Container>
    </BookShell>
  );
}
