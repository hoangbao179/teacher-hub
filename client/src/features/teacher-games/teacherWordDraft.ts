import type { AssignmentVocabularyItemInput, VocabularyPastePreview } from "@teacher/shared";
import { suggestOfflineIllustration } from "../vocabulary/offlineIllustrations.ts";
import { parseVocabularyPaste } from "../vocabulary/vocabularyEditor.ts";

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\\s+/gu, " ").toLocaleLowerCase("vi-VN");
const key = (word: string, meaning: string) => `${normalize(word)}\\u0000${normalize(meaning)}`;

export interface TeacherWordRow {
  id: number;
  word: string;
  meaningVi: string;
}

export interface TeacherWordDraft {
  preview: VocabularyPastePreview;
  items: AssignmentVocabularyItemInput[];
  duplicateLines: number[];
  errors: string[];
}

type WordPairInput = Pick<TeacherWordRow, "word" | "meaningVi"> & { sourceLine?: number };
type RowsResult = Pick<TeacherWordDraft, "items" | "duplicateLines" | "errors">;

/** Editable pairs are the source of truth. Ignore entirely blank rows in drafts;
 * reject half-filled rows, repeated pairs and >40 words rather than dropping input.
 * Preserve teacher-selected media only when both word and meaning match exactly. */
export function teacherWordsFromRows(
  rows: readonly WordPairInput[],
  previous: readonly AssignmentVocabularyItemInput[] = [],
): RowsResult {
  const prior = new Map(previous.map((item) => [key(item.word, item.meaningVi), item]));
  const duplicates = new Set<string>();
  const duplicateLines: number[] = [];
  const incompleteLines: number[] = [];
  const items: AssignmentVocabularyItemInput[] = [];
  rows.forEach((row, index) => {
    const word = row.word.trim();
    const meaningVi = row.meaningVi.trim();
    const line = row.sourceLine ?? index + 1;
    if (!word && !meaningVi) return;
    if (!word || !meaningVi) {
      incompleteLines.push(line);
      return;
    }
    const normalized = key(word, meaningVi);
    if (duplicates.has(normalized)) duplicateLines.push(line);
    duplicates.add(normalized);
    const existing = prior.get(normalized);
    const illustration = existing?.illustration ?? suggestOfflineIllustration(word, meaningVi);
    items.push({
      ...existing,
      displayOrder: items.length + 1,
      word,
      meaningVi,
      speechText: existing?.speechText ?? word,
      tier: existing?.tier ?? "CUSTOM",
      illustration,
      supportsImageGame: illustration.kind !== "NONE",
    });
  });
  const errors: string[] = [];
  if (incompleteLines.length)
    errors.push(`Chưa đủ từ và nghĩa tiếng Việt ở dòng ${incompleteLines.join(", ")}.`);
  if (duplicateLines.length)
    errors.push(`Từ bị lặp ở dòng ${duplicateLines.join(", ")}. Hãy sửa trước khi lưu.`);
  if (items.length > 40) errors.push("Mỗi bài được dùng tối đa 40 từ.");
  return { items, duplicateLines, errors };
}

/** Bulk Word/Excel paste remains supported when copied directly into a word input. */
export function teacherWordsFromPaste(
  pasted: string,
  previous: readonly AssignmentVocabularyItemInput[] = [],
): TeacherWordDraft {
  const preview = parseVocabularyPaste(pasted);
  return { preview, ...teacherWordsFromRows(preview.rows, previous) };
}

export function teacherWordRowsFromItems(
  items: readonly Pick<AssignmentVocabularyItemInput, "word" | "meaningVi">[],
): TeacherWordRow[] {
  return items.map((item, index) => ({
    id: index + 1, word: item.word, meaningVi: item.meaningVi,
  }));
}

export function teacherWordsToPaste(items: readonly Pick<AssignmentVocabularyItemInput, "word" | "meaningVi">[]): string {
  return items.map((item) => `${item.word}\\t${item.meaningVi}`).join("\\n");
}
