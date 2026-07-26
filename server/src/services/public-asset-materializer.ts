import type {
  AssignmentVocabularyItemInput,
  VocabularyStoredMedia,
} from "@teacher/shared";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "../errors/app-error";
import { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";

export class PublicAssetMaterializer {
  private readonly root: string;

  constructor(
    root: string,
    private readonly media: VocabularyMediaRepository,
    private readonly storage: VocabularyMediaStorage,
  ) {
    this.root = path.resolve(root);
  }

  async materializeItems(
    items: AssignmentVocabularyItemInput[],
    actorUserId: number,
  ): Promise<AssignmentVocabularyItemInput[]> {
    const result: AssignmentVocabularyItemInput[] = [];
    for (const item of items) {
      if (item.illustration.kind !== "PUBLIC_ASSET") {
        result.push(item);
        continue;
      }
      const sourcePath = item.illustration.value ?? "";
      const stored = await this.materialize(sourcePath, `${item.word} — ${item.meaningVi}`, actorUserId);
      result.push({
        ...item,
        illustration: { kind: "STORED_MEDIA", mediaId: stored.id },
      });
    }
    return result;
  }

  async materialize(
    publicPath: string,
    altText: string,
    actorUserId: number,
  ): Promise<VocabularyStoredMedia> {
    if (!/^\/learning\/[A-Za-z0-9_./-]+\.(svg|png|jpe?g|webp)$/i.test(publicPath))
      throw new AppError(422, "VALIDATION_ERROR", "Ảnh Unit không nằm trong allowlist.");
    const absolute = path.resolve(this.root, `.${publicPath}`);
    if (!absolute.startsWith(`${this.root}${path.sep}`))
      throw new AppError(422, "VALIDATION_ERROR", "Đường dẫn ảnh Unit không an toàn.");
    let source: Buffer;
    try {
      source = await fs.readFile(absolute);
    } catch {
      throw new AppError(422, "VALIDATION_ERROR", "Không tìm thấy ảnh Unit cần materialize.");
    }
    if (source.byteLength > 5 * 1024 * 1024)
      throw new AppError(422, "IMAGE_IMPORT_REJECTED", "Ảnh Unit vượt quá 5 MiB.");
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(source, { limitInputPixels: 16_000_000 }).metadata();
    } catch {
      throw new AppError(422, "IMAGE_IMPORT_REJECTED", "Ảnh Unit không hợp lệ.");
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 1 || height < 1 || width > 4096 || height > 4096 ||
        width * height > 16_000_000)
      throw new AppError(422, "IMAGE_IMPORT_REJECTED", "Kích thước ảnh Unit không hợp lệ.");
    const [game, thumbnail] = await Promise.all([
      sharp(source).rotate().resize(1024, 1024, {
        fit: "inside",
        withoutEnlargement: true,
      }).webp({ quality: 82 }).toBuffer(),
      sharp(source).rotate().resize(320, 320, {
        fit: "cover",
        position: "attention",
      }).webp({ quality: 76 }).toBuffer(),
    ]);
    const gameMetadata = await sharp(game).metadata();
    const contentSha256 = createHash("sha256").update(game).digest("hex");
    const assetId = createHash("sha256").update(publicPath).digest("hex");
    const existing = await this.media.findMedia("LOCAL_ASSET", assetId) ??
      await this.media.findMediaBySha(contentSha256);
    if (existing) return existing;
    const files = await this.storage.write(game, thumbnail);
    try {
      const created = await this.media.createMedia({
        provider: "LOCAL_ASSET",
        asset: {
          provider: "LOCAL_ASSET",
          providerAssetId: assetId,
          previewUrl: publicPath,
          thumbnailUrl: publicPath,
          downloadUrl: publicPath,
          width,
          height,
          mediaType: "ILLUSTRATION",
          contributorName: "Lớp học cô Vy",
          contributorUrl: publicPath,
          attributionText: "Nội dung nội bộ Lớp học cô Vy",
          sourcePageUrl: publicPath,
          licenseLabel: "Nội dung nội bộ",
        },
        storagePath: files.storagePath,
        thumbnailPath: files.thumbnailPath,
        altText: altText.slice(0, 200),
        byteSize: game.byteLength,
        width: gameMetadata.width ?? width,
        height: gameMetadata.height ?? height,
        contentSha256,
      }, actorUserId);
      if (!created.created)
        await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      return created.media;
    } catch (error) {
      await this.storage.remove(files.absoluteStoragePath, files.absoluteThumbnailPath);
      throw error;
    }
  }
}
