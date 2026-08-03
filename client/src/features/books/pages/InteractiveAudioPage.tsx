import { Box } from "@mui/material";
import { useParams } from "react-router-dom";
import { BookReaderHeader } from "../components/BookReaderHeader";
import { BookShell } from "../components/BookShell";
import { InteractiveAudioViewer } from "../components/InteractiveAudioViewer";
import { findPublicBook, isAllowedInteractiveAudioUrl } from "../content/publicBookCatalog";
import { BookNotFoundContent } from "./BookNotFoundPage";

export function InteractiveAudioPage() {
  const { seriesSlug = "", bookSlug = "" } = useParams();
  const book = findPublicBook(seriesSlug, bookSlug);
  const validAudio = book?.bookType === "STUDENT_BOOK" && book.interactiveAudioUrl && isAllowedInteractiveAudioUrl(book.interactiveAudioUrl);
  if (!book || !validAudio) return <BookShell readerMode><BookNotFoundContent message="Bản nghe tương tác cho cuốn sách này chưa có hoặc nguồn chưa hợp lệ." /></BookShell>;

  return (
    <BookShell readerMode>
      <Box component="main" sx={{ width: "100%", maxWidth: "1680px", mx: "auto", px: { xs: 0.5, sm: 1.5, md: 2 }, py: { xs: 0.5, md: 1 } }}>
        <BookReaderHeader book={book} />
        <InteractiveAudioViewer book={book} />
      </Box>
    </BookShell>
  );
}
