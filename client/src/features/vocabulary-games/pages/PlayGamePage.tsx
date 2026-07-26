import type { PublicLearningAttempt, SubmitLearningAnswerRequest } from "@teacher/shared";
import { Alert, Button, CircularProgress, Stack } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vocabularyGamesApi } from "../../../api/vocabularyGames";
import { GameQuestion } from "../GameQuestion";
import { PlayShell } from "../PlayShell";

interface PendingSubmission {
  request: SubmitLearningAnswerRequest;
}

export function PlayGamePage() {
  const { sessionToken = "" } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<PublicLearningAttempt | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(true);
  const pending = useRef<PendingSubmission | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      let value: PublicLearningAttempt;
      value = await vocabularyGamesApi.attempt(sessionToken);
      if (value.status === "COMPLETED")
        navigate(`/play/session/${encodeURIComponent(sessionToken)}/result`, { replace: true });
      else setAttempt(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể mở lượt chơi.");
    } finally {
      setBusy(false);
    }
  }, [navigate, sessionToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const send = async (submittedAnswer?: Record<string, unknown>) => {
    const question = attempt?.currentQuestion;
    if (!question) return;
    if (submittedAnswer) {
      pending.current = {
        request: {
          questionId: question.id,
          clientAnswerId: crypto.randomUUID(),
          answerSequence: question.answerSequence,
          submittedAnswer,
        },
      };
    }
    if (!pending.current) return;
    setBusy(true);
    setError("");
    try {
      const result = await vocabularyGamesApi.answer(sessionToken, pending.current.request);
      pending.current = null;
      setFeedback(result.feedback.message);
      setAttempt(result.attempt);
      if (!result.attempt.currentQuestion)
        navigate(`/play/session/${encodeURIComponent(sessionToken)}/result`);
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : "Chưa gửi được câu trả lời."} Con có thể thử gửi lại.`);
    } finally {
      setBusy(false);
    }
  };

  const percent = attempt?.progress.totalQuestions
    ? (attempt.progress.completedQuestions / attempt.progress.totalQuestions) * 100
    : 0;

  return (
    <PlayShell progress={percent} progressLabel={attempt?.progress.label}>
      <Stack spacing={2}>
        {feedback && <Alert severity="success" onClose={() => setFeedback("")}>{feedback}</Alert>}
        {error && (
          <Alert severity="warning" action={
            <Button color="inherit" onClick={() => void (pending.current ? send() : load())}>
              Thử lại
            </Button>
          }>
            {error}
          </Alert>
        )}
        {!attempt && busy && <CircularProgress sx={{ alignSelf: "center", mt: 8 }} />}
        {attempt?.currentQuestion && (
          <GameQuestion
            key={`${attempt.currentQuestion.id}-${attempt.currentQuestion.answerSequence}`}
            question={attempt.currentQuestion}
            disabled={busy}
            onAnswer={(answer) => void send(answer)}
          />
        )}
      </Stack>
    </PlayShell>
  );
}
