import { scoreQuiz } from "../quiz/quizQuestions.ts";
import { learningLevelSlugs, type ActiveQuizSession, type LearningProgress, type LearningLevelSlug, type LearningUnit, type QuizAnswer, type QuizAttempt, type UnitLearningProgress } from "../types.ts";

export const LEARNING_PROGRESS_STORAGE_KEY = "covy-learning-progress:v1";
const MIGRATED_AT = "1970-01-01T00:00:00.000Z";
export const MAX_RECENT_QUIZ_ATTEMPTS = 10;

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type LegacyUnitProgress = { learnedItemIds?: unknown; totalItems?: unknown; completed?: unknown };

const emptyProgress = (): LearningProgress => ({ schemaVersion: 1, units: {} });
const uniqueStrings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
  : [];
const safeCount = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const isLevelSlug = (value: unknown): value is LearningLevelSlug =>
  typeof value === "string" && (learningLevelSlugs as readonly string[]).includes(value);

export const emptyUnitProgress = (contentVersion: number, updatedAt = new Date().toISOString()): UnitLearningProgress => ({
  contentVersion,
  viewedItemIds: [],
  rememberedItemIds: [],
  reviewItemIds: [],
  lastItemIndex: 0,
  listenCorrect: 0,
  listenTotal: 0,
  quizAttempts: [],
  wrongItemIds: [],
  updatedAt,
});

function migrateQuizAttempt(value: unknown): QuizAttempt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<QuizAttempt>;
  const totalQuestions = safeCount(item.totalQuestions);
  const correctCount = Math.min(safeCount(item.correctCount), totalQuestions);
  if (!totalQuestions || typeof item.completedAt !== "string" || !item.completedAt) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : item.completedAt,
    completedAt: item.completedAt,
    totalQuestions,
    correctCount,
    scorePercent: Math.round((correctCount / totalQuestions) * 100),
    wrongItemIds: uniqueStrings(item.wrongItemIds),
  };
}

function migrateActiveQuiz(value: unknown): ActiveQuizSession | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Partial<ActiveQuizSession>;
  const questionItemIds = uniqueStrings(item.questionItemIds);
  if (!questionItemIds.length || typeof item.startedAt !== "string" || !item.startedAt) return undefined;
  const rawAnswers = Array.isArray(item.answers) ? item.answers.flatMap((answer) => {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return [];
    const candidate = answer as Partial<QuizAnswer>;
    return typeof candidate.itemId === "string" && questionItemIds.includes(candidate.itemId)
      && typeof candidate.selectedValue === "string" && typeof candidate.correct === "boolean"
      ? [{ itemId: candidate.itemId, selectedValue: candidate.selectedValue, correct: candidate.correct }]
      : [];
  }) : [];
  const answers: QuizAnswer[] = [];
  for (const itemId of questionItemIds) {
    const answer = rawAnswers.find((candidate) => candidate.itemId === itemId);
    if (!answer) break;
    answers.push(answer);
  }
  return { questionItemIds, answers, currentIndex: Math.min(answers.length, questionItemIds.length - 1), startedAt: item.startedAt };
}

