import { AutoStoriesOutlined, HeadphonesOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { BookShell } from "../components/BookShell";
import { enabledPublicBooks } from "../content/publicBookCatalog";
import type { BookGrade } from "../types";

const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function selectedGrade(value: string | null): BookGrade | null {
  const numeric = Number(value);
  return grades.includes(numeric as BookGrade) ? numeric as BookGrade : null;
}

export function BookLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeGrade = selectedGrade(searchParams.get("grade"));
  const visibleGrades = activeGrade ? [activeGrade] : grades;

  const chooseGrade = (grade: BookGrade | null) => {
    const next = new URLSearchParams(searchParams);
    if (grade) next.set("grade", String(grade)); else next.delete("grade");
    setSearchParams(next, { replace: true });
  };

  return (
    <BookShell>
      <Box component="main">
        <Box sx={{ background: "linear-gradient(135deg,#eaf9ff 0%,#effcf7 60%,#fff8dd 100%)" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 5, md: 6 } }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
              <Box sx={{ maxWidth: 720 }}>
                <Typography variant="overline" sx={{ color: "#087a72", fontWeight: 800 }}>TỦ SÁCH TIẾNG ANH</Typography>
                <Typography component="h1" sx={{ mt: 1, fontSize: { xs: 30, sm: 38, md: 46 }, lineHeight: 1.14, fontWeight: 800 }}>Chọn sách Global Success theo lớp</Typography>
                <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 610, fontSize: { xs: 15, sm: 17 } }}>Lật trang và bấm biểu tượng loa để nghe trực tiếp trong sách. Không cần đăng nhập.</Typography>
                <Button href="#chon-lop" variant="contained" sx={{ mt: 2.5, minHeight: 48, bgcolor: "#159f98", borderRadius: 2.5, "&:hover": { bgcolor: "#0c817b" } }}>Chọn lớp của em</Button>
              </Box>
              <Box aria-hidden="true" sx={{ display: { xs: "none", md: "grid" }, placeItems: "center", width: 260, height: 170, borderRadius: 5, bgcolor: "#152337", color: "white", boxShadow: "0 18px 40px rgba(23,34,56,.16)" }}>
                <AutoStoriesOutlined sx={{ fontSize: 86, color: "#8edbc9" }} />
                <Typography sx={{ mt: -3, fontWeight: 700 }}>Lật trang · Nghe bài</Typography>
              </Box>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 5 } }}>
          <Typography variant="overline" sx={{ color: "#087a72", fontWeight: 800 }}>GLOBAL SUCCESS · 13 SÁCH</Typography>
          <Typography id="chon-lop" component="h2" sx={{ mt: 0.5, fontSize: { xs: 25, sm: 31 }, fontWeight: 800, scrollMarginTop: 80 }}>Em đang học lớp mấy?</Typography>
          <Typography color="text.secondary">Lớp 3–6 có Tập 1 và Tập 2.</Typography>
          <Box role="group" aria-label="Chọn lớp" sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, border: "1px solid #d6e4e8", borderRadius: 3, bgcolor: "white", display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <Button variant={activeGrade === null ? "contained" : "outlined"} onClick={() => chooseGrade(null)} aria-pressed={activeGrade === null} sx={{ minHeight: 48, minWidth: 68, borderRadius: 2.5, ...(activeGrade === null ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>Tất cả</Button>
            {grades.map((grade) => <Button key={grade} variant={activeGrade === grade ? "contained" : "outlined"} onClick={() => chooseGrade(grade)} aria-pressed={activeGrade === grade} aria-label={`Lớp ${grade}`} sx={{ minHeight: 48, minWidth: 48, borderRadius: 2.5, ...(activeGrade === grade ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>{grade}</Button>)}
          </Box>

          <Stack spacing={2.5} sx={{ mt: 3 }} data-testid="book-groups">
            {visibleGrades.map((grade) => {
              const books = enabledPublicBooks.filter((item) => item.grade === grade);
              return (
                <Box component="section" aria-labelledby={`grade-${grade}-heading`} key={grade} data-testid={`book-group-${grade}`} sx={{ p: { xs: 1.5, sm: 2 }, border: "1px solid #d6e4e8", borderRadius: 3.5, bgcolor: "rgba(255,255,255,.8)" }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                    <Chip label={grade} sx={{ minWidth: 42, height: 42, bgcolor: "#e1f7f1", color: "#087a72", fontSize: 18, fontWeight: 800 }} />
                    <Typography id={`grade-${grade}-heading`} component="h2" sx={{ fontSize: { xs: 19, sm: 22 }, fontWeight: 800 }}>Tiếng Anh lớp {grade}</Typography>
                    <Chip size="small" label={`${books.length} cuốn`} />
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2,minmax(0,1fr))" }, gap: 1.5 }}>
                    {books.map((book) => <BookCard key={book.id} book={book} />)}
                  </Box>
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 3, alignItems: "center", justifyContent: "center", color: "text.secondary" }}><HeadphonesOutlined aria-hidden="true" /><Typography variant="body2">Audio và nội dung tương tác được phát trực tiếp trong viewer FlipBuilder.</Typography></Stack>
        </Container>
      </Box>
    </BookShell>
  );
}
