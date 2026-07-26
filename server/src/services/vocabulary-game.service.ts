import type {
  CompleteLearningAttemptResult,
  PublicAssignmentAccess,
  PublicLearningAttempt,
  SubmitLearningAnswerRequest,
  SubmitLearningAnswerResult,
} from "@teacher/shared";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../errors/app-error";
import { AssignmentRepository } from "../repositories/assignment.repository";
import {
  internalJson,
  publicQuestion,
  VocabularyGameRepository,
  type InternalAttemptState,
} from "../repositories/vocabulary-game.repository";
import { generateQuestionQueue } from "./game-question-generator";

const SESSION_MS = 24 * 60 * 60 * 1000;

export function gameToken(): string {
  return randomBytes(32).toString("base64url");
}

export function gameTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class VocabularyGameService {
  constructor(
    private readonly games: VocabularyGameRepository,
    private readonly assignments: AssignmentRepository,
  ) {}

  async summary(publicCode: string) {
    const code = this.publicCode(publicCode);
    const result = await this.games.summary(code);
    if (!result)
      throw new AppError(404, "PUBLIC_ASSIGNMENT_UNAVAILABLE", "Bài học hiện không khả dụng.");
    return result;
  }

  async access(
    publicCode: string,
    accessTokenValue: unknown,
    guestNameValue: unknown,
  ): Promise<PublicAssignmentAccess> {
    const code = this.publicCode(publicCode);
    const accessToken = this.token(accessTokenValue, "Liên kết truy cập không hợp lệ.");
    const guestName = this.guestName(guestNameValue);
    const sessionToken = gameToken();
    const expiresAt = new Date(Date.now() + SESSION_MS);
    const access = await this.games.createAccess({
      publicCode: code,
      accessTokenHash: gameTokenHash(accessToken),
      sessionTokenHash: gameTokenHash(sessionToken),
      guestName,
      expiresAt,
    });
    return {
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      audienceType: access.audienceType,
      ...(access.displayName ? { displayName: access.displayName } : {}),
      attemptsUsed: access.attemptsUsed,
      maxAttempts: access.maxAttempts,
    };
  }

  async start(publicCode: string, sessionTokenValue: unknown): Promise<PublicLearningAttempt> {
    const sessionToken = this.token(sessionTokenValue, "Phiên chơi không hợp lệ.");
    const hash = gameTokenHash(sessionToken);
    const code = await this.games.sessionAssignmentCode(hash);
    if (code !== this.publicCode(publicCode))
      throw new AppError(404, "PUBLIC_ASSIGNMENT_UNAVAILABLE", "Bài học hiện không khả dụng.");
    const assignment = await this.assignments.publicDetail(code);
    if (!assignment)
      throw new AppError(404, "PUBLIC_ASSIGNMENT_UNAVAILABLE", "Bài học hiện không khả dụng.");
    const seed = randomBytes(32).toString("hex");
    const queue = generateQuestionQueue(assignment, seed);
    await this.games.startAttempt(hash, seed, queue);
    return this.mapAttempt(await this.games.state(hash), sessionToken);
  }

  async attempt(sessionTokenValue: unknown): Promise<PublicLearningAttempt> {
    const sessionToken = this.token(sessionTokenValue, "Phiên chơi không hợp lệ.");
    return this.mapAttempt(
      await this.games.state(gameTokenHash(sessionToken)),
      sessionToken,
    );
  }

  async answer(
    sessionTokenValue: unknown,
    raw: SubmitLearningAnswerRequest,
  ): Promise<SubmitLearningAnswerResult> {
    const sessionToken = this.token(sessionTokenValue, "Phiên chơi không hợp lệ.");
    if (!Number.isInteger(raw?.questionId) || raw.questionId < 1)
      throw this.validation("Câu hỏi không hợp lệ.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw?.clientAnswerId ?? ""))
      throw this.validation("Mã câu trả lời không hợp lệ.");
    if (!Number.isInteger(raw?.answerSequence) || raw.answerSequence < 1 || raw.answerSequence > 3)
      throw this.validation("Thứ tự câu trả lời không hợp lệ.");
    if (!raw.submittedAnswer || typeof raw.submittedAnswer !== "object" || Array.isArray(raw.submittedAnswer))
      throw this.validation("Nội dung trả lời không hợp lệ.");
    if (JSON.stringify(raw.submittedAnswer).length > 8_000)
      throw new AppError(413, "ANSWER_PAYLOAD_TOO_LARGE", "Nội dung trả lời quá lớn.");
    const hash = gameTokenHash(sessionToken);
    const result = await this.games.answer({
      sessionHash: hash,
      questionId: raw.questionId,
      clientAnswerId: raw.clientAnswerId,
      answerSequence: raw.answerSequence,
      submittedAnswer: raw.submittedAnswer,
    });
    return {
      ...(result as Omit<SubmitLearningAnswerResult, "attempt">),
      attempt: this.mapAttempt(await this.games.state(hash), sessionToken),
    };
  }

  async complete(sessionTokenValue: unknown): Promise<CompleteLearningAttemptResult> {
    const sessionToken = this.token(sessionTokenValue, "Phiên chơi không hợp lệ.");
    return (await this.games.complete(gameTokenHash(sessionToken))) as unknown as CompleteLearningAttemptResult;
  }

  private mapAttempt(state: InternalAttemptState, rawToken: string): PublicLearningAttempt {
    const attempt = state.attempt;
    return {
      attemptId: Number(attempt.id),
      sessionToken: rawToken,
      sessionExpiresAt: new Date(attempt.session_expires_at).toISOString(),
      status: attempt.status,
      ageBand: attempt.age_band,
      answerFeedbackMode: attempt.answer_feedback_mode,
      ...(attempt.student_name_snapshot || attempt.guest_name
        ? { displayName: attempt.student_name_snapshot ?? attempt.guest_name ?? undefined }
        : {}),
      progress: {
        completedQuestions: state.completedQuestions,
        totalQuestions: Number(attempt.total_questions),
        label: `${state.completedQuestions}/${Number(attempt.total_questions)}`,
      },
      currentQuestion: state.question ? publicQuestion(state.question) : null,
      generationWarnings: internalJson<string[]>(attempt.generation_warnings_json, []),
    };
  }

  private publicCode(value: string): string {
    const code = String(value ?? "").trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code))
      throw new AppError(404, "PUBLIC_ASSIGNMENT_UNAVAILABLE", "Bài học hiện không khả dụng.");
    return code;
  }

  private token(value: unknown, message: string): string {
    const token = typeof value === "string" ? value.trim() : "";
    if (token.length < 40 || token.length > 200)
      throw new AppError(403, "PUBLIC_ACCESS_DENIED", message);
    return token;
  }

  private guestName(value: unknown): string | null {
    if (value == null || value === "") return null;
    if (typeof value !== "string") throw this.validation("Tên người chơi không hợp lệ.");
    const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (name.length > 80) throw this.validation("Tên người chơi tối đa 80 ký tự.");
    return name || null;
  }

  private validation(message: string) {
    return new AppError(400, "VALIDATION_ERROR", message);
  }
}
