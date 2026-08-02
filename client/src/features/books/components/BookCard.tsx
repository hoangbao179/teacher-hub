import { HeadphonesOutlined } from "@mui/icons-material";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { PublicBook } from "../types";

export function BookCard({ book }: { book: PublicBook }) {
  const isTeacherBook = book.bookType === "TEACHER_BOOK";
  const bookTypeLabel = isTeacherBook ? "Tài liệu giáo viên" : "Sách học sinh";
  return (
    <Card component="article" variant="outlined" data-testid={`book-card-${book.slug}`} sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: { xs: "16px", sm: "18px" }, borderColor: "#dce8ea", display: "grid", gridTemplateColumns: { xs: "108px minmax(0,1fr)", sm: "132px minmax(0,1fr)" }, gap: { xs: 1.25, sm: 1.75 }, alignItems: "start", boxShadow: "0 5px 16px rgba(23,34,56,.035)", bgcolor: "#fff" }}>
      <Box component="img" src={book.coverUrl} alt={`Bìa minh họa ${book.title}`} loading="lazy" sx={{ display: "block", width: "100%", height: "auto", aspectRatio: "3 / 4", objectFit: "contain", borderRadius: 1.75 }} />
      <Stack spacing={1} sx={{ minWidth: 0, alignSelf: "stretch" }}>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }}>
          <Chip size="small" label={book.seriesName} sx={{ maxWidth: "100%", bgcolor: "#e1f7f1", color: "#087a72", fontWeight: 700 }} />
          <Chip size="small" label={`Lớp ${book.grade}`} sx={{ bgcolor: "#f2f5f7", color: "#536273", fontWeight: 700 }} />
          {book.volume && <Chip size="small" label={`Tập ${book.volume}`} sx={{ bgcolor: "#eaf4ff", color: "#326da4", fontWeight: 700 }} />}
          <Chip size="small" label={bookTypeLabel} sx={{ bgcolor: isTeacherBook ? "#f3ebff" : "#fff8dc", color: isTeacherBook ? "#7141a1" : "#7d6200", fontWeight: 700 }} />
        </Stack>
        <Box>
          <Typography component="h3" sx={{ fontWeight: 800, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.35 }}>{book.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>{isTeacherBook ? "Tài liệu hỗ trợ giảng dạy" : "Phiên bản sách điện tử chính thức"}</Typography>
        </Box>
        <Stack spacing={0.75} sx={{ mt: "auto" }}>
          <Button component={Link} to={`/sach/${book.seriesSlug}/${book.slug}`} variant="contained" fullWidth sx={{ minHeight: 46, bgcolor: "#159f98", borderRadius: 2, "&:hover": { bgcolor: "#0c817b" } }}>
            {isTeacherBook ? "Đọc tài liệu" : "Đọc sách"}
          </Button>
          {book.interactiveAudioUrl && (
            <Button component={Link} to={`/sach/${book.seriesSlug}/${book.slug}/nghe`} variant="outlined" startIcon={<HeadphonesOutlined />} fullWidth sx={{ minHeight: 44, borderRadius: 2 }}>
              Nghe bài tương tác
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