function migrateUnitProgress(value: unknown): UnitLearningProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<UnitLearningProgress> & LegacyUnitProgress;
  const rememberedItemIds = uniqueStrings(item.rememberedItemIds ?? item.learnedItemIds);
  const reviewItemIds = uniqueStrings(item.reviewItemIds).filter((id) => !rememberedItemIds.includes(id));
  const viewedItemIds = uniqueStrings(item.viewedItemIds ?? item.learnedItemIds);
  const lastItemIndex = safeCount(item.lastItemIndex);
  const contentVersion = Math.max(1, safeCount(item.contentVersion) || 1);
  const updatedAt = typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : MIGRATED_AT;
  const listenTotal = safeCount(item.listenTotal);
  const quizAttempts = Array.isArray(item.quizAttempts)
    ? item.quizAttempts.flatMap((attempt) => migrateQuizAttempt(attempt) ?? []).slice(-MAX_RECENT_QUIZ_ATTEMPTS)
    : [];
  const activeQuiz = migrateActiveQuiz(item.activeQuiz);
  const latestAttempt = quizAttempts.at(-1);
  const storedBestScore = typeof item.bestScore === "number" ? Math.max(0, Math.min(100, Math.round(item.bestScore))) : undefined;
  const bestScore = latestAttempt ? Math.max(storedBestScore ?? 0, ...quizAttempts.map((attempt) => attempt.scorePercent)) : storedBestScore;
  const storedLatestScore = typeof item.latestScore === "number" ? Math.max(0, Math.min(100, Math.round(item.latestScore))) : undefined;
  return {
    contentVersion,
    viewedItemIds,
    rememberedItemIds,
    reviewItemIds,
    lastItemIndex,
    ...(typeof item.flashcardCompletedAt === "string" && item.flashcardCompletedAt ? { flashcardCompletedAt: item.flashcardCompletedAt } : {}),
    listenCorrect: Math.min(safeCount(item.listenCorrect), listenTotal),
    listenTotal,
    quizAttempts,
    ...(bestScore !== undefined ? { bestScore } : {}),
    ...(latestAttempt ? { latestScore: latestAttempt.scorePercent } : storedLatestScore !== undefined ? { latestScore: storedLatestScore } : {}),
    wrongItemIds: uniqueStrings(item.wrongItemIds ?? latestAttempt?.wrongItemIds),
    ...(typeof item.completedAt === "string" && item.completedAt ? { completedAt: item.completedAt } : {}),
    ...(typeof item.reviewCompletedAt === "string" && item.reviewCompletedAt ? { reviewCompletedAt: item.reviewCompletedAt } : {}),
    ...(activeQuiz ? { activeQuiz } : {}),
    updatedAt,
  };
}

function resolveStorage(storage?: StorageAdapter | null): StorageAdapter | null {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function readLearningProgress(storage?: StorageAdapter | null): LearningProgress {
  const target = resolveStorage(storage);
  if (!target) return emptyProgress();
  try {
    const raw = target.getItem(LEARNING_PROGRESS_STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (parsed.schemaVersion !== 1 || !parsed.units || typeof parsed.units !== "object" || Array.isArray(parsed.units)) return emptyProgress();
    const units = Object.fromEntries(Object.entries(parsed.units).flatMap(([slug, value]) => {
      const migrated = migrateUnitProgress(value);
      return migrated ? [[slug, migrated]] : [];
    }));
    return {
      schemaVersion: 1,
      units,
      ...(isLevelSlug(parsed.lastLevelSlug) ? { lastLevelSlug: parsed.lastLevelSlug } : {}),
      ...(typeof parsed.lastUnitSlug === "string" && parsed.lastUnitSlug.trim() ? { lastUnitSlug: parsed.lastUnitSlug } : {}),
    };
  } catch { return emptyProgress(); }
}

export function writeLearningProgress(progress: LearningProgress, storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try { target.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}

export function unitProgressFor(progress: LearningProgress, unit: LearningUnit): UnitLearningProgress {
  const stored = progress.units[unit.slug];
  return stored?.contentVersion === unit.contentVersion ? stored : emptyUnitProgress(unit.contentVersion);
}

export function updateUnitProgress(
  unit: LearningUnit,
  update: (current: UnitLearningProgress) => UnitLearningProgress,
  storage?: StorageAdapter | null,
): LearningProgress {
  const progress = readLearningProgress(storage);
  const nextUnit = update(unitProgressFor(progress, unit));
  const next = { ...progress, lastLevelSlug: unit.levelSlug, lastUnitSlug: unit.slug, units: { ...progress.units, [unit.slug]: nextUnit } };
  writeLearningProgress(next, storage);
  return next;
}

export function rememberLearningLocation(levelSlug: LearningLevelSlug, unitSlug?: string, storage?: StorageAdapter | null): LearningProgress {
  const next = { ...readLearningProgress(storage), lastLevelSlug: levelSlug, ...(unitSlug ? { lastUnitSlug: unitSlug } : {}) };
  writeLearningProgress(next, storage);
  return next;
}

export function recordViewedItem(unit: LearningUnit, itemId: string, itemIndex: number, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    const viewedItemIds = uniqueStrings([...current.viewedItemIds, itemId]);
    const completed = viewedItemIds.length >= unit.vocabulary.length;
    return { ...current, viewedItemIds, lastItemIndex: Math.max(0, Math.min(itemIndex, unit.vocabulary.length - 1)), ...(completed && !current.flashcardCompletedAt ? { flashcardCompletedAt: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() };
  }, storage);
}

export function markVocabularyItem(unit: LearningUnit, itemId: string, state: "REMEMBERED" | "REVIEW", storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => ({
    ...current,
    viewedItemIds: uniqueStrings([...current.viewedItemIds, itemId]),
    rememberedItemIds: state === "REMEMBERED" ? uniqueStrings([...current.rememberedItemIds, itemId]) : current.rememberedItemIds.filter((id) => id !== itemId),
    reviewItemIds: state === "REVIEW" ? uniqueStrings([...current.reviewItemIds, itemId]) : current.reviewItemIds.filter((id) => id !== itemId),
    updatedAt: new Date().toISOString(),
  }), storage);
}

export function recordListenAnswer(unit: LearningUnit, correct: boolean, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => ({ ...current, listenCorrect: current.listenCorrect + (correct ? 1 : 0), listenTotal: current.listenTotal + 1, updatedAt: new Date().toISOString() }), storage);
}

export function startOrResumeQuiz(unit: LearningUnit, questionItemIds: string[], storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    const validIds = uniqueStrings(questionItemIds).filter((id) => unit.vocabulary.some((item) => item.id === id)).slice(0, 10);
    if (current.activeQuiz && current.activeQuiz.questionItemIds.every((id) => validIds.includes(id))) return current;
    const now = new Date().toISOString();
    return { ...current, activeQuiz: { questionItemIds: validIds, currentIndex: 0, answers: [], startedAt: now }, updatedAt: now };
  }, storage);
}

