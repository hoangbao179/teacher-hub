import { learningLevels, levelBySlug, publishedUnits, unitBySlugs } from "../content/vocabularyCatalog.ts";

const SITE_URL = "https://tienganhcovy.com";

export const stableLearningPathnames = [
  "/hoc",
  ...learningLevels.filter((level) => level.available).map((level) => `/hoc/${level.slug}`),
  ...publishedUnits.map((unit) => `/hoc/${unit.levelSlug}/${unit.slug}`),
];

export interface LearningRouteMetadata {
  title: string;
  description: string;
  robots: string;
  canonical?: string;
  valid: boolean;
}

export function learningRouteMetadata(pathname: string): LearningRouteMetadata {
  const segments = pathname.split("/").filter(Boolean);
  const level = segments.length >= 2 ? levelBySlug(segments[1]) : undefined;
  const unit = segments.length >= 3 ? unitBySlugs(segments[1], segments[2]) : undefined;
  const action = segments[3];
  const validAction = segments.length === 4 && ["flashcards", "listen", "quiz", "result", "review"].includes(action);
  const valid = pathname === "/hoc"
    || (segments.length === 2 && Boolean(level?.available))
    || (segments.length === 3 && Boolean(unit))
    || (validAction && Boolean(unit));
  if (!valid) return { title: "Không tìm thấy bài học | Lớp tiếng Anh cô Vy", description: "Bài học hoặc cấp độ này không tồn tại.", robots: "noindex,follow", valid: false };
  const description = unit
    ? `Học từ vựng chủ đề ${unit.title} bằng flashcard và luyện tập miễn phí cùng cô Vy.`
    : level ? `Chọn chủ đề từ vựng ${level.name} và học miễn phí cùng cô Vy.` : "Chọn cấp độ từ mầm non đến lớp 9 và học từ vựng tiếng Anh miễn phí cùng cô Vy.";
  const actionTitle: Record<string, string> = { flashcards: "Flashcard", listen: "Luyện nghe", quiz: "Luyện tập", result: "Kết quả", review: "Ôn từ" };
  const title = unit ? `${actionTitle[action] ? `${actionTitle[action]} · ` : ""}${unit.title} | Góc học tiếng Anh cùng cô Vy` : level ? `${level.name} | Góc học tiếng Anh cùng cô Vy` : "Góc học tiếng Anh miễn phí cùng cô Vy";
  const noindex = Boolean(action);
  return { title, description, robots: noindex ? "noindex,follow" : "index,follow,max-image-preview:large", canonical: `${SITE_URL}${pathname}`, valid: true };
}
