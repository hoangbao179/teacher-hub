import { createHash } from "node:crypto";
import sharp from "sharp";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import { AppError } from "../errors/app-error";

export interface ProcessedImage {
  game: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  byteSize: number;
  totalByteSize: number;
  contentSha256: string;
}

const acceptedMime = ["image/jpeg", "image/png", "image/webp"] as const;
const retryableStatuses = new Set([502, 503, 504]);

function allowedHost(hostname: string, hosts: readonly string[]): boolean {
  const normalized = hostname.toLowerCase();
  return hosts.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function sniff(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function validation(code: string, message: string): AppError {
  return new AppError(422, code, message);
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export async function processVocabularyImage(
  input: Buffer,
  declaredMime: string | undefined,
  settings: VocabularyMediaSettings,
): Promise<ProcessedImage> {
  if (input.byteLength > settings.maxBytes)
    throw validation("IMAGE_IMPORT_TOO_LARGE", "Ảnh vượt quá 5 MiB.");
  const detected = sniff(input);
  if (!detected)
    throw validation("IMAGE_IMPORT_INVALID_CONTENT_TYPE", "Định dạng ảnh không được hỗ trợ.");
  if (declaredMime && declaredMime !== `image/${detected}`)
    throw validation("IMAGE_IMPORT_CONTENT_MISMATCH", "MIME ảnh không khớp nội dung thực.");
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: settings.maxPixels }).metadata();
  } catch {
    throw validation("IMAGE_IMPORT_INVALID_CONTENT_TYPE", "Không thể giải mã nội dung ảnh.");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < settings.minDimension || height < settings.minDimension ||
      width > settings.maxDimension || height > settings.maxDimension || width * height > settings.maxPixels)
    throw validation("IMAGE_IMPORT_INVALID_DIMENSIONS", "Kích thước ảnh phải từ 256–4096 px và không quá 16 MP.");
  const [game, thumbnail] = await Promise.all([
    sharp(input).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer(),
    sharp(input).rotate().resize(320, 320, { fit: "cover", position: "attention" })
      .webp({ quality: 76 }).toBuffer(),
  ]);
  const gameMetadata = await sharp(game).metadata();
  return {
    game,
    thumbnail,
    width: gameMetadata.width ?? width,
    height: gameMetadata.height ?? height,
    byteSize: game.byteLength,
    totalByteSize: game.byteLength + thumbnail.byteLength,
    contentSha256: createHash("sha256").update(game).digest("hex"),
  };
}

export class SecureImageDownloader {
  constructor(
    private readonly settings: VocabularyMediaSettings,
    private readonly fetcher: typeof fetch = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
  ) {}

  async download(urlValue: string, allowedHosts: readonly string[]): Promise<ProcessedImage> {
    const deadline = Date.now() + this.settings.timeoutMs + 500;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.downloadOnce(urlValue, allowedHosts, Math.max(1, deadline - Date.now()));
      } catch (error) {
        lastError = error;
        if (error instanceof AppError && error.code === "IMAGE_IMPORT_SOURCE_RATE_LIMITED") throw error;
        const upstreamStatus = error instanceof AppError && typeof error.details === "object" &&
          error.details && "upstreamStatus" in error.details
          ? Number((error.details as { upstreamStatus?: unknown }).upstreamStatus) : undefined;
        const retryable = error instanceof AppError && (error.code === "IMAGE_IMPORT_TIMEOUT" ||
          (error.code === "IMAGE_IMPORT_SOURCE_UNAVAILABLE" && upstreamStatus !== undefined && retryableStatuses.has(upstreamStatus)));
        if (!retryable || attempt === 1) throw error;
        const retryMs = Math.min(250, Math.max(0, deadline - Date.now() - 1));
        if (retryMs <= 0) throw error;
        await this.sleep(retryMs);
      }
    }
    throw lastError;
  }

  private async downloadOnce(
    urlValue: string,
    allowedHosts: readonly string[],
    timeoutMs: number,
  ): Promise<ProcessedImage> {
    let current: URL;
    try { current = new URL(urlValue); }
    catch { throw validation("IMAGE_IMPORT_UNSAFE_REDIRECT", "Địa chỉ ảnh không hợp lệ."); }
    let response: Response | null = null;
    for (let redirect = 0; redirect <= this.settings.maxRedirects; redirect += 1) {
      if (current.protocol !== "https:" || !allowedHost(current.hostname, allowedHosts))
        throw validation("IMAGE_IMPORT_UNSAFE_REDIRECT", "Máy chủ ảnh không nằm trong danh sách cho phép.");
      try {
        response = await this.fetcher(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(Math.min(this.settings.timeoutMs, timeoutMs)),
          headers: { Accept: acceptedMime.join(",") },
        });
      } catch {
        throw new AppError(504, "IMAGE_IMPORT_TIMEOUT", "Tải ảnh quá thời gian cho phép.");
      }
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirect === this.settings.maxRedirects)
        throw validation("IMAGE_IMPORT_UNSAFE_REDIRECT", "Ảnh chuyển hướng không an toàn.");
      current = new URL(location, current);
    }
    if (response?.status === 429) {
      const wait = retryAfterMs(response);
      throw new AppError(429, "IMAGE_IMPORT_SOURCE_RATE_LIMITED", "Nguồn ảnh đang giới hạn tần suất.", undefined,
        wait === undefined ? 60 : Math.max(1, Math.ceil(wait / 1_000)));
    }
    if (!response?.ok || !response.body) {
      const status = response?.status;
      throw new AppError(502, "IMAGE_IMPORT_SOURCE_UNAVAILABLE", "Nguồn ảnh tạm thời không khả dụng.",
        typeof status === "number" ? { upstreamStatus: status } : undefined,
        status && retryableStatuses.has(status) ? 1 : undefined);
    }
    const declared = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!acceptedMime.includes(declared as typeof acceptedMime[number]))
      throw validation("IMAGE_IMPORT_INVALID_CONTENT_TYPE", "Định dạng ảnh không được hỗ trợ.");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.settings.maxBytes)
      throw validation("IMAGE_IMPORT_TOO_LARGE", "Ảnh vượt quá 5 MiB.");
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > this.settings.maxBytes) {
        await reader.cancel();
        throw validation("IMAGE_IMPORT_TOO_LARGE", "Ảnh vượt quá 5 MiB.");
      }
      chunks.push(Buffer.from(value));
    }
    return processVocabularyImage(Buffer.concat(chunks), declared, this.settings);
  }
}
