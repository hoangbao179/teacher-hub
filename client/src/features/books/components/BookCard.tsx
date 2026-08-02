import { HeadphonesOutlined, OpenInNewOutlined } from "@mui/icons-material";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../../../content/publicHome";
import type { PublicBook } from "../types";

export function BookCard({ book }: { book: PublicBook }) {
  return (
    <Card component="article" variant="outlined" data-testid={`book-card-${book.slug}`} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, borderColor: "#d6e4e8", display: "grid", gridTemplateColumns: { xs: "96px minmax(0,1fr)", sm: "120px minmax(0,1fr)" }, gap: { xs: 1.5, sm: 2 }, alignItems: "stretch", boxShadow: "0 8px 24px rgba(23,34,56,.045)" }}>
      <Box component="img" src={book.coverUrl} alt={`Bìa minh họa ${book.title}`} width="240" height="320" loading="lazy" sx={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 2, alignSelf: "center" }} />
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75 }}>
          <Chip size="small" label={`Lớp ${book.grade}`} sx={{ bgcolor: "#e1f7f1", color: "#087a72", fontWeight: 700 }} />
          {book.volume && <Chip size="small" label={`Tập ${book.volume}`} sx={{ bgcolor: "#eaf4ff", color: "#326da4", fontWeight: 700 }} />}
          <Chip size="small" icon={<HeadphonesOutlined />} label="Có bài nghe" sx={{ bgcolor: "#fff1df", color: "#a64b09", fontWeight: 700 }} />
        </Stack>
        <Box sx={{ flex: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 800, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.35 }}>{book.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>Lật trang · Nghe · Zoom</Typography>
        </Box>
        <Stack direction="row" spacing={0.75}>
          <Button component={Link} to={`/sach/global-success/${book.slug}`} variant="contained" fullWidth sx={{ minHeight: 48, bgcolor: "#159f98", borderRadius: 2.5, "&:hover": { bgcolor: "#0c817b" } }}>Mở sách</Button>
          <Button component="a" href={publicHomeContent.contact.zaloUrl} target="_blank" rel="noopener noreferrer" variant="outlined" aria-label={`Hỏi cô Vy về ${book.shortTitle}`} sx={{ minWidth: 48, width: 48, p: 0, borderRadius: 2.5 }}><OpenInNewOutlined fontSize="small" /></Button>
        </Stack>
      </Stack>
    </Card>
  );
}
