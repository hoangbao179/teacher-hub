import type { PublicLearningAttempt, SubmitLearningAnswerResult } from "@teacher/shared";
import { Alert, Button, CircularProgress, Stack } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { vocabularyGamesApi } from "../../../api/vocabularyGames";
import { ApiError } from "../../../api/client";
import { GameQuestion } from "../GameQuestion";
import { PlayShell } from "../PlayShell";
import { clearGameSession } from "../gameSession";
import { beginAnswerSubmission, createAnswerSubmissionState, finishAnswerSubmission } from "../answerSubmission";

export function PlayGamePage() {
  const { sessionToken = "" } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<PublicLearningAttempt | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<SubmitLearningAnswerResult["feedback"] | null>(null);
  const [busy, setBusy] = useState(true);
  const submissionRef = useRef(createAnswerSubmissionState());
  const feedbackTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      let value: PublicLearningAttempt;
      value = await vocabularyGamesApi.attempt(sessionToken);
      if (value.status === "COMPLETED")
        { clearGameSession(sessionToken); navigate(`/play/session/${encodeURIComponent(sessionToken)}/result`, { replace: true }); }
      else setAttempt(value);
    } catch (reason) {
      if (reason instanceof ApiError && ["PUBLIC_SESSION_EXPIRED", "PUBLIC_ACCESS_DENIED"]
        .includes(reason.code)) clearGameSession(sessionToken);
      setError(reason instanceof Error ? reason.message : "Không thể mở lượt chơi.");
    } finally {
      setBusy(false);
    }
  }, [navigate, sessionToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, [load]);

  const send = async (submittedAnswer?: Record<string, unknown>) => {
    const question = attempt?.currentQuestion;
    if (!question) return;
    const request = beginAnswerSubmission(submissionRef.current, question, submittedAnswer);
    if (!request) return;
    setBusy(true);
    setError("");
    let delayed = false;
    try {
      const result = await vocabularyGamesApi.answer(sessionToken, request);
      finishAnswerSubmission(submissionRef.current, true);
      setFeedback(result.feedback);
      const applyAttempt = () => {
        setAttempt(result.attempt);
        if (!result.attempt.currentQuestion)
          navigate(`/play/session/${encodeURIComponent(sessionToken)}/result`);
      };
      if (result.feedback.tone === "POSITIVE" && !result.shouldRetry) {
        delayed = true;
        feedbackTimerRef.current = window.setTimeout(() => {
          applyAttempt();
          setBusy(false);
          finishAnswerSubmission(submissionRef.current, true);
        }, 550);
      } else
        applyAttempt();
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : "Chưa gửi được câu trả lời."} Con có thể thử gửi lại.`);
    } finally {
      if (!delayed) {
        setBusy(false);
        finishAnswerSubmission(submissionRef.current, false);
      }
    }
  };

  const percent = attempt?.progress.totalQuestions
    ? (attempt.progress.completedQuestions / attempt.progress.totalQuestions) * 100
    : 0;

  return (
    <PlayShell progress={percent} progressLabel={attempt?.progress.label}>
      <Stack spacing={2}>
        {feedback && <Alert
          role="status"
          aria-live="polite"
          severity={feedback.tone === "POSITIVE"
            ? "success" : feedback.tone === "TRY_AGAIN" ? "warning" : "info"}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>}
        {error && (
          <Alert severity="warning" action={
            <Button color="inherit" onClick={() => void (submissionRef.current.pending ? send() : load())}>
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
