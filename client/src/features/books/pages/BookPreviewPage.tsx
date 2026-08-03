import { Box } from "@mui/material";
import { useParams } from "react-router-dom";
import { BookReaderHeader } from "../components/BookReaderHeader";
import { BookShell } from "../components/BookShell";
import { ResponsiveBookViewer } from "../components/ResponsiveBookViewer";
import { findPublicBook } from "../content/publicBookCatalog";
import { BookNotFoundContent } from "./BookNotFoundPage";

export function BookPreviewPage() {
  const { seriesSlug = "", bookSlug = "" } = useParams();
  const book = findPublicBook(seriesSlug, bookSlug);
  if (!book) return <BookShell><BookNotFoundContent /></BookShell>;

  return (
    <BookShell readerMode>
      <Box component="main" sx={{ width: "100%", maxWidth: "1680px", mx: "auto", px: { xs: 0.5, sm: 1.5, md: 2 }, py: { xs: 0.5, md: 1 } }}>
        <BookReaderHeader book={book} />
        <ResponsiveBookViewer book={book} />
      </Box>
    </BookShell>
  );
}
