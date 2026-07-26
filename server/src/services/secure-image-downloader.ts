import sharp from "sharp";
import { AppError } from "../errors/app-error";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";

export interface ProcessedImage {
  game: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  byteSize: number;
  contentSha256: string;
}

function allowedHost(hostname: string, hosts: readonly string[]): boolean {
  const normalized = hostname.toLowerCase();
  return hosts.some((host) =>
    normalized === host || normalized.endsWith(`.${host}`));
}

function sniff(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export class SecureImageDownloader {
  constructor(
    private readonly settings: VocabularyMediaSettings,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async download(urlValue: string, allowedHosts: readonly string[]): Promise<ProcessedImage> {
    let current = new URL(urlValue);
    let response: Response | null = null;
    for (let redirect = 0; redirect <= this.settings.maxRedirects; redirect += 1) {
      if (current.protocol !== "https:" || !allowedHost(current.hostname, allowedHosts))
        throw this.rejected("Máy chủ ảnh không nằm trong danh sách cho phép.");
      try {
        response = await this.fetcher(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(this.settings.timeoutMs),
          headers: { Accept: "image/jpeg,image/png,image/webp" },
        });
      } catch {
        throw this.rejected("Tải ảnh quá thời gian cho phép.");
      }
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirect === this.settings.maxRedirects)
        throw this.rejected("Ảnh chuyển hướng quá số lần cho phép.");
      current = new URL(location, current);
    }
    if (!response?.ok || !response.body)
      throw this.rejected("Không tải được ảnh đã chọn.");
    const declared = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(declared ?? ""))
      throw this.rejected("Định dạng ảnh không được hỗ trợ.");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.settings.maxBytes)
      throw this.rejected("Ảnh vượt quá 5 MiB.");

    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > this.settings.maxBytes) {
        await reader.cancel();
        throw this.rejected("Ảnh vượt quá 5 MiB.");
      }
      chunks.push(Buffer.from(value));
    }
    const input = Buffer.concat(chunks);
    const detected = sniff(input);
    if (!detected || declared !== `image/${detected}`)
      throw this.rejected("MIME ảnh không khớp nội dung thực.");
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { limitInputPixels: this.settings.maxPixels }).metadata();
    } catch {
      throw this.rejected("Không thể xác minh nội dung ảnh.");
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < this.settings.minDimension || height < this.settings.minDimension ||
      width > this.settings.maxDimension || height > this.settings.maxDimension ||
      width * height > this.settings.maxPixels)
      throw this.rejected("Kích thước ảnh phải từ 256–4096 px và không quá 16 MP.");
    const gamePipeline = sharp(input).rotate().resize(1024, 1024, {
      fit: "inside",
      withoutEnlargement: true,
    }).webp({ quality: 82 });
    const thumbPipeline = sharp(input).rotate().resize(320, 320, {
      fit: "cover",
      position: "attention",
    }).webp({ quality: 76 });
    const [game, thumbnail] = await Promise.all([
      gamePipeline.toBuffer(),
      thumbPipeline.toBuffer(),
    ]);
    const gameMetadata = await sharp(game).metadata();
    return {
      game,
      thumbnail,
      width: gameMetadata.width ?? width,
      height: gameMetadata.height ?? height,
      byteSize: game.byteLength,
      contentSha256: await import("node:crypto").then(({ createHash }) =>
        createHash("sha256").update(game).digest("hex")),
    };
  }

  private rejected(message: string): AppError {
    return new AppError(422, "IMAGE_IMPORT_REJECTED", message);
  }
}
