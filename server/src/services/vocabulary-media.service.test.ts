import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../errors/app-error";
import {
  StaticImageProviderRegistry,
  type ProviderImageAsset,
} from "../integrations/images/image-search.provider";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import {
  normalizeImageQuery,
  VocabularyMediaService,
} from "./vocabulary-media.service";

const settings: VocabularyMediaSettings = {
  enabled: true,
  arasaacEnabled: false,
  pixabayEnabled: true,
  pixabayApiKey: "test",
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
  providerError?: Error;
} = {}) {
  let providerCalls = 0;
  let providerInput: unknown;
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
      providerInput = input;
      assert.equal(input.safeSearch, true);
      if (options.providerError) throw options.providerError;
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
    providerInput: () => providerInput,
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

test("search forwards page and defaults to eight results per page", async () => {
  const value = makeService();
  const result = await value.service.search({ query: "Apple", page: 2, pageSize: 8 });
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 8);
  assert.deepEqual(value.providerInput(), {
    query: "apple",
    page: 2,
    pageSize: 8,
    mediaType: "ALL",
    orientation: "ALL",
    safeSearch: true,
  });

  const defaults = makeService();
  assert.equal((await defaults.service.search({ query: "Pear" })).pageSize, 8);
});

test("provider rate limits remain distinct and preserve retry timing", async () => {
  const value = makeService({ providerError: new AppError(
    429, "IMAGE_PROVIDER_RATE_LIMITED", "limited", { remaining: 0 }, 9,
  ) });
  await assert.rejects(value.service.search({ query: "bird cartoon isolated" }),
    (error: unknown) => error instanceof AppError &&
      error.code === "IMAGE_PROVIDER_RATE_LIMITED" && error.retryAfterSeconds === 9);
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

test("search selects ARASAAC for illustration/all and Pixabay for photos", async () => {
  const calls: string[] = [];
  const arasaacAsset: ProviderImageAsset = {
    ...asset,
    provider: "ARASAAC",
    providerAssetId: "84",
    previewUrl: "https://static.arasaac.org/pictograms/84/84_300.png",
    thumbnailUrl: "https://static.arasaac.org/pictograms/84/84_300.png",
    downloadUrl: "https://static.arasaac.org/pictograms/84/84_500.png",
    mediaType: "ILLUSTRATION",
  };
  const registry = new StaticImageProviderRegistry([
    {
      name: "ARASAAC",
      allowedDownloadHosts: ["static.arasaac.org"],
      supportedMediaTypes: ["ALL", "ILLUSTRATION"],
      search: async () => { calls.push("ARASAAC"); return { total: 1, items: [arasaacAsset] }; },
    },
    {
      name: "PIXABAY",
      allowedDownloadHosts: ["cdn.pixabay.com"],
      supportedMediaTypes: ["ALL", "PHOTO", "ILLUSTRATION", "VECTOR"],
      search: async () => { calls.push("PIXABAY"); return { total: 1, items: [asset] }; },
    },
  ]);
  const repository = {
    findCache: async () => null,
    saveCache: async () => undefined,
  };
  const service = new VocabularyMediaService(
    repository as never,
    registry,
    { ...settings, arasaacEnabled: true },
    undefined,
    { initialize: async () => undefined } as never,
  );

  assert.equal((await service.search({ query: "apple", mediaType: "ILLUSTRATION" })).provider, "ARASAAC");
  assert.equal((await service.search({ query: "apple", mediaType: "ALL" })).provider, "ARASAAC");
  assert.equal((await service.search({ query: "apple", mediaType: "PHOTO" })).provider, "PIXABAY");
  assert.deepEqual(calls, ["ARASAAC", "ARASAAC", "PIXABAY"]);
  assert.deepEqual(service.providerStatus().providers.map(({ provider, enabled }) => ({ provider, enabled })), [
    { provider: "ARASAAC", enabled: true },
    { provider: "PIXABAY", enabled: true },
  ]);
});

test("ARASAAC import resolves a cache miss and coalesces concurrent requests", async () => {
  const arasaacAsset: ProviderImageAsset = {
    ...asset,
    provider: "ARASAAC",
    previewUrl: "https://static.arasaac.org/pictograms/42/42_300.png",
    thumbnailUrl: "https://static.arasaac.org/pictograms/42/42_300.png",
    downloadUrl: "https://static.arasaac.org/pictograms/42/42_500.png",
    mediaType: "ILLUSTRATION",
  };
  let resolved = 0;
  let downloaded = 0;
  let written = 0;
  let created = 0;
  const media = {
    id: 17, provider: "ARASAAC" as const, providerAssetId: "42",
    url: "/api/public/vocabulary-media/17?variant=GAME",
    thumbnailUrl: "/api/public/vocabulary-media/17?variant=THUMBNAIL",
    width: 500, height: 500, mimeType: "image/webp" as const, byteSize: 4,
    altText: "apple", contributorName: "Sergio Palao / ARASAAC",
    attributionText: "ARASAAC", sourcePageUrl: "https://arasaac.org/pictograms/en/42",
    licenseLabel: "CC BY-NC-SA",
  };
  const repository = {
    findMedia: async () => null,
    findCachedAsset: async () => null,
    createMedia: async () => { created += 1; return { media, created: true }; },
  };
  const provider = {
    name: "ARASAAC" as const,
    allowedDownloadHosts: ["static.arasaac.org"] as const,
    supportedMediaTypes: ["ALL", "ILLUSTRATION"] as const,
    search: async () => ({ total: 0, items: [] }),
    resolveAsset: async () => { resolved += 1; return arasaacAsset; },
  };
  const downloader = {
    download: async (url: string, hosts: readonly string[], fit: string) => {
      downloaded += 1;
      assert.equal(url, arasaacAsset.downloadUrl);
      assert.deepEqual(hosts, ["static.arasaac.org"]);
      assert.equal(fit, "contain");
      return {
        game: Buffer.from("game"), thumbnail: Buffer.from("thumb"),
        width: 500, height: 500, byteSize: 4, contentSha256: "c".repeat(64),
      };
    },
  };
  const storage = {
    backupLocked: async () => false,
    write: async () => {
      written += 1;
      return {
        storagePath: "game/asset.webp", thumbnailPath: "thumbnail/asset.webp",
        absoluteStoragePath: "C:/media/game/asset.webp",
        absoluteThumbnailPath: "C:/media/thumbnail/asset.webp",
      };
    },
    remove: async () => undefined,
  };
  const service = new VocabularyMediaService(
    repository as never,
    provider,
    { ...settings, arasaacEnabled: true, pixabayEnabled: false },
    downloader as never,
    storage as never,
  );
  const request = { provider: "ARASAAC" as const, providerAssetId: "42", altText: "apple" };
  const [first, second] = await Promise.all([
    service.importMedia(request, 1),
    service.importMedia(request, 1),
  ]);
  assert.equal(first.id, 17);
  assert.equal(second.id, 17);
  assert.equal(resolved, 1);
  assert.equal(downloaded, 1);
  assert.equal(written, 1);
  assert.equal(created, 1);
});

test("ARASAAC rejects an invalid provider asset ID after resolver verification", async () => {
  const repository = {
    findMedia: async () => null,
    findCachedAsset: async () => null,
  };
  const provider = {
    name: "ARASAAC" as const,
    allowedDownloadHosts: ["static.arasaac.org"] as const,
    supportedMediaTypes: ["ALL", "ILLUSTRATION"] as const,
    search: async () => ({ total: 0, items: [] }),
    resolveAsset: async () => null,
  };
  const service = new VocabularyMediaService(
    repository as never,
    provider,
    { ...settings, arasaacEnabled: true, pixabayEnabled: false },
    undefined,
    { backupLocked: async () => false } as never,
  );
  await assert.rejects(
    service.importMedia({ provider: "ARASAAC", providerAssetId: "999", altText: "missing" }, 1),
    (error: unknown) => error instanceof AppError && error.code === "IMAGE_IMPORT_REJECTED",
  );
});
