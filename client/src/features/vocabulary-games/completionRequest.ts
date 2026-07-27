import type { CompleteLearningAttemptResult } from "@teacher/shared";

export function requestCompletion(
  sessionToken: string,
  complete: (sessionToken: string) => Promise<CompleteLearningAttemptResult>,
): Promise<CompleteLearningAttemptResult> {
  return complete(sessionToken);
}
