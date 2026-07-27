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
import { StaticImageProviderRegistry, type ImageProviderRegistry, type ImageSearchProvider } from "../integrations/images/image-search.provider";
import { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { SecureImageDownloader } from "./secure-image-downloader";
import { processVocabularyImage } from "./secure-image-downloader";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";
import { InMemoryProviderRateCoordinator, type ProviderRateCoordinator } from "../integrations/images/provider-rate-coordinator";

export function normalizeImageQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export class VocabularyMediaService {
  private lifecycleTimer?: ReturnType<typeof setInterval>;
  private readonly registry: ImageProviderRegistry;
  private readonly provider: ImageSearchProvider | null;
  constructor(
    private readonly repository: VocabularyMediaRepository,
    providerOrRegistry: ImageSearchProvider | ImageProviderRegistry | null,
    private readonly settings: VocabularyMediaSettings,
    private readonly downloader = new SecureImageDownloader(settings),
    private readonly storage = new VocabularyMediaStorage(settings.storagePath),
    private readonly now: () => Date = () => new Date(),
    private readonly coordinator: ProviderRateCoordinator = new InMemoryProviderRateCoordinator(),
  ) {
    this.registry = providerOrRegistry && "get" in providerOrRegistry
      ? providerOrRegistry
      : new StaticImageProviderRegistry(providerOrRegistry ? [providerOrRegistry] : []);
    this.provider = this.registry.primary("ILLUSTRATION");
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    if (process.env.NODE_ENV === "test" || this.lifecycleTimer) return;
    const run = async () => {
      try { await this.cleanupOrphans(); await this.reconcile(); }
      catch (error) { console.error(JSON.stringify({ level: "error", event: "vocabulary_media_lifecycle_failed", error: error instanceof Error ? error.name : "UnknownError" })); }
    };
    void run();
    this.lifecycleTimer = globalThis.setInterval(() => { void run(); }, 6 * 60 * 60 * 1_000);
    this.lifecycleTimer.unref?.();
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
        payload = await this.coordinator.run(provider.name, () => provider.search({
          query,
          page,
          pageSize,
          mediaType,
          orientation,
          safeSearch: true,
        }));
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
    const importProvider = this.registry.get(input.provider);
    if (!vocabularyImageProviders.includes(input.provider) || !importProvider)
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn ảnh không hợp lệ.");
    const providerAssetId = String(input.providerAssetId ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(providerAssetId))
      throw new AppError(400, "VALIDATION_ERROR", "Mã ảnh không hợp lệ.");
    const altText = String(input.altText ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (altText.length < 1 || altText.length > 200)
      throw new AppError(400, "VALIDATION_ERROR", "Mô tả ảnh phải dài từ 1 đến 200 ký tự.");
    const existing = await this.repository.findMedia(input.provider, providerAssetId);
    if (existing) return existing;
    let asset = await this.repository.findCachedAsset(input.provider, providerAssetId, this.now());
    if (!asset)
      throw new AppError(
        409,
        "IMAGE_CACHE_MISS",
        "Kết quả tìm kiếm đã hết hạn. Hãy tìm lại ảnh trước khi chọn.",
      );
    const startedAt = Date.now();
    let processed;
    try {
      try {
        processed = await this.downloader.download(asset.downloadUrl, importProvider!.allowedDownloadHosts);
      } catch (error) {
        const upstreamStatus = error instanceof AppError && typeof error.details === "object" &&
          error.details && "upstreamStatus" in error.details
          ? Number((error.details as { upstreamStatus?: unknown }).upstreamStatus) : undefined;
        if (!(error instanceof AppError) || error.code !== "IMAGE_IMPORT_SOURCE_UNAVAILABLE" ||
            ![401, 403, 404, 410].includes(upstreamStatus ?? 0) || !importProvider?.resolveAsset)
          throw error;
        const refreshed = await this.coordinator.run(importProvider.name, () => importProvider.resolveAsset!(providerAssetId));
        if (!refreshed) throw error;
        asset = refreshed;
        processed = await this.downloader.download(asset.downloadUrl, importProvider.allowedDownloadHosts);
      }
    } catch (error) {
      console.warn(JSON.stringify({
        level: "warn", event: "vocabulary_media_import_failed", provider: input.provider,
        providerAssetId, stage: "download", upstreamStatus:
          error instanceof AppError && typeof error.details === "object" && error.details && "upstreamStatus" in error.details
            ? (error.details as { upstreamStatus?: unknown }).upstreamStatus : undefined,
        reasonCode: error instanceof AppError ? error.code : "UNEXPECTED",
        durationMs: Date.now() - startedAt,
      }));
      throw error;
    }
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
        thumbnailByteSize: processed.thumbnail.byteLength,
      }, actorUserId);
      if (!result.created)
        await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      return result.media;
    } catch (error) {
      await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      throw error;
    }
  }

  async uploadMedia(file: Express.Multer.File | undefined, altTextValue: unknown, actorUserId: number) {
    if (!Number.isInteger(actorUserId) || actorUserId < 1)
      throw new AppError(401, "UNAUTHORIZED", "Chưa xác thực.");
    if (!file)
      throw new AppError(422, "IMAGE_IMPORT_INVALID_CONTENT_TYPE", "Chưa chọn file ảnh.");
    const altText = String(altTextValue ?? "Ảnh từ máy").normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (altText.length < 1 || altText.length > 200)
      throw new AppError(400, "VALIDATION_ERROR", "Mô tả ảnh phải dài từ 1 đến 200 ký tự.");
    const processed = await processVocabularyImage(file.buffer, file.mimetype, this.settings);
    const existing = await this.repository.findMediaBySha(processed.contentSha256);
    if (existing) return existing;
    const providerAssetId = processed.contentSha256;
    const files = await this.storage.write(processed.game, processed.thumbnail);
    try {
      const result = await this.repository.createMedia({
        provider: "USER_UPLOAD",
        asset: {
          provider: "USER_UPLOAD", providerAssetId, previewUrl: "", thumbnailUrl: "", downloadUrl: "",
          width: processed.width, height: processed.height, mediaType: "PHOTO", tags: [],
          contributorName: "", contributorUrl: "", attributionText: "", sourcePageUrl: "", licenseLabel: "",
        },
        storagePath: files.storagePath, thumbnailPath: files.thumbnailPath, altText,
        byteSize: processed.byteSize, thumbnailByteSize: processed.thumbnail.byteLength,
        width: processed.width, height: processed.height, contentSha256: processed.contentSha256,
      }, actorUserId);
      if (!result.created) await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      return result.media;
    } catch (error) {
      await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      throw error;
    }
  }

  metrics() { return this.repository.metrics(); }

  async cleanupOrphans(maxAgeMs = 24 * 60 * 60 * 1_000): Promise<number> {
    const candidates = await this.repository.temporaryOrphans(new Date(this.now().getTime() - maxAgeMs));
    let removed = 0;
    for (const item of candidates) {
      if (!await this.repository.deleteUnreferenced(item.id)) continue;
      await this.storage.remove(this.storage.resolve(item.storagePath), this.storage.resolve(item.thumbnailPath));
      removed += 1;
    }
    return removed;
  }

  async reconcile() {
    const [rows, files] = await Promise.all([this.repository.activePaths(), this.storage.files()]);
    const disk = new Set(files);
    const tracked = new Set(rows.flatMap((row) => [row.storagePath, row.thumbnailPath]));
    const missingRowIds: number[] = [];
    const thumbnailSizes: Array<{ id: number; byteSize: number }> = [];
    for (const row of rows)
      if (!disk.has(row.storagePath) || !disk.has(row.thumbnailPath)) missingRowIds.push(row.id);
      else thumbnailSizes.push({ id: row.id, byteSize: await this.storage.size(row.thumbnailPath) });
    await Promise.all([
      this.repository.markMissingFiles(missingRowIds),
      this.repository.updateThumbnailSizes(thumbnailSizes),
    ]);
    return { missingFileMediaIds: missingRowIds, untrackedFiles: files.filter((file) => !tracked.has(file)) };
  }

  async mediaFile(id: number, variant: string | undefined) {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    if (variant != null && !["GAME", "THUMBNAIL"].includes(variant))
      throw new AppError(400, "VALIDATION_ERROR", "Phiên bản ảnh không hợp lệ.");
    const record = await this.repository.findMediaRecord(id);
    if (!record)
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    const relativePath = variant === "THUMBNAIL" ? record.thumbnailPath : record.storagePath;
    try {
      if (!await this.storage.exists(relativePath)) throw new Error("Vocabulary media file missing");
      return {
        path: this.storage.resolve(relativePath),
        media: record.media,
      };
    } catch {
      console.warn(JSON.stringify({
        level: "warn", event: "vocabulary_media_file_failed", mediaId: id,
        relativePath, errorCode: "VOCABULARY_MEDIA_FILE_UNAVAILABLE",
      }));
      throw new AppError(404, "VOCABULARY_MEDIA_NOT_FOUND", "Không tìm thấy ảnh.");
    }
  }

  providerStatus() {
    const cooldownUntil = this.provider ? this.coordinator.cooldownUntil(this.provider.name) : null;
    return {
      enabled: Boolean(this.settings.enabled && this.provider),
      provider: "PIXABAY" as const,
      ...(cooldownUntil ? { cooldownUntil: cooldownUntil.toISOString() } : {}),
      providers: this.registry.status(),
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
