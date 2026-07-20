import type { ApiEnvelope } from "@teacher/shared";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

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
  const token = localStorage.getItem("teacher-token");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { code: string; message: string };
  };
  if (!response.ok)
    throw new ApiError(
      response.status,
      payload.error?.code ?? "API_ERROR",
      payload.error?.message ?? "Có lỗi xảy ra.",
    );
  return payload.data;
}
