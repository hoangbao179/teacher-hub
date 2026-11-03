import type { AssignmentVocabularyItemInput, VocabularyPastePreview } from "@teacher/shared";
import { suggestOfflineIllustration } from "../../vocabulary/offlineIllustrations.ts";
import { parseVocabularyPaste } from "../../vocabulary/vocabularyEditor.ts";

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi-VN");
const key = (word: string, meaning: string) => `${normalize(word)}\u0000${normalize(meaning)}`;

export interface TeacherWordDraft {
  preview: VocabularyPastePreview;
  items: AssignmentVocabularyItemInput[];
  duplicateLines: number[];
  errors: string[];
}

/** Preserve teacher-selected images and per-word metadata when the original
 * word + meaning is unchanged; never infer a changed sense from English alone. */
export function teacherWordsFromPaste(
  pasted: string,
  previous: readonly AssignmentVocabularyItemInput[] = [],
): TeacherWordDraft {
  const preview = parseVocabularyPaste(pasted);
  const prior = new Map(previous.map((item) => [key(item.word, item.meaningVi), item]));
  const duplicates = new Set<string>();
  const duplicateLines: number[] = [];
  const items: AssignmentVocabularyItemInput[] = [];
  for (const row of preview.rows) {
    if (!row.valid) continue;
    const normalized = key(row.word, row.meaningVi);
    if (duplicates.has(normalized)) duplicateLines.push(row.sourceLine);
    duplicates.add(normalized);
    const existing = prior.get(normalized);
    const illustration = existing?.illustration ?? suggestOfflineIllustration(row.word, row.meaningVi);
    items.push({
      ...existing,
      displayOrder: items.length + 1,
      word: row.word,
      meaningVi: row.meaningVi,
      speechText: existing?.speechText ?? row.word,
      tier: existing?.tier ?? "CUSTOM",
      illustration,
      supportsImageGame: illustration.kind !== "NONE",
    });
  }
  const errors: string[] = [];
  if (preview.invalidCount) errors.push(`${preview.invalidCount} dòng chưa đủ từ và nghĩa tiếng Việt.`);
  if (duplicateLines.length) errors.push(`Từ bị lặp ở dòng ${duplicateLines.join(", ")}. Hãy sửa trước khi lưu.`);
  if (items.length < 2) errors.push("Một bài cần ít nhất 2 từ.");
  if (items.length > 40) errors.push("Mỗi bài được dùng tối đa 40 từ.");
  return { preview, items, duplicateLines, errors };
}

export function teacherWordsToPaste(items: readonly Pick<AssignmentVocabularyItemInput, "word" | "meaningVi">[]): string {
  return items.map((item) => `${item.word}\t${item.meaningVi}`).join("\n");
}
