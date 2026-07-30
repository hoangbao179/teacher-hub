import { ApiError } from "../../api/client";

const messages: Record<string, string> = {
  VOCABULARY_SEARCH_RATE_LIMITED: "Bạn đã tìm ảnh quá nhanh. Vui lòng chờ rồi tiếp tục batch còn lại.",
  IMAGE_PROVIDER_RATE_LIMITED: "Nguồn ảnh đang giới hạn tần suất. Các từ chưa xử lý vẫn được giữ nguyên.",
  IMAGE_IMPORT_SOURCE_RATE_LIMITED: "Nguồn tải ảnh đang giới hạn. Bạn có thể chờ hoặc dùng Tải ảnh từ máy.",
  VOCABULARY_IMPORT_RATE_LIMITED: "Bạn đã nhập ảnh quá nhanh. Vui lòng chờ trước khi chọn ảnh tiếp theo.",
  IMAGE_PROVIDER_UNAVAILABLE: "Nguồn hình minh họa đang tạm gián đoạn. Các từ chưa tìm vẫn được giữ lại.",
};

export function vocabularyMediaErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof ApiError && messages[value.code]) return messages[value.code];
  return value instanceof Error ? value.message : fallback;
}

export function vocabularyMediaCooldownSeconds(value: unknown): number | undefined {
  if (!(value instanceof ApiError)) return undefined;
  if (value.status === 429) return Math.max(1, value.retryAfterSeconds ?? 60);
  if (value.code === "IMAGE_PROVIDER_UNAVAILABLE")
    return Math.max(1, value.retryAfterSeconds ?? 30);
  return undefined;
}
