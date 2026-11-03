import { Add, ContentCopy, EditOutlined, MenuBookOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { AssignmentListItem, ClassListItem } from "@teacher/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { duplicateAssignment, listAssignments } from "../../../api/assignments";
import { listTeacherGameClasses } from "../../../api/teacherGames";
import { TeacherGameShell } from "../TeacherGameShell";
import { teacherGradeLabel, teacherGradeOptions } from "../teacherGrades";

const statusText = { DRAFT: "Bản nháp", PUBLISHED: "Đã giao", CLOSED: "Đã đóng" } as const;

export function TeacherGamesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState<number | "ALL">("ALL");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [classesError, setClassesError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [duplicating, setDuplicating] = useState<number | null>(null);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await listAssignments({
        pageSize: 50, page,
        search: filter.trim() || undefined,
        teachingClassId: classFilter === "ALL" ? undefined : classFilter,
        gradeLevel: gradeFilter === "ALL" ? undefined : gradeFilter,
      });
      if (requestId.current !== current) return;
      setItems(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (caught) {
      if (requestId.current === current)
        setError(caught instanceof Error ? caught.message : "Không tải được danh sách bài.");
    } finally {
      if (requestId.current === current) setLoading(false);
    }
  }, [classFilter, gradeFilter, filter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    let canceled = false;
    void listTeacherGameClasses().then((result) => {
      if (!canceled) setClasses(result);
    }).catch(() => {
      if (!canceled) setClassesError("Không tải được danh sách lớp để lọc.");
    });
    return () => { canceled = true; };
  }, []);

  const visible = items;

  const duplicate = async (id: number) => {
    if (duplicating != null) return;
    setDuplicating(id);
    setError("");
    try {
      const draft = await duplicateAssignment(id);
      navigate(`/admin/games/${draft.id}/edit`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể nhân bản bài.");
    } finally {
      setDuplicating(null);
    }
  };

  return <TeacherGameShell title="Trò chơi từ vựng" subtitle="Soạn bài từ giáo trình cô đang dạy. Không phải tìm ảnh, không cần tạo tài khoản học sinh." backTo="/admin/tools">
    <Stack spacing={2.5} data-testid="teacher-games-page">
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cfe7dc", bgcolor: "#fff" }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Bắt đầu với từ mới</Typography>
              <Typography variant="body2" color="text.secondary">Dán từ và nghĩa → chọn dạng trò → lưu bản nháp.</Typography>
            </Box>
            <Button component={Link} to="/admin/games/new" variant="contained" size="large" startIcon={<Add />} sx={{ minHeight: 48, whiteSpace: "nowrap" }}>Tạo bài mới</Button>
          </Stack>
        </CardContent>
      </Card>
      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>Bài đã tạo theo lớp</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5 }}>
          <TextField select size="small" value={gradeFilter} data-testid="teacher-games-grade-filter"
            onChange={(event) => { setGradeFilter(event.target.value === "ALL" ? "ALL" : Number(event.target.value)); setPage(1); }}
            label="Khối lớp" sx={{ flex: 1, minWidth: 0 }}>
            <MenuItem value="ALL">Tất cả khối lớp</MenuItem>
            {teacherGradeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" value={classFilter} data-testid="teacher-games-class-filter"
            onChange={(event) => { setClassFilter(event.target.value === "ALL" ? "ALL" : Number(event.target.value)); setPage(1); }}
            label="Lọc theo lớp" sx={{ flex: 1, minWidth: 0 }}>
            <MenuItem value="ALL">Tất cả lớp / Bài dùng chung</MenuItem>
            {classes.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField size="small" value={filter}
            onChange={(event) => { setFilter(event.target.value); setPage(1); }}
            placeholder="Tên bài, giáo trình hoặc Unit…" label="Tìm bài học"
            sx={{ flex: 1, minWidth: 0 }} />
        </Stack>
        {classesError && <Alert severity="warning">{classesError}</Alert>}
      </Stack>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Tải lại</Button>}>{error}</Alert>}
      {loading ? <Stack sx={{ py: 5, alignItems: "center" }}><CircularProgress aria-label="Đang tải bài từ vựng" /></Stack> : (
        visible.length === 0
          ? <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ textAlign: "center", py: 5 }}>
              <MenuBookOutlined sx={{ fontSize: 40, color: "#0f766e", mb: 1 }} />
              <Typography sx={{ fontWeight: 700 }}>{filter ? "Không tìm thấy bài phù hợp." : "Cô chưa có bài từ vựng nào."}</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Chọn “Tạo bài mới” để bắt đầu.</Typography>
            </CardContent></Card>
          : <Stack spacing={1.5}>
            {visible.map((item) => <Card key={item.id} variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <Chip size="small" label={statusText[item.status]} color={item.status === "PUBLISHED" ? "success" : "default"} />
                    <Chip size="small" variant="outlined" label={`${item.itemCount} từ`} />
                    <Chip size="small" variant="outlined" label={teacherGradeLabel(item.gradeLevel)} />
                    <Chip size="small" variant="outlined" label={item.teachingClassId == null
                      ? "Bài dùng chung"
                      : classes.find((value) => value.id === item.teachingClassId)?.name ?? `Lớp #${item.teachingClassId}`} />
                  </Stack>
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 750, overflowWrap: "anywhere" }}>{item.title}</Typography>
                  {(item.textbookName || item.lessonName) && <Typography variant="body2" color="text.secondary">
                    {[item.textbookName, item.lessonName].filter(Boolean).join(" · ")}
                  </Typography>}
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                    {item.status === "DRAFT" && <Button component={Link} to={`/admin/games/${item.id}/edit`} startIcon={<EditOutlined />} variant="contained" sx={{ minHeight: 44 }}>Tiếp tục soạn</Button>}
                    <Button onClick={() => void duplicate(item.id)} disabled={duplicating !== null} startIcon={<ContentCopy />} sx={{ minHeight: 44 }}>
                      {duplicating === item.id ? "Đang nhân bản…" : "Nhân bản"}
                    </Button>
                  </Stack>
                  {item.status !== "DRAFT" && <Typography variant="caption" color="text.secondary">
                    Bài đã giao trước đây được giữ nguyên. Chế độ trò chơi học sinh vẫn đang tạm đóng.
                  </Typography>}
                </Stack>
              </CardContent>
            </Card>)}
          </Stack>
      )}
      {!loading && total > 50 && <Stack direction="row" sx={{ gap: 1, alignItems: "center", justifyContent: "center" }}>
        <Button variant="outlined" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trang trước</Button>
        <Typography variant="body2">Trang {page} / {Math.ceil(total / 50)}</Typography>
        <Button variant="outlined" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
      </Stack>}
      <Alert severity="info">Hiện cô có thể soạn, lưu, nhân bản và xem trước nội dung. Link/QR giao bài chưa mở vì chế độ trò chơi cho học sinh đang tạm đóng.</Alert>
    </Stack>
  </TeacherGameShell>;
}
