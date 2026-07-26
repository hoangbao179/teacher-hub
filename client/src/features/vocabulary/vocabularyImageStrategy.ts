import type { VocabularyImageMediaType } from "@teacher/shared";

export type VocabularyImageCategory = "LOCAL" | "NOUN" | "ANIMAL" | "ACTION" | "EMOTION";
export type VocabularyImageFilter = Extract<VocabularyImageMediaType, "ILLUSTRATION" | "PHOTO">;

export interface VocabularyImageStrategy {
  category: VocabularyImageCategory;
  query: string;
  publicAsset?: string;
}

const colors: Record<string, string> = {
  red: "red", blue: "blue", yellow: "yellow", green: "green", orange: "orange",
  purple: "purple", pink: "pink", black: "black", white: "white", brown: "brown",
  gray: "gray", gold: "gold", silver: "silver",
};

const numberWords = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty",
] as const;

const actions = new Set([
  "run", "walk", "jump", "sit", "stand", "eat", "drink", "read", "write", "sing",
  "dance", "swim", "clap", "draw", "listen", "speak", "open", "close", "throw", "catch",
]);

const emotions = new Set([
  "happy", "sad", "angry", "scared", "tired", "hungry", "thirsty", "excited", "bored",
  "surprised", "worried", "shy", "proud", "calm",
]);
const animals = new Set([
  "cat", "dog", "fish", "bird", "rabbit", "hamster", "turtle", "parrot", "horse", "cow",
  "pig", "sheep", "goat", "chicken", "duck", "elephant", "tiger", "lion", "monkey", "bear",
  "giraffe", "zebra", "crocodile", "snake", "frog", "mouse", "bat",
]);
const topicNoise = new Set([
  "pets", "pet", "animals", "animal", "actions", "feelings", "colors", "color", "numbers", "number",
]);

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");

function curatedSubject(word: string, searchTerms: string[]): string {
  const genericLegacyTerms = new Set([
    `${word} color`, `${word} number`, `${word} actions`, `${word} feelings`,
  ]);
  return searchTerms.map(normalize).find((term) =>
    term && !genericLegacyTerms.has(term) && !term.split(" ").some((part) => topicNoise.has(part))) ?? word;
}

export function buildVocabularyImageStrategy(
  rawWord: string,
  searchTerms: string[] = [],
): VocabularyImageStrategy {
  const word = normalize(rawWord);
  if (colors[word]) {
    return { category: "LOCAL", query: word, publicAsset: `/learning/colors/${colors[word]}.svg` };
  }
  const numberIndex = numberWords.indexOf(word as typeof numberWords[number]);
  if (numberIndex >= 0) {
    return { category: "LOCAL", query: word, publicAsset: `/learning/numbers/${numberIndex + 1}.svg` };
  }
  const subject = curatedSubject(word, searchTerms);
  if (animals.has(word)) return { category: "ANIMAL", query: `${word} cartoon isolated` };
  if (actions.has(word)) return { category: "ACTION", query: `child ${subject} cartoon illustration` };
  if (emotions.has(word)) return { category: "EMOTION", query: `${subject} child face emotion cartoon illustration` };
  return { category: "NOUN", query: `${subject} cartoon isolated` };
}
