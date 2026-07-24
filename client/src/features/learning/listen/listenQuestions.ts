import type { VocabularyItem } from "../types.ts";

export interface ListenQuestion {
  item: VocabularyItem;
  options: string[];
  correctMeaning: string;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function createListenQuestion(vocabulary: readonly VocabularyItem[], itemIndex: number, random: () => number = seededRandom(itemIndex + 1)): ListenQuestion {
  if (vocabulary.length < 4) throw new Error("Listen practice cần ít nhất 4 từ");
  const item = vocabulary[itemIndex % vocabulary.length];
  const distractors = [...new Set(vocabulary.filter((candidate) => candidate.id !== item.id).map((candidate) => candidate.vietnameseMeaning))]
    .filter((meaning) => meaning !== item.vietnameseMeaning)
    .sort(() => random() - 0.5)
    .slice(0, 3);
  if (distractors.length < 3) throw new Error("Listen practice không đủ nghĩa nhiễu duy nhất");
  return { item, correctMeaning: item.vietnameseMeaning, options: [item.vietnameseMeaning, ...distractors].sort(() => random() - 0.5) };
}
