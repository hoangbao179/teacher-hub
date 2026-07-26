import type {
  CompleteLearningAttemptResult,
  PublicAssignmentAccess,
  PublicAssignmentSummary,
  PublicLearningAttempt,
  SubmitLearningAnswerRequest,
  SubmitLearningAnswerResult,
} from "@teacher/shared";
import { apiUrl, ApiError } from "./client";

async function publicGameApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối. Con kiểm tra mạng rồi thử lại nhé!");
  }
  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? "PUBLIC_GAME_ERROR",
      payload.error?.message ?? "Có lỗi xảy ra.",
      Number(response.headers.get("Retry-After")) || undefined,
    );
  }
  return payload.data as T;
}

export const vocabularyGamesApi = {
  summary: (publicCode: string) =>
    publicGameApi<PublicAssignmentSummary>(
      `/api/public/learning-assignments/${encodeURIComponent(publicCode)}`,
    ),
  access: (publicCode: string, accessToken: string, guestName?: string) =>
    publicGameApi<PublicAssignmentAccess>(
      `/api/public/learning-assignments/${encodeURIComponent(publicCode)}/access`,
      {
        method: "POST",
        body: JSON.stringify({ accessToken, ...(guestName ? { guestName } : {}) }),
      },
    ),
  start: (publicCode: string, sessionToken: string) =>
    publicGameApi<PublicLearningAttempt>(
      `/api/public/learning-assignments/${encodeURIComponent(publicCode)}/attempts`,
      {
      method: "POST",
      body: JSON.stringify({ sessionToken }),
      },
    ),
  attempt: (sessionToken: string) =>
    publicGameApi<PublicLearningAttempt>(
      `/api/public/learning-attempts/${encodeURIComponent(sessionToken)}`,
    ),
  answer: (
    sessionToken: string,
    request: SubmitLearningAnswerRequest,
  ) => publicGameApi<SubmitLearningAnswerResult>(
    `/api/public/learning-attempts/${encodeURIComponent(sessionToken)}/answers`,
    { method: "POST", body: JSON.stringify(request) },
  ),
  complete: (sessionToken: string) =>
    publicGameApi<CompleteLearningAttemptResult>(
      `/api/public/learning-attempts/${encodeURIComponent(sessionToken)}/complete`,
      { method: "POST", body: "{}" },
    ),
};
