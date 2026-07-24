import type { QuizAnswer, VocabularyItem } from "../types.ts";

export type QuizDirection = "WORD_TO_MEANING" | "MEANING_TO_WORD";

export interface QuizQuestion {
  itemId: string;
  direction: QuizDirection;
  prompt: string;
  correctValue: string;
  options: string[];
}

export const seededQuizRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

export function quizItemOrder(vocabulary: readonly VocabularyItem[], random = seededQuizRandom(18)): string[] {
  return shuffled(vocabulary, random).slice(0, 10).map((item) => item.id);
}

export function createQuizQuestions(
  vocabulary: readonly VocabularyItem[],
  itemIds = quizItemOrder(vocabulary),
  random = seededQuizRandom(1804),
): QuizQuestion[] {
  const byId = new Map(vocabulary.map((item) => [item.id, item]));
  return itemIds.flatMap((itemId, index) => {
    const item = byId.get(itemId);
    if (!item) return [];
    const direction: QuizDirection = index % 2 === 0 ? "WORD_TO_MEANING" : "MEANING_TO_WORD";
    const valueOf = (candidate: VocabularyItem) => direction === "WORD_TO_MEANING" ? candidate.vietnameseMeaning : candidate.word;
    const correctValue = valueOf(item);
    const distractors = shuffled(
      [...new Map(vocabulary.filter((candidate) => candidate.id !== item.id && valueOf(candidate) !== correctValue).map((candidate) => [valueOf(candidate), valueOf(candidate)])).values()],
      random,
    ).slice(0, Math.min(3, vocabulary.length - 1));
    const options = shuffled([correctValue, ...distractors], random);
    if (options.length < 2) return [];
    return [{
      itemId,
      direction,
      prompt: direction === "WORD_TO_MEANING" ? item.word : item.vietnameseMeaning,
      correctValue,
      options,
    }];
  });
}

export function scoreQuiz(answers: readonly QuizAnswer[]) {
  const totalQuestions = answers.length;
  const correctCount = answers.filter((answer) => answer.correct).length;
  return {
    totalQuestions,
    correctCount,
    wrongCount: totalQuestions - correctCount,
    scorePercent: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
    wrongItemIds: [...new Set(answers.filter((answer) => !answer.correct).map((answer) => answer.itemId))],
  };
}
