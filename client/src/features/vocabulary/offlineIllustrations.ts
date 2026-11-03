import type { VocabularyIllustrationInput, VocabularySetItemInput } from "@teacher/shared";

/**
 * Small, reviewed vocabulary-sense map. A word alone is never enough to select
 * a picture: orange (fruit/colour), bat (animal/sports) and similar words must
 * resolve against the Vietnamese meaning entered by the teacher.
 *
 * Keep this map deliberately conservative; an absent match is not an error.
 * Emoji are provided by the device, with no remote image requests or licensing
 * dependency on an image-search provider.
 */
const entries: readonly (readonly [string, readonly string[], string])[] = [
  ["apple", ["quả táo", "trái táo"], "🍎"],
  ["banana", ["quả chuối", "trái chuối"], "🍌"],
  ["orange", ["quả cam", "trái cam"], "🍊"],
  ["mango", ["quả xoài", "trái xoài"], "🥭"],
  ["grape", ["quả nho", "trái nho"], "🍇"],
  ["lemon", ["quả chanh", "trái chanh"], "🍋"],
  ["watermelon", ["quả dưa hấu", "trái dưa hấu"], "🍉"],
  ["strawberry", ["quả dâu tây", "trái dâu tây"], "🍓"],
  ["pineapple", ["quả dứa", "trái thơm", "quả thơm"], "🍍"],
  ["cat", ["con mèo", "mèo"], "🐱"],
  ["dog", ["con chó", "chó"], "🐶"],
  ["bird", ["con chim", "chim"], "🐦"],
  ["fish", ["con cá", "cá"], "🐟"],
  ["duck", ["con vịt", "vịt"], "🦆"],
  ["rabbit", ["con thỏ", "thỏ"], "🐰"],
  ["cow", ["con bò", "bò"], "🐮"],
  ["pig", ["con lợn", "con heo", "lợn", "heo"], "🐷"],
  ["horse", ["con ngựa", "ngựa"], "🐴"],
  ["sheep", ["con cừu", "cừu"], "🐑"],
  ["goat", ["con dê", "dê"], "🐐"],
  ["chicken", ["con gà", "gà"], "🐔"],
  ["frog", ["con ếch", "ếch"], "🐸"],
  ["bee", ["con ong", "ong"], "🐝"],
  ["lion", ["con sư tử", "sư tử"], "🦁"],
  ["tiger", ["con hổ", "con cọp", "hổ"], "🐯"],
  ["elephant", ["con voi", "voi"], "🐘"],
  ["monkey", ["con khỉ", "khỉ"], "🐵"],
  ["bear", ["con gấu", "gấu"], "🐻"],
  ["snake", ["con rắn", "rắn"], "🐍"],
  ["mouse", ["con chuột", "chuột"], "🐭"],
  ["bat", ["con dơi", "dơi"], "🦇"],
  ["turtle", ["con rùa", "rùa"], "🐢"],
  ["car", ["xe ô tô", "ô tô", "xe hơi"], "🚗"],
  ["bus", ["xe buýt", "xe bus"], "🚌"],
  ["bike", ["xe đạp"], "🚲"],
  ["bicycle", ["xe đạp"], "🚲"],
  ["train", ["tàu hỏa", "tàu hoả"], "🚆"],
  ["plane", ["máy bay"], "✈️"],
  ["airplane", ["máy bay"], "✈️"],
  ["ship", ["tàu thủy", "tàu thuỷ", "con tàu"], "🚢"],
  ["taxi", ["xe taxi", "taxi"], "🚕"],
  ["book", ["quyển sách", "cuốn sách", "sách"], "📖"],
  ["pen", ["bút mực", "cây bút", "bút"], "🖊️"],
  ["pencil", ["bút chì", "cây bút chì"], "✏️"],
  ["ruler", ["cái thước", "thước kẻ"], "📏"],
  ["bag", ["cái cặp", "cặp sách", "ba lô", "balo"], "🎒"],
  ["chair", ["cái ghế", "ghế"], "🪑"],
  ["school", ["trường học", "ngôi trường"], "🏫"],
  ["bread", ["bánh mì", "ổ bánh mì"], "🍞"],
  ["milk", ["sữa", "sữa bò"], "🥛"],
  ["egg", ["quả trứng", "trứng"], "🥚"],
  ["cake", ["bánh ngọt", "bánh kem"], "🍰"],
  ["rice", ["cơm", "gạo"], "🍚"],
  ["pizza", ["bánh pizza", "pizza"], "🍕"],
  ["soup", ["súp", "món súp"], "🍲"],
  ["rainbow", ["cầu vồng"], "🌈"],
  ["sunny", ["trời nắng", "có nắng"], "☀️"],
  ["rainy", ["trời mưa", "có mưa"], "🌧️"],
  ["cloudy", ["trời nhiều mây", "nhiều mây"], "☁️"],
  ["snowy", ["trời có tuyết", "có tuyết"], "❄️"],
  ["red", ["màu đỏ"], "🔴"],
  ["blue", ["màu xanh dương", "màu xanh da trời"], "🔵"],
  ["yellow", ["màu vàng"], "🟡"],
  ["green", ["màu xanh lá", "màu xanh lá cây"], "🟢"],
  ["orange", ["màu cam"], "🟠"],
  ["purple", ["màu tím"], "🟣"],
  ["black", ["màu đen"], "⚫"],
  ["white", ["màu trắng"], "⚪"],
  ["brown", ["màu nâu"], "🟤"],
];

const normalize = (value: string): string => value.normalize("NFKC")
  .trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi-VN");
const key = (word: string, meaningVi: string) => `${normalize(word)}\u0000${normalize(meaningVi)}`;
const emojiBySense = new Map<string, string>();
for (const [word, meanings, emoji] of entries)
  for (const meaning of meanings) emojiBySense.set(key(word, meaning), emoji);

export function suggestOfflineIllustration(word: string, meaningVi: string): VocabularyIllustrationInput {
  const emoji = emojiBySense.get(key(word, meaningVi));
  return emoji ? { kind: "EMOJI", value: emoji } : { kind: "NONE" };
}

/** Only regenerate a suggestion if the current image is absent or still exactly
 * matches the old built-in suggestion. Preserve teacher-picked/uploaded media. */
export function updateOfflineIllustrationAfterTextEdit(
  item: VocabularySetItemInput,
  field: "word" | "meaningVi",
  value: string,
): VocabularySetItemInput {
  const oldSuggested = suggestOfflineIllustration(item.word, item.meaningVi);
  const autoSelected = oldSuggested.kind === "EMOJI"
    && item.illustration.kind === "EMOJI"
    && oldSuggested.value === item.illustration.value;
  const updated = { ...item, [field]: value };
  if (item.illustration.kind !== "NONE" && !autoSelected) return updated;
  const illustration = suggestOfflineIllustration(updated.word, updated.meaningVi);
  return { ...updated, illustration, supportsImageGame: illustration.kind !== "NONE" };
}