export function recordQuizAnswer(unit: LearningUnit, answer: QuizAnswer, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    const session = current.activeQuiz;
    if (!session || session.answers.some((item) => item.itemId === answer.itemId) || session.questionItemIds[session.currentIndex] !== answer.itemId) return current;
    const answers = [...session.answers, answer];
    return { ...current, activeQuiz: { ...session, answers, currentIndex: Math.min(session.currentIndex + 1, session.questionItemIds.length - 1) }, updatedAt: new Date().toISOString() };
  }, storage);
}

export function completeQuiz(unit: LearningUnit, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    if (!current.activeQuiz || current.activeQuiz.answers.length !== current.activeQuiz.questionItemIds.length) return current;
    const score = scoreQuiz(current.activeQuiz.answers);
    const completedAt = new Date().toISOString();
    const attempt: QuizAttempt = { id: `${completedAt}-${current.quizAttempts.length + 1}`, completedAt, totalQuestions: score.totalQuestions, correctCount: score.correctCount, scorePercent: score.scorePercent, wrongItemIds: score.wrongItemIds };
    const quizAttempts = [...current.quizAttempts, attempt].slice(-MAX_RECENT_QUIZ_ATTEMPTS);
    return {
      ...current,
      quizAttempts,
      bestScore: Math.max(current.bestScore ?? 0, score.scorePercent),
      latestScore: score.scorePercent,
      wrongItemIds: score.wrongItemIds,
      completedAt,
      activeQuiz: undefined,
      reviewCompletedAt: score.wrongItemIds.length ? undefined : completedAt,
      updatedAt: completedAt,
    };
  }, storage);
}

export function restartQuiz(unit: LearningUnit, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => ({ ...current, activeQuiz: undefined, updatedAt: new Date().toISOString() }), storage);
}

export function markReviewedAsRemembered(unit: LearningUnit, itemId: string, storage?: StorageAdapter | null): LearningProgress {
  return updateUnitProgress(unit, (current) => {
    const wrongItemIds = current.wrongItemIds.filter((id) => id !== itemId);
    const reviewItemIds = current.reviewItemIds.filter((id) => id !== itemId);
    const now = new Date().toISOString();
    return {
      ...current,
      viewedItemIds: uniqueStrings([...current.viewedItemIds, itemId]),
      rememberedItemIds: uniqueStrings([...current.rememberedItemIds, itemId]),
      wrongItemIds,
      reviewItemIds,
      ...(wrongItemIds.length || reviewItemIds.length ? { reviewCompletedAt: undefined } : { reviewCompletedAt: now }),
      updatedAt: now,
    };
  }, storage);
}

export function resetUnitProgress(unitSlug: string, storage?: StorageAdapter | null): LearningProgress {
  const progress = readLearningProgress(storage);
  const units = { ...progress.units };
  delete units[unitSlug];
  const next = { ...progress, units, ...(progress.lastUnitSlug === unitSlug ? { lastUnitSlug: undefined } : {}) };
  writeLearningProgress(next, storage);
  return next;
}

export function resetLearningProgress(storage?: StorageAdapter | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;
  try { target.removeItem(LEARNING_PROGRESS_STORAGE_KEY); return true; } catch { return false; }
}
