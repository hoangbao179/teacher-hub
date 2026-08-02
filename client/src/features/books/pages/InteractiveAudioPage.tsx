import { HeadphonesOutlined } from "@mui/icons-material";
import { Box, Breadcrumbs, Chip, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { BookShell } from "../components/BookShell";
import { InteractiveAudioViewer } from "../components/InteractiveAudioViewer";
import { findPublicBook, isAllowedInteractiveAudioUrl } from "../content/publicBookCatalog";
import { BookNotFoundContent } from "./BookNotFoundPage";

export function InteractiveAudioPage() {
  const { seriesSlug = "", bookSlug = "" } = useParams();
  const book = findPublicBook(seriesSlug, bookSlug);
  const validAudio = book?.bookType === "STUDENT_BOOK" && book.interactiveAudioUrl && isAllowedInteractiveAudioUrl(book.interactiveAudioUrl);
  if (!book || !validAudio) return <BookShell><BookNotFoundContent message="Bản nghe tương tác cho cuốn sách này chưa có hoặc nguồn chưa hợp lệ." /></BookShell>;

  return (
    <BookShell>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 } }}>
        <Breadcrumbs aria-label="Đường dẫn bản nghe" sx={{ mb: { xs: 1.5, sm: 2 }, fontSize: 13 }}>
          <MuiLink component={Link} to="/sach" underline="hover" color="inherit">Tủ sách</MuiLink>
          <MuiLink component={Link} to={`/sach/${book.seriesSlug}/${book.slug}`} underline="hover" color="inherit">{book.shortTitle}</MuiLink>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>Nghe tương tác</Typography>
        </Breadcrumbs>
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
            <HeadphonesOutlined aria-hidden="true" sx={{ color: "#a64b09" }} />
            <Chip size="small" label="Bản nghe tương tác" sx={{ bgcolor: "#fff1df", color: "#a64b09", fontWeight: 700 }} />
          </Stack>
          <Typography component="h1" sx={{ mt: 1, fontSize: { xs: 23, sm: 31 }, lineHeight: 1.2, fontWeight: 800 }}>{book.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Đây là bản nghe tương tác được mở từ viewer bên ngoài. Em có thể nhấn biểu tượng loa trong sách để nghe.</Typography>
        </Box>
        <InteractiveAudioViewer book={book} />
      </Container>
    </BookShell>
  );
}
