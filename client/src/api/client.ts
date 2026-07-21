import type { ApiEnvelope } from "@teacher/shared";
import { clearToken, getToken } from "../auth/authStorage";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
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
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  if (response.status === 401 && path !== "/api/auth/login") {
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
    );
  return payload;
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối máy chủ để tải báo cáo. Vui lòng thử lại.");
  }
  if (response.status === 401) {
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
    filename: encoded ? decodeURIComponent(encoded) : (fallback ?? "bao-cao-hoc-sinh.xlsx"),
  };
}
