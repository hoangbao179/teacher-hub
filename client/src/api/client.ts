import type { ApiEnvelope } from "@teacher/shared";
import { PDF_OUTPUT_MAX_BYTES } from "@teacher/shared";
import { clearToken, getToken } from "../auth/authStorage";
import { parseRetryAfterSeconds } from "../auth/retryAfter";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
let unauthorizedHandler: (() => void) | null = null;

export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await apiEnvelope<T>(path, options)).data;
}

export async function apiEnvelope<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  if (response.status === 401 && path !== "/api/auth/login" && !path.startsWith("/api/public/pdf/")) {
    clearToken();
    unauthorizedHandler?.();
  }
  if (response.status === 204) return { data: undefined as T };
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & {
    error?: { code: string; message: string };
  };
  if (!response.ok)
    throw new ApiError(
      response.status,
      payload.error?.code ?? "API_ERROR",
      payload.error?.message ?? "Có lỗi xảy ra.",
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
    );
  return payload;
}

export async function apiDownload(path: string, fallbackFilename = "bao-cao-hoc-sinh.xlsx"): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ để tải báo cáo. Vui lòng thử lại.");
  }
  if (response.status === 401 && !path.startsWith("/api/public/pdf/")) {
    clearToken();
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    throw new ApiError(response.status, payload.error?.code ?? "DOWNLOAD_ERROR", payload.error?.message ?? "Không thể tải báo cáo.");
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const fallback = disposition.match(/filename="([^"]+)"/i)?.[1];
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : (fallback ?? fallbackFilename),
  };
}

/** Authenticated binary POST for one-use PDF tickets. Never send secrets in URLs. */
export async function apiPostPdfBlob(path: string, payload: unknown, signal?: AbortSignal): Promise<Blob> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ để tải PDF.");
  }
  if (response.status === 401 && !path.startsWith("/api/public/pdf/")) {
    clearToken();
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new ApiError(response.status, error.error?.code ?? "PDF_DOWNLOAD_UNAVAILABLE",
      error.error?.message ?? "Không thể tải PDF.");
  }
  if (!response.body || !response.headers.get("content-type")?.toLowerCase().startsWith("application/pdf")) {
    await response.body?.cancel();
    throw new ApiError(502, "PDF_INVALID_DOWNLOAD", "Tệp trả về không phải PDF.");
  }
  const maxBytes = PDF_OUTPUT_MAX_BYTES;
  const reported = Number(response.headers.get("content-length"));
  if (reported > maxBytes) {
    await response.body.cancel();
    throw new ApiError(502, "PDF_DOWNLOAD_TOO_LARGE", "Tệp PDF vượt giới hạn cho phép.");
  }
  const reader = response.body.getReader();
  let count = 0;
  const chunks: BlobPart[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) throw new ApiError(502, "PDF_DOWNLOAD_TOO_LARGE", "Tệp PDF vượt giới hạn cho phép.");
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "PDF_DOWNLOAD_INTERRUPTED", "Tải PDF bị gián đoạn. Vui lòng thử lại.");
  } finally { reader.releaseLock(); }
  if (!count || (Number.isFinite(reported) && reported > 0 && count !== reported)) {
    throw new ApiError(502, "PDF_DOWNLOAD_INTERRUPTED", "Tệp PDF tải xuống không đầy đủ.");
  }
  return new Blob(chunks, { type: "application/pdf" });
}
