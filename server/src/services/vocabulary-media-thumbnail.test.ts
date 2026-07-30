import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import sharp from "sharp";
import { VocabularyMediaController } from "../controllers/vocabulary-media.controller";
import { errorHandler } from "../middleware/error-handler";
import type { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { asyncHandler } from "../utils/async-handler";
import { SecureImageDownloader } from "./secure-image-downloader";
import { VocabularyMediaService } from "./vocabulary-media.service";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";

test("provider import 201 serves a non-empty decodable thumbnail from the same storage root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "media-thumbnail-"));
  const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#38bdf8" } }).png().toBuffer();
  let stored: { storagePath: string; thumbnailPath: string } | undefined;
  const media = {
    id: 77, provider: "PIXABAY" as const, providerAssetId: "asset-77",
    url: "/api/public/vocabulary-media/77?variant=GAME",
    thumbnailUrl: "/api/public/vocabulary-media/77?variant=THUMBNAIL",
    width: 1024, height: 683, mimeType: "image/webp" as const, byteSize: 1,
    altText: "plane", contributorName: "test", attributionText: "test",
    sourcePageUrl: "https://pixabay.com/test", licenseLabel: "test",
  };
  const repository = {
    findMedia: async () => null,
    findCachedAsset: async () => ({
      provider: "PIXABAY", providerAssetId: "asset-77",
      previewUrl: "https://cdn.pixabay.com/preview.png", thumbnailUrl: "https://cdn.pixabay.com/thumb.png",
      downloadUrl: "https://cdn.pixabay.com/source.png", width: 1200, height: 800,
      mediaType: "PHOTO", tags: ["plane"], contributorName: "test", contributorUrl: "",
      attributionText: "test", sourcePageUrl: "https://pixabay.com/test", licenseLabel: "test",
    }),
    createMedia: async (input: { storagePath: string; thumbnailPath: string }) => {
      stored = { storagePath: input.storagePath, thumbnailPath: input.thumbnailPath };
      return { media, created: true };
    },
    findMediaRecord: async () => stored ? { media, ...stored } : null,
  } as unknown as VocabularyMediaRepository;
  const settings = {
    enabled: true, arasaacEnabled: false, pixabayEnabled: true, pixabayApiKey: "test",
    storagePath: root, cacheTtlMs: 86_400_000,
    timeoutMs: 2_000, maxBytes: 5 * 1024 * 1024, maxRedirects: 2,
    minDimension: 256, maxDimension: 4096, maxPixels: 16_000_000,
  };
  const provider = {
    name: "PIXABAY" as const, allowedDownloadHosts: ["cdn.pixabay.com"],
    search: async () => ({ total: 0, items: [] }),
  };
  const storage = new VocabularyMediaStorage(root);
  const downloader = new SecureImageDownloader(settings, async () => new Response(source as unknown as BodyInit, {
    status: 200, headers: { "content-type": "image/png", "content-length": String(source.byteLength) },
  }));
  const service = new VocabularyMediaService(repository, provider, settings, downloader, storage);
  const controller = new VocabularyMediaController(service);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { id: 1, username: "test", displayName: "Test", role: "TEACHER" };
    req.requestId = "thumbnail-test";
    next();
  });
  app.post("/api/vocabulary/media/import", asyncHandler(controller.import));
  app.get("/api/public/vocabulary-media/:mediaId", asyncHandler(controller.serve));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const imported = await fetch(`http://127.0.0.1:${port}/api/vocabulary/media/import`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "PIXABAY", providerAssetId: "asset-77", altText: "plane" }),
    });
    assert.equal(imported.status, 201);
    assert.equal((await imported.json() as { data: { id: number } }).data.id, 77);
    assert.ok(stored);
    const gamePath = storage.resolve(stored!.storagePath);
    const thumbnailPath = storage.resolve(stored!.thumbnailPath);
    assert.ok(gamePath.startsWith(`${path.resolve(root)}${path.sep}`));
    assert.ok(thumbnailPath.startsWith(`${path.resolve(root)}${path.sep}`));
    await Promise.all([fs.access(gamePath), fs.access(thumbnailPath)]);
    const thumbnail = await fetch(`http://127.0.0.1:${port}/api/public/vocabulary-media/77?variant=THUMBNAIL`);
    assert.equal(thumbnail.status, 200);
    assert.equal(thumbnail.headers.get("content-type"), "image/webp");
    const body = Buffer.from(await thumbnail.arrayBuffer());
    assert.ok(body.byteLength > 0);
    assert.equal((await sharp(body).metadata()).format, "webp");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(root, { recursive: true, force: true });
  }
});
