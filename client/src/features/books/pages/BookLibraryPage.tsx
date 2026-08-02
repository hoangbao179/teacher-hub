import { AutoStoriesOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { BookShell } from "../components/BookShell";
import { enabledPublicBooks, enabledPublicBookSeries } from "../content/publicBookCatalog";
import type { BookGrade, BookType } from "../types";

const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function selectedGrade(value: string | null): BookGrade | null {
  const numeric = Number(value);
  return grades.includes(numeric as BookGrade) ? numeric as BookGrade : null;
}

function selectedSeries(value: string | null): string | null {
  return value && enabledPublicBookSeries.some((series) => series.slug === value) ? value : null;
}

function selectedBookType(value: string | null): BookType {
  return value === "teacher" ? "TEACHER_BOOK" : "STUDENT_BOOK";
}

export function BookLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeGrade = selectedGrade(searchParams.get("grade"));
  const activeSeries = selectedSeries(searchParams.get("series"));
  const activeBookType = selectedBookType(searchParams.get("type"));
  const visibleBooks = enabledPublicBooks.filter((book) => book.bookType === activeBookType && (!activeGrade || book.grade === activeGrade) && (!activeSeries || book.seriesSlug === activeSeries));
  const visibleGrades = activeGrade && visibleBooks.some((book) => book.grade === activeGrade)
    ? [activeGrade]
    : grades.filter((grade) => visibleBooks.some((book) => book.grade === grade));

  const chooseGrade = (grade: BookGrade | null) => {
    const next = new URLSearchParams(searchParams);
    if (grade) next.set("grade", String(grade)); else next.delete("grade");
    setSearchParams(next, { replace: true });
  };

  const chooseSeries = (seriesSlug: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (seriesSlug) next.set("series", seriesSlug); else next.delete("series");
    setSearchParams(next, { replace: true });
  };

  const chooseBookType = (bookType: BookType) => {
    const next = new URLSearchParams(searchParams);
    next.set("type", bookType === "TEACHER_BOOK" ? "teacher" : "student");
    setSearchParams(next, { replace: true });
  };

  return (
    <BookShell>
      <Box component="main">
        <Box sx={{ background: "linear-gradient(135deg,#eaf9ff 0%,#effcf7 60%,#fff8dd 100%)" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 2.75, sm: 3.5, md: 4 } }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
              <Box sx={{ maxWidth: 720 }}>
                <Typography variant="overline" sx={{ color: "#087a72", fontWeight: 800 }}>TỦ SÁCH TIẾNG ANH</Typography>
                <Typography component="h1" sx={{ mt: 0.75, fontSize: { xs: 28, sm: 38, md: 44 }, lineHeight: 1.14, fontWeight: 800 }}>Sách học sinh và tài liệu giáo viên</Typography>
                <Typography color="text.secondary" sx={{ mt: 1.25, maxWidth: 650, fontSize: { xs: 15, sm: 17 } }}>Chọn lớp để đọc sách Tiếng Anh từ nguồn chính thức của Nhà xuất bản Giáo dục Việt Nam.</Typography>
              </Box>
              <Box aria-hidden="true" sx={{ display: { xs: "none", md: "grid" }, placeItems: "center", width: 184, height: 120, borderRadius: 3.5, bgcolor: "#152337", color: "white", boxShadow: "0 7px 18px rgba(23,34,56,.09)" }}>
                <AutoStoriesOutlined sx={{ fontSize: 56, color: "#8edbc9" }} />
                <Typography sx={{ mt: -2.5, fontWeight: 700 }}>Đọc sách theo lớp</Typography>
              </Box>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5, md: 4.5 } }}>
          <Typography component="h2" sx={{ fontSize: { xs: 23, sm: 29 }, fontWeight: 800 }}>Chọn sách</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.25 }}>Chọn loại tài liệu và lớp để tìm nhanh hơn.</Typography>
          <Box data-testid="book-type-filter" role="group" aria-label="Chọn loại tài liệu" sx={{ mt: 2, width: "fit-content", maxWidth: "100%", p: 0.75, border: "1px solid #dce8ea", borderRadius: "16px", bgcolor: "white", display: "flex", gap: 0.75 }}>
            <Button variant={activeBookType === "STUDENT_BOOK" ? "contained" : "outlined"} onClick={() => chooseBookType("STUDENT_BOOK")} aria-pressed={activeBookType === "STUDENT_BOOK"} sx={{ minHeight: 44, borderRadius: 2, whiteSpace: "nowrap", ...(activeBookType === "STUDENT_BOOK" ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>Sách học sinh</Button>
            <Button variant={activeBookType === "TEACHER_BOOK" ? "contained" : "outlined"} onClick={() => chooseBookType("TEACHER_BOOK")} aria-pressed={activeBookType === "TEACHER_BOOK"} sx={{ minHeight: 44, borderRadius: 2, whiteSpace: "nowrap", ...(activeBookType === "TEACHER_BOOK" ? { bgcolor: "#7141a1", "&:hover": { bgcolor: "#5e3488" } } : {}) }}>Tài liệu giáo viên</Button>
          </Box>
          {enabledPublicBookSeries.length > 1 && <Box data-testid="book-series-filter" role="group" aria-label="Chọn bộ sách" sx={{ mt: 2, width: "fit-content", maxWidth: "100%", p: 1, border: "1px solid #dce8ea", borderRadius: "18px", bgcolor: "white", display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <Button variant={activeSeries === null ? "contained" : "outlined"} onClick={() => chooseSeries(null)} aria-pressed={activeSeries === null} sx={{ minHeight: 44, borderRadius: 2, ...(activeSeries === null ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>Tất cả bộ sách</Button>
            {enabledPublicBookSeries.map((series) => <Button key={series.slug} variant={activeSeries === series.slug ? "contained" : "outlined"} onClick={() => chooseSeries(series.slug)} aria-pressed={activeSeries === series.slug} sx={{ minHeight: 44, borderRadius: 2, ...(activeSeries === series.slug ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>{series.name}</Button>)}
          </Box>}
          <Box role="group" aria-label="Chọn lớp" sx={{ mt: 1.5, width: "fit-content", maxWidth: "100%", p: 1, border: "1px solid #dce8ea", borderRadius: "18px", bgcolor: "white", display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <Button variant={activeGrade === null ? "contained" : "outlined"} onClick={() => chooseGrade(null)} aria-pressed={activeGrade === null} sx={{ minHeight: 48, minWidth: 72, borderRadius: 2, ...(activeGrade === null ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>Tất cả</Button>
            {grades.map((grade) => <Button key={grade} variant={activeGrade === grade ? "contained" : "outlined"} onClick={() => chooseGrade(grade)} aria-pressed={activeGrade === grade} aria-label={`Lớp ${grade}`} sx={{ minHeight: 48, minWidth: 48, p: 0, borderRadius: 2, ...(activeGrade === grade ? { bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } } : {}) }}>{grade}</Button>)}
          </Box>
          {visibleBooks.length === 0 && <Typography role="status" color="text.secondary" sx={{ mt: 3 }}>Nguồn chính thức cho lựa chọn này chưa được tìm thấy.</Typography>}

          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: activeGrade ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))" }, gap: { xs: 2, md: 2.5, lg: 3 }, alignItems: "start" }} data-testid="book-groups">
            {visibleGrades.map((grade) => {
              const books = visibleBooks.filter((item) => item.grade === grade);
              return (
                <Box component="section" aria-labelledby={`grade-${grade}-heading`} key={grade} data-testid={`book-group-${grade}`} sx={{ p: { xs: 1.5, sm: 1.75 }, border: "1px solid #dce8ea", borderRadius: { xs: "20px", sm: "22px" }, bgcolor: "rgba(255,255,255,.88)", alignSelf: "start" }}>
                  <Stack direction="row" spacing={0.875} sx={{ alignItems: "center", mb: 1.25 }}>
                    <Chip label={grade} sx={{ minWidth: 38, height: 38, bgcolor: "#e1f7f1", color: "#087a72", fontSize: 16, fontWeight: 800 }} />
                    <Typography id={`grade-${grade}-heading`} component="h2" sx={{ minWidth: 0, fontSize: { xs: 18, sm: 20 }, fontWeight: 800 }}>Tiếng Anh lớp {grade}</Typography>
                    <Chip size="small" label={`${books.length} cuốn`} sx={{ ml: "auto !important", height: 24, color: "text.secondary" }} />
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: activeGrade && books.length > 1 ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)" }, gap: 1.5, maxWidth: activeGrade && books.length === 1 ? 720 : "none" }}>
                    {books.map((book) => <BookCard key={book.id} book={book} />)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Container>
      </Box>
    </BookShell>
  );
}
