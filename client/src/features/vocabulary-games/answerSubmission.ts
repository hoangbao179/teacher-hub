import type { PublicLearningQuestion, SubmitLearningAnswerRequest } from "@teacher/shared";

export interface AnswerSubmissionState {
  locked: boolean;
  pending: SubmitLearningAnswerRequest | null;
}

export function createAnswerSubmissionState(): AnswerSubmissionState {
  return { locked: false, pending: null };
}

export function beginAnswerSubmission(
  state: AnswerSubmissionState,
  question: PublicLearningQuestion,
  submittedAnswer: Record<string, unknown> | undefined,
  createId: () => string = () => crypto.randomUUID(),
): SubmitLearningAnswerRequest | null {
  if (state.locked) return null;
  if (submittedAnswer && !state.pending)
    state.pending = {
      questionId: question.id,
      clientAnswerId: createId(),
      answerSequence: question.answerSequence,
      submittedAnswer,
    };
  if (!state.pending) return null;
  state.locked = true;
  return state.pending;
}

export function finishAnswerSubmission(state: AnswerSubmissionState, succeeded: boolean): void {
  if (succeeded) state.pending = null;
  state.locked = false;
}
