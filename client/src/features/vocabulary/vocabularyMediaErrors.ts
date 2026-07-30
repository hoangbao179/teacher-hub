import { ApiError } from "../../api/client";

const messages: Record<string, string> = {
  VOCABULARY_SEARCH_RATE_LIMITED: "Bạn đã tìm ảnh quá nhanh. Vui lòng chờ rồi tiếp tục batch còn lại.",
  IMAGE_PROVIDER_RATE_LIMITED: "Nguồn ảnh đang giới hạn tần suất. Các từ chưa xử lý vẫn được giữ nguyên.",
  IMAGE_IMPORT_SOURCE_RATE_LIMITED: "Nguồn tải ảnh đang giới hạn. Bạn có thể chờ hoặc dùng Tải ảnh từ máy.",
  VOCABULARY_IMPORT_RATE_LIMITED: "Bạn đã nhập ảnh quá nhanh. Vui lòng chờ trước khi chọn ảnh tiếp theo.",
};

export function vocabularyMediaErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof ApiError && messages[value.code]) return messages[value.code];
  return value instanceof Error ? value.message : fallback;
}

export function vocabularyMediaCooldownSeconds(value: unknown): number | undefined {
  return value instanceof ApiError && value.status === 429
    ? Math.max(1, value.retryAfterSeconds ?? 60)
    : undefined;
}
