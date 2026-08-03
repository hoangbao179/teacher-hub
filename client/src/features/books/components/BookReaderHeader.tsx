import { ArrowBack } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import type { PublicBook } from "../types";

export function BookReaderHeader({ book }: { book: PublicBook }) {
  const [searchParams] = useSearchParams();
  const libraryParams = new URLSearchParams({
    grade: String(book.grade),
    type: book.bookType === "TEACHER_BOOK" ? "teacher" : "student",
  });
  if (searchParams.get("series") === book.seriesSlug) libraryParams.set("series", book.seriesSlug);

  return (
    <Box data-testid="book-reader-header" sx={{ position: "sticky", top: 0, zIndex: 30, minHeight: { xs: 48, sm: 52 }, display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, minWidth: 0, bgcolor: "rgba(238,243,245,.97)", backdropFilter: "blur(8px)" }}>
      <Button component={Link} to={`/sach?${libraryParams.toString()}`} aria-label="Quay lại Tủ sách" startIcon={<ArrowBack />} color="inherit" sx={{ minWidth: { xs: 44, sm: "auto" }, minHeight: 44, px: { xs: 1, sm: 1.25 }, flexShrink: 0, "& .MuiButton-startIcon": { m: { xs: 0, sm: "0 8px 0 -4px" } } }}>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Tủ sách</Box>
      </Button>
      <Typography component="h1" title={book.title} sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: { xs: 16, sm: 18 }, fontWeight: 800 }}>
        <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{book.shortTitle}</Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{book.title}</Box>
      </Typography>
    </Box>
  );
}
