export type GoogleFailureCode = "INTEGRATION_DISABLED" | "AUTH_REQUIRED" | "PERMISSION_DENIED" |
  "ROOT_FOLDER_MISSING" | "SPREADSHEET_MISSING" | "RATE_LIMITED" | "NETWORK" | "MALFORMED_TEMPLATE" | "UNKNOWN";

export class GoogleIntegrationError extends Error {
  constructor(public readonly failureCode: GoogleFailureCode, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "GoogleIntegrationError";
  }
}

export function classifyGoogleError(
  error: unknown,
  missingResource: "ROOT_FOLDER_MISSING" | "SPREADSHEET_MISSING" = "SPREADSHEET_MISSING",
): GoogleIntegrationError {
  if (error instanceof GoogleIntegrationError) return error;
  const candidate = error as { code?: number | string; response?: { status?: number }; message?: string };
  const status = Number(candidate.response?.status ?? candidate.code ?? 0);
  const message = String(candidate.message ?? "");
  if (/invalid_grant/i.test(message)) return new GoogleIntegrationError("AUTH_REQUIRED", "Kết nối Google đã hết hiệu lực. Hãy cấp quyền lại.", false);
  if (status === 401) return new GoogleIntegrationError("AUTH_REQUIRED", "Google yêu cầu cấp quyền lại.", false);
  if (status === 403 && /rateLimitExceeded|userRateLimitExceeded|quota.*(?:temporary|temporarily)/i.test(message))
    return new GoogleIntegrationError("RATE_LIMITED", "Google đang giới hạn tần suất. Vui lòng thử lại sau.", true);
  if (status === 403) return new GoogleIntegrationError("PERMISSION_DENIED", "Tài khoản Google không có quyền với thư mục đã cấu hình.", false);
  if (status === 404) return missingResource === "ROOT_FOLDER_MISSING"
    ? new GoogleIntegrationError("ROOT_FOLDER_MISSING", "Không tìm thấy thư mục Google Drive đã cấu hình.", false)
    : new GoogleIntegrationError("SPREADSHEET_MISSING", "Không tìm thấy Google Sheet đã liên kết.", false);
  if (status === 429) return new GoogleIntegrationError("RATE_LIMITED", "Google đang giới hạn tần suất. Vui lòng thử lại sau.", true);
  if (status >= 500 || /timeout|network|ECONN|ENOTFOUND/i.test(message))
    return new GoogleIntegrationError("NETWORK", "Không thể kết nối Google. Vui lòng thử lại.", true);
  return new GoogleIntegrationError("UNKNOWN", "Không thể tạo Google Sheet. Vui lòng kiểm tra cấu hình và thử lại.", false);
}
