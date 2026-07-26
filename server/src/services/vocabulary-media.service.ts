import { createHash } from "node:crypto";
import type {
  ImportVocabularyMediaRequest,
  VocabularyImageMediaType,
  VocabularyImageOrientation,
  VocabularyImageProvider,
  VocabularyMediaSearchQuery,
  VocabularyMediaSearchResponse,
} from "@teacher/shared";
import {
  vocabularyImageMediaTypes,
  vocabularyImageOrientations,
  vocabularyImageProviders,
} from "@teacher/shared";
import { AppError } from "../errors/app-error";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import type { ImageSearchProvider } from "../integrations/images/image-search.provider";
import { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { SecureImageDownloader } from "./secure-image-downloader";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";

export function normalizeImageQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export class VocabularyMediaService {
  constructor(
    private readonly repository: VocabularyMediaRepository,
    private readonly provider: ImageSearchProvider | null,
    private readonly settings: VocabularyMediaSettings,
    private readonly downloader = new SecureImageDownloader(settings),
    private readonly storage = new VocabularyMediaStorage(settings.storagePath),
    private readonly now: () => Date = () => new Date(),
  ) {}

  initialize(): Promise<void> {
    return this.storage.initialize();
  }

  async search(raw: VocabularyMediaSearchQuery): Promise<VocabularyMediaSearchResponse> {
    this.ensureEnabled();
    const query = normalizeImageQuery(raw.query ?? "");
    if (query.length < 2 || query.length > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Từ khóa ảnh phải dài từ 2 đến 100 ký tự.");
    const page = this.integer(raw.page, 1, 1, 1000, "Trang");
    const pageSize = this.integer(raw.pageSize, 8, 3, 50, "Số ảnh mỗi trang");
    const mediaType = (raw.mediaType ?? "ALL") as VocabularyImageMediaType;
    const orientation = (raw.orientation ?? "ALL") as VocabularyImageOrientation;
    if (!vocabularyImageMediaTypes.includes(mediaType) ||
      !vocabularyImageOrientations.includes(orientation))
      throw new AppError(400, "VALIDATION_ERROR", "Bộ lọc ảnh không hợp lệ.");
    const provider = this.provider!;
    const cacheKey = createHash("sha256").update(JSON.stringify({
      provider: provider.name,
      query,
      mediaType,
      orientation,
      page,
      pageSize,
    })).digest("hex");
    const now = this.now();
    let cached = await this.repository.findCache(provider.name, cacheKey, now);
    if (!cached) {
      let payload;
      try {
        payload = await provider.search({
          query,
          page,
          pageSize,
          mediaType,
          orientation,
          safeSearch: true,
        });
      } catch (error) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "vocabulary_image_provider_failed",
          provider: provider.name,
          category: error instanceof AppError ? error.code : "UNEXPECTED",
        }));
        throw error;
      }
      const expiresAt = new Date(now.getTime() + this.settings.cacheTtlMs);
      await this.repository.saveCache({
        provider: provider.name,
        cacheKey,
        normalizedQuery: query,
        mediaType,
        orientation,
        page,
        pageSize,
        payload,
        expiresAt,
      });
      cached = { payload, expiresAt };
    }
    return {
      provider: provider.name,
      safeSearch: true,
      cacheExpiresAt: cached.expiresAt.toISOString(),
      page,
      pageSize,
      total: cached.payload.total,
      items: cached.payload.items.map((item) => ({
        provider: item.provider,
        providerAssetId: item.providerAssetId,
        previewUrl: item.previewUrl,
        thumbnailUrl: item.thumbnailUrl,
        width: item.width,
        height: item.height,
        mediaType: item.mediaType,
        contributorName: item.contributorName,
        attributionText: item.attributionText,
        sourcePageUrl: item.sourcePageUrl,
      })),
    };
  }

  async importMedia(input: ImportVocabularyMediaRequest, actorUserId: number) {
    this.ensureEnabled();
    if (await this.storage.backupLocked())
      throw new AppError(
        503,
        "VOCABULARY_MEDIA_BACKUP_IN_PROGRESS",
        "Kho ảnh đang được sao lưu. Hãy thử lại sau.",
      );
    if (!Number.isInteger(actorUserId) || actorUserId < 1)
      throw new AppError(401, "UNAUTHORIZED", "Chưa xác thực.");
    if (!vocabularyImageProviders.includes(input.provider) ||
        input.provider !== this.provider?.name)
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn ảnh không hợp lệ.");
    const providerAssetId = String(input.providerAssetId ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(providerAssetId))
      throw new AppError(400, "VALIDATION_ERROR", "Mã ảnh không hợp lệ.");
    const altText = String(input.altText ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (altText.length < 1 || altText.length > 200)
      throw new AppError(400, "VALIDATION_ERROR", "Mô tả ảnh phải dài từ 1 đến 200 ký tự.");
    const existing = await this.repository.findMedia(input.provider, providerAssetId);
    if (existing) return existing;
    const asset = await this.repository.findCachedAsset(input.provider, providerAssetId, this.now());
    if (!asset)
      throw new AppError(
        409,
        "IMAGE_CACHE_MISS",
        "Kết quả tìm kiếm đã hết hạn. Hãy tìm lại ảnh trước khi chọn.",
      );
    const processed = await this.downloader.download(
      asset.downloadUrl,
      this.provider!.allowedDownloadHosts,
    );
    const files = await this.storage.write(processed.game, processed.thumbnail);
    try {
      const result = await this.repository.createMedia({
        provider: input.provider,
        asset,
        storagePath: files.storagePath,
        thumbnailPath: files.thumbnailPath,
        altText,
        byteSize: processed.byteSize,
        width: processed.width,
        height: processed.height,
        contentSha256: processed.contentSha256,
      }, actorUserId);
      if (!result.created)
        await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      return result.media;
    } catch (error) {
      await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      throw error;
    }
  }

  async mediaFile(id: number, variant: string | undefined) {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    if (variant != null && !["GAME", "THUMBNAIL"].includes(variant))
      throw new AppError(400, "VALIDATION_ERROR", "Phiên bản ảnh không hợp lệ.");
    const record = await this.repository.findMediaRecord(id);
    if (!record)
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    try {
      return {
        path: this.storage.resolve(
          variant === "THUMBNAIL" ? record.thumbnailPath : record.storagePath,
        ),
        media: record.media,
      };
    } catch {
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    }
  }

  providerStatus() {
    return {
      enabled: Boolean(this.settings.enabled && this.provider),
      provider: "PIXABAY" as const,
    };
  }

  private ensureEnabled(): void {
    if (!this.settings.enabled || !this.provider)
      throw new AppError(
        503,
        "IMAGE_PROVIDER_DISABLED",
        "Tìm ảnh đang tắt. Bạn vẫn có thể dùng emoji hoặc ảnh của Unit công khai.",
      );
  }

  private integer(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
    label: string,
  ): number {
    const result = value ?? fallback;
    if (!Number.isInteger(result) || result < min || result > max)
      throw new AppError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
    return result;
  }
}
