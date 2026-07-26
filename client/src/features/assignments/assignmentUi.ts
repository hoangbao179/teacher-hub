import type {
  AssignmentAudienceType,
  AssignmentStatus,
  AssignmentTemplateCode,
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

export function formatDateTime(value: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
