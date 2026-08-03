import { isAllowedInteractiveAudioUrl } from "../content/publicBookCatalog.ts";
import type { BookType } from "../types.ts";

export type BookViewerKind = "INTERACTIVE" | "OFFICIAL";

export function selectBookViewer({
  bookType,
  interactiveAudioUrl,
  isDesktop,
}: {
  bookType: BookType;
  interactiveAudioUrl?: string;
  isDesktop: boolean;
}): BookViewerKind {
  return bookType === "STUDENT_BOOK"
    && Boolean(interactiveAudioUrl && isAllowedInteractiveAudioUrl(interactiveAudioUrl))
    && isDesktop
    ? "INTERACTIVE"
    : "OFFICIAL";
}
