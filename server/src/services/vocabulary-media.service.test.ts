import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderImageAsset } from "../integrations/images/image-search.provider";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import {
  normalizeImageQuery,
  VocabularyMediaService,
} from "./vocabulary-media.service";

const settings: VocabularyMediaSettings = {
  enabled: true,
  apiKey: "test",
  storagePath: "unused",
  cacheTtlMs: 86_400_000,
  timeoutMs: 500,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 2,
  minDimension: 256,
  maxDimension: 4096,
  maxPixels: 16_000_000,
};

const asset: ProviderImageAsset = {
  provider: "PIXABAY",
  providerAssetId: "42",
  previewUrl: "https://cdn.pixabay.com/preview.jpg",
  thumbnailUrl: "https://cdn.pixabay.com/thumb.jpg",
  downloadUrl: "https://cdn.pixabay.com/large.jpg",
  width: 800,
  height: 600,
  mediaType: "PHOTO",
  tags: ["apple"],
  contributorName: "Teacher",
  contributorUrl: "https://pixabay.com/users/teacher-7/",
  attributionText: "Pixabay attribution",
  sourcePageUrl: "https://pixabay.com/photos/example-42/",
  licenseLabel: "Pixabay Content License",
};

function makeService(options: {
  enabled?: boolean;
  cached?: boolean;
  existing?: boolean;
  now?: Date;
  createFailure?: boolean;
  backupLocked?: boolean;
} = {}) {
  let providerCalls = 0;
  let savedCache: unknown;
  let removed = false;
  const cached = options.cached
    ? {
        payload: { total: 1, items: [asset] },
        expiresAt: new Date("2026-07-27T00:00:00Z"),
      }
    : null;
  const repository = {
    findCache: async () => cached,
    saveCache: async (value: unknown) => { savedCache = value; },
    findMedia: async () => options.existing ? {
      id: 9,
      url: "/api/public/vocabulary-media/9",
      thumbnailUrl: "/api/public/vocabulary-media/9?variant=THUMBNAIL",
      width: 800,
      height: 600,
      altText: "apple",
      attributionText: asset.attributionText,
      sourcePageUrl: asset.sourcePageUrl,
    } : null,
    findCachedAsset: async () => options.cached ? asset : null,
    createMedia: async () => {
      if (options.createFailure) throw new Error("metadata failure");
      return ({
      created: true,
      media: {
        id: 10,
        url: "/api/public/vocabulary-media/10",
        thumbnailUrl: "/api/public/vocabulary-media/10?variant=THUMBNAIL",
        width: 300,
        height: 300,
        altText: "apple",
        attributionText: asset.attributionText,
        sourcePageUrl: asset.sourcePageUrl,
      },
      });
    },
  };
  const provider = {
    name: "PIXABAY" as const,
    allowedDownloadHosts: ["cdn.pixabay.com"] as const,
    search: async (input: { safeSearch: true }) => {
      providerCalls += 1;
      assert.equal(input.safeSearch, true);
      return { total: 1, items: [asset] };
    },
  };
  const downloader = {
    download: async (url: string) => {
      assert.equal(url, asset.downloadUrl);
      return {
        game: Buffer.from("game"),
        thumbnail: Buffer.from("thumbnail"),
        width: 300,
        height: 300,
        byteSize: 4,
        contentSha256: "a".repeat(64),
      };
    },
  };
  const storage = {
    initialize: async () => undefined,
    backupLocked: async () => options.backupLocked ?? false,
    write: async () => ({
      storagePath: "game/test.webp",
      thumbnailPath: "thumbnail/test.webp",
      absoluteStoragePath: "C:/media/game/test.webp",
      absoluteThumbnailPath: "C:/media/thumbnail/test.webp",
    }),
    remove: async () => { removed = true; },
    resolve: (value: string) => value,
  };
  const service = new VocabularyMediaService(
    repository as never,
    options.enabled === false ? null : provider,
    { ...settings, enabled: options.enabled !== false },
    downloader as never,
    storage as never,
    () => options.now ?? new Date("2026-07-26T00:00:00Z"),
  );
  return {
    service,
    providerCalls: () => providerCalls,
    savedCache: () => savedCache,
    removed: () => removed,
  };
}

test("image query normalization is deterministic", () => {
  assert.equal(normalizeImageQuery("  RED   Apple  "), "red apple");
  assert.equal(normalizeImageQuery("ＡＰＰＬＥ"), "apple");
});

test("disabled provider returns a controlled status and error", async () => {
  const { service } = makeService({ enabled: false });
  assert.equal(service.providerStatus().enabled, false);
  await assert.rejects(
    service.search({ query: "apple" }),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_PROVIDER_DISABLED",
  );
});

test("media import pauses while a consistent recovery set is being created", async () => {
  const { service } = makeService({ backupLocked: true, cached: true });
  await assert.rejects(
    service.importMedia({
      provider: "PIXABAY", providerAssetId: "42", altText: "quả táo",
    }, 1),
    (error: unknown) =>
      (error as { code?: string }).code === "VOCABULARY_MEDIA_BACKUP_IN_PROGRESS",
  );
});

test("search uses cache, or persists a 24-hour safe result on miss", async () => {
  const hit = makeService({ cached: true });
  const hitResult = await hit.service.search({ query: "  APPLE " });
  assert.equal(hit.providerCalls(), 0);
  assert.equal(hitResult.safeSearch, true);
  assert.equal("downloadUrl" in hitResult.items[0], false);

  const miss = makeService();
  const missResult = await miss.service.search({ query: "Apple" });
  assert.equal(miss.providerCalls(), 1);
  assert.ok(miss.savedCache());
  assert.equal(missResult.cacheExpiresAt, "2026-07-27T00:00:00.000Z");
});

test("import rejects assets absent from valid cache and deduplicates existing media", async () => {
  const absent = makeService();
  await assert.rejects(
    absent.service.importMedia({
      provider: "PIXABAY",
      providerAssetId: "42",
      altText: "apple",
    }, 1),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_CACHE_MISS",
  );

  const existing = makeService({ existing: true });
  const media = await existing.service.importMedia({
    provider: "PIXABAY",
    providerAssetId: "42",
    altText: "apple",
  }, 1);
  assert.equal(media.id, 9);
  assert.equal(existing.removed(), false);
});

test("import takes only provider and asset id from a valid cached result", async () => {
  const value = makeService({ cached: true });
  const media = await value.service.importMedia({
    provider: "PIXABAY",
    providerAssetId: "42",
    altText: "red apple",
  }, 1);
  assert.equal(media.id, 10);
});

test("metadata rollback removes both newly written renditions", async () => {
  const value = makeService({ cached: true, createFailure: true });
  await assert.rejects(value.service.importMedia({
    provider: "PIXABAY",
    providerAssetId: "42",
    altText: "red apple",
  }, 1), /metadata failure/);
  assert.equal(value.removed(), true);
});
