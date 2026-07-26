import { Alert, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { PublicAssignmentSummary } from "@teacher/shared";
import { vocabularyGamesApi } from "../../../api/vocabularyGames";
import { ApiError } from "../../../api/client";
import { PlayShell } from "../PlayShell";

export function PlayStartPage() {
  const { publicCode = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const accessToken = search.get("access") ?? "";
  const [summary, setSummary] = useState<PublicAssignmentSummary | null>(null);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    vocabularyGamesApi.summary(publicCode)
      .then((value) => { if (active) setSummary(value); })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : "Bài học chưa sẵn sàng.");
      });
    return () => { active = false; };
  }, [publicCode]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await vocabularyGamesApi.access(publicCode, accessToken, guestName.trim() || undefined);
      await vocabularyGamesApi.start(publicCode, result.sessionToken);
      navigate(`/play/session/${encodeURIComponent(result.sessionToken)}`, { replace: true });
    } catch (value) {
      const apiError = value as ApiError;
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlayShell>
      <Card sx={{ borderRadius: 5, boxShadow: "0 16px 50px rgba(57,77,124,.14)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={2.5} sx={{ alignItems: "stretch" }}>
            <Typography aria-hidden sx={{ fontSize: 64, textAlign: "center" }}>🚀</Typography>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, textAlign: "center" }}>
              {summary?.title ?? (error ? "Chưa thể mở bài học" : "Đang mở bài học…")}
            </Typography>
            {summary && (
              <>
                <Typography color="text.secondary" sx={{ textAlign: "center" }}>
                  {summary.instruction || `${summary.itemCount} từ vựng · khoảng ${summary.estimatedMinutes} phút`}
                </Typography>
                {summary.audienceType === "OPEN_LINK" && (
                  <TextField
                    label="Tên của con (không bắt buộc)"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                  />
                )}
              </>
            )}
            {error && <Alert severity="warning">{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={!summary || !accessToken || busy}
              onClick={() => void start()}
              sx={{ minHeight: 60, fontSize: 18, borderRadius: 3 }}
            >
              {busy ? <CircularProgress size={26} color="inherit" /> : "Bắt đầu chơi"}
            </Button>
            {!accessToken && summary && (
              <Typography color="text.secondary" variant="body2" sx={{ textAlign: "center" }}>
                Con hãy mở đúng liên kết cô Vy đã gửi nhé.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </PlayShell>
  );
}
