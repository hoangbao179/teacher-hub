import type { CompleteLearningAttemptResult } from "@teacher/shared";
import { Alert, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vocabularyGamesApi } from "../../../api/vocabularyGames";
import { PlayShell } from "../PlayShell";

export function PlayResultPage() {
  const { sessionToken = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<CompleteLearningAttemptResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    vocabularyGamesApi.complete(sessionToken)
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Chưa thể nhận kết quả.");
      });
    return () => { active = false; };
  }, [sessionToken]);

  return (
    <PlayShell progress={100} progressLabel="Hoàn thành">
      <Card sx={{ borderRadius: 5, textAlign: "center", boxShadow: "0 16px 50px rgba(57,77,124,.14)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          {!result && !error && <CircularProgress />}
          {error && (
            <Stack spacing={2}>
              <Alert severity="warning">{error}</Alert>
              <Button onClick={() => navigate(-1)} sx={{ minHeight: 56 }}>Quay lại bài học</Button>
            </Stack>
          )}
          {result && (
            <Stack spacing={2.5}>
              <Typography aria-hidden sx={{ fontSize: 88 }}>{result.sticker}</Typography>
              <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
                {"⭐".repeat(result.stars)}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Con đã hoàn thành!</Typography>
              <Typography color="text.secondary">{result.message}</Typography>
              {result.scorePercent != null && (
                <Typography variant="h4" color="primary.main" sx={{ fontWeight: 800 }}>
                  {result.scorePercent}%
                </Typography>
              )}
              <Typography>
                Đúng ngay lần đầu: {result.firstTryCorrectCount}/{result.gradedExposureCount}
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate("/", { replace: true })}
                sx={{ minHeight: 60, fontSize: 17 }}
              >
                Về trang chủ
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </PlayShell>
  );
}
