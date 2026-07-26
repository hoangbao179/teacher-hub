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
  const [replaying, setReplaying] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const replay = async () => {
    setReplaying(true);
    setError("");
    try {
      const attempt = await vocabularyGamesApi.replay(sessionToken);
      navigate(`/play/session/${encodeURIComponent(attempt.sessionToken)}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chưa thể chơi lại.");
      setReplaying(false);
    }
  };

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
              {result.resultMode === "SCORE" && result.scorePercent != null && (
                <Typography variant="h4" color="primary.main" sx={{ fontWeight: 800 }}>
                  {result.scorePercent}%
                </Typography>
              )}
              {result.resultMode === "SCORE" && <Typography>
                Đúng ngay lần đầu: {result.firstTryCorrectCount}/{result.gradedExposureCount}
              </Typography>}
              {showReview && <Stack spacing={0.75} aria-live="polite">
                {result.reviewWords.length
                  ? result.reviewWords.map((item) => <Typography key={`${item.word}-${item.meaningVi}`}>
                    <strong>{item.word}</strong> — {item.meaningVi}
                  </Typography>)
                  : <Typography>Con chưa có từ khó cần ôn thêm.</Typography>}
              </Stack>}
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, justifyContent: "center" }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowReview((value) => !value)}
                  sx={{ minHeight: 56 }}
                >
                  Ôn từ khó
                </Button>
                {result.canPlayAgain && <Button
                  variant="contained"
                  disabled={replaying}
                  onClick={() => void replay()}
                  sx={{ minHeight: 56 }}
                >
                  {replaying ? "Đang chuẩn bị…" : "Chơi lại"}
                </Button>}
                {!result.canPlayAgain && <Typography color="text.secondary" sx={{ alignSelf: "center" }}>
                  Con đã dùng hết lượt chơi của bài này.
                </Typography>}
              </Stack>
              <Button
                variant="text"
                onClick={() => navigate("/", { replace: true })}
                sx={{ minHeight: 60, fontSize: 17 }}
              >
                Kết thúc
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </PlayShell>
  );
}
