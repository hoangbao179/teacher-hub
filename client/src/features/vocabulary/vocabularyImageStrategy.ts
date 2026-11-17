import type { VocabularyImageMediaType } from "@teacher/shared";

export type VocabularyImageCategory = "LOCAL" | "NOUN" | "TRANSPORT" | "WEATHER" | "ANIMAL" | "FOOD" | "SCHOOL" | "FAMILY" | "ACTION" | "EMOTION";
export type VocabularyImageFilter = Extract<VocabularyImageMediaType, "ILLUSTRATION" | "PHOTO">;

export interface VocabularyImageStrategy {
  category: VocabularyImageCategory;
  query: string;
  queries: string[];
  publicAsset?: string;
}

const localAssetManifest: Record<string, string> = Object.fromEntries([
  ...["red", "blue", "yellow", "green", "orange", "purple", "pink", "black", "white", "brown", "gray", "gold", "silver"]
    .map((word) => [word, `/learning/colors/${word}.svg`]),
  ...["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
    .map((word, index) => [word, `/learning/numbers/${index + 1}.svg`]),
]);
const groups: Array<[VocabularyImageCategory, Set<string>]> = [
  ["TRANSPORT", new Set(["car", "bus", "bike", "motorbike", "train", "plane", "boat", "taxi", "truck", "ship", "helicopter", "subway", "ambulance", "fire engine"])],
  ["WEATHER", new Set(["sunny", "rainy", "cloudy", "windy", "stormy", "snowy", "foggy", "weather", "rainbow"])],
  ["ANIMAL", new Set(["cat", "dog", "fish", "bird", "rabbit", "hamster", "turtle", "parrot", "horse", "cow", "pig", "sheep", "goat", "chicken", "duck", "elephant", "tiger", "lion", "monkey", "bear", "giraffe", "zebra", "crocodile", "snake", "frog", "mouse", "bat"])],
  ["FOOD", new Set(["apple", "banana", "orange", "mango", "grape", "rice", "bread", "egg", "milk", "water", "juice", "cake", "noodles", "pizza", "salad", "soup"])],
  ["SCHOOL", new Set(["book", "pen", "pencil", "ruler", "eraser", "bag", "desk", "chair", "board", "teacher", "school", "classroom"])],
  ["FAMILY", new Set(["mother", "father", "parents", "brother", "sister", "baby", "grandmother", "grandfather", "aunt", "uncle", "cousin", "family"])],
  ["ACTION", new Set(["run", "walk", "jump", "sit", "stand", "eat", "drink", "read", "write", "sing", "dance", "swim", "clap", "draw", "listen", "speak", "open", "close", "throw", "catch"])],
  ["EMOTION", new Set(["happy", "sad", "angry", "scared", "tired", "hungry", "thirsty", "excited", "bored", "surprised", "worried", "shy", "proud", "calm"])],
];
const noise = new Set(["transport", "weather", "isolated", "object", "animals", "animal", "food", "school", "family", "actions"]);
const contextLabels: Record<VocabularyImageCategory, string> = {
  LOCAL: "", NOUN: "", TRANSPORT: "vehicle", WEATHER: "outdoor sky", ANIMAL: "wildlife",
  FOOD: "meal", SCHOOL: "classroom", FAMILY: "people", ACTION: "person", EMOTION: "facial expression",
};
const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
const localSenseAssets: Readonly<Record<string, string>> = {
  "cat\u0000con mèo": "/learning/animals/cat.svg",
  "cat\u0000mèo": "/learning/animals/cat.svg",
};
const colorMeanings: Readonly<Record<string, string>> = {
  red: "đỏ", blue: "xanh dương", yellow: "vàng", green: "xanh lá",
  orange: "cam", purple: "tím", pink: "hồng", black: "đen",
  white: "trắng", brown: "nâu", gray: "xám", gold: "vàng kim", silver: "bạc",
};
const numberMeanings: Readonly<Record<string, string>> = Object.fromEntries(
  ["một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười",
   "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu",
   "mười bảy", "mười tám", "mười chín", "hai mươi"]
    .map((meaning, index) => [
      ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
       "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
       "eighteen", "nineteen", "twenty"][index], meaning,
    ]),
);
const normalizeMeaning = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi-VN");
function allowedLocalAssetSense(word: string, meaningVi: string): boolean {
  const meaning = normalizeMeaning(meaningVi);
  if (word in colorMeanings) {
    const color = colorMeanings[word];
    return meaning === color || meaning === `màu ${color}`;
  }
  if (word in numberMeanings) {
    const number = numberMeanings[word];
    return meaning === number || meaning === `số ${number}`;
  }
  return false;
}

const clean = (value: string) => normalize(value).split(" ").filter((part) => !noise.has(part)).join(" ");

export function buildVocabularyImageStrategy(
  rawWord: string, searchTerms: string[] = [], meaningVi?: string,
): VocabularyImageStrategy {
  const word = normalize(rawWord);
  const verifiedSense = meaningVi ? localSenseAssets[`${word}\u0000${normalizeMeaning(meaningVi)}`] : undefined;
  const publicAsset = verifiedSense ??
    (!meaningVi || allowedLocalAssetSense(word, meaningVi) ? localAssetManifest[word] : undefined);
  if (publicAsset) return { category: "LOCAL", query: word, queries: [word], publicAsset };
  const category = groups.find(([, words]) => words.has(word))?.[0] ?? "NOUN";
  const preferred = searchTerms.map(clean).find((term) => term && term !== word);
  const context = category === "ACTION" ? `person ${word}` : `${word} ${contextLabels[category]}`.trim();
  const queries = [...new Set([word, preferred, `${word} illustration`, `${word} cartoon`, context].filter((value): value is string => Boolean(value)))];
  return { category, query: queries[0], queries };
}
