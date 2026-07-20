import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { StudentDetail, StudentStatus } from "@teacher/shared";
import { api } from "../api/client";
import { LoadingState } from "../components/LoadingState";

export function StudentFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate();
  const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [fullName, setFullName] = useState(""); const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(""); const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState(""); const [note, setNote] = useState("");
  const [status, setStatus] = useState<StudentStatus>("ACTIVE");
  useEffect(() => { if (!id) return; api<StudentDetail>(`/api/students/${id}`).then((x) => {
    setFullName(x.fullName); setNickname(x.nickname ?? ""); setDateOfBirth(x.dateOfBirth ?? "");
    setParentName(x.parentName ?? ""); setParentPhone(x.parentPhone ?? ""); setNote(x.note ?? ""); setStatus(x.status);
  }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, [id]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setSaving(true); setError("");
    const body = { fullName, nickname: nickname || undefined, dateOfBirth: dateOfBirth || undefined,
      parentName: parentName || undefined, parentPhone: parentPhone || undefined, note: note || undefined, status };
    try { if (editing) await api(`/api/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      else { const result = await api<{id:number}>("/api/students", { method: "POST", body: JSON.stringify(body) }); navigate(`/admin/students/${result.id}`); return; }
      navigate(`/admin/students/${id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu học sinh."); } finally { setSaving(false); }
  };
  if (loading) return <LoadingState />;
  return <Stack component="form" spacing={2} onSubmit={submit}><Typography variant="h5" sx={{ fontWeight: 900 }}>{editing ? "Sửa học sinh" : "Thêm học sinh"}</Typography>
    {error && <Alert severity="error">{error}</Alert>}<TextField required label="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
    <TextField label="Tên gọi" value={nickname} onChange={(e) => setNickname(e.target.value)} /><TextField type="date" label="Ngày sinh" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    <TextField label="Tên phụ huynh" value={parentName} onChange={(e) => setParentName(e.target.value)} /><TextField label="Số điện thoại phụ huynh" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
    {editing && <FormControl><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}><MenuItem value="ACTIVE">Hoạt động</MenuItem><MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem></Select></FormControl>}
    <TextField multiline minRows={3} label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} /><Button type="submit" variant="contained" size="large" disabled={saving}>{saving ? "Đang lưu…" : "Lưu học sinh"}</Button>
  </Stack>;
}
