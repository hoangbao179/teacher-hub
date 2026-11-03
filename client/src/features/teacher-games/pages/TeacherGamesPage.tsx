import { Add, ContentCopy, EditOutlined, MenuBookOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import type { AssignmentListItem } from "@teacher/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { duplicateAssignment, listAssignments } from "../../../api/assignments";
import { TeacherGameShell } from "../TeacherGameShell";

const statusText = { DRAFT: "Bản nháp", PUBLISHED: "Đã giao", CLOSED: "Đã đóng" } as const;

export function TeacherGamesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [duplicating, setDuplicating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAssignments({ pageSize: 50 });
      setItems(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được danh sách bài.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const visible = useMemo(() => items.filter((item) =>
    item.title.toLocaleLowerCase("vi-VN").includes(filter.trim().toLocaleLowerCase("vi-VN"))
  ), [filter, items]);

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
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>Bài đã tạo</Typography>
        <TextField size="small" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm tên bài…" label="Tìm bài" sx={{ width: { xs: "100%", sm: 260 } }} />
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
                  </Stack>
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 750, overflowWrap: "anywhere" }}>{item.title}</Typography>
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
      <Alert severity="info">Hiện cô có thể soạn, lưu, nhân bản và xem trước nội dung. Link/QR giao bài chưa mở vì chế độ trò chơi cho học sinh đang tạm đóng.</Alert>
    </Stack>
  </TeacherGameShell>;
}
