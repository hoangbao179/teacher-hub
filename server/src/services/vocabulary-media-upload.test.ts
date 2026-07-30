import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import { processVocabularyImage } from "./secure-image-downloader";
import { VocabularyMediaService } from "./vocabulary-media.service";
import type { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";

const settings: VocabularyMediaSettings = {
  enabled: true, arasaacEnabled: false, pixabayEnabled: true, pixabayApiKey: "test",
  storagePath: "unused", cacheTtlMs: 86_400_000,
  timeoutMs: 15_000, maxBytes: 5 * 1024 * 1024, maxRedirects: 2,
  minDimension: 256, maxDimension: 4096, maxPixels: 16_000_000,
};

test("user upload rejects a fake MIME and creates two metadata-free WebP renditions", async () => {
  const source = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#2563eb" } })
    .withMetadata({ orientation: 6 }).png().toBuffer();
  await assert.rejects(processVocabularyImage(source, "image/jpeg", settings),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_CONTENT_MISMATCH");
  const result = await processVocabularyImage(source, "image/png", settings);
  const [game, thumbnail] = await Promise.all([sharp(result.game).metadata(), sharp(result.thumbnail).metadata()]);
  assert.equal(game.format, "webp");
  assert.equal(thumbnail.format, "webp");
  assert.equal(thumbnail.width, 320);
  assert.equal(game.exif, undefined);
  assert.equal(thumbnail.exif, undefined);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
});

test("user upload deduplicates by processed SHA-256 before writing files", async () => {
  const source = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#fff" } }).png().toBuffer();
  const existing = { id: 9, provider: "USER_UPLOAD", providerAssetId: "sha", url: "/media/9", thumbnailUrl: "/thumb/9",
    width: 300, height: 300, mimeType: "image/webp", byteSize: 10, altText: "existing",
    contributorName: "", attributionText: "", sourcePageUrl: "", licenseLabel: "" } as const;
  let createCalls = 0;
  const repository = {
    findMediaBySha: async () => existing,
    createMedia: async () => { createCalls += 1; throw new Error("must not create"); },
  } as unknown as VocabularyMediaRepository;
  const service = new VocabularyMediaService(repository, null, settings);
  const result = await service.uploadMedia({ buffer: source, mimetype: "image/png" } as Express.Multer.File, "upload", 1);
  assert.equal(result.id, existing.id);
  assert.equal(createCalls, 0);
});
