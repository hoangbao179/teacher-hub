import type {
  AssignmentAudienceType,
  AssignmentStatus,
  AssignmentTemplateCode,
  GamePresentation,
  GameMechanic,
} from "@teacher/shared";

export const statusLabels: Record<AssignmentStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã giao",
  CLOSED: "Đã đóng",
};

export const audienceLabels: Record<AssignmentAudienceType, string> = {
  CLASS: "Cả lớp",
  SELECTED_STUDENTS: "Học sinh được chọn",
  OPEN_LINK: "Liên kết mở",
};

export const templateLabels: Record<AssignmentTemplateCode, string> = {
  YOUNG_BEGINNER: "Làm quen từ mới",
  WORD_RECOGNITION: "Nhận diện từ",
  SPELLING_REVIEW: "Ôn chính tả",
  PRE_TEST_REVIEW: "Ôn trước kiểm tra",
  CUSTOM: "Tùy chỉnh",
};

export const gamePresentationLabels: Record<GamePresentation, {
  label: string;
  description: string;
  requiresImages?: boolean;
}> = {
  FLASHCARD: { label: "Khám phá flashcard", description: "Lật thẻ để xem nghĩa và ví dụ." },
  LISTEN_PICK_IMAGE: { label: "Nghe và chọn hình", description: "Nghe từ rồi chọn hình đúng.", requiresImages: true },
  IMAGE_PICK_WORD: { label: "Nhìn hình chọn từ", description: "Nhìn hình rồi chọn từ.", requiresImages: true },
  LISTEN_PICK_WORD: { label: "Nghe và chọn từ", description: "Nghe rồi chọn mặt chữ." },
  WORD_PICK_MEANING: { label: "Nhìn từ chọn nghĩa", description: "Chọn nghĩa tiếng Việt." },
  MEANING_PICK_WORD: { label: "Nhìn nghĩa chọn từ", description: "Chọn từ tiếng Anh." },
  MATCH_WORD_IMAGE: { label: "Ghép từ với hình", description: "Chạm hai phía để ghép.", requiresImages: true },
  MATCH_WORD_MEANING: { label: "Ghép cặp", description: "Ghép từ với nghĩa." },
  MEMORY_WORD_IMAGE: { label: "Lật thẻ hình", description: "Tìm cặp từ và hình.", requiresImages: true },
  MEMORY_WORD_MEANING: { label: "Lật thẻ", description: "Tìm cặp từ và nghĩa." },
  MISSING_LETTER: { label: "Điền chữ thiếu", description: "Chọn một chữ còn thiếu." },
  BUILD_SPELLED_WORD: { label: "Xếp chữ", description: "Xếp toàn bộ chữ thành từ." },
  FEED_MONSTER: { label: "Cho quái vật ăn", description: "Chọn món ăn có đáp án đúng." },
  POP_BALLOON: { label: "Đập bong bóng", description: "Chạm bong bóng đúng." },
  OPEN_TREASURE: { label: "Mở kho báu", description: "Mở rương có đáp án đúng." },
  CHOOSE_TRAIN_CARRIAGE: { label: "Chọn toa tàu", description: "Nối toa đúng vào đầu tàu." },
};

export const gameMechanicLabels: Record<GameMechanic, string> = {
  EXPLORE_CARD: "Khám phá",
  SELECT_ONE: "Chọn đáp án",
  MATCH_PAIRS: "Ghép cặp",
  MEMORY_PAIRS: "Lật thẻ",
  ORDER_TOKENS: "Sắp xếp",
  BUILD_WORD: "Chính tả",
  SORT_ITEMS: "Phân loại",
  REPEAT_AUDIO: "Nghe và nhắc lại",
};

export function formatDateTime(value: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
